#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

import { accordHashV0, validateAgreement, validateSettlementReceipt, validateVerificationReceipt } from "@accord-protocol/core";
import { verifySignature } from "@accord-protocol/conformance";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const DEFAULT_RECEIPT_URL =
  "https://www.ergoblockchain.org/api/sage/receipt/f8752d10a2ece92fbc88065c3b92b94da621ec65943098f43c9e084deb763d81";
const DEFAULT_CONFORMANCE_URL =
  "https://www.ergoblockchain.org/evidence/sage/conformance-l1-2026-05-21.signed.json";
const DEFAULT_PUBLIC_KEY_URL =
  "https://www.ergoblockchain.org/evidence/sage/provider-signing-key.json";
const DEFAULT_ERGO_API_BASE = "https://api-testnet.ergoplatform.com/api/v1";

const args = new Set(process.argv.slice(2));
if (args.has("--help") || args.has("-h")) {
  console.log([
    "Usage:",
    "  npm run pilots:sage:live",
    "",
    "Optional env:",
    "  SAGE_RECEIPT_URL       # full receipt bundle API URL",
    "  SAGE_CONFORMANCE_URL   # signed conformance result URL",
    "  SAGE_PUBLIC_KEY_URL    # provider signing public key URL",
    "  ERGO_TESTNET_API_BASE  # default: https://api-testnet.ergoplatform.com/api/v1",
    "",
    "Exit code:",
    "  0 when the live bundle is schema-valid, hash-bound, signed, and on-chain",
    "  1 when any required pass criterion is missing",
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
        mode: "sage-ergo-live-receipt",
        error: err instanceof Error ? err.message : String(err),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

async function main() {
  const urls = {
    receipt: process.env.SAGE_RECEIPT_URL || DEFAULT_RECEIPT_URL,
    conformance: process.env.SAGE_CONFORMANCE_URL || DEFAULT_CONFORMANCE_URL,
    publicKey: process.env.SAGE_PUBLIC_KEY_URL || DEFAULT_PUBLIC_KEY_URL,
    ergoApiBase: process.env.ERGO_TESTNET_API_BASE || DEFAULT_ERGO_API_BASE,
  };

  const [receipt, signedConformance, publicKey] = await Promise.all([
    fetchJson(urls.receipt),
    fetchJson(urls.conformance),
    fetchJson(urls.publicKey),
  ]);

  const problems = [];
  const evidence = {};
  const accord = receipt.accord;
  const agreement = accord?.agreement_json;
  const verification = accord?.verification_receipt_json;
  const settlement = accord?.settlement_receipt_json;

  requireField(Boolean(accord), "missing_accord_bundle", "receipt.accord is missing", problems);
  requireField(Boolean(agreement), "missing_agreement_json", "accord.agreement_json is missing", problems);
  requireField(Boolean(verification), "missing_verification_receipt_json", "accord.verification_receipt_json is missing", problems);
  requireField(Boolean(settlement), "missing_settlement_receipt_json", "accord.settlement_receipt_json is missing", problems);

  if (agreement && verification && settlement) {
    evidence.receipt_id = receipt.id;
    evidence.status = receipt.status;
    evidence.completeness = receipt.completeness;
    evidence.agreement_id = agreement.agreement_id;
    evidence.verification_receipt_id = verification.receipt_id;
    evidence.settlement_receipt_id = settlement.settlement_id;
    evidence.settlement_tx_id = settlement.tx?.tx_id;
    evidence.note_box_id = settlement.tx?.box_id;

    requireField(receipt.status === "settled_on_chain", "receipt_not_settled", `expected settled_on_chain, got ${receipt.status}`, problems);
    requireField(receipt.completeness === "full_receipt_bundle", "receipt_not_full_bundle", `expected full_receipt_bundle, got ${receipt.completeness}`, problems);

    const hashes = {
      agreement: {
        expected: accord.agreement_hash,
        actual: `blake2b256:0x${accordHashV0(agreement)}`,
      },
      verification_receipt: {
        expected: accord.verification_receipt_hash,
        actual: `blake2b256:0x${accordHashV0(verification)}`,
      },
      settlement_receipt: {
        expected: accord.settlement_receipt_hash,
        actual: `blake2b256:0x${accordHashV0(settlement)}`,
      },
    };
    evidence.hashes = hashes;
    for (const [name, pair] of Object.entries(hashes)) {
      requireField(pair.expected === pair.actual, `${name}_hash_mismatch`, `${pair.expected} != ${pair.actual}`, problems);
    }

    const schema = validateSchemas({ agreement, verification, settlement });
    evidence.schema = schema;
    for (const [name, result] of Object.entries(schema)) {
      requireField(result.valid, `${name}_schema_invalid`, result.errors.join("; "), problems);
    }

    const semantic = {
      agreement: semanticResult(validateAgreement(agreement)),
      verification: semanticResult(validateVerificationReceipt(verification, { agreement })),
      settlement: semanticResult(validateSettlementReceipt(settlement, { agreement })),
    };
    evidence.semantic = semantic;
    for (const [name, result] of Object.entries(semantic)) {
      requireField(result.valid, `${name}_semantic_invalid`, result.errors.join("; "), problems);
    }

    if (receipt.public_receipt_url) {
      const publicReceipt = await fetchStatus(receipt.public_receipt_url);
      evidence.public_receipt = publicReceipt;
      requireField(publicReceipt.ok, "public_receipt_unavailable", `HTTP ${publicReceipt.status} from ${receipt.public_receipt_url}`, problems);
    } else {
      requireField(false, "missing_public_receipt_url", "receipt.public_receipt_url is missing", problems);
    }

    if (settlement.tx?.tx_id) {
      const tx = await fetchJson(`${urls.ergoApiBase}/transactions/${settlement.tx.tx_id}`);
      evidence.ergo_transaction = {
        id: tx.id,
        inclusionHeight: tx.inclusionHeight,
        timestamp: tx.timestamp,
        numConfirmations: tx.numConfirmations,
        inputs: Array.isArray(tx.inputs) ? tx.inputs.length : null,
        outputs: Array.isArray(tx.outputs) ? tx.outputs.length : null,
      };
      requireField(tx.id === settlement.tx.tx_id, "settlement_tx_not_found", `expected ${settlement.tx.tx_id}, got ${tx.id}`, problems);
    }

    if (settlement.tx?.box_id) {
      const box = await fetchJson(`${urls.ergoApiBase}/boxes/${settlement.tx.box_id}`);
      evidence.ergo_note_box = {
        boxId: box.boxId,
        transactionId: box.transactionId,
        value: box.value,
        creationHeight: box.creationHeight,
        spentTransactionId: box.spentTransactionId,
      };
      requireField(box.boxId === settlement.tx.box_id, "note_box_not_found", `expected ${settlement.tx.box_id}, got ${box.boxId}`, problems);
      requireField(box.spentTransactionId === settlement.tx.tx_id, "note_box_not_spent_by_settlement", `expected spent by ${settlement.tx.tx_id}, got ${box.spentTransactionId}`, problems);
    }
  }

  const signature = verifySignature(signedConformance, publicKey.public_key);
  evidence.conformance = {
    status: signedConformance.status,
    achieved_level: signedConformance.achieved_level,
    receipt_id: signedConformance.receipt_id,
    agreement_id: signedConformance.agreement_id,
    accord_l1_exit_code: signedConformance.accord_l1_exit_code,
    signature,
    expected_public_key: publicKey.public_key,
    embedded_public_key: signedConformance.signature?.public_key,
  };
  requireField(signature.ok, "conformance_signature_invalid", signature.ok ? "" : `${signature.code}: ${signature.message}`, problems);
  requireField(signedConformance.status === "passed", "conformance_not_passed", `expected passed, got ${signedConformance.status}`, problems);
  requireField(signedConformance.achieved_level === "L1", "conformance_not_l1", `expected L1, got ${signedConformance.achieved_level}`, problems);
  requireField(signedConformance.accord_l1_exit_code === 0, "conformance_exit_nonzero", `expected 0, got ${signedConformance.accord_l1_exit_code}`, problems);

  const ok = problems.length === 0;
  console.log(
    JSON.stringify(
      {
        ok,
        mode: "sage-ergo-live-receipt",
        urls,
        evidence,
        problems,
      },
      null,
      2,
    ),
  );
  process.exit(ok ? 0 : 1);
}

function validateSchemas({ agreement, verification, settlement }) {
  const root = process.cwd();
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const validators = {
    agreement: ajv.compile(readJson(path.join(root, "schemas/agreement.v0.schema.json"))),
    verification: ajv.compile(readJson(path.join(root, "schemas/verification-receipt.v0.schema.json"))),
    settlement: ajv.compile(readJson(path.join(root, "schemas/settlement-receipt.v0.schema.json"))),
  };
  return {
    agreement: schemaResult(validators.agreement, agreement),
    verification: schemaResult(validators.verification, verification),
    settlement: schemaResult(validators.settlement, settlement),
  };
}

function schemaResult(validator, value) {
  const valid = validator(value);
  return {
    valid,
    errors: valid
      ? []
      : (validator.errors ?? []).map((err) => {
          const where = err.instancePath || "/";
          return `${where} ${err.message}`;
        }),
  };
}

function semanticResult(result) {
  return {
    valid: result.ok,
    errors: result.problems.map((problem) => `${problem.path} ${problem.code}: ${problem.message}`),
  };
}

function requireField(condition, code, detail, problems) {
  if (!condition) problems.push({ code, detail });
}

async function fetchJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`GET ${url} failed with HTTP ${response.status}`);
  return response.json();
}

async function fetchStatus(url) {
  const response = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(60_000) });
  return {
    ok: response.ok,
    status: response.status,
  };
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
