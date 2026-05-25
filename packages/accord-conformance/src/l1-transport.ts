// ─────────────────────────────────────────────────────────────────────────────
// @accord-protocol/conformance — L1 transport-compatibility checks
//
// "Accord/402 or Accord/MCP roundtrip works." We exercise the in-process
// implementations from @accord-protocol/{mcp,gateway} with a Mock rail and
// a synthetic verifier, and assert that:
//
//   * a 402 challenge from the gateway carries the right Accord-* headers
//   * a paid HTTP call returns 200 + accord_* metadata
//   * an MCP tool call returns the right AccordMcpResult shape
//   * both transports round-trip Verification + Settlement Receipts that
//     pass @accord-protocol/core's validators
//
// L1 doesn't care WHAT the implementation does internally — only that the
// wire shape conforms. A third-party SDK that wants to claim
// "Accord/402 certified (L1)" or "Accord/MCP certified (L1)" should pass
// every check here.
//
// Note: this version exercises the *reference* @accord-protocol/{mcp,gateway}
// packages directly. A network-mode CLI (target an HTTP endpoint or MCP
// stdio server) is a follow-up.
// ─────────────────────────────────────────────────────────────────────────────

import {
  accordHashV0,
  validateSettlementReceipt,
  validateVerificationReceipt,
  type AccordAgreement,
  type AccordSettlementReceipt,
  type AccordVerificationReceipt,
} from "@accord-protocol/core";

import {
  ACCORD_HEADERS,
  accordGateway,
  type AccordHttpRequest,
  type AccordHttpResponse,
} from "@accord-protocol/gateway";

import { wrapAccordMcp } from "@accord-protocol/mcp";

import type {
  AccordRailAdapter,
  SettleInput,
  VerifyPaymentInput,
  VerifyPaymentResult,
} from "@accord-protocol/rails";

import type { ConformanceCheck, ConformanceLevelResult } from "./types.js";

// ── synthetic helpers ───────────────────────────────────────────────────────

function buildAgreement(): AccordAgreement {
  return {
    type: "accord.agreement.v0",
    version: "v0",
    agreement_id: "acc_01HX0L1CONFORMANCETESTAAAAA",
    created_at: "2026-05-07T00:00:00Z",
    buyer: { id: "agent://l1-buyer" },
    seller: { id: "provider://l1-seller" },
    task: { kind: "ping", input_ref: "inline:hi", description: "L1 conformance ping" },
    price: { amount: "0.001", currency: "ERG", decimals: 9 },
    payment: {
      mode: "note",
      rail: "ergo",
      reserve_ref: "ergo:box:" + "ab".repeat(32),
      deadline: "+480 blocks",
    },
    verification: {
      required: true,
      method: "verifier_receipt",
      verifier: "verifier://l1-verifier",
    },
    settlement: { mode: "inline", refund_policy: "expiry", dispute_policy: "none" },
  };
}

function makeRail(): AccordRailAdapter {
  return {
    rail: "ergo",
    async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
      const p = (input.payment ?? {}) as { value?: string };
      if (typeof p.value !== "string") {
        return { ok: false, rail: "ergo", code: "MISSING_VALUE", message: "value missing" };
      }
      return {
        ok: true,
        rail: "ergo",
        payment_id: "l1-" + accordHashV0(p).slice(0, 16),
      };
    },
    async settle(input: SettleInput): Promise<AccordSettlementReceipt> {
      const a = input.agreement;
      const receipt: AccordSettlementReceipt = {
        type: "accord.settlement_receipt.v0",
        version: "v0",
        settlement_id: "sr_L1CONFORMANCEXXXXXXXXXXXXX",
        agreement_id: a.agreement_id,
        agreement_hash: "blake2b256:0x" + accordHashV0(a),
        rail: "ergo",
        mode: "note_redeemed",
        status: "settled",
        amount: a.price.amount,
        currency: a.price.currency,
        decimals: a.price.decimals,
        tx: {
          network: "testnet",
          tx_id: "0x" + "1".repeat(64),
          box_id: "0x" + "2".repeat(64),
        },
        created_at: "2026-05-07T00:00:20Z",
      };
      // When the agreement requires verification, include the verifier's
      // receipt hash so the SR validates against core's
      // ACCORD_VERIFICATION_REQUIRED rule.
      if (a.verification.required && input.verification) {
        receipt.verification_receipts = [
          "blake2b256:0x" + accordHashV0(input.verification),
        ];
      }
      return receipt;
    },
  };
}

function makeVerifier(): (args: {
  agreement: AccordAgreement;
  output: unknown;
}) => Promise<AccordVerificationReceipt> {
  return async ({ agreement }) => ({
    type: "accord.verification_receipt.v0",
    version: "v0",
    receipt_id: "vr_L1CONFORMANCEYYYYYYYYYYYYY",
    agreement_id: agreement.agreement_id,
    agreement_hash: "blake2b256:0x" + accordHashV0(agreement),
    verifier: { id: "verifier://l1-verifier" },
    result: "accepted",
    evidence: { output_hash: "blake2b256:0x" + "3".repeat(64) },
    created_at: "2026-05-07T00:00:10Z",
    signature: { scheme: "ed25519", public_key: "0xaa", signature: "0xbb" },
  });
}

// ── tiny mock res ───────────────────────────────────────────────────────────

interface MockRes extends AccordHttpResponse {
  body: string | undefined;
  headerMap: Map<string, string>;
}

function mockRes(): MockRes {
  const res: MockRes = {
    statusCode: 200,
    body: undefined,
    headerMap: new Map(),
    setHeader(name: string, value: string) {
      res.headerMap.set(name.toLowerCase(), value);
    },
    end(payload?: string) {
      res.body = payload;
    },
  };
  return res;
}

// ── L1 runner ───────────────────────────────────────────────────────────────

export async function runL1(): Promise<ConformanceLevelResult> {
  const checks: ConformanceCheck[] = [];

  await runMcpChecks(checks);
  await runGatewayChecks(checks);

  return summarise(checks);
}

// ── MCP transport checks ────────────────────────────────────────────────────

async function runMcpChecks(checks: ConformanceCheck[]): Promise<void> {
  const agreement = buildAgreement();
  const rail = makeRail();
  const verifier = makeVerifier();
  const store = new Map<string, AccordAgreement>([[agreement.agreement_id, agreement]]);

  const callTool = wrapAccordMcp({
    rail,
    verifier,
    resolveAgreement: async (id) => store.get(id),
    handler: async () => ({ pong: true }),
  });

  // 1. Missing accord_agreement_id → MISSING_AGREEMENT_ID error
  {
    const t0 = Date.now();
    const r = await callTool({} as never);
    checks.push({
      id: "L1.mcp.missing-agreement-id",
      level: "L1",
      description: "wrapAccordMcp() rejects calls without accord_agreement_id",
      result:
        r.isError && r._meta.accord_error_code === "MISSING_AGREEMENT_ID"
          ? "pass"
          : "fail",
      detail: r.isError ? undefined : "expected isError: true",
      duration_ms: Date.now() - t0,
    });
  }

  // 2. Happy path: accord_* metadata present
  {
    const t0 = Date.now();
    const r = await callTool({
      accord_agreement_id: agreement.agreement_id,
      accord_payment: { value: "0.001" },
    } as never);
    if (r.isError) {
      checks.push({
        id: "L1.mcp.happy-path",
        level: "L1",
        description: "wrapAccordMcp() runs the handler when payment + verifier accept",
        result: "fail",
        detail: `handler returned isError; code=${r._meta.accord_error_code}`,
      });
    } else {
      checks.push({
        id: "L1.mcp.happy-path",
        level: "L1",
        description: "wrapAccordMcp() runs the handler when payment + verifier accept",
        result: "pass",
        duration_ms: Date.now() - t0,
      });

      // 3. _meta.accord_agreement_hash is the blake2b256 wire form
      const matchesAgreementHash = String(r._meta.accord_agreement_hash) ===
        "blake2b256:0x" + accordHashV0(agreement);
      checks.push({
        id: "L1.mcp.agreement-hash-meta",
        level: "L1",
        description: "_meta.accord_agreement_hash equals blake2b256(canonical(agreement))",
        result: matchesAgreementHash ? "pass" : "fail",
        detail: matchesAgreementHash
          ? undefined
          : `got ${r._meta.accord_agreement_hash}`,
      });

      // 4. Verification Receipt validates against core
      const vr = r._meta.accord_verification_receipt;
      if (!vr) {
        checks.push({
          id: "L1.mcp.verification-receipt-present",
          level: "L1",
          description: "verification.required=true → _meta carries a Verification Receipt",
          result: "fail",
          detail: "expected accord_verification_receipt in _meta",
        });
      } else {
        checks.push({
          id: "L1.mcp.verification-receipt-present",
          level: "L1",
          description: "verification.required=true → _meta carries a Verification Receipt",
          result: "pass",
        });
        const v = validateVerificationReceipt(vr, { agreement });
        checks.push({
          id: "L1.mcp.verification-receipt-valid",
          level: "L1",
          description: "Verification Receipt passes core validateVerificationReceipt",
          result: v.ok ? "pass" : "fail",
          detail: v.ok ? undefined : v.problems.map((p) => p.code).join(", "),
        });
      }

      // 5. Settlement Receipt validates
      const sr = r._meta.accord_settlement_receipt;
      if (!sr) {
        checks.push({
          id: "L1.mcp.settlement-receipt-present",
          level: "L1",
          description: "rail.settle() defined → _meta carries a Settlement Receipt",
          result: "fail",
          detail: "expected accord_settlement_receipt in _meta",
        });
      } else {
        const v = validateSettlementReceipt(sr, { agreement });
        checks.push({
          id: "L1.mcp.settlement-receipt-valid",
          level: "L1",
          description: "Settlement Receipt passes core validateSettlementReceipt",
          result: v.ok ? "pass" : "fail",
          detail: v.ok ? undefined : v.problems.map((p) => p.code).join(", "),
        });
      }
    }
  }
}

// ── Gateway / Accord/402 transport checks ───────────────────────────────────

async function runGatewayChecks(checks: ConformanceCheck[]): Promise<void> {
  const agreement = buildAgreement();
  const rail = makeRail();
  const verifier = makeVerifier();
  const store = new Map<string, AccordAgreement>([[agreement.agreement_id, agreement]]);

  const middleware = accordGateway({
    rail,
    verifier,
    resolveAgreement: async (id) => store.get(id),
    buildAgreementTemplate: () => ({
      agreement_template: "https://l1.example/.well-known/accord/agreement-template",
      price: { amount: "0.001", currency: "ERG", decimals: 9 },
      accepted_rails: ["ergo", "rosen", "base", "x402"],
      verification_required: true,
    }),
    handler: async () => ({ pong: true }),
  });

  // 1. 402 challenge with right headers
  {
    const res = mockRes();
    await middleware(
      { method: "POST", url: "/api/run", headers: {} },
      res,
      () => {},
    );
    const ok =
      res.statusCode === 402 &&
      res.headerMap.get(ACCORD_HEADERS.versionResponse) === "v0" &&
      res.headerMap.get(ACCORD_HEADERS.agreementRequired) === "true" &&
      res.headerMap.get(ACCORD_HEADERS.wwwAuthenticate) === "Accord402";
    checks.push({
      id: "L1.gateway.402-challenge-headers",
      level: "L1",
      description:
        "no Accord-* request headers → 402 with Accord-Version, Accord-Agreement-Required, WWW-Authenticate Accord402",
      result: ok ? "pass" : "fail",
      detail: ok ? undefined : `status=${res.statusCode}, body=${res.body}`,
    });
  }

  // 2. 200 happy path with response headers
  {
    const req: AccordHttpRequest = {
      method: "POST",
      url: "/api/run",
      headers: {
        [ACCORD_HEADERS.agreementId]: agreement.agreement_id,
        [ACCORD_HEADERS.payment]: '{"value":"0.001"}',
      },
    };
    const res = mockRes();
    await middleware(req, res, () => {});
    const ok = res.statusCode === 200;
    checks.push({
      id: "L1.gateway.200-happy-path",
      level: "L1",
      description: "valid Accord-* headers → 200 with output + _meta",
      result: ok ? "pass" : "fail",
      detail: ok ? undefined : `got status ${res.statusCode}, body=${res.body}`,
    });

    if (ok) {
      // 3. response carries x-accord-agreement-hash
      const ah = res.headerMap.get("x-accord-agreement-hash");
      const expected = "blake2b256:0x" + accordHashV0(agreement);
      checks.push({
        id: "L1.gateway.agreement-hash-header",
        level: "L1",
        description: "200 response carries x-accord-agreement-hash matching agreement bytes",
        result: ah === expected ? "pass" : "fail",
        detail: ah === expected ? undefined : `got ${ah}, expected ${expected}`,
      });

      // 4. response body has _meta.accord_*
      try {
        const body = JSON.parse(res.body ?? "{}") as {
          output?: unknown;
          _meta?: Record<string, unknown>;
        };
        checks.push({
          id: "L1.gateway.body-output-meta",
          level: "L1",
          description: "200 body is { output, _meta } with accord_* metadata",
          result:
            body.output !== undefined && typeof body._meta === "object"
              ? "pass"
              : "fail",
          detail: body.output === undefined ? "missing 'output'" : undefined,
        });

        // 5. embedded verification + settlement receipts validate
        const vr = body._meta?.accord_verification_receipt as
          | AccordVerificationReceipt
          | undefined;
        const sr = body._meta?.accord_settlement_receipt as
          | AccordSettlementReceipt
          | undefined;
        if (!vr) {
          checks.push({
            id: "L1.gateway.verification-receipt-present",
            level: "L1",
            description: "verification.required=true → response _meta carries a Verification Receipt",
            result: "fail",
            detail: "missing _meta.accord_verification_receipt",
          });
        } else {
          const v = validateVerificationReceipt(vr, { agreement });
          checks.push({
            id: "L1.gateway.verification-receipt-valid",
            level: "L1",
            description: "embedded Verification Receipt passes core validation",
            result: v.ok ? "pass" : "fail",
            detail: v.ok ? undefined : v.problems.map((p) => p.code).join(", "),
          });
        }
        if (sr) {
          const v = validateSettlementReceipt(sr, { agreement });
          checks.push({
            id: "L1.gateway.settlement-receipt-valid",
            level: "L1",
            description: "embedded Settlement Receipt passes core validation",
            result: v.ok ? "pass" : "fail",
            detail: v.ok ? undefined : v.problems.map((p) => p.code).join(", "),
          });
        }
      } catch (err) {
        checks.push({
          id: "L1.gateway.body-output-meta",
          level: "L1",
          description: "200 body is { output, _meta } with accord_* metadata",
          result: "fail",
          detail: `body parse failed: ${(err as Error).message}`,
        });
      }
    }
  }

  // 6. Replay protection: same payment_id submitted twice → second is REPLAY_DETECTED
  {
    const reqA: AccordHttpRequest = {
      method: "POST",
      url: "/api/run",
      headers: {
        [ACCORD_HEADERS.agreementId]: agreement.agreement_id,
        [ACCORD_HEADERS.payment]: '{"value":"0.001","__replay_seed":"rep1"}',
      },
    };
    const resA = mockRes();
    await middleware(reqA, resA, () => {});
    const resB = mockRes();
    await middleware(reqA, resB, () => {});
    const ok =
      resA.statusCode === 200 &&
      resB.statusCode === 402 &&
      JSON.parse(resB.body ?? "{}").error === "REPLAY_DETECTED";
    checks.push({
      id: "L1.gateway.replay-detected",
      level: "L1",
      description: "second use of the same payment_id is rejected with REPLAY_DETECTED",
      result: ok ? "pass" : "fail",
      detail: ok
        ? undefined
        : `first=${resA.statusCode}, second=${resB.statusCode}, body=${resB.body}`,
    });
  }

  // 7. Rail binding: configured adapter rail must match agreement.payment.rail
  {
    const mismatchedRail = { ...makeRail(), rail: "x402" } as AccordRailAdapter;
    const mismatchMiddleware = accordGateway({
      rail: mismatchedRail,
      verifier,
      resolveAgreement: async (id) => store.get(id),
      buildAgreementTemplate: () => ({
        agreement_template: "https://l1.example/.well-known/accord/agreement-template",
        price: { amount: "0.001", currency: "ERG", decimals: 9 },
        accepted_rails: ["ergo"],
        verification_required: true,
      }),
      handler: async () => ({ pong: true }),
    });
    const res = mockRes();
    await mismatchMiddleware(
      {
        method: "POST",
        url: "/api/run",
        headers: {
          [ACCORD_HEADERS.agreementId]: agreement.agreement_id,
          [ACCORD_HEADERS.payment]: '{"value":"0.001"}',
        },
      },
      res,
      () => {},
    );
    const body = JSON.parse(res.body ?? "{}") as { error?: string };
    const ok =
      res.statusCode === 400 &&
      body.error === "PAYMENT_RAIL_MISMATCH";
    checks.push({
      id: "L1.gateway.rail-mismatch-rejected",
      level: "L1",
      description:
        "configured gateway rail must match agreement.payment.rail before payment is accepted",
      result: ok ? "pass" : "fail",
      detail: ok ? undefined : `status=${res.statusCode}, body=${res.body}`,
    });
  }

  // 8. Settlement validation: invalid receipts are not emitted as evidence
  {
    const baseRail = makeRail();
    const invalidSettlementRail: AccordRailAdapter = {
      ...baseRail,
      async verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
        const base = await baseRail.verifyPayment(input);
        return base.ok
          ? { ...base, payment_id: "invalid-settlement-" + base.payment_id }
          : base;
      },
      async settle(input: SettleInput): Promise<AccordSettlementReceipt> {
        return {
          type: "accord.settlement_receipt.v0",
          version: "v0",
          settlement_id: "sr_L1INVALIDSETTLEMENTXXXXXXX",
          agreement_id: "acc_WRONG",
          agreement_hash: "blake2b256:0x" + accordHashV0(input.agreement),
          rail: "base",
          mode: "redeemed",
          status: "settled",
          amount: "999",
          currency: "USDC",
          decimals: 6,
          tx: {
            network: "base-sepolia",
            tx_id: "0x" + "4".repeat(64),
          },
          created_at: "2026-05-07T00:00:20Z",
        };
      },
    };
    const invalidSettlementMiddleware = accordGateway({
      rail: invalidSettlementRail,
      verifier,
      resolveAgreement: async (id) => store.get(id),
      buildAgreementTemplate: () => ({
        agreement_template: "https://l1.example/.well-known/accord/agreement-template",
        price: { amount: "0.001", currency: "ERG", decimals: 9 },
        accepted_rails: ["ergo"],
        verification_required: true,
      }),
      handler: async () => ({ pong: true }),
    });
    const res = mockRes();
    await invalidSettlementMiddleware(
      {
        method: "POST",
        url: "/api/run",
        headers: {
          [ACCORD_HEADERS.agreementId]: agreement.agreement_id,
          [ACCORD_HEADERS.payment]: '{"value":"0.001","__settle_seed":"bad"}',
        },
      },
      res,
      () => {},
    );
    const body = JSON.parse(res.body ?? "{}") as {
      _meta?: Record<string, unknown>;
    };
    const emittedReceipt = body._meta?.accord_settlement_receipt;
    const header = res.headerMap.get("x-accord-settlement-receipt-hash");
    const ok =
      res.statusCode === 200 &&
      emittedReceipt === undefined &&
      header === undefined &&
      typeof body._meta?.accord_settlement_error === "string";
    checks.push({
      id: "L1.gateway.invalid-settlement-omitted",
      level: "L1",
      description:
        "invalid Settlement Receipts are omitted from _meta and settlement receipt hash headers",
      result: ok ? "pass" : "fail",
      detail: ok ? undefined : `status=${res.statusCode}, body=${res.body}, header=${header}`,
    });
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function summarise(checks: ConformanceCheck[]): ConformanceLevelResult {
  return {
    level: "L1",
    passed:
      checks.every((c) => c.result === "pass") && checks.length > 0,
    passed_count: checks.filter((c) => c.result === "pass").length,
    failed_count: checks.filter((c) => c.result === "fail").length,
    inconclusive_count: checks.filter((c) => c.result === "inconclusive").length,
    checks,
  };
}
