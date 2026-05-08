// ─────────────────────────────────────────────────────────────────────────────
// @accord-protocol/buyer-policy — typed error taxonomy
//
// Every reason a policy can deny an authorize() call has a stable error code
// here. Application code should branch on `err.code`, never on `err.message`,
// because messages are intentionally light on detail (no agreement bodies, no
// signer inputs) to avoid leaking sensitive context into logs.
// ─────────────────────────────────────────────────────────────────────────────

export type BuyerPolicyDenyCode =
  // Construction / configuration errors
  | "POLICY_INVALID_CONFIG"
  | "POLICY_INVALID_AMOUNT_FORMAT"
  | "POLICY_INVALID_RECIPIENT_PATTERN"
  // Pre-flight rejections (before signer is touched)
  | "AGREEMENT_INVALID"
  | "RAIL_NOT_ALLOWED"
  | "RECIPIENT_NOT_ALLOWED"
  | "CURRENCY_MISMATCH"
  | "BUDGET_EXCEEDED_SINGLE"
  | "BUDGET_EXCEEDED_SESSION"
  | "BUDGET_EXCEEDED_DAILY"
  // Approval-flow rejections
  | "APPROVAL_REQUIRED_NO_HANDLER"
  | "APPROVAL_DENIED"
  | "APPROVAL_TIMEOUT"
  | "APPROVAL_HANDLER_ERROR"
  // Session-state rejections
  | "SESSION_EXPIRED"
  | "SESSION_CLOSED"
  // Signer-side
  | "SIGNER_ERROR";

/**
 * Stable, typed error class for every buyer-policy deny path.
 *
 * Messages are deliberately terse. They do NOT include:
 *   - the unsigned tx contents
 *   - the agreement body
 *   - amount values (only the field name, not the value)
 *
 * Callers that need richer telemetry should attach context at the call-site
 * after catching this error — not by inspecting `err.message`.
 */
export class BuyerPolicyError extends Error {
  readonly code: BuyerPolicyDenyCode;

  constructor(code: BuyerPolicyDenyCode, message: string) {
    super(message);
    this.name = "BuyerPolicyError";
    this.code = code;
  }

  override toString(): string {
    return `BuyerPolicyError[${this.code}]: ${this.message}`;
  }
}
