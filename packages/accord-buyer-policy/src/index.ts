// ─────────────────────────────────────────────────────────────────────────────
// @accord-protocol/buyer-policy — public API
//
// Wraps a buyer agent's signer with a policy engine that enforces:
//   * single-payment cap
//   * per-session cumulative cap
//   * optional 24h rolling daily cap
//   * recipient allow-list (suffix wildcards only)
//   * rail allow-list
//   * approval-required threshold (with handler timeout)
//
// Zero runtime deps outside @accord-protocol/core (and the Node built-ins
// `crypto`). Designed to be embedded in agentic wallets or buyer-side
// gateways. Threat-model details live in src/enforcer.ts.
// ─────────────────────────────────────────────────────────────────────────────

export {
  createBuyerPolicyEnforcer,
  scaledToDecimal,
  type BuyerPolicyEnforcer,
  type BuyerPolicyEnforcerOptions,
  type BuyerSession,
} from "./enforcer.js";

export {
  type ApprovalHandler,
  type ApprovalRequest,
  type AuthorizeResult,
  type BuyerPolicy,
  type BuyerPolicyAmount,
  type SignerContext,
  type SignerFn,
} from "./types.js";

export { BuyerPolicyError, type BuyerPolicyDenyCode } from "./errors.js";

export {
  parseAmount,
  add,
  lte,
  gt,
  zero,
  type ScaledAmount,
} from "./amount.js";
