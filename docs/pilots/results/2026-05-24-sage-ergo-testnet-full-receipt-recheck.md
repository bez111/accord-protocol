# Pilot Result - Sage Ergo Testnet Full Receipt Recheck

## Summary

| Field | Value |
|---|---|
| Pilot | Ergo testnet Note settlement |
| Date | 2026-05-24 |
| Operator | Sage live testnet flow; evidence captured by Codex |
| Git commit | `bcf2575b` |
| Network | Ergo testnet |
| Result | `pass` |

## Scenario

- User story: recheck the latest public Sage full receipt bundle after the
  original 2026-05-15 pilot found no public Agreement / Verification Receipt /
  Settlement Receipt JSON.
- Rail: `ergo`.
- Tool or endpoint: `https://www.ergoblockchain.org/api/sage/*`.
- Buyer identity: anonymous Sage buyer using a testnet Note.
- Seller identity: Sage seller wallet `3WwRauZrYjaQYgnS9P6U4i7Ng7MBzn8MSh4yPXA9qgcySrmkEdn6`.
- Verifier identity: `verifier://sage-self-v0`.

## Commands

```bash
npm run pilots:sage:live
curl -sS 'https://www.ergoblockchain.org/api/sage/receipt/f8752d10a2ece92fbc88065c3b92b94da621ec65943098f43c9e084deb763d81'
curl -sS 'https://www.ergoblockchain.org/evidence/sage/conformance-l1-2026-05-21.signed.json'
curl -sS 'https://www.ergoblockchain.org/evidence/sage/provider-signing-key.json'
curl -sS 'https://api-testnet.ergoplatform.com/api/v1/transactions/f8752d10a2ece92fbc88065c3b92b94da621ec65943098f43c9e084deb763d81'
curl -sS 'https://api-testnet.ergoplatform.com/api/v1/boxes/c942939bead0faa601dfea59e222784052ff6d01709c670f036c53395ab72630'
```

Command evidence:

- `npm run pilots:sage:live`: exited `0`.
- Sage API receipt returned `status: "settled_on_chain"` and
  `completeness: "full_receipt_bundle"`.
- Full Agreement, Verification Receipt, and Settlement Receipt JSON are now
  publicly exposed.
- Locally computed `accordHashV0` values match the three published receipt
  hashes.
- JSON Schema and core semantic validators passed for Agreement, Verification
  Receipt, and Settlement Receipt binding.
- Signed Sage L1 conformance result verified against public key
  `0xa94e16b40ce918db8f2925bd3f9c0bd604a38e40ffcbb46e5d758bdc6ae587bc`.
- Public receipt URL returned HTTP 200.
- Ergo testnet API confirmed the Note box was spent by the settlement tx.

## Expected Receipts

| Receipt | Required? | Expected evidence |
|---|---:|---|
| Agreement | Yes | Full JSON, schema-valid `agreement_id`, `agreement_hash`, Note task binding |
| Verification Receipt | Yes | Full JSON, schema-valid `receipt_id`, verifier id, accepted result |
| Settlement Receipt | Yes | Full JSON, schema-valid `settlement_id`, rail, Note box id, redemption tx id |
| Conformance Result | Yes | Signed L1 or stronger result with provider public key |

## Observed Receipts

```json
{
  "agreement_id": "acc_BGYV1X1X34PA2W2V1CSBGYN5ZF",
  "agreement_hash": "blake2b256:0x7bbe425952efa0b912207e7c4b322079a0b5b3027cc5bc95b076376e4aeff404",
  "verification_receipt_id": "vr_KCJ6SM1PY3T3M3YYWN2R2MYBBB",
  "verification_receipt_hash": "blake2b256:0xca885a458db9e584a54ceefdadfa3feb02e33c9978469311a3fee7dbacd2f767",
  "settlement_receipt_id": "sr_EMT2RKDVZMBKWYAJRY3CCPFYDT",
  "settlement_receipt_hash": "blake2b256:0x80790a943f0189e5639b7070ddfe3aef43ab28aee40c193daa4c2d06bdf998c8",
  "settlement_tx_id": "f8752d10a2ece92fbc88065c3b92b94da621ec65943098f43c9e084deb763d81",
  "conformance_result": "Sage Accord conformance passed with achieved_level=L1 and zero failed checks."
}
```

Schema and semantic results from `npm run pilots:sage:live`:

- Agreement: schema-valid and semantic-valid.
- Verification Receipt: schema-valid and semantic-valid.
- Settlement Receipt: schema-valid and semantic-valid.
- Published hashes match locally recomputed `accordHashV0` values.
- Receipt signatures use the Accord v0-compatible Ed25519 shape.

## Explorer / External Evidence

- API full receipt bundle: `https://www.ergoblockchain.org/api/sage/receipt/f8752d10a2ece92fbc88065c3b92b94da621ec65943098f43c9e084deb763d81`
- Public receipt: `https://www.ergoblockchain.org/r/sage/f8752d10a2ece92fbc88065c3b92b94da621ec65943098f43c9e084deb763d81`
- Settlement explorer: `https://testnet.ergoplatform.com/transactions/f8752d10a2ece92fbc88065c3b92b94da621ec65943098f43c9e084deb763d81`
- Settlement tx API: `https://api-testnet.ergoplatform.com/api/v1/transactions/f8752d10a2ece92fbc88065c3b92b94da621ec65943098f43c9e084deb763d81`
- Settlement block: `356728`
- Note tx: `30ace821d11a3f19098f0d9dee09c016c858da105efa6904aef4a84bb6782a88`
- Note box: `c942939bead0faa601dfea59e222784052ff6d01709c670f036c53395ab72630`
- Note box explorer: `https://testnet.ergoplatform.com/boxes/c942939bead0faa601dfea59e222784052ff6d01709c670f036c53395ab72630`
- Note box API: `https://api-testnet.ergoplatform.com/api/v1/boxes/c942939bead0faa601dfea59e222784052ff6d01709c670f036c53395ab72630`
- Note value: `1000000` nanoERG (`0.001` ERG)
- Note spent by settlement tx:
  `f8752d10a2ece92fbc88065c3b92b94da621ec65943098f43c9e084deb763d81`
- Signed conformance result:
  `https://www.ergoblockchain.org/evidence/sage/conformance-l1-2026-05-21.signed.json`
- Provider public key:
  `https://www.ergoblockchain.org/evidence/sage/provider-signing-key.json`
- Facilitator proof: N/A - Ergo Note rail, no x402 facilitator.

## Failure Classification

None - this recheck passed.

## Rollback

- Funds recovered or expired: the Note box was spent by settlement tx
  `f8752d10a2ece92fbc88065c3b92b94da621ec65943098f43c9e084deb763d81`.
- Keys rotated: no private keys, mnemonics, bearer tokens, or signed
  transaction payloads were handled in this repository during evidence capture.
- Pending Notes cancelled or documented: no pending Note is part of this result
  record.
- Follow-up test: keep `npm run pilots:sage:live` in release readiness so the
  public Sage bundle cannot regress from schema-valid, hash-bound, signed, and
  on-chain.
- Follow-up issue:
  `https://github.com/accord-protocol/accord-protocol/issues/71` can be closed
  after this result is merged.

## Notes

- This pilot does not certify mainnet use.
- This record proves the latest Sage public surface now exposes the full receipt
  JSON bundle and that the settlement tx spent the Note box on Ergo testnet.
- This record upgrades the Sage Ergo testnet full receipt recheck to `pass`.
