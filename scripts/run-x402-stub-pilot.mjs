#!/usr/bin/env node
import {
  accordHashV0,
  validateAgreement,
  validateSettlementReceipt,
  validateVerificationReceipt,
} from "@accord-protocol/core";
import {
  ACCORD_GATEWAY_ERROR_CODES,
  ACCORD_HEADERS,
  InMemoryReplayStore,
  accordGateway,
} from "@accord-protocol/gateway";
import { createX402RailAdapter } from "@accord-protocol/rails-x402";

const OUTPUT_TEXT = "x402 stub premium response";
const PAYMENT_PAYLOAD = "stub-x402-payment-payload-redacted";
const AGREEMENT = {
  type: "accord.agreement.v0",
  version: "v0",
  agreement_id: "acc_x402_stub_20260515",
  created_at: "2026-05-15T20:45:00Z",
  buyer: { id: "agent://x402-stub-buyer" },
  seller: { id: "provider://accord-x402-stub-seller" },
  task: {
    kind: "http_paid_tool",
    input_ref: "stub://x402/premium-response",
    description: "Return a deterministic premium response after x402 payment verification.",
    output_schema: "x402.stub.response.v0",
  },
  price: { amount: "0.05", currency: "USDC", decimals: 6 },
  payment: { mode: "pay_before_response", rail: "x402", deadline: "+30 seconds" },
  verification: {
    required: true,
    method: "verifier_receipt",
    verifier: "verifier://x402-stub-v0",
    evidence_required: ["schema_valid", "http_response_valid"],
  },
  settlement: { mode: "inline", refund_policy: "none", dispute_policy: "none" },
  metadata: { labels: ["pilot", "x402", "stub"] },
};

const agreementHash = "blake2b256:0x" + accordHashV0(AGREEMENT);
const paymentId = "0x" + accordHashV0(`payment:${PAYMENT_PAYLOAD}`);
const txHash = "0x" + accordHashV0(`settle:${PAYMENT_PAYLOAD}`);
const payer = "0x" + "1".repeat(40);
const verificationReceiptId = "vr_" + toBase32(accordHashV0(`vr:${AGREEMENT.agreement_id}`), 26);

const facilitatorCalls = [];
const facilitator = {
  network: "base-sepolia",
  async verify(input) {
    facilitatorCalls.push({
      method: "verify",
      scheme: input.scheme,
      paymentPayload: redact(input.paymentPayload),
    });
    if (input.paymentPayload !== PAYMENT_PAYLOAD) {
      return {
        ok: false,
        code: "INVALID_STUB_PAYMENT",
        message: "payment payload does not match the local stub proof",
      };
    }
    return {
      ok: true,
      payment_id: paymentId,
      scheme: input.scheme ?? "exact",
      payer,
      details: { facilitator: "local-stub", redacted: true },
    };
  },
  async settle(input) {
    facilitatorCalls.push({
      method: "settle",
      scheme: input.scheme,
      paymentPayload: redact(input.paymentPayload),
      payment_id: input.payment_id,
    });
    return { tx_hash: txHash, block_height: 424242 };
  },
};

const rail = createX402RailAdapter({ facilitator, network: "base-sepolia" });
const replayStore = new InMemoryReplayStore();

const gateway = accordGateway({
  rail,
  replayStore,
  buildAgreementTemplate: () => ({
    agreement_template: "stub://accord/x402/agreement-template",
    price: { amount: "0.05", currency: "USDC", decimals: 6 },
    accepted_rails: ["x402"],
    verification_required: true,
    provider_metadata: {
      network: "base-sepolia",
      facilitator: "local-stub",
      mainnet_certified: false,
    },
  }),
  resolveAgreement: async (agreementId) =>
    agreementId === AGREEMENT.agreement_id ? AGREEMENT : undefined,
  handler: async () => ({
    message: OUTPUT_TEXT,
    schema: "x402.stub.response.v0",
  }),
  verifier: async ({ agreement, output }) => ({
    type: "accord.verification_receipt.v0",
    version: "v0",
    receipt_id: verificationReceiptId,
    agreement_id: agreement.agreement_id,
    agreement_hash: "blake2b256:0x" + accordHashV0(agreement),
    verifier: { id: "verifier://x402-stub-v0" },
    result: "accepted",
    evidence: {
      output_hash: "blake2b256:0x" + accordHashV0(output),
      output_ref: "stub://x402/premium-response",
      schema: "x402.stub.response.v0",
    },
    checks: [
      { name: "schema_valid", result: "pass" },
      { name: "http_response_valid", result: "pass" },
    ],
    created_at: "2026-05-15T20:45:10Z",
    signature: {
      scheme: "ed25519",
      public_key: "0xstub-x402-verifier-public-key",
      signature: "0xstub-x402-verifier-signature",
    },
  }),
});

const challenge = await callGateway(gateway, { headers: {} });
assertStatus("challenge", challenge.statusCode, 402);
assertEqual(
  "challenge error",
  challenge.body.error,
  ACCORD_GATEWAY_ERROR_CODES.ACCORD_PAYMENT_REQUIRED,
);

const paidHeaders = {
  [ACCORD_HEADERS.agreementId]: AGREEMENT.agreement_id,
  [ACCORD_HEADERS.payment]: JSON.stringify({
    x402_payment_payload: PAYMENT_PAYLOAD,
    scheme: "exact",
  }),
};

const paid = await callGateway(gateway, {
  headers: paidHeaders,
  body: { request: "run paid x402 stub task" },
});
assertStatus("paid call", paid.statusCode, 200);

const replay = await callGateway(gateway, {
  headers: paidHeaders,
  body: { request: "run paid x402 stub task again" },
});
assertStatus("replay", replay.statusCode, 402);
assertEqual("replay error", replay.body.error, ACCORD_GATEWAY_ERROR_CODES.REPLAY_DETECTED);

const verificationReceipt = paid.body._meta.accord_verification_receipt;
const settlementReceipt = paid.body._meta.accord_settlement_receipt;
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

const evidence = {
  ok: true,
  agreement_id: AGREEMENT.agreement_id,
  agreement_hash: agreementHash,
  verification_receipt_id: verificationReceipt.receipt_id,
  settlement_receipt_id: settlementReceipt.settlement_id,
  settlement_tx_id: settlementReceipt.tx.tx_id,
  payment_id: paymentId,
  network: settlementReceipt.tx.network,
  challenge: {
    status: challenge.statusCode,
    headers: pickHeaders(challenge.headers, [
      ACCORD_HEADERS.versionResponse,
      ACCORD_HEADERS.agreementRequired,
      ACCORD_HEADERS.agreementTemplate,
      ACCORD_HEADERS.acceptedRails,
      ACCORD_HEADERS.wwwAuthenticate,
    ]),
    body: {
      error: challenge.body.error,
      agreement_template: challenge.body.agreement_template,
      accepted_rails: challenge.body.accepted_rails,
      verification_required: challenge.body.verification_required,
    },
  },
  paid_call: {
    status: paid.statusCode,
    response_headers: pickHeaders(paid.headers, [
      ACCORD_HEADERS.versionResponse,
      "x-accord-agreement-hash",
      "x-accord-verification-receipt-hash",
      "x-accord-settlement-receipt-hash",
    ]),
    output: paid.body.output,
  },
  replay: {
    status: replay.statusCode,
    error: replay.body.error,
  },
  facilitator_calls: facilitatorCalls,
  receipt_checks: {
    agreement_valid: agreementValidation.ok,
    verification_receipt_valid: verificationValidation.ok,
    settlement_receipt_valid: settlementValidation.ok,
    settlement_references_verification:
      settlementReceipt.verification_receipts?.[0] === verificationReceipt.receipt_id,
  },
};

console.log(JSON.stringify(evidence, null, 2));

function mockRes() {
  const res = {
    statusCode: 200,
    headers: new Map(),
    bodyText: undefined,
    setHeader(name, value) {
      this.headers.set(name.toLowerCase(), String(value));
    },
    end(payload) {
      this.bodyText = payload;
    },
  };
  return res;
}

async function callGateway(middleware, req) {
  const res = mockRes();
  let nextError;
  await middleware(
    {
      method: "POST",
      url: "/stub/x402/premium",
      headers: req.headers,
      body: req.body,
    },
    res,
    (err) => {
      nextError = err;
    },
  );
  if (nextError) throw nextError;
  return {
    statusCode: res.statusCode,
    headers: Object.fromEntries(res.headers.entries()),
    body: JSON.parse(res.bodyText ?? "{}"),
  };
}

function pickHeaders(headers, names) {
  const out = {};
  for (const name of names) {
    const key = name.toLowerCase();
    if (headers[key] !== undefined) out[key] = headers[key];
  }
  return out;
}

function assertStatus(label, got, expected) {
  if (got !== expected) {
    throw new Error(`${label}: expected HTTP ${expected}, got ${got}`);
  }
}

function assertEqual(label, got, expected) {
  if (got !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${got}`);
  }
}

function redact(value) {
  return `${value.slice(0, 8)}...redacted`;
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
