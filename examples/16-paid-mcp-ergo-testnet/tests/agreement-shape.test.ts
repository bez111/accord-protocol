// Agreement shape smoke test — does not hit the network.
// Verifies the agreement factory produces a valid v0 Accord Agreement
// with the testnet Reserve binding wired through.

import { strict as assert } from "node:assert"
import { test } from "node:test"
import { buildDemoAgreement, agreementHash } from "../common/agreement.js"

test("agreement carries the operator-supplied Reserve box id", () => {
  const a = buildDemoAgreement({
    repo_url: "https://github.com/foo/bar",
    reserve_box_id: "deadbeef".repeat(8),
    seller_id: "agent://test",
  })
  assert.equal(a.payment.rail, "ergo")
  assert.equal(a.payment.mode, "note")
  assert.equal(
    a.payment.reserve_ref,
    `ergo:box:${"deadbeef".repeat(8)}`,
    "reserve_ref must encode the operator-supplied Reserve box id, not a placeholder",
  )
})

test("agreement hash is deterministic for identical inputs", () => {
  const a = buildDemoAgreement({
    repo_url: "https://github.com/x/y",
    reserve_box_id: "ab".repeat(32),
    seller_id: "agent://s",
    agreement_id: "acc_FIXED",
  })
  const b = buildDemoAgreement({
    repo_url: "https://github.com/x/y",
    reserve_box_id: "ab".repeat(32),
    seller_id: "agent://s",
    agreement_id: "acc_FIXED",
  })
  // created_at differs by ms so hashes can differ; what we want here is
  // that the function is stable shape-wise. Re-pin created_at to compare.
  ;(a as { created_at: string }).created_at = "2026-01-01T00:00:00Z"
  ;(b as { created_at: string }).created_at = "2026-01-01T00:00:00Z"
  assert.equal(agreementHash(a), agreementHash(b))
})
