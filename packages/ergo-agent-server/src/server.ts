// ─────────────────────────────────────────────────────────────────────────────
// ergo-agent-server — Node http adapter
//
// Thin wrapper around the pure router. Reads request bodies, parses JSON,
// dispatches to `route()`, and writes the JSON response. No external server
// dependency — Node's `http` module is enough for a localhost daemon.
// ─────────────────────────────────────────────────────────────────────────────

import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse, Server } from "node:http";
import { route } from "./router.js";
import type { BridgeRouterDeps } from "./router.js";

export interface BridgeServerOptions extends BridgeRouterDeps {
  port: number;
  host?: string;
  /** Max accepted body size in bytes. Default 1 MiB. */
  maxBodyBytes?: number;
}

export function createBridgeServer(options: BridgeServerOptions): Server {
  const maxBody = options.maxBodyBytes ?? 1024 * 1024;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    const headers: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v[0] : v;
    }

    let bodyText = "";
    if (req.method && req.method !== "GET" && req.method !== "HEAD") {
      try {
        bodyText = await readBody(req, maxBody);
      } catch (err) {
        return writeJson(res, 413, {
          error: err instanceof Error ? err.message : String(err),
          code: "PAYLOAD_TOO_LARGE",
          status: 413,
        });
      }
    }

    let parsedBody: unknown = null;
    if (bodyText) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch {
        return writeJson(res, 400, {
          error: "Invalid JSON body.",
          code: "INVALID_JSON",
          status: 400,
        });
      }
    }

    const verdict = await route(options, {
      method: req.method ?? "GET",
      path: url.pathname,
      query: url.searchParams,
      headers,
      body: parsedBody,
    });

    writeJson(res, verdict.status, verdict.body);
  });

  return server;
}

function readBody(req: IncomingMessage, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > max) {
        req.destroy();
        reject(new Error(`Request body exceeds ${max} bytes.`));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function writeJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  const text = JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(text).toString());
  res.end(text);
}
