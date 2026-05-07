import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import {
  accordGateway,
  type AccordHttpRequest,
  type AccordHttpResponse,
} from "@accord-protocol/gateway";
import { accordHashV0, type AccordAgreement } from "@accord-protocol/core";
import type { AccordRailAdapter } from "@accord-protocol/rails";
import { runL1Network } from "../index.js";

// Builds an in-process accord-gateway-backed HTTP server. The conformance
// suite probes its `/api/run` endpoint over real HTTP, exactly as it would
// probe a third-party Accord/402 implementation.

const PORT = 51791;
const URL = `http://127.0.0.1:${PORT}/api/run`;

function buildAgreement(): AccordAgreement {
  return {
    type: "accord.agreement.v0",
    version: "v0",
    agreement_id: "acc_01HX0NETWORKPROBETARGETAAAA",
    created_at: "2026-05-07T00:00:00Z",
    buyer: { id: "agent://probe-buyer" },
    seller: { id: "provider://probe-seller" },
    task: { kind: "ping", input_ref: "inline:hi", description: "L1-network probe" },
    price: { amount: "0.001", currency: "ERG", decimals: 9 },
    payment: {
      mode: "note",
      rail: "ergo",
      reserve_ref: "ergo:box:" + "ab".repeat(32),
      deadline: "+480 blocks",
    },
    verification: { required: false, method: "none" },
    settlement: { mode: "inline", refund_policy: "expiry", dispute_policy: "none" },
  };
}

function makeRail(): AccordRailAdapter {
  return {
    rail: "ergo",
    async verifyPayment(input) {
      const p = (input.payment ?? {}) as { value?: string };
      if (typeof p.value !== "string") {
        return { ok: false, rail: "ergo", code: "MISSING_VALUE", message: "value required" };
      }
      return { ok: true, rail: "ergo", payment_id: "probe-" + accordHashV0(p).slice(0, 16) };
    },
    async settle(input) {
      return {
        type: "accord.settlement_receipt.v0",
        version: "v0",
        settlement_id: "sr_NETWORKPROBETARGETXXXXXXXX",
        agreement_id: input.agreement.agreement_id,
        agreement_hash: "blake2b256:0x" + accordHashV0(input.agreement),
        rail: "ergo",
        mode: "note_redeemed",
        status: "settled",
        amount: input.agreement.price.amount,
        currency: input.agreement.price.currency,
        decimals: input.agreement.price.decimals,
        tx: {
          network: "testnet",
          tx_id: "0x" + "1".repeat(64),
          box_id: "0x" + "2".repeat(64),
        },
        created_at: "2026-05-07T00:00:20Z",
      };
    },
  };
}

const agreement = buildAgreement();
const store = new Map<string, AccordAgreement>([[agreement.agreement_id, agreement]]);
const middleware = accordGateway({
  rail: makeRail(),
  resolveAgreement: async (id) => store.get(id),
  buildAgreementTemplate: () => ({
    agreement_template: "https://probe.test/.well-known/accord/agreement-template",
    price: { amount: "0.001", currency: "ERG", decimals: 9 },
    accepted_rails: ["ergo"],
    verification_required: false,
  }),
  handler: async () => ({ pong: true }),
});

let server: http.Server | undefined;

before(async () => {
  // Adapter from node:http to AccordHttpRequest/Response.
  server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const accordReq: AccordHttpRequest = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: body ? safeJson(body) : undefined,
      };
      const accordRes: AccordHttpResponse = {
        get statusCode() {
          return res.statusCode;
        },
        set statusCode(v: number) {
          res.statusCode = v;
        },
        setHeader(name, value) {
          res.setHeader(name, value);
        },
        end(payload?: string) {
          res.end(payload);
        },
      };
      void Promise.resolve(middleware(accordReq, accordRes, () => {})).catch((err) => {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: "GATEWAY_THREW", message: String(err) }));
      });
    });
  });
  await new Promise<void>((resolve) => server!.listen(PORT, "127.0.0.1", resolve));
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) =>
      server!.close((err) => (err ? reject(err) : resolve())),
    );
  }
});

function safeJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

describe("conformance L1 — network mode (HTTP probe)", () => {
  it("probes a real HTTP endpoint and reports per-probe checks", async () => {
    const result = await runL1Network({ url: URL });
    const fails = result.checks.filter((c) => c.result === "fail");
    assert.equal(
      fails.length,
      0,
      `L1 network probe failed:\n${fails
        .map((c) => `  ${c.id}: ${c.detail}`)
        .join("\n")}`,
    );
  });

  it("the challenge probe verifies all four required headers", async () => {
    const result = await runL1Network({ url: URL });
    const ids = new Set(result.checks.map((c) => c.id));
    for (const id of [
      "L1.network.challenge.reachable",
      "L1.network.challenge.status-402",
      "L1.network.challenge.accord-version",
      "L1.network.challenge.agreement-required",
      "L1.network.challenge.www-authenticate",
      "L1.network.challenge.body-error-code",
      "L1.network.challenge.body-agreement-template",
    ]) {
      assert.ok(ids.has(id), `missing check ${id}`);
    }
  });

  it("the missing-payment probe accepts both MISSING_PAYMENT and UNKNOWN_AGREEMENT codes", async () => {
    const result = await runL1Network({ url: URL });
    const c = result.checks.find((x) => x.id === "L1.network.missing-payment.body-error-code");
    assert.equal(c?.result, "pass", c?.detail);
  });

  it("happy-path probe is inconclusive without --agreement-id + --payment", async () => {
    const result = await runL1Network({ url: URL });
    const c = result.checks.find((x) => x.id === "L1.network.happy-path");
    assert.equal(c?.result, "inconclusive");
  });

  it("happy-path probe runs a 200 + _meta check when agreement-id + payment are supplied", async () => {
    const result = await runL1Network({
      url: URL,
      agreementId: agreement.agreement_id,
      paymentJson: '{"value":"0.001"}',
    });
    const status = result.checks.find((x) => x.id === "L1.network.happy-path.status-200");
    const ah = result.checks.find(
      (x) => x.id === "L1.network.happy-path.agreement-hash-header",
    );
    assert.equal(status?.result, "pass", status?.detail);
    assert.equal(ah?.result, "pass", ah?.detail);
  });
});
