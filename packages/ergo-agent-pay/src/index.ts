// ─────────────────────────────────────────────────────────────────────────────
// ergo-agent-pay — Public API
// ─────────────────────────────────────────────────────────────────────────────

export { ErgoAgentPay } from "./ErgoAgentPay.js";

export {
  computeTaskHash,
  computeTaskHashAsync,
  resolveDeadline,
  validateTaskHash,
  TASK_HASH_PREDICATE_SCRIPT,
  CREDENTIAL_PREDICATE_SCRIPT,
} from "./predicates.js";

export { parseAmount } from "./transactions.js";

export { encodeSigmaCollByte, MAX_TASK_OUTPUT_BYTES } from "./encoding.js";

export { assertProductionSafety } from "./safety.js";
export type { ProductionSafetyArgs, AuditPolicy, AuditPolicyVerdict } from "./safety.js";

export type {
  ErgoAgentPayConfig,
  Network,
  PayOptions,
  PayResult,
  NoteOptions,
  NoteResult,
  PolicyConfig,
  BeforePayHook,
  AfterPayHook,
  ApprovalFn,
  AuditLogEvent,
  AuditLogFn,
  PayContext,
  SignerFn,
  LangChainToolConfig,
  OpenAIFunctionConfig,
  EIP12UnsignedTx,
  SignedTx,
} from "./types.js";

export { PolicyEngine } from "./policy.js";

export { ErgoAgentPayError } from "./types.js";
export type { ErgoAgentPayErrorCode } from "./types.js";

// ── Lifecycle types ────────────────────────────────────────────────────────────
export type {
  NoteInfo,
  ReserveConfig,
  ReserveResult,
  RedeemOptions,
  RedeemResult,
  BatchSettleOptions,
  BatchSettleResult,
  TrackerConfig,
  TrackerResult,
} from "./types.js";

// ── Raw lifecycle builders ────────────────────────────────────────────────────
//
// IMPORTANT: these builders bypass the high-level audit/safety guardrails
// applied by `ErgoAgentPay`. The exports prefixed with `dangerously` are
// the canonical names; the unprefixed aliases are kept for one minor
// version cycle and will be removed.
//
// Use the high-level SDK methods (`agent.createReserve`, `agent.issueNote`
// etc.) unless you have a specific reason to bypass the audit gate. If you
// do bypass it, run your own audit policy before signing on mainnet.
// ─────────────────────────────────────────────────────────────────────────────

export {
  dangerouslyBuildCreateReserveTx,
  dangerouslyBuildRedeemNoteTx,
  dangerouslyBuildBatchSettleTx,
  dangerouslyBuildDeployTrackerTx,
  // Deprecated aliases — same functions under their original names.
  buildCreateReserveTx,
  buildRedeemNoteTx,
  buildBatchSettleTx,
  buildDeployTrackerTx,
  decodeRegisterInt,
  decodeRegisterBytes,
} from "./lifecycle.js";
