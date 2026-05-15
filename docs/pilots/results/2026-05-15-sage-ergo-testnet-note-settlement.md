# Pilot Result - Sage Ergo Testnet Note Settlement

## Summary

| Field | Value |
|---|---|
| Pilot | Ergo testnet Note settlement |
| Date | 2026-05-15 |
| Operator | Sage live testnet flow; evidence captured by Codex |
| Git commit | `b355ec6617ea2bfb2e022c5ffe8767817054bac9` |
| Network | Ergo testnet |
| Result | `inconclusive` |

## Scenario

- User story: a Sage premium-tier request on ergoblockchain.org paid with an Accord Note and later redeemed on Ergo testnet.
- Rail: `ergo`.
- Tool or endpoint: `https://www.ergoblockchain.org/api/sage/*`.
- Buyer identity: anonymous Sage buyer using a testnet Note.
- Seller identity: Sage seller wallet `3Wz1LmuZoaHqpSPm1SkhmFCu726FfdqkesEkNsiKtpBBJXqAY28w`.
- Verifier identity: `verifier://sage-self-v0`.

## Commands

```bash
npm run release:check
npm run build -w @accord-protocol/conformance
node packages/accord-conformance/dist/cli.js run --levels L0,L1,L2,L3,L4
curl -sS 'https://www.ergoblockchain.org/api/sage/activity?limit=5'
curl -sS -I 'https://www.ergoblockchain.org/r/sage/f697e4841dd9a0c689d0b83a311130b85a0cfbab123230a6c40284b44c4cafef'
curl -sS 'https://api-testnet.ergoplatform.com/api/v1/transactions/f697e4841dd9a0c689d0b83a311130b85a0cfbab123230a6c40284b44c4cafef'
curl -sS 'https://api-testnet.ergoplatform.com/api/v1/transactions/6d3115b13fa8e08e2e32e0a6361059b238c5ef86b414d677a7096dc61a3fea1c'
curl -sS 'https://api-testnet.ergoplatform.com/api/v1/boxes/4af1816cb444f51f5a77e60fa195806b3bfc3fef163feeb5bde7661c26628a4d'
```

Command evidence:

- `npm run release:check`: passed.
- `node packages/accord-conformance/dist/cli.js run --levels L0,L1,L2,L3,L4`: Achieved L4.
- Sage activity feed returned `ok: true`, `network: "testnet"`, `type: "settlement"`, and the settlement tx below.
- Public Sage receipt URL returned HTTP 200.
- Ergo testnet explorer confirmed the Note issuance tx, Reserve box, Note box, and redemption tx.

## Expected Receipts

| Receipt | Required? | Expected evidence |
|---|---:|---|
| Agreement | Yes | `agreement_id`, `agreement_hash`, Note task hash binding |
| Verification Receipt | Yes | `receipt_id`, verifier id, accepted result |
| Settlement Receipt | Yes | `settlement_id`, rail, Note box id, redemption tx id |
| Conformance Result | Yes | L0-L4 output |

## Observed Receipts

```json
{
  "agreement_id": "Not publicly reconstructable from the current Sage receipt surface; Sage quoteId is ephemeral server-side.",
  "agreement_hash": "Not publicly reconstructable from the current Sage receipt surface; on-chain Note R6 task hash is 9674cd3942614a20dc66e08a5d9fa4dfadcb511d6a9096b5eaf94a14230ced33.",
  "verification_receipt_id": "Not emitted as a public artifact by the current Sage receipt surface.",
  "settlement_receipt_id": "Not emitted as a public artifact by the current Sage receipt surface; public receipt anchors to the settlement tx id.",
  "settlement_tx_id": "f697e4841dd9a0c689d0b83a311130b85a0cfbab123230a6c40284b44c4cafef",
  "conformance_result": "Achieved: L4"
}
```

## Explorer / External Evidence

- Reserve tx: `195f769dc25d36244c271ff8bdc2be65b3f184a0440459fb67116f9b55d1f041`
- Reserve box: `4af1816cb444f51f5a77e60fa195806b3bfc3fef163feeb5bde7661c26628a4d`
- Reserve box explorer: `https://testnet.ergoplatform.com/boxes/4af1816cb444f51f5a77e60fa195806b3bfc3fef163feeb5bde7661c26628a4d`
- Note tx: `6d3115b13fa8e08e2e32e0a6361059b238c5ef86b414d677a7096dc61a3fea1c`
- Note tx explorer: `https://testnet.ergoplatform.com/transactions/6d3115b13fa8e08e2e32e0a6361059b238c5ef86b414d677a7096dc61a3fea1c`
- Note box: `5d77ba6bd6594415502b8802b109a2abf7eacab82fa072c96a04fe5cf14884cd`
- Note box explorer: `https://testnet.ergoplatform.com/boxes/5d77ba6bd6594415502b8802b109a2abf7eacab82fa072c96a04fe5cf14884cd`
- Note value: `1000000` nanoERG (`0.001` ERG)
- Note expiry block from R5: `345719`
- Note task hash from R6: `9674cd3942614a20dc66e08a5d9fa4dfadcb511d6a9096b5eaf94a14230ced33`
- Settlement tx: `f697e4841dd9a0c689d0b83a311130b85a0cfbab123230a6c40284b44c4cafef`
- Settlement block: `345673`
- Settlement explorer: `https://testnet.ergoplatform.com/transactions/f697e4841dd9a0c689d0b83a311130b85a0cfbab123230a6c40284b44c4cafef`
- Public receipt: `https://www.ergoblockchain.org/r/sage/f697e4841dd9a0c689d0b83a311130b85a0cfbab123230a6c40284b44c4cafef`
- Live activity feed: `https://www.ergoblockchain.org/api/sage/activity`
- Facilitator proof: N/A - Ergo Note rail, no x402 facilitator.

## Failure Classification

documentation.

The rail-level evidence is live and externally verifiable, but the current
public Sage receipt page reconstructs settlement from the chain and does not
publish the full Accord Agreement, Verification Receipt, or Settlement Receipt
JSON. This prevents marking the pilot as a full protocol `pass`.

## Rollback

- Funds recovered or expired: the Note box was spent by settlement tx `f697e4841dd9a0c689d0b83a311130b85a0cfbab123230a6c40284b44c4cafef`.
- Keys rotated: no private keys, mnemonics, bearer tokens, or signed transaction payloads were handled in this repository during evidence capture.
- Pending Notes cancelled or documented: no pending Note is part of this result record.
- Follow-up tests/issues: expose signed Accord Agreement, Verification Receipt, and Settlement Receipt JSON from Sage receipt/activity surfaces, then rerun this pilot as `pass`.

## Notes

- This pilot does not certify mainnet use.
- This record proves the Sage Ergo testnet Note was issued and redeemed on-chain.
- This record intentionally remains `inconclusive` until the public Sage surface exposes the protocol receipt IDs or signed receipt JSON needed to validate Agreement and Verification Receipt binding.
