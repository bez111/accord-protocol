// ─────────────────────────────────────────────────────────────────────────────
// Resolve note_box_id from a Note issuance tx.
//
// ergo-agent-pay's NoteResult currently surfaces only `txId` — the Note's
// box id has to be looked up on the chain after the tx confirms. This is
// a small helper that polls the testnet explorer for the issuance tx and
// returns its first output's box id.
//
// TODO(ergo-agent-pay): expose noteBoxId directly on NoteResult so this
// indirection isn't needed. Tracked as a v0.4 surface change.
// ─────────────────────────────────────────────────────────────────────────────

const TESTNET_API = "https://api-testnet.ergoplatform.com/api/v1"

interface TxOutput {
  boxId: string
  index: number
}
interface TxResponse {
  outputs?: TxOutput[]
}

export interface ResolveOpts {
  txId: string
  network: "testnet" | "mainnet"
  /** ms between polls, default 4000 — testnet block time ~120s */
  pollIntervalMs?: number
  /** max wall time, default 180_000 (3 min) */
  timeoutMs?: number
}

export async function resolveNoteBoxId(opts: ResolveOpts): Promise<string> {
  const apiBase =
    opts.network === "testnet"
      ? TESTNET_API
      : "https://api.ergoplatform.com/api/v1"
  const pollMs = opts.pollIntervalMs ?? 4000
  const deadline = Date.now() + (opts.timeoutMs ?? 180_000)

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${apiBase}/transactions/${opts.txId}`)
      if (res.ok) {
        const tx = (await res.json()) as TxResponse
        const note = tx.outputs?.[0]
        if (note?.boxId) return note.boxId
      }
    } catch {
      // network blip — keep polling until deadline
    }
    await sleep(pollMs)
  }
  throw new Error(
    `Tx ${opts.txId} did not appear within ${(opts.timeoutMs ?? 180_000) / 1000}s. ` +
      `Check the explorer manually: https://${opts.network}.ergoplatform.com/transactions/${opts.txId}`,
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
