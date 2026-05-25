# `@accord-protocol/mcp`

**Accord/MCP transport wrapper.** Turns any MCP tool into a paid, verifiable Accord engagement: validate Agreement, verify payment via a rail adapter, run the seller's handler, optionally call a verifier, emit Verification + Settlement Receipts.

Public docs: [Website](https://accordprotocol.ai/) · [Accord/MCP guide](https://accordprotocol.ai/learn/accord-mcp-paid-tools/) · [Status](https://accordprotocol.ai/status/)

Rail-agnostic — the wrapper takes any `AccordRailAdapter`. Reference rail adapters (`@accord-protocol/rails-ergo`, `@accord-protocol/rails-base`, `@accord-protocol/rails-x402`) land separately.

## Install

```bash
npm install @accord-protocol/mcp @accord-protocol/core
```

## Quickstart

```ts
import { wrapAccordMcp, describeAccordMcpTool, type AccordRailAdapter } from "@accord-protocol/mcp";

// Plug your real rail in here. Stub for illustration:
const rail: AccordRailAdapter = {
  rail: "ergo",
  async verifyPayment({ agreement, payment }) {
    return { ok: true, rail: "ergo", payment_id: "<note-box-id>" };
  },
  async settle({ agreement }) {
    return { /* AccordSettlementReceipt */ } as never;
  },
};

const callPaidSummariser = wrapAccordMcp({
  rail,
  // Plug your storage here. The wrapper will reject calls whose
  // accord_agreement_id this function can't resolve.
  resolveAgreement: async (id) => store.get(id),

  // Optional. Only invoked when agreement.verification.required is true.
  // verifier: async ({ agreement, output }) => signedReceipt,

  handler: async ({ text }, { agreement }) => {
    return { word_count: text.split(/\s+/).length };
  },
});

// And the MCP tool definition with Accord fields injected:
const toolDef = describeAccordMcpTool({
  name: "summarise",
  description: "Summarise text. Paid.",
  inputSchema: { type: "object", properties: { text: { type: "string" } }, required: ["text"] },
});
```

## What the wrapper does on every call

```text
1. Pull accord_agreement_id / accord_payment / accord_task_output from buyer's args
2. resolveAgreement(id)                       → reject if unknown
3. validateAgreement(agreement)                → reject on cross-field problems
4. bind configured rail to agreement.payment.rail
   + rail.verifyPayment(agreement, payment)    → reject if payment fails or rail mismatch
5. replayStore.claim(rail, payment_id)         → reject if same id replayed
6. (optional) check accord_task_output hash    → reject if it doesn't match agreement.task.output_hash
7. handler(strippedArgs, { agreement })        → run the seller's tool
8. (if required) verifier(agreement, output)
   + validateVerificationReceipt(receipt)
   + check result !== "rejected"
9. (best-effort) rail.settle(...) + validate   → invalid receipts omitted from _meta
10. return output + _meta.accord_*
```

The wrapper **returns** structured errors (`isError: true` + `_meta.accord_error_code`) instead of throwing. MCP clients are easier to wire that way.

## Error codes

| Code | When |
|---|---|
| `MISSING_AGREEMENT_ID` | Buyer didn't include `accord_agreement_id` |
| `MISSING_PAYMENT` | Buyer didn't include `accord_payment` |
| `UNKNOWN_AGREEMENT` | `resolveAgreement(id)` returned undefined or threw |
| `AGREEMENT_INVALID` | `validateAgreement` from `@accord-protocol/core` rejected |
| `PAYMENT_VERIFICATION_FAILED` | Rail returned `{ ok: false }` |
| `PAYMENT_RAIL_MISMATCH` | Configured adapter, Agreement rail, or verified payment rail disagree |
| `RAIL_UNAVAILABLE` | Rail's `verifyPayment` threw |
| `REPLAY_DETECTED` | `payment_id` was already claimed within the replay TTL |
| `TASK_OUTPUT_HASH_MISMATCH` | Buyer's `accord_task_output` hash ≠ `agreement.task.output_hash` |
| `HANDLER_THREW` | Seller's handler threw |
| `VERIFICATION_REQUIRED` | `agreement.verification.required` is true but no verifier configured |
| `VERIFICATION_REJECTED` | Verifier rejected, or returned an invalid receipt |

## Rail binding and settlement validation

The wrapper rejects calls when the configured adapter rail, `agreement.payment.rail`, and `verifyPayment(...).rail` disagree.

Successful `verifyPayment(...)` results must include a stable non-empty `payment_id`. The wrapper claims `(rail, payment_id)` before running the tool; pass a production replay store with atomic `claim(...)` when running more than one process.

If `rail.settle(...)` is configured, the returned Settlement Receipt is validated against the Agreement before it is emitted in `_meta.accord_settlement_receipt`. Invalid settlement receipts are omitted and `_meta.accord_settlement_error` records the validation failure.

## What's NOT in this package

- Rail adapters (Ergo / Rosen / Base / x402) → `@accord-protocol/rails-*`
- HTTP-side transport → `@accord-protocol/gateway` + `@accord-protocol/x402`
- Conformance tests → `@accord-protocol/conformance`
- An MCP server runtime — bring your own (`@modelcontextprotocol/sdk` etc.). The wrapper is a function over args / results, framework-agnostic.

## License

MIT.
