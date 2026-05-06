// ─────────────────────────────────────────────────────────────────────────────
// ergo-agent-rosen — public surface
// ─────────────────────────────────────────────────────────────────────────────

export {
  resolveErgoSideToken,
  listSupportedFromChain,
} from "./tokens.js";

export {
  BridgeUrlBuilder,
  bridgeUrl,
  DEFAULT_ROSEN_HOST,
} from "./bridge-url.js";
export type { BridgeUrlBuilderOptions } from "./bridge-url.js";

export {
  buildRosenReserveConfig,
  createRosenReserve,
  buildRosenNoteOptions,
  RS_RESERVE_SCRIPT_NAME,
} from "./reserve.js";

export {
  RosenIntegrationError,
} from "./types.js";

export type {
  RosenChain,
  AssetDescriptor,
  TokenLookupResult,
  TokenMapLike,
  BridgeUrlInput,
  RosenIntegrationErrorCode,
} from "./types.js";
