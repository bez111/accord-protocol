// ─────────────────────────────────────────────────────────────────────────────
// @accord-protocol/mcp — wrap an MCP tool handler with Accord paywall
// + verification + settlement.
//
// The wrapper does the following per call:
//
//   1. Pull `accord_agreement_id` / `accord_payment` / `accord_task_output`
//      out of the buyer's tool args. Reject if `agreement_id` is missing.
//   2. Resolve the Agreement via `config.resolveAgreement`. Reject if unknown.
//   3. Run @accord-protocol/core's `validateAgreement`. Reject on any problem.
//   4. Bind the configured rail to `agreement.payment.rail`, then call
//      `rail.verifyPayment({ agreement, payment })`. Reject on failure or
//      if the verified rail does not match.
//   5. (Optional) If `accord_task_output` was sent, ensure its
//      `accord_hash_v0` matches `agreement.task.output_hash` if that field
//      was set.
//   6. Claim `(rail, payment_id)` in the replay store before work runs.
//   7. Run the seller's handler with the *non-Accord* args + the resolved
//      Agreement.
//   8. If `agreement.verification.required` is true:
//        a. Call `config.verifier({ agreement, output })`.
//        b. Run `validateVerificationReceipt(receipt, { agreement })`.
//        c. Reject the call if the receipt's `result === "rejected"`.
//   9. (Optional) Call `rail.settle(...)` and validate the returned
//      Settlement Receipt. Don't reject the tool call if settle fails
//      post-execution — report the settlement error in `_meta` so the buyer
//      can retry settlement out-of-band.
//  10. Return the handler's output, with both receipts (if any) attached
//      under `_meta.accord_*`.
//
// The wrapper returns `AccordMcpResult` — either a success result with
// `output` + `_meta`, or a structured error with `isError: true` and
// `_meta.accord_error_code`. It deliberately does NOT throw on
// rejection — MCP clients are easier to wire when errors flow as result
// values.
// ─────────────────────────────────────────────────────────────────────────────

import {
  accordHashV0,
  validateAgreement,
  validateSettlementReceipt,
  validateVerificationReceipt,
  type AccordAgreement,
  type AccordSettlementReceipt,
  type AccordVerificationReceipt,
} from "@accord-protocol/core";

import { ACCORD_MCP_ERROR_CODES } from "./errors.js";
import type {
  AccordMcpHandler,
  AccordMcpInputArgs,
  AccordMcpReplayStore,
  AccordMcpResult,
  AccordMcpToolDefinition,
  AccordMcpWrapperConfig,
  McpJsonSchema,
} from "./types.js";

/** The tool args shape after Accord fields are stripped. */
type StrippedArgs<TArgs> = Omit<TArgs, keyof AccordMcpInputArgs>;

const DEFAULT_REPLAY_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_AGREEMENT_ID_BYTES = 256;
const DEFAULT_MAX_PAYMENT_BYTES = 16 * 1024;
const DEFAULT_MAX_TASK_OUTPUT_BYTES = 64 * 1024;

/**
 * Inject `accord_agreement_id`, `accord_payment`, `accord_task_output`
 * into a tool's input schema. Used by sellers that want their MCP tool
 * advertisement to declare the Accord fields up-front.
 */
export function injectAccordSchemaFields(schema: McpJsonSchema | undefined): McpJsonSchema {
  const base: McpJsonSchema =
    schema && schema.type === "object"
      ? { ...schema, properties: { ...(schema.properties ?? {}) } }
      : { type: "object", properties: {} };

  base.properties = {
    accord_agreement_id: {
      type: "string",
      description:
        "ULID-shaped Accord Agreement id (acc_*). The seller's resolveAgreement() must be able to look this up.",
    },
    accord_payment: {
      description:
        "Rail-specific payment proof. Contents are inspected by the seller's rail adapter, not by the wrapper.",
    },
    accord_task_output: {
      description:
        "Optional pre-committed task output. If set, its accord_hash_v0 must match agreement.task.output_hash.",
    },
    ...base.properties,
  };

  base.required = Array.from(
    new Set([...(base.required ?? []), "accord_agreement_id", "accord_payment"]),
  );
  return base;
}

/**
 * Wrap an Accord/MCP tool. Returns a callable that takes the buyer's
 * raw tool args (including the `accord_*` fields) and returns the
 * structured `AccordMcpResult`.
 */
export function wrapAccordMcp<TArgs extends Record<string, unknown>, TOut>(
  config: AccordMcpWrapperConfig<StrippedArgs<TArgs>, TOut>,
): (args: TArgs & AccordMcpInputArgs) => Promise<AccordMcpResult<TOut>> {
  const replayStore: AccordMcpReplayStore =
    config.replayStore ?? new InMemoryMcpReplayStore();
  const replayTtlMs = config.replayTtlMs ?? DEFAULT_REPLAY_TTL_MS;
  const limits = normalizeLimits(config.limits);
  const exposeInternalErrors = config.exposeInternalErrors === true;

  return async function callAccordMcp(rawArgs) {
    // ── 1. Pull the Accord fields ─────────────────────────────────────────
    const { accord_agreement_id, accord_payment, accord_task_output, ...rest } =
      rawArgs as AccordMcpInputArgs & Record<string, unknown>;

    if (!accord_agreement_id || typeof accord_agreement_id !== "string") {
      return mcpError(ACCORD_MCP_ERROR_CODES.MISSING_AGREEMENT_ID, {
        message: "accord_agreement_id is required",
      });
    }
    if (byteLengthOfString(accord_agreement_id) > limits.maxAgreementIdBytes) {
      return mcpError(ACCORD_MCP_ERROR_CODES.INPUT_TOO_LARGE, {
        message: "accord_agreement_id exceeds the configured size limit",
      });
    }
    if (accord_payment === undefined || accord_payment === null) {
      return mcpError(ACCORD_MCP_ERROR_CODES.MISSING_PAYMENT, {
        message: "accord_payment is required",
        accord_agreement_id,
      });
    }
    if (byteLengthOfUnknown(accord_payment) > limits.maxPaymentBytes) {
      return mcpError(ACCORD_MCP_ERROR_CODES.INPUT_TOO_LARGE, {
        message: "accord_payment exceeds the configured size limit",
        accord_agreement_id,
        accord_field: "accord_payment",
      });
    }
    if (
      accord_task_output !== undefined &&
      byteLengthOfUnknown(accord_task_output) > limits.maxTaskOutputBytes
    ) {
      return mcpError(ACCORD_MCP_ERROR_CODES.INPUT_TOO_LARGE, {
        message: "accord_task_output exceeds the configured size limit",
        accord_agreement_id,
        accord_field: "accord_task_output",
      });
    }

    // ── 2. Resolve the Agreement ──────────────────────────────────────────
    let agreement: AccordAgreement | undefined;
    try {
      agreement = await config.resolveAgreement(accord_agreement_id);
    } catch (err) {
      return mcpError(ACCORD_MCP_ERROR_CODES.UNKNOWN_AGREEMENT, {
        message: `resolveAgreement threw: ${stringifyError(err, exposeInternalErrors)}`,
        accord_agreement_id,
      });
    }
    if (!agreement) {
      return mcpError(ACCORD_MCP_ERROR_CODES.UNKNOWN_AGREEMENT, {
        message: `no agreement found for id ${accord_agreement_id}`,
        accord_agreement_id,
      });
    }

    // ── 3. Validate the Agreement ─────────────────────────────────────────
    let v;
    try {
      v = validateAgreement(agreement);
    } catch (err) {
      return mcpError(ACCORD_MCP_ERROR_CODES.AGREEMENT_INVALID, {
        message: `agreement validation threw: ${stringifyError(err, exposeInternalErrors)}`,
        accord_agreement_id,
      });
    }
    if (!v.ok) {
      return mcpError(ACCORD_MCP_ERROR_CODES.AGREEMENT_INVALID, {
        message: `agreement is invalid: ${v.problems.map((p) => p.code + "@" + p.path).join(", ")}`,
        accord_agreement_id,
        problems: v.problems,
      });
    }

    if (config.rail.rail !== agreement.payment.rail) {
      return mcpError(ACCORD_MCP_ERROR_CODES.PAYMENT_RAIL_MISMATCH, {
        message:
          `configured rail ${config.rail.rail} does not match agreement.payment.rail ` +
          `${agreement.payment.rail}`,
        rail: config.rail.rail,
        expected_rail: agreement.payment.rail,
        accord_agreement_id,
      });
    }

    // ── 4. Verify payment with the rail ───────────────────────────────────
    let verification:
      | { ok: true; rail: string; payment_id: string; details?: Record<string, unknown> }
      | { ok: false; rail: string; code: string; message: string };
    try {
      verification = await config.rail.verifyPayment({
        agreement,
        payment: accord_payment,
      });
    } catch (err) {
      return mcpError(ACCORD_MCP_ERROR_CODES.RAIL_UNAVAILABLE, {
        message: `rail.verifyPayment threw: ${stringifyError(err, exposeInternalErrors)}`,
        rail: config.rail.rail,
        accord_agreement_id,
      });
    }
    if (!verification.ok) {
      return mcpError(ACCORD_MCP_ERROR_CODES.PAYMENT_VERIFICATION_FAILED, {
        message: verification.message,
        rail: verification.rail,
        rail_error_code: verification.code,
        accord_agreement_id,
      });
    }
    if (verification.rail !== config.rail.rail || verification.rail !== agreement.payment.rail) {
      return mcpError(ACCORD_MCP_ERROR_CODES.PAYMENT_RAIL_MISMATCH, {
        message:
          `rail.verifyPayment returned rail ${verification.rail}, expected ` +
          `${agreement.payment.rail}`,
        rail: verification.rail,
        expected_rail: agreement.payment.rail,
        accord_agreement_id,
      });
    }
    if (
      typeof verification.payment_id !== "string" ||
      verification.payment_id.trim().length === 0
    ) {
      return mcpError(ACCORD_MCP_ERROR_CODES.PAYMENT_VERIFICATION_FAILED, {
        message: "rail.verifyPayment returned ok=true without a non-empty payment_id",
        rail: verification.rail,
        rail_error_code: "MISSING_PAYMENT_ID",
        accord_agreement_id,
      });
    }

    // ── 5. Optional pre-committed task-output hash check ──────────────────
    if (accord_task_output !== undefined && agreement.task.output_hash) {
      const got = "blake2b256:0x" + accordHashV0(accord_task_output);
      if (got !== agreement.task.output_hash) {
        return mcpError(ACCORD_MCP_ERROR_CODES.TASK_OUTPUT_HASH_MISMATCH, {
          message: `accord_task_output hash ${got} ≠ agreement.task.output_hash ${agreement.task.output_hash}`,
          accord_agreement_id,
        });
      }
    }

    // ── 6. Replay protection ─────────────────────────────────────────────
    const expiresAtMs = Date.now() + replayTtlMs;
    const claimAccepted = replayStore.claim
      ? await replayStore.claim(verification.rail, verification.payment_id, expiresAtMs)
      : !(await replayStore.has(verification.rail, verification.payment_id));
    if (!claimAccepted) {
      return mcpError(ACCORD_MCP_ERROR_CODES.REPLAY_DETECTED, {
        message: "payment_id was already claimed in the past TTL window",
        rail: verification.rail,
        payment_id: verification.payment_id,
        accord_agreement_id,
      });
    }
    if (!replayStore.claim) {
      await replayStore.put(verification.rail, verification.payment_id, expiresAtMs);
    }

    // ── 7. Run the seller's handler ───────────────────────────────────────
    let output: TOut;
    try {
      output = await config.handler(rest as StrippedArgs<TArgs>, { agreement });
    } catch (err) {
      return mcpError(ACCORD_MCP_ERROR_CODES.HANDLER_THREW, {
        message: stringifyError(err, exposeInternalErrors),
        accord_agreement_id,
      });
    }

    // ── 8. Verifier (when required) ───────────────────────────────────────
    let verificationReceipt: AccordVerificationReceipt | undefined;
    if (agreement.verification.required) {
      if (!config.verifier) {
        return mcpError(ACCORD_MCP_ERROR_CODES.VERIFICATION_REQUIRED, {
          message:
            "agreement.verification.required is true but no verifier is configured on the wrapper",
          accord_agreement_id,
        });
      }
      try {
        verificationReceipt = await config.verifier({ agreement, output });
      } catch (err) {
        return mcpError(ACCORD_MCP_ERROR_CODES.VERIFICATION_REJECTED, {
          message: `verifier threw: ${stringifyError(err, exposeInternalErrors)}`,
          accord_agreement_id,
        });
      }

      let vrCheck;
      try {
        vrCheck = validateVerificationReceipt(verificationReceipt, { agreement });
      } catch (err) {
        return mcpError(ACCORD_MCP_ERROR_CODES.VERIFICATION_REJECTED, {
          message: `verification receipt validation threw: ${stringifyError(err, exposeInternalErrors)}`,
          accord_agreement_id,
        });
      }
      if (!vrCheck.ok) {
        return mcpError(ACCORD_MCP_ERROR_CODES.VERIFICATION_REJECTED, {
          message: `verification receipt is invalid: ${vrCheck.problems.map((p) => p.code).join(", ")}`,
          accord_agreement_id,
          problems: vrCheck.problems,
        });
      }
      if (verificationReceipt.result === "rejected") {
        return mcpError(ACCORD_MCP_ERROR_CODES.VERIFICATION_REJECTED, {
          message: "verifier rejected the seller's output",
          accord_agreement_id,
          accord_verification_receipt: verificationReceipt,
        });
      }
    }

    // ── 9. Settle (best-effort) ───────────────────────────────────────────
    let settlementReceipt: AccordSettlementReceipt | undefined;
    let settlementError: string | undefined;
    if (config.rail.settle) {
      try {
        settlementReceipt = await config.rail.settle({
          agreement,
          payment: accord_payment,
          verification: verificationReceipt,
        });
        const srCheck = validateSettlementReceipt(settlementReceipt, { agreement });
        if (!srCheck.ok) {
          settlementError =
            `settlement receipt is invalid: ${srCheck.problems.map((p) => p.code).join(", ")}`;
          settlementReceipt = undefined;
        }
      } catch (err) {
        // Settlement failure post-execution does NOT reject the tool call
        // — the buyer already got the work, the receipts can be reconciled
        // out-of-band. The seller's logs should pick this up.
        settlementError = `rail.settle threw: ${stringifyError(err, exposeInternalErrors)}`;
        settlementReceipt = undefined;
      }
    }

    // ── 10. Success ───────────────────────────────────────────────────────
    return {
      content: [
        {
          type: "text",
          text:
            typeof output === "string"
              ? output
              : JSON.stringify(output),
        },
      ],
      output,
      _meta: {
        accord_agreement_id,
        accord_agreement_hash: "blake2b256:0x" + accordHashV0(agreement),
        accord_payment_id: verification.payment_id,
        accord_verification_receipt: verificationReceipt,
        accord_settlement_receipt: settlementReceipt,
        accord_settlement_error: settlementError,
      },
    };
  };
}

class InMemoryMcpReplayStore implements AccordMcpReplayStore {
  private readonly map = new Map<string, { expiresAtMs: number }>();

  has(rail: string, paymentId: string): boolean {
    this.gc();
    return this.map.has(this.key(rail, paymentId));
  }

  put(rail: string, paymentId: string, expiresAtMs: number): void {
    this.map.set(this.key(rail, paymentId), { expiresAtMs });
  }

  claim(rail: string, paymentId: string, expiresAtMs: number): boolean {
    this.gc();
    const key = this.key(rail, paymentId);
    if (this.map.has(key)) return false;
    this.map.set(key, { expiresAtMs });
    return true;
  }

  private key(rail: string, paymentId: string): string {
    return `accord:mcp:v0:${rail}:${paymentId}`;
  }

  private gc(): void {
    const now = Date.now();
    for (const [k, v] of this.map) {
      if (v.expiresAtMs <= now) this.map.delete(k);
    }
  }
}

/** Build an MCP-shaped error result. */
function mcpError(
  code: string,
  meta: { message: string } & Record<string, unknown>,
): AccordMcpResult<never> {
  const { message, ...rest } = meta;
  return {
    isError: true,
    content: [{ type: "text", text: `[${code}] ${message}` }],
    _meta: {
      accord_error_code: code,
      ...rest,
    },
  };
}

function normalizeLimits(limits: AccordMcpWrapperConfig<unknown, unknown>["limits"]) {
  return {
    maxAgreementIdBytes: positiveIntegerOrDefault(
      limits?.maxAgreementIdBytes,
      DEFAULT_MAX_AGREEMENT_ID_BYTES,
    ),
    maxPaymentBytes: positiveIntegerOrDefault(
      limits?.maxPaymentBytes,
      DEFAULT_MAX_PAYMENT_BYTES,
    ),
    maxTaskOutputBytes: positiveIntegerOrDefault(
      limits?.maxTaskOutputBytes,
      DEFAULT_MAX_TASK_OUTPUT_BYTES,
    ),
  };
}

function positiveIntegerOrDefault(value: unknown, fallback: number): number {
  return Number.isSafeInteger(value) && (value as number) > 0
    ? (value as number)
    : fallback;
}

function byteLengthOfString(value: string): number {
  return new TextEncoder().encode(value).length;
}

function byteLengthOfUnknown(value: unknown): number {
  if (typeof value === "string") return byteLengthOfString(value);
  try {
    const encoded = JSON.stringify(value);
    return typeof encoded === "string"
      ? byteLengthOfString(encoded)
      : Number.POSITIVE_INFINITY;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function stringifyError(err: unknown, exposeInternalErrors: boolean): string {
  if (!exposeInternalErrors) return "internal error";
  let text: string;
  if (err instanceof Error) text = err.message;
  else if (typeof err === "string") text = err;
  else {
    try {
      text = JSON.stringify(err);
    } catch {
      text = String(err);
    }
  }
  return truncateForWire(redactLikelySecrets(text));
}

function redactLikelySecrets(text: string): string {
  return text
    .replace(/0x[0-9a-fA-F]{64}/g, "0x[REDACTED_32B]")
    .replace(/\b[A-Za-z0-9_-]{32,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/g, "[REDACTED_TOKEN]")
    .replace(/\b(sk|pk|secret|token|private[_-]?key)=([^,\s]+)/gi, "$1=[REDACTED]");
}

function truncateForWire(text: string): string {
  const max = 512;
  if (text.length <= max) return text;
  return text.slice(0, max) + "...";
}

/**
 * Helper: build the MCP tool definition with Accord fields injected.
 * Sellers can register this with their MCP server framework directly.
 */
export function describeAccordMcpTool(
  base: AccordMcpToolDefinition,
): AccordMcpToolDefinition {
  return {
    ...base,
    inputSchema: injectAccordSchemaFields(base.inputSchema),
  };
}
