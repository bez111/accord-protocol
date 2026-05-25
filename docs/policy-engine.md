# Buyer Policy Engine

`@accord-protocol/buyer-policy` is the canonical buyer-side policy package for
Accord v0. It wraps an integrator-owned signer and decides whether an agent is
allowed to sign a payment for an Accord Agreement.

This package is for buyer-side gateways, agentic wallets, and autonomous agents
that need a small, auditable layer between an LLM-driven decision and the key
that signs a rail transaction.

## Install

```bash
npm install @accord-protocol/buyer-policy @accord-protocol/core
```

## Quick Start

```ts
import { createBuyerPolicyEnforcer } from "@accord-protocol/buyer-policy";

const enforcer = createBuyerPolicyEnforcer({
  policy: {
    maxSinglePayment: { amount: "5", currency: "USDC", decimals: 2 },
    maxSessionSpend: { amount: "50", currency: "USDC", decimals: 2 },
    maxDailySpend: { amount: "100", currency: "USDC", decimals: 2 },
    requireApprovalAbove: { amount: "2", currency: "USDC", decimals: 2 },
    allowedRecipients: ["provider://repo-audit-v1", "provider://summarizer-*"],
    allowedRails: ["ergo", "x402"],
    approvalTimeoutMs: 60_000,
    sessionTtlMs: 86_400_000,
  },
  signer: async (unsignedTx, context) => {
    return wallet.sign(unsignedTx, {
      sessionId: context.session_id,
      nonce: context.nonce,
    });
  },
  approvalHandler: async (request, abortSignal) => {
    return pushApprovalRequest(request, { signal: abortSignal });
  },
});

const session = enforcer.openSession({ agentId: "agent://buyer-agent" });

const result = await session.authorize({
  agreement,
  rail: "ergo",
  unsignedTx,
});
```

## Decision Semantics

Every `authorize()` call is evaluated in this order:

1. Session is open and not expired.
2. Agreement has the required v0 shape and passes semantic validation.
3. Requested rail is in `allowedRails`.
4. `agreement.payment.rail` matches the requested rail.
5. `agreement.seller.id` matches `allowedRecipients`.
6. Agreement price currency and decimals match the policy caps.
7. Price is at or below `maxSinglePayment`.
8. Session total after this authorization is at or below `maxSessionSpend`.
9. Rolling 24h total after this authorization is at or below `maxDailySpend`, when set.
10. If price is at or above `requireApprovalAbove`, `approvalHandler` must approve.
11. Budget is charged before the signer runs.
12. Signer receives the unsigned tx and a minimal context.
13. If the signer throws, the budget charge is rolled back.

The policy is deny-first. The signer is never called after a policy denial.

## Amounts

All policy caps and Agreement prices are decimal strings:

```ts
{ amount: "2.50", currency: "USDC", decimals: 2 }
```

The package parses amounts into scaled `BigInt` values. JavaScript numbers are
rejected at the API boundary to avoid precision drift. The package does not do
currency conversion; if an integrator wants cross-currency budgets, the
integrator must convert before calling `authorize()`.

All configured caps must share the same `(currency, decimals)` pair.

## Recipients

`allowedRecipients` is matched against `agreement.seller.id`.

Exact entries match only that exact id:

```ts
allowedRecipients: ["provider://repo-audit-v1"]
```

Suffix wildcard entries are allowed:

```ts
allowedRecipients: ["provider://summarizer-*"]
```

Only a single trailing `*` is supported. Leading, middle, `?`, and `**`
patterns are rejected at construction so matching remains easy to audit.

## Approval Handler

`approvalHandler` receives only public decision facts:

```ts
{
  agreement_id,
  buyer_id,
  seller_id,
  rail,
  price,
  session_id,
  issued_at
}
```

It does not receive the unsigned transaction, signer state, private keys,
session budget internals, or the full Agreement body.

The handler must return:

```ts
{ approved: boolean, approver_id?: string }
```

If it throws, times out, or returns a malformed shape, authorization is denied.

## Signer Context

The signer receives:

```ts
{
  session_id,
  nonce,
  agreement_id,
  rail
}
```

`nonce` is a fresh 16-byte hex string per authorization. The nonce helps the
integrator correlate or idempotency-check signing requests, but it is not a
rail replay store.

## Replay Boundary

Buyer policy is not replay protection.

The package charges budget per `authorize()` call, even if the same Agreement is
authorized twice. Replay and double-spend protection belongs to the rail,
gateway, Tracker, facilitator, or settlement layer:

- Accord/402 uses the gateway replay store.
- Ergo/Rosen Notes rely on on-chain UTxO spending and optional Tracker flows.
- Base/EVM relies on contract state.
- x402 relies on facilitator/payment-proof semantics plus gateway replay checks.

This boundary is intentional: buyer policy answers "may this signer sign this
payment now?", not "has this payment proof already settled?"

## Security Properties

The implementation pins these properties in tests:

- Per-session mutex prevents TOCTOU budget races.
- Amount parsing uses decimal strings plus `BigInt`.
- Invalid Agreement shape is rejected before policy checks.
- Rail and recipient checks run before approval and signer calls.
- Budget is charged before signer execution and rolled back on signer failure.
- Approval handler has a hard timeout.
- Session ids are 16 random bytes and membership checks use constant-time compare.
- Error messages avoid leaking prices, Agreement bodies, and unsigned tx bodies.
- Policy arrays are snapshotted at construction so later mutation does not reopen access.

## Error Codes

Branch on `err.code`, not `err.message`:

```text
POLICY_INVALID_CONFIG
POLICY_INVALID_AMOUNT_FORMAT
POLICY_INVALID_RECIPIENT_PATTERN
AGREEMENT_INVALID
RAIL_NOT_ALLOWED
RECIPIENT_NOT_ALLOWED
CURRENCY_MISMATCH
BUDGET_EXCEEDED_SINGLE
BUDGET_EXCEEDED_SESSION
BUDGET_EXCEEDED_DAILY
APPROVAL_REQUIRED_NO_HANDLER
APPROVAL_DENIED
APPROVAL_TIMEOUT
APPROVAL_HANDLER_ERROR
SESSION_EXPIRED
SESSION_CLOSED
SIGNER_ERROR
```

## What This Is Not

Buyer policy is not:

- a wallet;
- a signer;
- a custody layer;
- a push-notification service;
- durable cross-process accounting by itself;
- a replacement for rail replay protection;
- a mainnet audit certification mechanism.

Mainnet safety for scripts and contracts is still controlled by the audit
manifest workflow in [`ACCORD-010`](../specs/ACCORD-010-security-audit.md) and
[`docs/status.md`](./status.md).
