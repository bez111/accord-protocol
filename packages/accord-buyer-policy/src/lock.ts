// ─────────────────────────────────────────────────────────────────────────────
// @accord-protocol/buyer-policy — async mutex
//
// Tiny promise-chain mutex used to serialise authorize() calls within a
// session. Without this, two concurrent authorize() calls could both observe
// `spentSoFar < cap` and both pass the budget check, then both increment past
// the cap.
//
// We don't use a third-party lib (zero runtime deps is a hard rule for this
// package). The implementation is well-known and deterministic.
// ─────────────────────────────────────────────────────────────────────────────

export class AsyncMutex {
  #tail: Promise<void> = Promise.resolve();

  /**
   * Run `fn` while holding the mutex. Awaits any prior caller, then runs.
   * Re-throws `fn`'s rejection but never poisons the chain.
   */
  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const myTurn = this.#tail;
    this.#tail = new Promise<void>((res) => {
      release = res;
    });
    try {
      await myTurn;
      return await fn();
    } finally {
      release();
    }
  }
}
