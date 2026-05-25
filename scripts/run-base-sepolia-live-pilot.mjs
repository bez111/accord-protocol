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
  fetchBytecodeHash,
} from "agentpay-base";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  formatUnits,
  getAddress,
  http,
  isAddress,
  keccak256,
  parseUnits,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const TASK_OUTPUT = '{"word_count":2,"schema":"base.sepolia.live.response.v0"}';
const DEFAULT_AMOUNT = "0.01";
const DEFAULT_EXPIRY = "+480 blocks";
const DEFAULT_EXPLORER_TX_BASE = "https://sepolia.basescan.org/tx/";

const args = new Set(process.argv.slice(2));
if (args.has("--help") || args.has("-h")) {
  console.log([
    "Usage:",
    "  BASE_SEPOLIA_LIVE=1 npm run pilots:base:live -- --live",
    "",
    "Required env:",
    "  BASE_SEPOLIA_RPC_URL",
    "  BASE_SEPOLIA_BUYER_PRIVATE_KEY",
    "  BASE_SEPOLIA_RESERVE_CONTRACT",
    "  BASE_SEPOLIA_TOKEN_CONTRACT",
    "",
    "Optional env:",
    "  BASE_SEPOLIA_SELLER_PRIVATE_KEY  # defaults to buyer key",
    "  BASE_SEPOLIA_AMOUNT              # default: 0.01",
    "  BASE_SEPOLIA_EXPLORER_TX_BASE    # default: https://sepolia.basescan.org/tx/",
    "",
    "Safety:",
    "  Without BASE_SEPOLIA_LIVE=1 and --live this script only prints missing inputs.",
  ].join("\n"));
  process.exit(0);
}

try {
  await main();
} catch (err) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        mode: "base-sepolia-live",
        error: formatError(err),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

async function main() {
  const cfg = readConfig();
  if (!cfg.ready) {
    console.log(JSON.stringify(cfg.report, null, 2));
    return;
  }

  const buyerAccount = privateKeyToAccount(cfg.buyerPrivateKey);
  const sellerAccount = privateKeyToAccount(cfg.sellerPrivateKey ?? cfg.buyerPrivateKey);
  const reserveContract = getAddress(cfg.reserveContract);
  const tokenContract = getAddress(cfg.tokenContract);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(cfg.rpcUrl, { timeout: 60_000 }),
  });
  const buyerWallet = createWalletClient({
    account: buyerAccount,
    chain: baseSepolia,
    transport: http(cfg.rpcUrl, { timeout: 60_000 }),
  });
  const sellerWallet = createWalletClient({
    account: sellerAccount,
    chain: baseSepolia,
    transport: http(cfg.rpcUrl, { timeout: 60_000 }),
  });

  const chainId = await publicClient.getChainId();
  if (chainId !== baseSepolia.id) {
    throw new Error(`RPC is not Base Sepolia: expected chainId ${baseSepolia.id}, got ${chainId}`);
  }

  const reserveCode = await publicClient.getBytecode({ address: reserveContract });
  if (!reserveCode || reserveCode === "0x") {
    throw new Error(`No bytecode at BASE_SEPOLIA_RESERVE_CONTRACT ${reserveContract}`);
  }
  const tokenCode = await publicClient.getBytecode({ address: tokenContract });
  if (!tokenCode || tokenCode === "0x") {
    throw new Error(`No bytecode at BASE_SEPOLIA_TOKEN_CONTRACT ${tokenContract}`);
  }

  const buyerAgent = new BaseAgentPay({
    address: buyerAccount.address,
    network: "base-sepolia",
    reserveContract,
    tokenContract,
    publicClient,
    walletClient: buyerWallet,
  });
  const sellerAgent = new BaseAgentPay({
    address: sellerAccount.address,
    network: "base-sepolia",
    reserveContract,
    tokenContract,
    publicClient,
    walletClient: sellerWallet,
  });

  const blockBefore = await publicClient.getBlockNumber();
  const decimals = await buyerAgent.getTokenDecimals();
  const amountBaseUnits = parseUnits(cfg.amount, decimals);
  const amountViaRail = decimalToBaseUnits(cfg.amount, decimals);
  if (amountBaseUnits !== amountViaRail) {
    throw new Error(`Amount conversion mismatch: viem=${amountBaseUnits} rails-base=${amountViaRail}`);
  }

  const buyerGasBalance = await publicClient.getBalance({ address: buyerAccount.address });
  const sellerGasBalance = await publicClient.getBalance({ address: sellerAccount.address });
  if (buyerGasBalance === 0n) {
    throw new Error(`Buyer ${buyerAccount.address} has 0 ETH on Base Sepolia for gas`);
  }
  if (sellerGasBalance === 0n) {
    throw new Error(`Seller ${sellerAccount.address} has 0 ETH on Base Sepolia for gas`);
  }

  await assertProductionSafety({
    operation: "issueNote",
    network: "base-sepolia",
    reserveContract,
    publicClient,
  });

  const reserveBefore = await buyerAgent.getReserveBalance();
  const tokenBalanceBefore = await buyerAgent.getTokenBalance();
  let topUp = null;
  if (reserveBefore < amountBaseUnits) {
    const topUpAmount = amountBaseUnits - reserveBefore;
    if (tokenBalanceBefore < topUpAmount) {
      throw new Error(
        [
          `Buyer token balance too low for topUp.`,
          `Need ${formatUnits(topUpAmount, decimals)} token units.`,
          `Have ${formatUnits(tokenBalanceBefore, decimals)}.`,
          `Token contract: ${tokenContract}`,
        ].join(" "),
      );
    }
    topUp = await buyerAgent.topUp(topUpAmount);
    await waitFor(
      async () => (await buyerAgent.getReserveBalance()) >= amountBaseUnits,
      "reserve balance to reflect topUp",
    );
  }

  const agreement = buildAgreement({
    buyer: buyerAccount.address,
    seller: sellerAccount.address,
    reserveContract,
    amount: cfg.amount,
    decimals,
  });
  const agreementHash = "blake2b256:0x" + accordHashV0(agreement);
  const taskHash = computeTaskHash(TASK_OUTPUT);

  const issued = await buyerAgent.issueNote({
    recipient: sellerAccount.address,
    amount: amountBaseUnits,
    expiry: DEFAULT_EXPIRY,
    taskHash,
  });
  await waitFor(
    async () => {
      const note = await sellerAgent.checkNote(issued.noteId);
      return note.exists;
    },
    "issued Note to become visible",
  );

  const rail = createBaseRailAdapter({ ops: sellerAgent, network: "base-sepolia" });
  const payment = {
    note_id: issued.noteId,
    task_output: TASK_OUTPUT,
    tx_hash: issued.txHash,
  };

  const verifyResult = await rail.verifyPayment({ agreement, payment });
  if (!verifyResult.ok) {
    throw new Error(`verifyPayment failed: ${verifyResult.code}: ${verifyResult.message}`);
  }

  const taskMismatch = await rail.verifyPayment({
    agreement,
    payment: { ...payment, task_output: "wrong base sepolia task output" },
  });
  if (taskMismatch.ok) {
    throw new Error("wrong task output unexpectedly passed Base rail verification");
  }

  const verificationReceipt = buildVerificationReceipt({
    agreement,
    agreementHash,
    taskHash,
  });
  if (!rail.settle) throw new Error("rails-base settle() is unavailable");
  const settlementReceipt = await rail.settle({
    agreement,
    payment,
    verification: verificationReceipt,
  });

  await waitFor(
    async () => {
      const note = await sellerAgent.checkNote(issued.noteId);
      return note.redeemed;
    },
    "redeemed Note state to become visible",
  );
  const noteAfterRedeem = await sellerAgent.checkNote(issued.noteId);

  let mainnetDefaultDenied = false;
  let mainnetDenyCode = "";
  try {
    await assertProductionSafety({
      operation: "issueNote",
      network: "base",
      reserveContract,
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
    throw new Error("Base mainnet audit gate did not default-deny unaudited writes");
  }

  const agreementValidation = validateAgreement(agreement);
  const verificationValidation = validateVerificationReceipt(verificationReceipt, { agreement });
  const settlementValidation = validateSettlementReceipt(settlementReceipt, { agreement });
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

  const reserveBytecodeHash = await fetchBytecodeHash(publicClient, reserveContract);
  const tokenBytecodeHash = keccak256(tokenCode);
  const blockAfter = await publicClient.getBlockNumber();

  const evidence = {
    ok: true,
    mode: "live-base-sepolia",
    network: "base-sepolia",
    rpc_endpoint_host: safeHost(cfg.rpcUrl),
    accounts: {
      buyer: buyerAccount.address,
      seller: sellerAccount.address,
      single_signer_mode: buyerAccount.address.toLowerCase() === sellerAccount.address.toLowerCase(),
      buyer_gas_eth_before: formatEther(buyerGasBalance),
      seller_gas_eth_before: formatEther(sellerGasBalance),
    },
    contract: {
      reserve_contract: reserveContract,
      token_contract: tokenContract,
      reserve_runtime_bytecode_hash_keccak256: reserveBytecodeHash,
      token_runtime_bytecode_hash_keccak256: tokenBytecodeHash,
    },
    accounting: {
      price: agreement.price.amount,
      currency: agreement.price.currency,
      decimals,
      amount_base_units: amountBaseUnits.toString(),
      buyer_reserve_before: reserveBefore.toString(),
      buyer_token_balance_before: tokenBalanceBefore.toString(),
      top_up_tx_id: topUp?.topUpTxHash ?? null,
      approve_tx_id: topUp?.approveTxHash ?? null,
    },
    agreement,
    agreement_hash: agreementHash,
    verification_receipt: verificationReceipt,
    settlement_receipt: settlementReceipt,
    note: {
      note_id: issued.noteId,
      issuance_tx_id: issued.txHash,
      task_hash: taskHash,
      redeemed_after_settlement: noteAfterRedeem.redeemed,
      current_block_after: noteAfterRedeem.currentBlock.toString(),
    },
    explorer_urls: {
      approve: topUp?.approveTxHash ? txUrl(cfg.explorerTxBase, topUp.approveTxHash) : null,
      top_up: topUp?.topUpTxHash ? txUrl(cfg.explorerTxBase, topUp.topUpTxHash) : null,
      issue_note: txUrl(cfg.explorerTxBase, issued.txHash),
      redeem_note: txUrl(cfg.explorerTxBase, settlementReceipt.tx.tx_id),
    },
    audit_gate: {
      base_sepolia_write_allowed: true,
      base_mainnet_default_denied: mainnetDefaultDenied,
      base_mainnet_deny_code: mainnetDenyCode,
    },
    negative_checks: {
      wrong_task_output_rejected: true,
      wrong_task_output_code: taskMismatch.code,
    },
    receipt_checks: {
      agreement_valid: agreementValidation.ok,
      verification_receipt_valid: verificationValidation.ok,
      settlement_receipt_valid: settlementValidation.ok,
      settlement_references_verification:
        settlementReceipt.verification_receipts?.[0] === verificationReceipt.receipt_id,
    },
    blocks: {
      before: blockBefore.toString(),
      after: blockAfter.toString(),
    },
    next_step:
      "Archive this JSON into docs/pilots/results/<date>-base-sepolia-contract-rail.md, then move Base Sepolia from Pending Pilots to Completed Results.",
  };

  console.log(JSON.stringify(evidence, bigintReplacer, 2));
}

function readConfig() {
  const required = [
    "BASE_SEPOLIA_RPC_URL",
    "BASE_SEPOLIA_BUYER_PRIVATE_KEY",
    "BASE_SEPOLIA_RESERVE_CONTRACT",
    "BASE_SEPOLIA_TOKEN_CONTRACT",
  ];
  const values = Object.fromEntries(required.map((name) => [name, env(name)]));
  const missing = required.filter((name) => !values[name]);
  const liveRequested = process.env.BASE_SEPOLIA_LIVE === "1" && args.has("--live");
  const addressErrors = [];

  for (const name of ["BASE_SEPOLIA_RESERVE_CONTRACT", "BASE_SEPOLIA_TOKEN_CONTRACT"]) {
    if (values[name] && !isAddress(values[name])) {
      addressErrors.push(`${name} must be an EVM address`);
    }
  }

  let buyerPrivateKey;
  let sellerPrivateKey;
  try {
    if (values.BASE_SEPOLIA_BUYER_PRIVATE_KEY) {
      buyerPrivateKey = normalizePrivateKey(values.BASE_SEPOLIA_BUYER_PRIVATE_KEY, "BASE_SEPOLIA_BUYER_PRIVATE_KEY");
    }
    const seller = env("BASE_SEPOLIA_SELLER_PRIVATE_KEY");
    if (seller) sellerPrivateKey = normalizePrivateKey(seller, "BASE_SEPOLIA_SELLER_PRIVATE_KEY");
  } catch (err) {
    addressErrors.push(err instanceof Error ? err.message : String(err));
  }

  const amount = env("BASE_SEPOLIA_AMOUNT") ?? DEFAULT_AMOUNT;
  if (!/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(amount)) {
    addressErrors.push("BASE_SEPOLIA_AMOUNT must be a decimal string like 0.01");
  }

  const ready = liveRequested && missing.length === 0 && addressErrors.length === 0;
  return {
    ready,
    report: {
      ok: false,
      mode: "base-sepolia-live-preflight",
      live_requested: liveRequested,
      ready_to_run_live: ready,
      missing_env: missing,
      config_errors: addressErrors,
      required_env: required,
      optional_env: [
        "BASE_SEPOLIA_SELLER_PRIVATE_KEY",
        "BASE_SEPOLIA_AMOUNT",
        "BASE_SEPOLIA_EXPLORER_TX_BASE",
      ],
      safety:
        "Set both BASE_SEPOLIA_LIVE=1 and pass --live to send Base Sepolia write transactions.",
    },
    rpcUrl: values.BASE_SEPOLIA_RPC_URL,
    buyerPrivateKey,
    sellerPrivateKey,
    reserveContract: values.BASE_SEPOLIA_RESERVE_CONTRACT,
    tokenContract: values.BASE_SEPOLIA_TOKEN_CONTRACT,
    amount,
    explorerTxBase: env("BASE_SEPOLIA_EXPLORER_TX_BASE") ?? DEFAULT_EXPLORER_TX_BASE,
  };
}

function buildAgreement({ buyer, seller, reserveContract, amount, decimals }) {
  return {
    type: "accord.agreement.v0",
    version: "v0",
    agreement_id: `acc_base_sepolia_${Date.now()}`,
    created_at: nowIsoUtc(),
    buyer: { id: `agent://base-sepolia/${buyer}` },
    seller: { id: `provider://base-sepolia/${seller}` },
    task: {
      kind: "evm_note_paid_tool",
      input_ref: "live://base-sepolia/usdc-tool",
      description: "Validate a live Base Sepolia Note against the Accord Base rail adapter.",
      output_schema: "base.sepolia.live.response.v0",
    },
    price: { amount, currency: "USDC", decimals },
    payment: {
      mode: "note",
      rail: "base",
      reserve_ref: `base-sepolia:${reserveContract}`,
      deadline: DEFAULT_EXPIRY,
    },
    verification: {
      required: true,
      method: "verifier_receipt",
      verifier: "verifier://base-sepolia-live-pilot-v0",
      evidence_required: ["schema_valid", "task_hash_valid", "amount_valid"],
    },
    settlement: { mode: "inline", refund_policy: "expiry", dispute_policy: "none" },
    metadata: { labels: ["pilot", "base", "base-sepolia", "live"] },
  };
}

function buildVerificationReceipt({ agreement, agreementHash, taskHash }) {
  return {
    type: "accord.verification_receipt.v0",
    version: "v0",
    receipt_id: "vr_" + toBase32(accordHashV0(`vr:${agreement.agreement_id}`), 26),
    agreement_id: agreement.agreement_id,
    agreement_hash: agreementHash,
    verifier: { id: "verifier://base-sepolia-live-pilot-v0" },
    result: "accepted",
    evidence: {
      output_hash: taskHash.replace(/^0x/, "keccak256:0x"),
      output_ref: "live://base-sepolia/usdc-tool",
      schema: "base.sepolia.live.response.v0",
    },
    checks: [
      { name: "schema_valid", result: "pass" },
      { name: "task_hash_valid", result: "pass", detail: taskHash },
      {
        name: "amount_valid",
        result: "pass",
        detail: `${agreement.price.amount} ${agreement.price.currency}`,
      },
    ],
    created_at: nowIsoUtc(),
    signature: {
      scheme: "ed25519",
      public_key: "0xbase-sepolia-live-pilot-verifier-public-key",
      signature: "0xbase-sepolia-live-pilot-verifier-signature",
    },
  };
}

function env(name) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizePrivateKey(value, name) {
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    throw new Error(`${name} must be a 32-byte hex private key`);
  }
  return normalized;
}

function nowIsoUtc() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function txUrl(base, hash) {
  return base.endsWith("/") ? `${base}${hash}` : `${base}/${hash}`;
}

function safeHost(url) {
  try {
    return new URL(url).host;
  } catch {
    return "(unparseable)";
  }
}

async function waitFor(check, label, attempts = 12, delayMs = 1000) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      if (await check()) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  const suffix = lastError instanceof Error ? ` Last error: ${lastError.message}` : "";
  throw new Error(`Timed out waiting for ${label}.${suffix}`);
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

function formatError(err) {
  if (err instanceof Error) return { name: err.name, message: err.message };
  return { name: "Error", message: String(err) };
}
