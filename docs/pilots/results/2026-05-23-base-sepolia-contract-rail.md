# Base Sepolia Contract Rail Pilot

## Summary

| Field | Value |
|---|---|
| Pilot | Base Sepolia contract rail |
| Date | 2026-05-23 |
| Operator | Codex using project-owned Base Sepolia burner account |
| Git commit | cb8eb96 |
| Network | Base Sepolia |
| Result | `pass` |

This result does not certify mainnet use. Accord remains NOT CERTIFIED FOR
MAINNET until the relevant signed audit manifests mark exact deployed
bytecode entries `mainnetAllowed: true`.

## Scenario

- User story: Validate that the Base/EVM rail can issue, verify, and redeem a live testnet Note.
- Rail: `@accord-protocol/rails-base` over `agentpay-base`.
- Tool or endpoint: `npm run pilots:base:live -- --live`.
- Buyer identity: `agent://base-sepolia/0xFb2F23f83ac54009c653172797F0Ecf985604380`.
- Seller identity: `provider://base-sepolia/0xFb2F23f83ac54009c653172797F0Ecf985604380`.
- Verifier identity: `verifier://base-sepolia-live-pilot-v0`.

## Commands

```bash
npm install --include=optional
npm run build --workspace agentpay-base
npm test --workspace agentpay-base
npm run build --workspace @accord-protocol/rails-base
npm test --workspace @accord-protocol/rails-base
npm run pilots:base:stub
BASE_SEPOLIA_LIVE=1 npm run pilots:base:live -- --live
npx accord-conformance --levels L0,L1,L2,L3,L4
```

## Expected Receipts

| Receipt | Required? | Expected evidence |
|---|---:|---|
| Agreement | Yes | `agreement_id`, `agreement_hash`, `rail: "base"` |
| Verification Receipt | Yes | accepted verifier receipt bound to the Agreement hash |
| Settlement Receipt | Yes | `rail: "base"`, `mode: "redeemed"`, Base Sepolia tx id |
| Conformance Result | Yes | L0-L4 local conformance output |

## Observed Receipts

```json
{
  "agreement_id": "acc_base_sepolia_1779560257980",
  "agreement_hash": "blake2b256:0xc11e1223210638a5b5f6b89b528a0355b1be7cf66b05f49a4c5365d8441c8214",
  "verification_receipt_id": "vr_3XGH6WAG46FTH6PEYT9M82866Q",
  "settlement_receipt_id": "sr_8CDAQ4YKT1SDB1TSSPQTRBDKAK",
  "settlement_tx_id": "0xf6ab7267f1ff489524d06884effa045f9430858509348cbf30970f34cb741f92",
  "conformance_result": "Achieved: L4 (L0 26/26, L1 13/13, L2 24/24, L3 12/12, L4 16/16)"
}
```

Live runner evidence:

```json
{
  "mode": "live-base-sepolia",
  "network": "base-sepolia",
  "rpc_endpoint_host": "sepolia.base.org",
  "reserve_contract": "0x08e27593a6e89ed04eB0eBAe249A460657d3Cc89",
  "token_contract": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "reserve_runtime_bytecode_hash_keccak256": "0xbec4df1379e1878e128c5ac16b4daba0639089f36fefc504cf93b6f4863e0875",
  "token_runtime_bytecode_hash_keccak256": "0xedc5281a85c0efecd49999a1ef668390c59b88702f2d4a07029d7f5d63059d6c",
  "price": "0.01",
  "currency": "USDC",
  "amount_base_units": "10000",
  "note_id": "0x82ca18b4d398c6e672e40a73a40ac5bbca5747040863a149583913831dab7c0e",
  "task_hash": "0xb704f4bd2e84f039dbaf63dc460b75eddaf24130223b8f1f6bc5f4a0a2175393",
  "redeemed_after_settlement": true,
  "audit_gate": {
    "base_sepolia_write_allowed": true,
    "base_mainnet_default_denied": true,
    "base_mainnet_deny_code": "UNAUDITED_CONTRACT"
  },
  "negative_checks": {
    "wrong_task_output_rejected": true,
    "wrong_task_output_code": "TASK_HASH_MISMATCH"
  },
  "receipt_checks": {
    "agreement_valid": true,
    "verification_receipt_valid": true,
    "settlement_receipt_valid": true,
    "settlement_references_verification": true
  }
}
```

Conformance output:

```text
Accord Conformance - local:accord-protocol
  2026-05-23T18:20:20Z -> 2026-05-23T18:20:20Z

  L0 PASS  (26/26 pass, 0 fail, 0 inconclusive)
  L1 PASS  (13/13 pass, 0 fail, 0 inconclusive)
  L2 PASS  (24/24 pass, 0 fail, 0 inconclusive)
  L3 PASS  (12/12 pass, 0 fail, 0 inconclusive)
  L4 PASS  (16/16 pass, 0 fail, 0 inconclusive)

Achieved: L4
```

## Explorer / External Evidence

- Deploy tx: <https://sepolia.basescan.org/tx/0x09e750fcd1a9f17d3df249eecd82c7586084fbd3560aaa64034c10851696b8ad>
- Reserve contract: <https://sepolia.basescan.org/address/0x08e27593a6e89ed04eb0ebae249a460657d3cc89>
- ERC-20 token contract: <https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e>
- Approve tx: <https://sepolia.basescan.org/tx/0x708573455b74e9d74cb76684b50fd91d0a0410d3f899248efd6dd855cdfff7cc>
- Reserve top-up tx: <https://sepolia.basescan.org/tx/0xad963ea39dfedb9f317288e5927fd3a843051bbc50a31d2af85858a8de8888da>
- Note issue tx: <https://sepolia.basescan.org/tx/0x05704e506af7100ca3d6de15b9cb9ca55bf6e23b516648672fda14772c061d48>
- Settlement tx: <https://sepolia.basescan.org/tx/0xf6ab7267f1ff489524d06884effa045f9430858509348cbf30970f34cb741f92>
- Note id: `0x82ca18b4d398c6e672e40a73a40ac5bbca5747040863a149583913831dab7c0e`
- Facilitator proof: not applicable.

## Failure Classification

None.

## Rollback

- Funds recovered or expired: The passing Note was redeemed and `redeemed_after_settlement` was observed as `true`.
- Keys rotated: Not required for the low-balance Base Sepolia burner account; no private key is stored in the repository.
- Pending Notes cancelled or documented: Earlier exploratory attempts emitted one pending test Note before the runner gained state-visibility waits; it is testnet-only and can be redeemed/refunded separately.
- Follow-up tests/issues: Keep the local-account signing fix in `agentpay-base`; keep the Base Sepolia runner's state-visibility waits for top-up, issue, and redeem.

## Notes

- `AgentPayReserveV0` was deployed on Base Sepolia against Circle test USDC.
- The live runner proved approval, reserve top-up, Note issuance, payment verification, negative task-hash rejection, redemption, receipt validation, and mainnet default-deny audit posture.
- The pilot does not update `AUDITED_CONTRACTS.json` and does not certify mainnet use.
