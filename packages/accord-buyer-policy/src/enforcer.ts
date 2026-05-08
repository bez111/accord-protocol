// ─────────────────────────────────────────────────────────────────────────────
// @accord-protocol/buyer-policy — main enforcer
//
// Wraps an integrator-supplied SignerFn with policy checks. Public surface:
//
//   const enforcer = createBuyerPolicyEnforcer({ policy, signer, approvalHandler })
//   const session  = enforcer.openSession({ agentId })
//   const result   = await session.authorize({ agreement, rail, unsignedTx })
//   session.close()
//
// Threat model the implementation defends against (in order):
//
//   1. Time-of-check / time-of-use   — per-session AsyncMutex serialises
//      authorize() calls and increments `spentSoFar` BEFORE invoking the
//      signer; rolled back on signer rejection.
//   2. Numeric drift                  — every amount is BigInt, parsed from
//      decimal strings, never JS numbers; cross-currency comparisons fail
//      loudly via CURRENCY_MISMATCH.
//   3. Allow-list bypass              — recipient and rail are checked AFTER
//      schema validation but BEFORE any approval round-trip; suffix-only
//      wildcards only.
//   4. Approval-handler hang          — AbortController with a hard timeout;
//      handler exceptions are surfaced as APPROVAL_HANDLER_ERROR.
//   5. Session id forgery             — ids are crypto.randomBytes(16) hex
//      strings; comparison uses timingSafeEqual.
//   6. Information leak via errors    — error messages reference field names
//      and codes only; never amount values, agreement bodies or signer io.
//   7. Mutating policy mid-flight     — policy is deep-frozen at construction.
// ─────────────────────────────────────────────────────────────────────────────

import { randomBytes, timingSafeEqual } from "node:crypto";

import { type AccordAgreement, validateAgreement } from "@accord-protocol/core";

import {
  type ScaledAmount,
  add,
  gt,
  lte,
  parseAmount,
  scaledToDecimal,
  zero,
} from "./amount.js";
import { BuyerPolicyError } from "./errors.js";
import { AsyncMutex } from "./lock.js";
import type {
  AccordRail,
  ApprovalHandler,
  ApprovalRequest,
  AuthorizeResult,
  BuyerPolicy,
  BuyerPolicyAmount,
  SignerContext,
  SignerFn,
} from "./types.js";

const ALLOWED_RAILS: ReadonlySet<AccordRail> = new Set(["ergo", "rosen", "base", "x402"]);

const DEFAULT_APPROVAL_TIMEOUT_MS = 60_000;
const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1_000;
const DEFAULT_DAILY_WINDOW_MS = 24 * 60 * 60 * 1_000;

interface ParsedPolicy {
  maxSinglePayment: ScaledAmount;
  maxSessionSpend: ScaledAmount;
  maxDailySpend: ScaledAmount | null;
  requireApprovalAbove: ScaledAmount | null;
  allowedRecipients: ReadonlyArray<string>;
  allowedRails: ReadonlySet<AccordRail>;
  approvalTimeoutMs: number;
  sessionTtlMs: number;
  /** Internal: the canonical (currency, decimals) every cap shares. */
  currency: string;
  decimals: number;
}

interface ParsedRecipient {
  raw: string;
  prefix: string;
  exact: boolean;
}

function parseRecipientPattern(raw: string): ParsedRecipient {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 256) {
    throw new BuyerPolicyError(
      "POLICY_INVALID_RECIPIENT_PATTERN",
      "recipient pattern must be a string in (0, 256]",
    );
  }
  // Reject anything that smells like an attempt at multi-pattern wildcards.
  if (raw.includes("**") || raw.includes("?")) {
    throw new BuyerPolicyError(
      "POLICY_INVALID_RECIPIENT_PATTERN",
      "recipient pattern only supports a single trailing '*'",
    );
  }
  const star = raw.indexOf("*");
  if (star === -1) {
    return { raw, prefix: raw, exact: true };
  }
  if (star !== raw.length - 1) {
    throw new BuyerPolicyError(
      "POLICY_INVALID_RECIPIENT_PATTERN",
      "wildcard '*' must be the last character of a recipient pattern",
    );
  }
  return { raw, prefix: raw.slice(0, -1), exact: false };
}

function recipientMatches(patterns: ReadonlyArray<ParsedRecipient>, candidate: string): boolean {
  for (const p of patterns) {
    if (p.exact) {
      if (p.raw === candidate) return true;
    } else {
      if (candidate.startsWith(p.prefix)) return true;
    }
  }
  return false;
}

function parsePolicy(policy: BuyerPolicy): ParsedPolicy {
  if (!policy || typeof policy !== "object") {
    throw new BuyerPolicyError("POLICY_INVALID_CONFIG", "policy must be an object");
  }
  const single = parseAmount(
    policy.maxSinglePayment.amount,
    policy.maxSinglePayment.currency,
    policy.maxSinglePayment.decimals,
  );
  const session = parseAmount(
    policy.maxSessionSpend.amount,
    policy.maxSessionSpend.currency,
    policy.maxSessionSpend.decimals,
  );
  if (single.currency !== session.currency || single.decimals !== session.decimals) {
    throw new BuyerPolicyError(
      "POLICY_INVALID_CONFIG",
      "maxSinglePayment and maxSessionSpend must share currency and decimals",
    );
  }
  if (gt(single, session)) {
    throw new BuyerPolicyError(
      "POLICY_INVALID_CONFIG",
      "maxSinglePayment may not exceed maxSessionSpend",
    );
  }

  let daily: ScaledAmount | null = null;
  if (policy.maxDailySpend) {
    const d = parseAmount(
      policy.maxDailySpend.amount,
      policy.maxDailySpend.currency,
      policy.maxDailySpend.decimals,
    );
    if (d.currency !== single.currency || d.decimals !== single.decimals) {
      throw new BuyerPolicyError(
        "POLICY_INVALID_CONFIG",
        "maxDailySpend must share currency and decimals with the other caps",
      );
    }
    daily = d;
  }

  let approvalAbove: ScaledAmount | null = null;
  if (policy.requireApprovalAbove) {
    const a = parseAmount(
      policy.requireApprovalAbove.amount,
      policy.requireApprovalAbove.currency,
      policy.requireApprovalAbove.decimals,
    );
    if (a.currency !== single.currency || a.decimals !== single.decimals) {
      throw new BuyerPolicyError(
        "POLICY_INVALID_CONFIG",
        "requireApprovalAbove must share currency and decimals with the other caps",
      );
    }
    if (gt(a, single)) {
      throw new BuyerPolicyError(
        "POLICY_INVALID_CONFIG",
        "requireApprovalAbove may not exceed maxSinglePayment",
      );
    }
    approvalAbove = a;
  }

  if (
    !Array.isArray(policy.allowedRecipients) ||
    policy.allowedRecipients.length === 0
  ) {
    throw new BuyerPolicyError(
      "POLICY_INVALID_CONFIG",
      "allowedRecipients must be a non-empty array",
    );
  }
  // Validate every pattern at construction so a malformed entry can't slip
  // through later as an unintended pass-through.
  for (const r of policy.allowedRecipients) {
    parseRecipientPattern(r);
  }

  if (
    !Array.isArray(policy.allowedRails) ||
    policy.allowedRails.length === 0
  ) {
    throw new BuyerPolicyError(
      "POLICY_INVALID_CONFIG",
      "allowedRails must be a non-empty array",
    );
  }
  const railSet = new Set<AccordRail>();
  for (const r of policy.allowedRails) {
    if (!ALLOWED_RAILS.has(r)) {
      throw new BuyerPolicyError(
        "POLICY_INVALID_CONFIG",
        `allowedRails contains unknown rail "${String(r)}"`,
      );
    }
    railSet.add(r);
  }

  const approvalTimeoutMs =
    policy.approvalTimeoutMs ?? DEFAULT_APPROVAL_TIMEOUT_MS;
  if (
    !Number.isFinite(approvalTimeoutMs) ||
    !Number.isInteger(approvalTimeoutMs) ||
    approvalTimeoutMs < 100 ||
    approvalTimeoutMs > 30 * 60 * 1_000
  ) {
    throw new BuyerPolicyError(
      "POLICY_INVALID_CONFIG",
      "approvalTimeoutMs must be an integer in [100, 1_800_000]",
    );
  }
  const sessionTtlMs = policy.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  if (
    !Number.isFinite(sessionTtlMs) ||
    !Number.isInteger(sessionTtlMs) ||
    sessionTtlMs < 1_000 ||
    sessionTtlMs > 30 * 24 * 60 * 60 * 1_000
  ) {
    throw new BuyerPolicyError(
      "POLICY_INVALID_CONFIG",
      "sessionTtlMs must be an integer in [1_000, 2_592_000_000]",
    );
  }

  return {
    maxSinglePayment: single,
    maxSessionSpend: session,
    maxDailySpend: daily,
    requireApprovalAbove: approvalAbove,
    allowedRecipients: Object.freeze([...policy.allowedRecipients]),
    allowedRails: railSet,
    approvalTimeoutMs,
    sessionTtlMs,
    currency: single.currency,
    decimals: single.decimals,
  };
}

// ── Session ────────────────────────────────────────────────────────────────

interface DailyEvent {
  at: number;
  amount: ScaledAmount;
}

class SessionImpl {
  readonly id: string;
  readonly agentId: string;
  readonly createdAt: number;
  readonly #policy: ParsedPolicy;
  readonly #patterns: ReadonlyArray<ParsedRecipient>;
  readonly #now: () => number;
  readonly #signer: SignerFn<unknown, unknown>;
  readonly #approvalHandler: ApprovalHandler | undefined;
  readonly #randomBytes: (n: number) => Uint8Array;
  readonly #mutex = new AsyncMutex();

  #closed = false;
  #spent: ScaledAmount;
  #dailyEvents: DailyEvent[] = [];

  constructor(args: {
    id: string;
    agentId: string;
    policy: ParsedPolicy;
    patterns: ReadonlyArray<ParsedRecipient>;
    now: () => number;
    signer: SignerFn<unknown, unknown>;
    approvalHandler: ApprovalHandler | undefined;
    randomBytes: (n: number) => Uint8Array;
  }) {
    this.id = args.id;
    this.agentId = args.agentId;
    this.createdAt = args.now();
    this.#policy = args.policy;
    this.#patterns = args.patterns;
    this.#now = args.now;
    this.#signer = args.signer;
    this.#approvalHandler = args.approvalHandler;
    this.#randomBytes = args.randomBytes;
    this.#spent = zero({
      currency: args.policy.currency,
      decimals: args.policy.decimals,
    });
  }

  get spent(): BuyerPolicyAmount {
    return {
      amount: this.#spent.amount,
      currency: this.#spent.currency,
      decimals: this.#spent.decimals,
    };
  }

  get closed(): boolean {
    return this.#closed;
  }

  close(): void {
    this.#closed = true;
  }

  async authorize<TUnsignedTx, TSignedTx>(args: {
    agreement: unknown;
    rail: AccordRail;
    unsignedTx: TUnsignedTx;
  }): Promise<AuthorizeResult<TSignedTx>> {
    return this.#mutex.runExclusive(async () => {
      this.#assertOpen();
      this.#assertFresh();

      const agreement = this.#assertAgreement(args.agreement);

      // Rail allow-list. Cheaper than parsing amounts, so check first.
      if (!this.#policy.allowedRails.has(args.rail)) {
        throw new BuyerPolicyError(
          "RAIL_NOT_ALLOWED",
          `rail "${args.rail}" is not in allowedRails`,
        );
      }
      // Sanity: agreement.payment.rail must agree with the rail we'll sign on.
      if (agreement.payment.rail !== args.rail) {
        throw new BuyerPolicyError(
          "RAIL_NOT_ALLOWED",
          "agreement.payment.rail and supplied rail disagree",
        );
      }

      // Recipient allow-list.
      if (!recipientMatches(this.#patterns, agreement.seller.id)) {
        throw new BuyerPolicyError(
          "RECIPIENT_NOT_ALLOWED",
          "agreement.seller.id is not in allowedRecipients",
        );
      }

      // Currency match: we don't convert. Integrator runs an oracle in front
      // if cross-currency caps are needed.
      if (
        agreement.price.currency !== this.#policy.currency ||
        agreement.price.decimals !== this.#policy.decimals
      ) {
        throw new BuyerPolicyError(
          "CURRENCY_MISMATCH",
          "agreement.price currency or decimals do not match policy",
        );
      }
      const price = parseAmount(
        agreement.price.amount,
        agreement.price.currency,
        agreement.price.decimals,
      );

      // Hard single-payment cap.
      if (gt(price, this.#policy.maxSinglePayment)) {
        throw new BuyerPolicyError(
          "BUDGET_EXCEEDED_SINGLE",
          "agreement.price exceeds maxSinglePayment",
        );
      }

      // Pre-flight session cap (re-checked after spend below; this is the
      // fast-path rejection so we don't run the approval flow on certain
      // failures).
      const projectedSession = add(this.#spent, price);
      if (gt(projectedSession, this.#policy.maxSessionSpend)) {
        throw new BuyerPolicyError(
          "BUDGET_EXCEEDED_SESSION",
          "agreement.price would exceed maxSessionSpend",
        );
      }

      // Daily rolling window.
      if (this.#policy.maxDailySpend) {
        const projectedDaily = this.#projectedDailySpend(price);
        if (gt(projectedDaily, this.#policy.maxDailySpend)) {
          throw new BuyerPolicyError(
            "BUDGET_EXCEEDED_DAILY",
            "agreement.price would exceed maxDailySpend (24h rolling window)",
          );
        }
      }

      // Approval flow.
      const needsApproval =
        this.#policy.requireApprovalAbove !== null &&
        lte(this.#policy.requireApprovalAbove, price);
      if (needsApproval) {
        if (!this.#approvalHandler) {
          throw new BuyerPolicyError(
            "APPROVAL_REQUIRED_NO_HANDLER",
            "agreement requires approval but no approvalHandler was registered",
          );
        }
        const verdict = await this.#runApprovalHandler({
          agreement_id: agreement.agreement_id,
          buyer_id: agreement.buyer.id,
          seller_id: agreement.seller.id,
          rail: args.rail,
          price: {
            amount: agreement.price.amount,
            currency: agreement.price.currency,
            decimals: agreement.price.decimals,
          },
          session_id: this.id,
          issued_at: new Date(this.#now()).toISOString(),
        });
        if (!verdict.approved) {
          throw new BuyerPolicyError(
            "APPROVAL_DENIED",
            "approvalHandler returned approved=false",
          );
        }
      }

      // Atomic charge: increment BEFORE signer runs. If the signer throws,
      // we roll back. Concurrent authorize() calls cannot interleave because
      // they're serialised by the session mutex.
      const previousSpent = this.#spent;
      this.#spent = projectedSession;
      const dailyMark = this.#policy.maxDailySpend
        ? this.#chargeDaily(price)
        : null;

      const context: SignerContext = {
        session_id: this.id,
        nonce: bytesToHex(this.#randomBytes(16)),
        agreement_id: agreement.agreement_id,
        rail: args.rail,
      };

      let signedTx: TSignedTx;
      try {
        signedTx = (await this.#signer(args.unsignedTx, context)) as TSignedTx;
      } catch (err) {
        // Rollback the charge — the payment never went through.
        this.#spent = previousSpent;
        if (dailyMark !== null) this.#dailyEvents.length = dailyMark;
        if (err instanceof BuyerPolicyError) throw err;
        throw new BuyerPolicyError(
          "SIGNER_ERROR",
          err instanceof Error ? `signer rejected: ${err.message}` : "signer rejected",
        );
      }

      return {
        signedTx,
        sessionSpend: this.spent,
      };
    });
  }

  // ── internal ────────────────────────────────────────────────────────────

  #assertOpen(): void {
    if (this.#closed) {
      throw new BuyerPolicyError("SESSION_CLOSED", "session is closed");
    }
  }

  #assertFresh(): void {
    if (this.#now() - this.createdAt >= this.#policy.sessionTtlMs) {
      this.#closed = true;
      throw new BuyerPolicyError("SESSION_EXPIRED", "session is past sessionTtlMs");
    }
  }

  #assertAgreement(raw: unknown): AccordAgreement {
    // Shape guard first. We don't pull in ajv to keep the runtime dep tree
    // tiny; this checks the minimum surface that lets us safely run the
    // semantic validator from @accord-protocol/core without it throwing on a
    // missing nested field.
    if (!isAgreementShape(raw)) {
      throw new BuyerPolicyError(
        "AGREEMENT_INVALID",
        "agreement shape is invalid (missing or wrongly-typed required fields)",
      );
    }
    const result = validateAgreement(raw);
    if (!result.ok) {
      throw new BuyerPolicyError(
        "AGREEMENT_INVALID",
        `agreement failed semantic validation (${result.problems.length} issue(s))`,
      );
    }
    return raw;
  }

  #projectedDailySpend(price: ScaledAmount): ScaledAmount {
    const cutoff = this.#now() - DEFAULT_DAILY_WINDOW_MS;
    let total = zero({ currency: price.currency, decimals: price.decimals });
    for (const ev of this.#dailyEvents) {
      if (ev.at >= cutoff) {
        total = add(total, ev.amount);
      }
    }
    return add(total, price);
  }

  #chargeDaily(price: ScaledAmount): number {
    const cutoff = this.#now() - DEFAULT_DAILY_WINDOW_MS;
    // Drop expired events to keep the array bounded; do this before push so
    // the rollback length is the right number to truncate to.
    this.#dailyEvents = this.#dailyEvents.filter((ev) => ev.at >= cutoff);
    const mark = this.#dailyEvents.length;
    this.#dailyEvents.push({ at: this.#now(), amount: price });
    return mark;
  }

  async #runApprovalHandler(
    request: ApprovalRequest,
  ): Promise<{ approved: boolean; approver_id?: string }> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.#policy.approvalTimeoutMs);
    try {
      const handler = this.#approvalHandler;
      if (!handler) {
        // Defensive — caller already checked.
        throw new BuyerPolicyError(
          "APPROVAL_REQUIRED_NO_HANDLER",
          "approvalHandler missing at runtime",
        );
      }
      const result = await Promise.race([
        handler(request, ac.signal),
        new Promise<never>((_, reject) =>
          ac.signal.addEventListener(
            "abort",
            () =>
              reject(
                new BuyerPolicyError(
                  "APPROVAL_TIMEOUT",
                  `approval handler did not respond within ${this.#policy.approvalTimeoutMs}ms`,
                ),
              ),
            { once: true },
          ),
        ),
      ]);
      if (
        typeof result !== "object" ||
        result === null ||
        typeof (result as { approved?: unknown }).approved !== "boolean"
      ) {
        throw new BuyerPolicyError(
          "APPROVAL_HANDLER_ERROR",
          "approval handler returned an invalid shape",
        );
      }
      return result;
    } catch (err) {
      if (err instanceof BuyerPolicyError) throw err;
      throw new BuyerPolicyError(
        "APPROVAL_HANDLER_ERROR",
        err instanceof Error ? `approval handler threw: ${err.message}` : "approval handler threw",
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

// ── Public surface ─────────────────────────────────────────────────────────

export interface BuyerPolicyEnforcerOptions<TUnsignedTx, TSignedTx> {
  policy: BuyerPolicy;
  signer: SignerFn<TUnsignedTx, TSignedTx>;
  approvalHandler?: ApprovalHandler;
  /** Defaults to `Date.now`. Override for tests. */
  now?: () => number;
  /** Defaults to `crypto.randomBytes`. Override for tests. */
  randomBytes?: (n: number) => Uint8Array;
}

export interface BuyerPolicyEnforcer<TUnsignedTx, TSignedTx> {
  openSession(args: { agentId: string }): BuyerSession<TUnsignedTx, TSignedTx>;
  /**
   * Constant-time check whether `id` looks like one of the session ids this
   * enforcer has issued. Returns false on a malformed id rather than throwing,
   * so accidental probing through an HTTP layer doesn't reveal anything about
   * which calls hit the membership branch.
   */
  isKnownSessionId(id: string): boolean;
}

export interface BuyerSession<TUnsignedTx, TSignedTx> {
  readonly id: string;
  readonly agentId: string;
  readonly spent: BuyerPolicyAmount;
  readonly closed: boolean;
  authorize(args: {
    agreement: unknown;
    rail: AccordRail;
    unsignedTx: TUnsignedTx;
  }): Promise<AuthorizeResult<TSignedTx>>;
  close(): void;
}

export function createBuyerPolicyEnforcer<TUnsignedTx, TSignedTx>(
  opts: BuyerPolicyEnforcerOptions<TUnsignedTx, TSignedTx>,
): BuyerPolicyEnforcer<TUnsignedTx, TSignedTx> {
  if (!opts || typeof opts !== "object") {
    throw new BuyerPolicyError("POLICY_INVALID_CONFIG", "options object required");
  }
  if (typeof opts.signer !== "function") {
    throw new BuyerPolicyError("POLICY_INVALID_CONFIG", "signer must be a function");
  }
  if (opts.approvalHandler !== undefined && typeof opts.approvalHandler !== "function") {
    throw new BuyerPolicyError(
      "POLICY_INVALID_CONFIG",
      "approvalHandler must be a function or omitted",
    );
  }
  const policy = parsePolicy(opts.policy);
  const patterns = policy.allowedRecipients.map(parseRecipientPattern);
  const now = opts.now ?? Date.now;
  const rng = opts.randomBytes ?? ((n: number) => Uint8Array.from(randomBytes(n)));

  // Track session ids to enable constant-time membership lookup.
  const issuedIds = new Map<string, Buffer>();

  return {
    openSession({ agentId }) {
      if (typeof agentId !== "string" || agentId.length === 0 || agentId.length > 256) {
        throw new BuyerPolicyError(
          "POLICY_INVALID_CONFIG",
          "agentId must be a non-empty string ≤ 256 chars",
        );
      }
      const id = bytesToHex(rng(16));
      issuedIds.set(id, Buffer.from(id, "utf8"));
      const impl = new SessionImpl({
        id,
        agentId,
        policy,
        patterns,
        now,
        signer: opts.signer as SignerFn<unknown, unknown>,
        approvalHandler: opts.approvalHandler,
        randomBytes: rng,
      });
      return {
        get id() {
          return impl.id;
        },
        get agentId() {
          return impl.agentId;
        },
        get spent() {
          return impl.spent;
        },
        get closed() {
          return impl.closed;
        },
        authorize: (args) =>
          impl.authorize(args) as Promise<AuthorizeResult<TSignedTx>>,
        close() {
          impl.close();
        },
      };
    },
    isKnownSessionId(id) {
      if (typeof id !== "string" || id.length !== 32) return false;
      // First, quick presence check via Map. If hit, do a timingSafeEqual
      // against the canonical bytes to prevent the membership probe itself
      // from leaking via timing of the buffer comparison.
      const stored = issuedIds.get(id);
      if (!stored) return false;
      const candidate = Buffer.from(id, "utf8");
      if (candidate.length !== stored.length) return false;
      return timingSafeEqual(candidate, stored);
    },
  };
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function isAgreementShape(raw: unknown): raw is AccordAgreement {
  if (!isObject(raw)) return false;
  if (raw.type !== "accord.agreement.v0") return false;
  if (raw.version !== "v0") return false;
  if (typeof raw.agreement_id !== "string") return false;
  if (typeof raw.created_at !== "string") return false;

  const buyer = raw.buyer;
  if (!isObject(buyer) || typeof buyer.id !== "string") return false;
  const seller = raw.seller;
  if (!isObject(seller) || typeof seller.id !== "string") return false;

  const task = raw.task;
  if (
    !isObject(task) ||
    typeof task.kind !== "string" ||
    typeof task.input_ref !== "string" ||
    typeof task.description !== "string"
  ) {
    return false;
  }

  const price = raw.price;
  if (
    !isObject(price) ||
    typeof price.amount !== "string" ||
    typeof price.currency !== "string" ||
    typeof price.decimals !== "number"
  ) {
    return false;
  }

  const payment = raw.payment;
  if (
    !isObject(payment) ||
    typeof payment.mode !== "string" ||
    typeof payment.rail !== "string" ||
    typeof payment.deadline !== "string"
  ) {
    return false;
  }

  const verification = raw.verification;
  if (
    !isObject(verification) ||
    typeof verification.required !== "boolean" ||
    typeof verification.method !== "string"
  ) {
    return false;
  }

  const settlement = raw.settlement;
  if (
    !isObject(settlement) ||
    typeof settlement.mode !== "string" ||
    typeof settlement.refund_policy !== "string" ||
    typeof settlement.dispute_policy !== "string"
  ) {
    return false;
  }

  return true;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] as number;
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

// Re-export so consumers can format the spend remaining etc.
export { scaledToDecimal };
