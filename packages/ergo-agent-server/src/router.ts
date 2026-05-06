// ─────────────────────────────────────────────────────────────────────────────
// ergo-agent-server — request router
//
// Pure-function dispatcher: takes a `Request` shape and returns a `Response`
// shape. The HTTP adapter (server.ts) wires this to node's `http` module;
// tests call it directly without binding a port.
//
// All write endpoints accept JSON; all responses are JSON. Errors carry a
// stable code field for the Python client to switch on.
// ─────────────────────────────────────────────────────────────────────────────

import {
  ErgoAgentPay,
  ErgoAgentPayError,
  computeTaskHash,
} from "ergo-agent-pay";
import type {
  NoteOptions,
  ReserveConfig,
  TrackerConfig,
  BatchSettleOptions,
} from "ergo-agent-pay";

export interface BridgeRequest {
  method: string;
  path: string;          // path without query string
  query: URLSearchParams;
  headers: Record<string, string | undefined>;
  body: unknown;         // already JSON-parsed when applicable
}

export interface BridgeResponse {
  status: number;
  body: Record<string, unknown> | { error: string; code: string; status: number };
}

export interface BridgeRouterDeps {
  agent: ErgoAgentPay;
  /** API key — when set, every request must carry a matching X-API-Key header. */
  apiKey?: string;
}

const PUBLIC_PATHS = new Set(["/health"]);

export async function route(deps: BridgeRouterDeps, req: BridgeRequest): Promise<BridgeResponse> {
  if (deps.apiKey && !PUBLIC_PATHS.has(req.path)) {
    const provided = req.headers["x-api-key"];
    if (provided !== deps.apiKey) {
      return error(401, "UNAUTHORISED", "Missing or invalid X-API-Key header.");
    }
  }

  try {
    return await dispatch(deps, req);
  } catch (err) {
    if (err instanceof ErgoAgentPayError) {
      const status = httpStatusFor(err.code);
      return { status, body: { error: err.message, code: err.code, status } };
    }
    const message = err instanceof Error ? err.message : String(err);
    return error(500, "INTERNAL_ERROR", message);
  }
}

async function dispatch(deps: BridgeRouterDeps, req: BridgeRequest): Promise<BridgeResponse> {
  const { method, path } = req;

  if (method === "GET" && path === "/health") {
    return ok({ status: "ok", service: "ergo-agent-server", version: "0.1.0" });
  }

  if (method === "GET" && path === "/balance") {
    const balance = await deps.agent.getBalance();
    return ok({ nano_ergs: balance.nanoErgs.toString(), ergs: balance.ergs });
  }

  if (method === "GET" && path === "/height") {
    return ok({ height: await deps.agent.getHeight() });
  }

  // /notes/:boxId
  const noteMatch = path.match(/^\/notes\/([^/]+)$/);
  if (method === "GET" && noteMatch) {
    const info = await deps.agent.checkNote(noteMatch[1]!);
    return ok(serialiseNoteInfo(info));
  }

  // /notes/:boxId/redeem
  const redeemMatch = path.match(/^\/notes\/([^/]+)\/redeem$/);
  if (method === "POST" && redeemMatch) {
    const body = asObject(req.body);
    const result = await deps.agent.redeemNote({
      noteBoxId: redeemMatch[1]!,
      taskOutput: body["task_output"] as string | undefined,
      receiverAddress: body["receiver_address"] as string | undefined,
    });
    return ok({
      submitted: result.submitted,
      tx_id: result.txId,
      redeemed: result.redeemed,
      unsigned_tx: result.unsignedTx,
    });
  }

  if (method === "POST" && path === "/pay") {
    const body = asObject(req.body);
    const to = requireField<string>(body, "to");
    const amount = requireField<string | number>(body, "amount");
    const memo = body["memo"] as string | undefined;
    const result = await deps.agent.pay(to, amount, { memo });
    return ok({
      submitted: result.submitted,
      tx_id: result.txId,
      unsigned_tx: result.unsignedTx,
    });
  }

  if (method === "POST" && path === "/notes") {
    const body = asObject(req.body);
    const opts: NoteOptions = {
      recipient: requireField<string>(body, "recipient"),
      value: requireField<string | number | bigint>(body, "value"),
      reserveBoxId: requireField<string>(body, "reserve_box_id"),
      deadline: requireField<NoteOptions["deadline"]>(body, "deadline"),
      taskHash: body["task_hash"] as string | undefined,
      credentialKey: body["credential_key"] as string | undefined,
      scriptErgoTree: body["script_ergo_tree"] as string | undefined,
    };
    const result = await deps.agent.issueNote(opts);
    return ok({
      submitted: result.submitted,
      tx_id: result.txId,
      note_output: result.noteOutput,
      unsigned_tx: result.unsignedTx,
    });
  }

  if (method === "POST" && path === "/reserves") {
    const body = asObject(req.body);
    const config: ReserveConfig = {
      collateral: requireField<string | number | bigint>(body, "collateral"),
      scriptErgoTree: body["script_ergo_tree"] as string | undefined,
      memo: body["memo"] as string | undefined,
    };
    const result = await deps.agent.createReserve(config);
    return ok({
      submitted: result.submitted,
      tx_id: result.txId,
      reserve: result.reserve,
      unsigned_tx: result.unsignedTx,
    });
  }

  if (method === "POST" && path === "/trackers") {
    const body = asObject(req.body);
    const config: TrackerConfig = {
      scriptErgoTree: requireField<string>(body, "script_ergo_tree"),
    };
    const result = await deps.agent.deployTracker(config);
    return ok({
      submitted: result.submitted,
      tx_id: result.txId,
      tracker: result.tracker,
      unsigned_tx: result.unsignedTx,
    });
  }

  if (method === "POST" && path === "/settle") {
    const body = asObject(req.body);
    const opts: BatchSettleOptions = {
      noteBoxIds: requireField<string[]>(body, "note_box_ids"),
      taskOutputs: body["task_outputs"] as Record<string, string> | undefined,
      receiverAddress: body["receiver_address"] as string | undefined,
    };
    const result = await deps.agent.settleBatch(opts);
    return ok({
      submitted: result.submitted,
      tx_id: result.txId,
      settlement: result.settlement,
      unsigned_tx: result.unsignedTx,
    });
  }

  if (method === "POST" && path === "/task-hash") {
    const body = asObject(req.body);
    let bytes: Uint8Array;
    if (typeof body["text"] === "string") {
      bytes = new TextEncoder().encode(body["text"]);
    } else if (typeof body["hex"] === "string") {
      const hex = body["hex"] as string;
      if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
        return error(400, "INVALID_HASH", "Field 'hex' must be an even-length hex string.");
      }
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < hex.length; i += 2) out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
      bytes = out;
    } else {
      return error(400, "INVALID_AMOUNT", "POST /task-hash requires 'text' or 'hex' field.");
    }
    return ok({
      task_hash: computeTaskHash(bytes),
      algorithm: "BLAKE2b-256",
      input_bytes: bytes.length,
    });
  }

  return error(404, "NOT_FOUND", `No route for ${method} ${path}.`);
}

// ── helpers ──────────────────────────────────────────────────────────────────

function ok(body: Record<string, unknown>): BridgeResponse {
  return { status: 200, body };
}

function error(status: number, code: string, message: string): BridgeResponse {
  return { status, body: { error: message, code, status } };
}

function asObject(body: unknown): Record<string, unknown> {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  throw new ErgoAgentPayError("Request body must be a JSON object.", "INVALID_AMOUNT");
}

function requireField<T>(body: Record<string, unknown>, name: string): T {
  const v = body[name];
  if (v === undefined || v === null) {
    throw new ErgoAgentPayError(`Missing required field "${name}" in request body.`, "INVALID_AMOUNT");
  }
  return v as T;
}

function serialiseNoteInfo(info: {
  boxId: string;
  value: bigint;
  ergs: string;
  expiryBlock: number;
  currentBlock: number;
  isExpired: boolean;
  reserveBoxId?: string;
  taskHash?: string;
  credentialKey?: string;
}): Record<string, unknown> {
  return {
    box_id: info.boxId,
    value_nano_erg: info.value.toString(),
    value_erg: info.ergs,
    expiry_block: info.expiryBlock,
    current_block: info.currentBlock,
    is_expired: info.isExpired,
    reserve_box_id: info.reserveBoxId ?? null,
    task_hash: info.taskHash ?? null,
    credential_key: info.credentialKey ?? null,
  };
}

function httpStatusFor(code: string): number {
  switch (code) {
    case "INVALID_ADDRESS":
    case "INVALID_AMOUNT":
    case "INVALID_HASH":
      return 400;
    case "BOX_NOT_FOUND":
    case "NOTE_EXPIRED":
    case "NOTE_INVALID":
      return 404;
    case "INSECURE_MAINNET_MODE":
      return 403;
    case "POLICY_REJECTED":
    case "APPROVAL_DENIED":
      return 403;
    case "NO_SIGNER":
    case "INSUFFICIENT_FUNDS":
      return 409;
    case "NETWORK_ERROR":
    case "SUBMISSION_FAILED":
      return 502;
    default:
      return 500;
  }
}
