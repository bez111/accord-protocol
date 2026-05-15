#!/usr/bin/env node
import {
  accordHashV0,
  validateAgreement,
  validateSettlementReceipt,
  validateVerificationReceipt,
} from "@accord-protocol/core";
import { createBaseRailAdapter, decimalToBaseUnits } from "@accord-protocol/rails-base";
import {
  BaseAgentPay,
  BaseAgentPayError,
  assertProductionSafety,
  computeTaskHash,
} from "agentpay-base";

const TASK_OUTPUT = '{"word_count":2,"schema":"base.stub.response.v0"}';
const BUYER = `0x${"1".repeat(40)}`;
const SELLER = `0x${"2".repeat(40)}`;
const RESERVE_CONTRACT = `0x${"a".repeat(40)}`;
const TOKEN_CONTRACT = `0x${"b".repeat(40)}`;
const NOTE_ID = `0x${"c".repeat(64)}`;
const APPROVE_TX_HASH = `0x${"1".repeat(64)}`;
const TOP_UP_TX_HASH = `0x${"2".repeat(64)}`;
const ISSUE_TX_HASH = `0x${"3".repeat(64)}`;
const REDEEM_TX_HASH = `0x${"4".repeat(64)}`;
const EXPECTED_BASE_UNITS = 50_000n;

const AGREEMENT = {
  type: "accord.agreement.v0",
  version: "v0",
  agreement_id: "acc_base_stub_20260515",
  created_at: "2026-05-15T21:15:00Z",
  buyer: { id: "agent://base-stub-buyer" },
  seller: { id: "provider://accord-base-stub-seller" },
  task: {
    kind: "evm_note_paid_tool",
    input_ref: "stub://base/usdc-tool",
    description: "Validate a Base/EVM Note against the Accord Base rail adapter.",
    output_schema: "base.stub.response.v0",
  },
  price: { amount: "0.05", currency: "USDC", decimals: 6 },
  payment: {
    mode: "note",
    rail: "base",
    reserve_ref: `base-sepolia:${RESERVE_CONTRACT}`,
    deadline: "+480 blocks",
  },
  verification: {
    required: true,
    method: "verifier_receipt",
    verifier: "verifier://base-stub-v0",
    evidence_required: ["schema_valid", "task_hash_valid", "amount_valid"],
  },
  settlement: { mode: "inline", refund_policy: "expiry", dispute_policy: "none" },
  metadata: { labels: ["pilot", "base", "stub"] },
};

const agreementHash = "blake2b256:0x" + accordHashV0(AGREEMENT);
const taskHash = computeTaskHash(TASK_OUTPUT);
const state = makeState();
const { publicClient, walletClient, writes } = makeMockClients(state);

const buyerAgent = new BaseAgentPay({
  address: BUYER,
  network: "base-sepolia",
  reserveContract: RESERVE_CONTRACT,
  tokenContract: TOKEN_CONTRACT,
  publicClient,
  walletClient,
});

const sellerAgent = new BaseAgentPay({
  address: SELLER,
  network: "base-sepolia",
  reserveContract: RESERVE_CONTRACT,
  tokenContract: TOKEN_CONTRACT,
  publicClient,
  walletClient,
});

const decimals = await buyerAgent.getTokenDecimals();
const required = decimalToBaseUnits(AGREEMENT.price.amount, decimals);
if (required !== EXPECTED_BASE_UNITS) {
  throw new Error(`unexpected base-unit conversion: ${required}`);
}

const topUp = await buyerAgent.topUp(required);
const issued = await buyerAgent.issueNote({
  recipient: SELLER,
  amount: required,
  expiry: "+480 blocks",
  taskHash,
});

const rail = createBaseRailAdapter({ ops: sellerAgent, network: "base-sepolia" });
const payment = {
  note_id: issued.noteId,
  task_output: TASK_OUTPUT,
  tx_hash: issued.txHash,
};

const verifyResult = await rail.verifyPayment({ agreement: AGREEMENT, payment });
if (!verifyResult.ok) {
  throw new Error(`expected verifyPayment ok, got ${verifyResult.code}: ${verifyResult.message}`);
}

const taskMismatch = await rail.verifyPayment({
  agreement: AGREEMENT,
  payment: { ...payment, task_output: "wrong base task output" },
});
if (taskMismatch.ok) {
  throw new Error("wrong task output unexpectedly passed");
}

const verificationReceipt = {
  type: "accord.verification_receipt.v0",
  version: "v0",
  receipt_id: "vr_" + toBase32(accordHashV0(`vr:${AGREEMENT.agreement_id}`), 26),
  agreement_id: AGREEMENT.agreement_id,
  agreement_hash: agreementHash,
  verifier: { id: "verifier://base-stub-v0" },
  result: "accepted",
  evidence: {
    output_hash: "blake2b256:0x" + accordHashV0(TASK_OUTPUT),
    output_ref: "stub://base/usdc-tool",
    schema: "base.stub.response.v0",
  },
  checks: [
    { name: "schema_valid", result: "pass" },
    { name: "task_hash_valid", result: "pass", detail: taskHash },
    { name: "amount_valid", result: "pass", detail: "0.05 USDC = 50000 base units" },
  ],
  created_at: "2026-05-15T21:15:10Z",
  signature: {
    scheme: "ed25519",
    public_key: "0xstub-base-verifier-public-key",
    signature: "0xstub-base-verifier-signature",
  },
};

const settlementReceipt = await rail.settle({
  agreement: AGREEMENT,
  payment,
  verification: verificationReceipt,
});

let testnetWriteAllowed = false;
await assertProductionSafety({
  operation: "issueNote",
  network: "base-sepolia",
  reserveContract: RESERVE_CONTRACT,
  publicClient,
});
testnetWriteAllowed = true;

let mainnetDefaultDenied = false;
let mainnetDenyCode = "";
try {
  await assertProductionSafety({
    operation: "issueNote",
    network: "base",
    reserveContract: RESERVE_CONTRACT,
    publicClient,
  });
} catch (err) {
  if (err instanceof BaseAgentPayError && err.code === "UNAUDITED_CONTRACT") {
    mainnetDefaultDenied = true;
    mainnetDenyCode = err.code;
  } else {
    throw err;
  }
}
if (!mainnetDefaultDenied) {
  throw new Error("mainnet audit gate did not default-deny unaudited contract writes");
}

const agreementValidation = validateAgreement(AGREEMENT);
const verificationValidation = validateVerificationReceipt(verificationReceipt, {
  agreement: AGREEMENT,
});
const settlementValidation = validateSettlementReceipt(settlementReceipt, {
  agreement: AGREEMENT,
});

if (!agreementValidation.ok || !verificationValidation.ok || !settlementValidation.ok) {
  throw new Error(
    JSON.stringify(
      {
        agreement: agreementValidation.problems,
        verification: verificationValidation.problems,
        settlement: settlementValidation.problems,
      },
      null,
      2,
    ),
  );
}

if (settlementReceipt.verification_receipts?.[0] !== verificationReceipt.receipt_id) {
  throw new Error("settlement receipt did not reference the verification receipt");
}

const note = state.notes.get(NOTE_ID);
const evidence = {
  ok: true,
  mode: "local-contract-stub",
  agreement_id: AGREEMENT.agreement_id,
  agreement_hash: agreementHash,
  verification_receipt_id: verificationReceipt.receipt_id,
  settlement_receipt_id: settlementReceipt.settlement_id,
  settlement_tx_id: settlementReceipt.tx.tx_id,
  note_id: issued.noteId,
  issuance_tx_id: issued.txHash,
  approve_tx_id: topUp.approveTxHash,
  top_up_tx_id: topUp.topUpTxHash,
  network: settlementReceipt.tx.network,
  contract: {
    reserve_contract: RESERVE_CONTRACT,
    token_contract: TOKEN_CONTRACT,
    deployed_on_base_sepolia: false,
    source: "local mock viem clients exercising AgentPayReserveV0 semantics",
  },
  accounting: {
    price: AGREEMENT.price.amount,
    currency: AGREEMENT.price.currency,
    decimals,
    expected_base_units: EXPECTED_BASE_UNITS.toString(),
    actual_note_amount: verifyResult.details.note_amount,
    matched: verifyResult.details.note_amount === EXPECTED_BASE_UNITS.toString(),
  },
  evm_note: {
    issuer: note?.issuer,
    recipient: note?.recipient,
    task_hash: note?.taskHash,
    redeemed: note?.redeemed,
  },
  audit_gate: {
    base_sepolia_write_allowed: testnetWriteAllowed,
    base_mainnet_default_denied: mainnetDefaultDenied,
    base_mainnet_deny_code: mainnetDenyCode,
  },
  negative_checks: {
    wrong_task_output_rejected: true,
    wrong_task_output_code: taskMismatch.code,
  },
  external_evidence: {
    live_base_sepolia_tx: false,
    explorer_urls: [],
    missing_for_full_p4_pass: [
      "Base Sepolia RPC endpoint",
      "funded Base Sepolia signer",
      "deployed AgentPayReserveV0 contract address or deployment tx",
      "live reserve/note/redemption/refund transaction link",
    ],
  },
  stub_assumptions: {
    real: [
      "agentpay-base SDK",
      "@accord-protocol/rails-base adapter",
      "Accord receipt validators",
      "Base mainnet audit gate default-deny path",
    ],
    stubbed: [
      "viem PublicClient",
      "viem WalletClient",
      "ERC-20 approve/topUp state",
      "AgentPayReserveV0 Note storage and redeem transition",
    ],
    unavailable: ["live Base Sepolia RPC/signer/contract/transaction evidence"],
  },
  writes,
  receipt_checks: {
    agreement_valid: agreementValidation.ok,
    verification_receipt_valid: verificationValidation.ok,
    settlement_receipt_valid: settlementValidation.ok,
    settlement_references_verification:
      settlementReceipt.verification_receipts?.[0] === verificationReceipt.receipt_id,
  },
};

console.log(JSON.stringify(evidence, bigintReplacer, 2));

function makeState() {
  return {
    blockNumber: 1_000_000n,
    decimals: 6,
    reserveBalances: new Map([[BUYER.toLowerCase(), 0n]]),
    tokenBalances: new Map([
      [BUYER.toLowerCase(), 1_000_000n],
      [SELLER.toLowerCase(), 0n],
    ]),
    notes: new Map(),
  };
}

function makeMockClients(stubState) {
  const writes = [];
  const publicClient = {
    async getBlockNumber() {
      return stubState.blockNumber;
    },
    async getBytecode() {
      return "0x6080604052";
    },
    async readContract(args) {
      switch (args.functionName) {
        case "reserveBalance":
          return stubState.reserveBalances.get(String(args.args[0]).toLowerCase()) ?? 0n;
        case "balanceOf":
          return stubState.tokenBalances.get(String(args.args[0]).toLowerCase()) ?? 0n;
        case "decimals":
          return stubState.decimals;
        case "previewNoteId":
          return NOTE_ID;
        case "getNote": {
          const note = stubState.notes.get(String(args.args[0]).toLowerCase());
          return (
            note ?? {
              issuer: `0x${"0".repeat(40)}`,
              recipient: `0x${"0".repeat(40)}`,
              amount: 0n,
              expiryBlock: 0n,
              taskHash: `0x${"0".repeat(64)}`,
              redeemed: false,
            }
          );
        }
        default:
          throw new Error(`unmocked readContract: ${args.functionName}`);
      }
    },
    async waitForTransactionReceipt() {
      return { logs: [] };
    },
  };

  const walletClient = {
    async writeContract(args) {
      const account = String(args.account).toLowerCase();
      writes.push({
        functionName: args.functionName,
        address: args.address,
        account: args.account,
        args: args.args.map((arg) => (typeof arg === "bigint" ? arg.toString() : arg)),
      });
      switch (args.functionName) {
        case "approve":
          return APPROVE_TX_HASH;
        case "topUp": {
          const amount = BigInt(args.args[0]);
          const balance = stubState.tokenBalances.get(account) ?? 0n;
          if (balance < amount) throw new Error("mock token balance too low");
          stubState.tokenBalances.set(account, balance - amount);
          stubState.reserveBalances.set(
            account,
            (stubState.reserveBalances.get(account) ?? 0n) + amount,
          );
          return TOP_UP_TX_HASH;
        }
        case "issueNote": {
          const [recipient, amountRaw, expiryBlock, issuedTaskHash] = args.args;
          const amount = BigInt(amountRaw);
          const reserve = stubState.reserveBalances.get(account) ?? 0n;
          if (reserve < amount) throw new Error("mock reserve too low");
          stubState.reserveBalances.set(account, reserve - amount);
          stubState.notes.set(NOTE_ID.toLowerCase(), {
            issuer: args.account,
            recipient,
            amount,
            expiryBlock,
            taskHash: issuedTaskHash,
            redeemed: false,
          });
          return ISSUE_TX_HASH;
        }
        case "redeemNote": {
          const [noteId, taskBytes] = args.args;
          const note = stubState.notes.get(String(noteId).toLowerCase());
          if (!note) throw new Error("mock Note not found");
          if (note.redeemed) throw new Error("mock Note already redeemed");
          if (stubState.blockNumber >= BigInt(note.expiryBlock)) throw new Error("mock Note expired");
          if (String(note.recipient).toLowerCase() !== account) throw new Error("mock NotRecipient");
          const decodedTaskOutput = Buffer.from(String(taskBytes).slice(2), "hex").toString("utf8");
          if (computeTaskHash(decodedTaskOutput).toLowerCase() !== String(note.taskHash).toLowerCase()) {
            throw new Error("mock InvalidTaskOutput");
          }
          note.redeemed = true;
          stubState.tokenBalances.set(
            account,
            (stubState.tokenBalances.get(account) ?? 0n) + BigInt(note.amount),
          );
          return REDEEM_TX_HASH;
        }
        default:
          throw new Error(`unmocked writeContract: ${args.functionName}`);
      }
    },
  };

  return { publicClient, walletClient, writes };
}

function toBase32(hex, length) {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let out = "";
  let bits = 0;
  let value = 0;
  for (let i = 0; out.length < length; i = (i + 1) % hex.length) {
    value = (value << 4) | parseInt(hex[i], 16);
    bits += 4;
    if (bits >= 5) {
      bits -= 5;
      out += alphabet[(value >> bits) & 0x1f];
    }
  }
  return out;
}

function bigintReplacer(_key, value) {
  return typeof value === "bigint" ? value.toString() : value;
}
