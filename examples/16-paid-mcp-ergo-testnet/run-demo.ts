#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// One-command paid-MCP demo on Ergo testnet.
//
//   $ npm run dev
//
// Prerequisites (one-time):
//   1. Two testnet addresses (buyer + seller). See README "Setup".
//   2. A funded Reserve box. See `npm run setup:reserve`.
//   3. .env file with ACCORD_DEMO_BUYER_ADDR / SELLER_ADDR / RESERVE_BOX_ID.
//
// What it prints:
//   ✓ Agreement created          acc_…
//      agreement_hash            blake2b256:0x…
//   ✓ Note issued (testnet)      tx 0x…  box 0x…
//   ✓ MCP tool ran               2 finding(s)
//   ✓ Verification Receipt       vr_…
//   ✓ Settlement Receipt         sr_…
//      settlement tx             0x…  (Note redeemed on testnet)
//
// All on-chain — no mocks. The buyer's testnet wallet shrinks by the
// price + miner fee, the seller's grows by the redeemed Note value.
// ─────────────────────────────────────────────────────────────────────────────

import { runDemo } from "./buyer/run.js"

const repoFlagIdx = process.argv.indexOf("--repo")
const repo_url =
  repoFlagIdx >= 0 ? process.argv[repoFlagIdx + 1] : undefined

const trace = await runDemo({ repo_url })

console.log("")
console.log("Accord Protocol — paid MCP repo-audit demo (Ergo testnet)")
console.log("")

if (!trace.ok) {
  console.log(`✗ Demo failed (code: ${trace.error_code})`)
  if (trace.note_tx_id)
    console.log(`  Note tx may still be pending: ${trace.note_tx_id}`)
  process.exit(1)
}

console.log(`  ✓ Agreement created       ${trace.agreement_id}`)
console.log(`     agreement_hash         ${trace.agreement_hash}`)
console.log(`  ✓ Note issued (testnet)   tx ${trace.note_tx_id}`)
console.log(`     note_box_id            ${trace.note_box_id}`)
console.log(
  `  ✓ MCP tool ran            ${
    Array.isArray((trace.output as { findings?: unknown[] })?.findings)
      ? (trace.output as { findings: unknown[] }).findings.length
      : 0
  } finding(s)`,
)
console.log(`  ✓ Verification Receipt    ${trace.verification_receipt_id}`)
console.log(`  ✓ Settlement Receipt      ${trace.settlement_receipt_id}`)
if (trace.settlement_tx_id) {
  console.log(`     settlement tx          ${trace.settlement_tx_id}`)
  console.log(
    `     explorer               https://testnet.ergoplatform.com/transactions/${trace.settlement_tx_id}`,
  )
}
console.log("")
console.log("Output:")
console.log(JSON.stringify(trace.output, null, 2))
console.log("")
