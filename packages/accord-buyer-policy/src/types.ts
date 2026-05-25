// ─────────────────────────────────────────────────────────────────────────────
// @accord-protocol/buyer-policy — public types
// ─────────────────────────────────────────────────────────────────────────────

import type { AccordRail } from "@accord-protocol/core";

/**
 * A decimal-string amount paired with its currency and the decimal scale used
 * for comparisons. `amount` is always a string — passing a JS number is a
 * construction error (would silently lose precision on big amounts).
 */
export interface BuyerPolicyAmount {
  amount: string;
  currency: string;
  decimals: number;
}

/**
 * The policy bound to one BuyerPolicyEnforcer.
 *
 * All numeric caps share the same currency + decimals — the package does not
 * cross currencies internally. If the integrator needs cross-currency caps,
 * they wire up an oracle layer that converts agreement amounts to the policy
 * currency BEFORE handing them to the enforcer.
 */
export interface BuyerPolicy {
  /**
   * Reject any single agreement above this amount, even with approval.
   * Hard ceiling — `requireApprovalAbove` does NOT bypass it.
   */
  maxSinglePayment: BuyerPolicyAmount;

  /**
   * Cumulative cap inside one session. Tracked as the sum of all approved
   * agreements' prices (in the policy's currency).
   */
  maxSessionSpend: BuyerPolicyAmount;

  /**
   * Optional rolling-day cap. If set, the enforcer rejects any agreement that
   * would push the trailing-24h spend past it. Implemented per-session for v0;
   * persisting across sessions is integrator responsibility (via SessionStore).
   */
  maxDailySpend?: BuyerPolicyAmount;

  /**
   * Any single agreement at or above this amount goes through the
   * approvalHandler before being signed. Below it, signing is automatic.
   * Set to `maxSinglePayment` to require approval for everything.
   */
  requireApprovalAbove?: BuyerPolicyAmount;

  /**
   * Allow-list of agreement.seller.id values. Wildcard tail with `*` is
   * supported only after a non-empty literal prefix
   * (e.g. "provider://repo-audit-*"); bare, leading, or middle wildcards
   * are deliberately rejected to keep the matching trivially auditable.
   */
  allowedRecipients: ReadonlyArray<string>;

  /**
   * Allow-list of rails this enforcer will sign for. Anything outside the set
   * is rejected pre-flight.
   */
  allowedRails: ReadonlyArray<AccordRail>;

  /**
   * Hard timeout for the integrator-supplied approval handler, in ms.
   * Default 60_000.
   */
  approvalTimeoutMs?: number;

  /**
   * Session lifetime in ms. After this from `openSession`, every authorize()
   * call rejects with SESSION_EXPIRED. Default 24h.
   */
  sessionTtlMs?: number;
}

/**
 * The result of a successful authorize() — the signed transaction plus a
 * snapshot of the session-spend after this payment was charged.
 */
export interface AuthorizeResult<TSignedTx> {
  signedTx: TSignedTx;
  sessionSpend: BuyerPolicyAmount;
}

/**
 * What the enforcer hands to the integrator-supplied approvalHandler.
 *
 * Intentionally minimal — the handler must NOT receive the unsigned tx, the
 * private key, or any signer state. It receives only the public-facing facts a
 * human (or an external authenticated agent) needs to make the decision.
 */
export interface ApprovalRequest {
  agreement_id: string;
  buyer_id: string;
  seller_id: string;
  rail: AccordRail;
  price: BuyerPolicyAmount;
  session_id: string;
  /** ISO 8601 UTC. Use this, not `Date.now()`, for any "issued at" logic. */
  issued_at: string;
}

export type ApprovalHandler = (
  request: ApprovalRequest,
  abortSignal: AbortSignal,
) => Promise<{ approved: boolean; approver_id?: string }>;

/**
 * The signer is integrator-owned. It receives the unsigned tx for the rail
 * and returns the signed form. The enforcer never stores or logs the unsigned
 * or signed tx body.
 *
 * `context` carries only the session id and a per-call nonce so the signer can
 * idempotency-check or correlate. It does NOT carry budget state.
 */
export interface SignerContext {
  session_id: string;
  nonce: string;
  agreement_id: string;
  rail: AccordRail;
}

export type SignerFn<TUnsignedTx, TSignedTx> = (
  unsignedTx: TUnsignedTx,
  context: SignerContext,
) => Promise<TSignedTx>;

/**
 * Re-exported for the integrator's convenience. Pass agreements typed as the
 * discriminated union from `@accord-protocol/core`; the enforcer
 * shape-guards and semantically-validates anyway.
 */
export type { AccordRail };
