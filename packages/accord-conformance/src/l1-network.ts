// ─────────────────────────────────────────────────────────────────────────────
// @accord-protocol/conformance — L1 transport-compatibility, NETWORK mode
//
// Probes a live HTTP endpoint via Node's built-in `fetch`. Used by the CLI's
// `--target https://provider.example` flag. Same level (L1, transport) as
// the in-process runL1, but exercises a third-party Accord/402 implementation
// across the wire.
//
// What it sends
// -------------
//   1. POST /api/run with NO Accord-* headers — expects 402 + the
//      documented response headers + body.error == ACCORD_PAYMENT_REQUIRED.
//   2. POST /api/run with X-Accord-Agreement-Id but no payment — expects
//      402 + body.error == MISSING_PAYMENT (or UNKNOWN_AGREEMENT, depending
//      on whether the provider keeps an agreement store).
//   3. (Optional) POST /api/run with both headers IF the caller supplies
//      a valid agreement_id + payment via env. We don't mint either at v0
//      since that needs rail-specific signing.
//
// MCP-stdio probing is a follow-up — see the comment in the CLI; it'll
// spawn a child process and JSON-RPC over stdio.
// ─────────────────────────────────────────────────────────────────────────────

import type { ConformanceCheck, ConformanceLevelResult } from "./types.js";

export interface RunL1NetworkOptions {
  /** Endpoint URL. The probes POST against this — typically e.g. `https://provider.example/api/run`. */
  url: string;
  /** Optional buyer-supplied agreement_id for the third probe. */
  agreementId?: string;
  /** Optional buyer-supplied payment payload (rail-specific). */
  paymentJson?: string;
  /** Override default request timeout (ms). */
  timeoutMs?: number;
}

const ACCORD_HEADERS = {
  agreementId: "x-accord-agreement-id",
  payment: "x-accord-payment",
  taskOutput: "x-accord-task-output",
};

const RESPONSE_HEADERS = {
  versionResponse: "accord-version",
  agreementRequired: "accord-agreement-required",
  agreementTemplate: "accord-agreement-template",
  acceptedRails: "accord-accepted-rails",
  wwwAuthenticate: "www-authenticate",
};

export async function runL1Network(opts: RunL1NetworkOptions): Promise<ConformanceLevelResult> {
  const checks: ConformanceCheck[] = [];

  // Probe 1: empty headers → 402 challenge with right headers + body
  await runChallengeProbe(opts, checks);

  // Probe 2: agreement-id without payment → 402 + structured error
  await runMissingPaymentProbe(opts, checks);

  // Probe 3 (optional): full happy path
  if (opts.agreementId && opts.paymentJson) {
    await runHappyPathProbe(opts, checks);
  } else {
    checks.push({
      id: "L1.network.happy-path",
      level: "L1",
      description:
        "happy-path probe (200 + _meta) — skipped (caller did not supply --agreement-id + --payment)",
      result: "inconclusive",
      detail: "supply --agreement-id and --payment to exercise the happy-path probe",
    });
  }

  return summarise(checks);
}

// ── probes ──────────────────────────────────────────────────────────────────

async function runChallengeProbe(
  opts: RunL1NetworkOptions,
  checks: ConformanceCheck[],
): Promise<void> {
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetchWithTimeout(opts.url, opts.timeoutMs, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
  } catch (err) {
    checks.push({
      id: "L1.network.challenge.reachable",
      level: "L1",
      description: `${opts.url} is reachable (POST without Accord headers)`,
      result: "fail",
      detail: stringifyError(err),
    });
    return;
  }
  checks.push({
    id: "L1.network.challenge.reachable",
    level: "L1",
    description: `${opts.url} is reachable (POST without Accord headers)`,
    result: "pass",
    duration_ms: Date.now() - t0,
  });

  // Status code
  checks.push({
    id: "L1.network.challenge.status-402",
    level: "L1",
    description: "POST without Accord-* headers → 402",
    result: res.status === 402 ? "pass" : "fail",
    detail: res.status === 402 ? undefined : `got ${res.status}`,
  });

  // Required response headers
  const v = res.headers.get(RESPONSE_HEADERS.versionResponse);
  checks.push({
    id: "L1.network.challenge.accord-version",
    level: "L1",
    description: `Accord-Version response header is "v0"`,
    result: v === "v0" ? "pass" : "fail",
    detail: v === "v0" ? undefined : `got ${JSON.stringify(v)}`,
  });

  const aReq = res.headers.get(RESPONSE_HEADERS.agreementRequired);
  checks.push({
    id: "L1.network.challenge.agreement-required",
    level: "L1",
    description: `Accord-Agreement-Required response header is "true"`,
    result: aReq === "true" ? "pass" : "fail",
    detail: aReq === "true" ? undefined : `got ${JSON.stringify(aReq)}`,
  });

  const wwa = res.headers.get(RESPONSE_HEADERS.wwwAuthenticate);
  checks.push({
    id: "L1.network.challenge.www-authenticate",
    level: "L1",
    description: `WWW-Authenticate: Accord402`,
    result: wwa === "Accord402" ? "pass" : "fail",
    detail: wwa === "Accord402" ? undefined : `got ${JSON.stringify(wwa)}`,
  });

  // Body shape
  let body: unknown;
  try {
    body = await res.json();
  } catch (err) {
    checks.push({
      id: "L1.network.challenge.body-json",
      level: "L1",
      description: `402 body parses as JSON`,
      result: "fail",
      detail: stringifyError(err),
    });
    return;
  }
  const errCode = (body as { error?: string }).error;
  checks.push({
    id: "L1.network.challenge.body-error-code",
    level: "L1",
    description: `body.error == ACCORD_PAYMENT_REQUIRED`,
    result: errCode === "ACCORD_PAYMENT_REQUIRED" ? "pass" : "fail",
    detail:
      errCode === "ACCORD_PAYMENT_REQUIRED" ? undefined : `got ${JSON.stringify(errCode)}`,
  });
  const tpl = (body as { agreement_template?: string }).agreement_template;
  checks.push({
    id: "L1.network.challenge.body-agreement-template",
    level: "L1",
    description: `body.agreement_template is a non-empty string`,
    result: typeof tpl === "string" && tpl.length > 0 ? "pass" : "fail",
    detail: typeof tpl === "string" && tpl.length > 0 ? undefined : `got ${tpl}`,
  });
}

async function runMissingPaymentProbe(
  opts: RunL1NetworkOptions,
  checks: ConformanceCheck[],
): Promise<void> {
  let res: Response;
  try {
    res = await fetchWithTimeout(opts.url, opts.timeoutMs, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [ACCORD_HEADERS.agreementId]: opts.agreementId ?? "acc_01HX0CONFORMANCEPROBETEST",
      },
      body: JSON.stringify({}),
    });
  } catch (err) {
    checks.push({
      id: "L1.network.missing-payment.reachable",
      level: "L1",
      description: "POST with agreement-id but no X-Accord-Payment is reachable",
      result: "fail",
      detail: stringifyError(err),
    });
    return;
  }
  // The provider may either: have the agreement and ask for payment
  // (MISSING_PAYMENT, 402) or not have it at all (UNKNOWN_AGREEMENT, 402).
  // Both are valid Accord/402 behaviours.
  checks.push({
    id: "L1.network.missing-payment.status-402",
    level: "L1",
    description: "POST with agreement-id but no payment → 402",
    result: res.status === 402 ? "pass" : "fail",
    detail: res.status === 402 ? undefined : `got ${res.status}`,
  });

  if (res.status !== 402) return;
  let body: { error?: string };
  try {
    body = (await res.json()) as { error?: string };
  } catch (err) {
    checks.push({
      id: "L1.network.missing-payment.body-json",
      level: "L1",
      description: "402 body parses as JSON",
      result: "fail",
      detail: stringifyError(err),
    });
    return;
  }
  const ok = body.error === "MISSING_PAYMENT" || body.error === "UNKNOWN_AGREEMENT";
  checks.push({
    id: "L1.network.missing-payment.body-error-code",
    level: "L1",
    description: "body.error ∈ {MISSING_PAYMENT, UNKNOWN_AGREEMENT}",
    result: ok ? "pass" : "fail",
    detail: ok ? undefined : `got ${JSON.stringify(body.error)}`,
  });
}

async function runHappyPathProbe(
  opts: RunL1NetworkOptions,
  checks: ConformanceCheck[],
): Promise<void> {
  if (!opts.agreementId || !opts.paymentJson) return;
  let res: Response;
  try {
    res = await fetchWithTimeout(opts.url, opts.timeoutMs, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [ACCORD_HEADERS.agreementId]: opts.agreementId,
        [ACCORD_HEADERS.payment]: opts.paymentJson,
      },
      body: JSON.stringify({}),
    });
  } catch (err) {
    checks.push({
      id: "L1.network.happy-path.reachable",
      level: "L1",
      description: "happy-path POST is reachable",
      result: "fail",
      detail: stringifyError(err),
    });
    return;
  }
  checks.push({
    id: "L1.network.happy-path.status-200",
    level: "L1",
    description: "valid Accord-* headers → 200",
    result: res.status === 200 ? "pass" : "fail",
    detail: res.status === 200 ? undefined : `got ${res.status}`,
  });

  if (res.status !== 200) return;

  // Response carries x-accord-agreement-hash
  const ah = res.headers.get("x-accord-agreement-hash");
  checks.push({
    id: "L1.network.happy-path.agreement-hash-header",
    level: "L1",
    description: "x-accord-agreement-hash response header is blake2b256:0x<64>",
    result: ah && /^blake2b256:0x[0-9a-f]{64}$/.test(ah) ? "pass" : "fail",
    detail: ah && /^blake2b256:0x[0-9a-f]{64}$/.test(ah) ? undefined : `got ${ah}`,
  });

  let body: { output?: unknown; _meta?: Record<string, unknown> };
  try {
    body = (await res.json()) as { output?: unknown; _meta?: Record<string, unknown> };
  } catch (err) {
    checks.push({
      id: "L1.network.happy-path.body-json",
      level: "L1",
      description: "200 body parses as JSON",
      result: "fail",
      detail: stringifyError(err),
    });
    return;
  }
  checks.push({
    id: "L1.network.happy-path.body-shape",
    level: "L1",
    description: "200 body is { output, _meta } with accord_agreement_id in _meta",
    result:
      body.output !== undefined &&
      typeof body._meta === "object" &&
      body._meta !== null &&
      typeof (body._meta as Record<string, unknown>).accord_agreement_id === "string"
        ? "pass"
        : "fail",
    detail:
      body.output !== undefined && typeof body._meta === "object"
        ? undefined
        : "missing output or _meta",
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 10_000,
  init: RequestInit = {},
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

function summarise(checks: ConformanceCheck[]): ConformanceLevelResult {
  return {
    level: "L1",
    passed: checks.every((c) => c.result === "pass") && checks.length > 0,
    passed_count: checks.filter((c) => c.result === "pass").length,
    failed_count: checks.filter((c) => c.result === "fail").length,
    inconclusive_count: checks.filter((c) => c.result === "inconclusive").length,
    checks,
  };
}

function stringifyError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}
