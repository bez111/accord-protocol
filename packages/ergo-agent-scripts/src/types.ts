// ─────────────────────────────────────────────────────────────────────────────
// ergo-agent-scripts — type definitions
// ─────────────────────────────────────────────────────────────────────────────

export type PredicateName = "task_hash_v0" | "credential_v0";

export interface PredicateEntry {
  /** Stable identifier; corresponds to `PredicateName`. */
  name: PredicateName;

  /** One-line description of what redemption proves. */
  purpose: string;

  /** Verbatim ErgoScript source. SHA-stable; do not edit unless bumping the v0 → v1 spec. */
  source: string;

  /** Map of register slot → human-readable type. Documentation only. */
  registers: Record<string, string>;

  /** Map of context-variable index → expected payload. Documentation only. */
  context_variables: Record<string, string>;

  /**
   * Compiled ErgoTree, hex-encoded.
   *
   * `null` when the package was published without a compiled artefact.
   * Populated by `npm run compile-predicates`, which spawns a Node script
   * that uses `ergo-lib-wasm-nodejs` to compile the source.
   *
   * Consumers MUST treat `null` as "no compiled tree available" and either
   * compile themselves or run in dev mode (testnet / `allowInsecureDevMode`).
   */
  ergoTreeHex: string | null;

  /**
   * BLAKE2b-256 of the raw ErgoTree bytes — a stable identifier for the
   * compiled artefact. Useful for quick equality checks and audit logs.
   */
  treeHashBlake2b256: string | null;

  /** ISO-8601 timestamp of compilation, or null if unset. */
  compiledAt: string | null;

  /** Identifier of the compiler used (name + version). */
  compiler: string | null;
}

export interface PredicateRegistry {
  spec: string;
  version: "v0";
  description: string;
  predicates: PredicateEntry[];
}
