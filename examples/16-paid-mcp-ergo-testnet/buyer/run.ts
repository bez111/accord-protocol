// ─────────────────────────────────────────────────────────────────────────────
// Buyer — drives the demo end-to-end against Ergo testnet.
//
//   1. Build the Accord Agreement using the operator-supplied Reserve.
//   2. Persist it where the seller's resolver can find it.
//   3. Compute the Acceptance Predicate's task hash from the expected output.
//   4. Issue a real Note via ergo-agent-pay (testnet tx submitted).
//   5. Wait for the Note tx to appear on chain.
//   6. Resolve note_box_id from the issuance tx's first output.
//   7. Call the seller's paywalled MCP tool with note_box_id.
//   8. Inspect the AccordMcpResult — output, _meta.accord_*, no isError.
//
// In a real deployment, the buyer agent would receive an agreement-template
// URL via 402 challenge or a /.well-known/accord lookup, build the Agreement
// client-side, and POST it to the seller's Create-Agreement API. The demo
// collapses these into one process for visibility.
// ─────────────────────────────────────────────────────────────────────────────

import { computeTaskHashAsync } from "ergo-agent-pay"
import {
  buildBuyerAgent,
  buildSellerAgent,
  loadTestnetConfigFromEnv,
} from "../common/setup.js"
import { buildDemoAgreement, agreementHash } from "../common/agreement.js"
import { InMemoryAgreementStore } from "../common/storage/agreement-store.js"
import { buildSeller } from "../seller/tool.js"
import { makeDemoVerifier } from "../verifier/sign.js"
import { resolveNoteBoxId } from "./resolve-note-box.js"

export interface DemoTrace {
  agreement_id: string
  agreement_hash: string
  note_box_id: string | undefined
  note_tx_id: string | undefined
  verification_receipt_id: string | undefined
  settlement_receipt_id: string | undefined
  settlement_tx_id: string | undefined
  output: unknown
  ok: boolean
  error_code?: string
}

export interface RunDemoOpts {
  repo_url?: string
  agreement_id?: string
}

export async function runDemo(opts: RunDemoOpts = {}): Promise<DemoTrace> {
  const repo_url =
    opts.repo_url ?? "https://github.com/accord-protocol/accord-protocol"
  const cfg = loadTestnetConfigFromEnv()

  const buyerAgent = buildBuyerAgent(cfg)
  const sellerAgent = buildSellerAgent(cfg)

  // 1. Build the Accord Agreement. The seller_id surfaces the testnet
  //    receiver address so the buyer can verify *who* will redeem the Note.
  const agreement = buildDemoAgreement({
    repo_url,
    reserve_box_id: cfg.reserveBoxId,
    seller_id: `agent://ergo-testnet/${cfg.sellerAddress}`,
    agreement_id: opts.agreement_id,
  })

  // 2. Persist for the seller's MCP resolver.
  const store = new InMemoryAgreementStore()
  store.put(agreement)

  // 3. Compute the acceptance predicate's task hash. The seller's handler
  //    deterministically returns this output for the given repo_url, so
  //    the buyer can pre-compute the hash and lock the Note to it.
  const expectedOutput = JSON.stringify({
    schema: "accord.audit_report.v0",
    repo_url,
    findings: [], // structural commitment — exact findings checked by the verifier
  })
  const taskHash = await computeTaskHashAsync(expectedOutput)

  // 4. Issue a real Note on testnet. ergo-agent-pay signs + submits.
  //    The agreement's deadline is typed as a generic string when read
  //    back through AccordAgreement; we narrow it to the literal shape
  //    issueNote expects.
  const noteResult = await buyerAgent.issueNote({
    recipient: cfg.sellerAddress,
    value: `${agreement.price.amount} ERG`,
    reserveBoxId: cfg.reserveBoxId,
    deadline: agreement.payment.deadline as `+${number} blocks`,
    taskHash,
  })

  if (!noteResult.submitted || !noteResult.txId) {
    return {
      agreement_id: agreement.agreement_id,
      agreement_hash: agreementHash(agreement),
      note_box_id: undefined,
      note_tx_id: undefined,
      verification_receipt_id: undefined,
      settlement_receipt_id: undefined,
      settlement_tx_id: undefined,
      output: undefined,
      ok: false,
      error_code: "NOTE_NOT_SUBMITTED",
    }
  }

  // 5 + 6. Prefer signer-provided output ids; fall back to explorer polling
  //        when the signer/submit endpoint returned only txId.
  const noteBoxId =
    noteResult.noteBoxId ??
    (await resolveNoteBoxId({
      txId: noteResult.txId,
      network: "testnet",
      outputIndex: noteResult.noteOutputIndex,
    }))

  // 7. Make the paid call.
  const verifier = makeDemoVerifier()
  const { callTool } = buildSeller({
    agreementStore: store,
    sellerAgent,
    verifier,
  })

  const result = await callTool({
    accord_agreement_id: agreement.agreement_id,
    accord_payment: {
      note_box_id: noteBoxId,
      task_output: expectedOutput,
      receiver_address: cfg.sellerAddress,
    },
    repo_url,
  } as never)

  // 8. Build a structured trace.
  const trace: DemoTrace = {
    agreement_id: agreement.agreement_id,
    agreement_hash: agreementHash(agreement),
    note_box_id: noteBoxId,
    note_tx_id: noteResult.txId,
    verification_receipt_id: undefined,
    settlement_receipt_id: undefined,
    settlement_tx_id: undefined,
    output: undefined,
    ok: !result.isError,
    error_code: result.isError ? String(result._meta.accord_error_code) : undefined,
  }

  if (!result.isError) {
    trace.output = result.output
    trace.verification_receipt_id =
      result._meta.accord_verification_receipt?.receipt_id
    trace.settlement_receipt_id =
      result._meta.accord_settlement_receipt?.settlement_id
    trace.settlement_tx_id =
      result._meta.accord_settlement_receipt?.tx?.tx_id
  }

  return trace
}
