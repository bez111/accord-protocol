#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// ergo-agent-server — CLI entrypoint
//
// Usage:
//   ergo-agent-server --address 9X... --network testnet --port 3737
//   ergo-agent-server --help
//
// Environment variables (CLI flags take precedence):
//   ERGO_ADDRESS, ERGO_NETWORK, ERGO_NODE_URL, ERGO_API_KEY,
//   ERGO_BRIDGE_PORT, ERGO_BRIDGE_HOST, ERGO_ALLOW_INSECURE_DEV_MODE
//
// Signing: this v0 daemon does not embed a signer. It returns unsigned EIP-12
// transactions on every write endpoint; the caller signs and submits via
// Nautilus, AppKit, or a separate signing process. A future revision will
// support a configurable signer (HSM, file-based key with passphrase, etc.).
// ─────────────────────────────────────────────────────────────────────────────

import { ErgoAgentPay } from "ergo-agent-pay";
import type { Network } from "ergo-agent-pay";
import { createBridgeServer } from "./server.js";

export { createBridgeServer } from "./server.js";
export { route } from "./router.js";
export type { BridgeRequest, BridgeResponse, BridgeRouterDeps } from "./router.js";

const HELP = `ergo-agent-server — local HTTP bridge for ergo-agent-pay

USAGE
  ergo-agent-server [flags]

FLAGS
  --address <addr>             agent address (or env ERGO_ADDRESS)
  --network mainnet|testnet    network (or env ERGO_NETWORK; default: testnet)
  --node-url <url>             custom Ergo API (or env ERGO_NODE_URL)
  --port <n>                   listen port (or env ERGO_BRIDGE_PORT; default: 3737)
  --host <h>                   bind host (or env ERGO_BRIDGE_HOST; default: 127.0.0.1)
  --api-key <key>              require this X-API-Key header (or env ERGO_API_KEY)
  --allow-insecure-dev-mode    legacy flag; no longer bypasses mainnet safety
                               (or env ERGO_ALLOW_INSECURE_DEV_MODE=1)
  --help                       show this message

ENDPOINTS
  GET  /health
  GET  /balance
  GET  /height
  GET  /notes/<boxId>
  POST /notes/<boxId>/redeem            { task_output?, receiver_address? }
  POST /pay                             { to, amount, memo? }
  POST /notes                           { recipient, value, reserve_box_id, deadline, ... }
  POST /reserves                        { collateral, script_ergo_tree?, memo? }
  POST /trackers                        { script_ergo_tree }
  POST /settle                          { note_box_ids[], task_outputs?, receiver_address? }
  POST /task-hash                       { text } | { hex }

The daemon listens on 127.0.0.1 by default. Binding to a non-localhost
interface requires --api-key.
`;

export function isLoopbackHost(host: string): boolean {
  const normalised = host.trim().toLowerCase();
  return (
    normalised === "127.0.0.1" ||
    normalised === "localhost" ||
    normalised === "::1" ||
    normalised === "[::1]"
  );
}

export function requiresApiKeyForHost(host: string): boolean {
  return !isLoopbackHost(host);
}

function getFlag(argv: readonly string[], name: string): string | undefined {
  const idx = argv.indexOf(`--${name}`);
  if (idx !== -1) {
    const next = argv[idx + 1];
    if (next && !next.startsWith("--")) return next;
    return "";
  }
  for (const arg of argv) {
    if (arg.startsWith(`--${name}=`)) return arg.slice(name.length + 3);
  }
  return undefined;
}

function hasBoolFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

export function parseCliConfig(argv: readonly string[]) {
  if (hasBoolFlag(argv, "help") || argv.includes("-h")) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  const env = process.env;
  const address = getFlag(argv, "address") ?? env["ERGO_ADDRESS"] ?? "";
  if (!address) {
    process.stderr.write("error: --address is required (or set ERGO_ADDRESS)\n\n");
    process.stderr.write(HELP);
    process.exit(2);
  }

  const networkRaw = getFlag(argv, "network") ?? env["ERGO_NETWORK"] ?? "testnet";
  if (networkRaw !== "mainnet" && networkRaw !== "testnet") {
    process.stderr.write(`error: --network must be "mainnet" or "testnet" (got "${networkRaw}")\n`);
    process.exit(2);
  }
  const network = networkRaw as Network;

  const nodeUrl = getFlag(argv, "node-url") ?? env["ERGO_NODE_URL"];
  const portStr = getFlag(argv, "port") ?? env["ERGO_BRIDGE_PORT"] ?? "3737";
  const port = parseInt(portStr, 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    process.stderr.write(`error: invalid --port "${portStr}"\n`);
    process.exit(2);
  }
  const host = getFlag(argv, "host") ?? env["ERGO_BRIDGE_HOST"] ?? "127.0.0.1";
  const apiKey = getFlag(argv, "api-key") ?? env["ERGO_API_KEY"];
  if (!apiKey && requiresApiKeyForHost(host)) {
    process.stderr.write(
      "error: --api-key is required when --host is not localhost/127.0.0.1\n"
    );
    process.exit(2);
  }
  const allowInsecureDevMode =
    hasBoolFlag(argv, "allow-insecure-dev-mode") ||
    env["ERGO_ALLOW_INSECURE_DEV_MODE"] === "1" ||
    env["ERGO_ALLOW_INSECURE_DEV_MODE"] === "true";

  return { address, network, nodeUrl, port, host, apiKey, allowInsecureDevMode };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const cfg = parseCliConfig(process.argv.slice(2));
  const agent = new ErgoAgentPay({
    address: cfg.address,
    network: cfg.network,
    nodeUrl: cfg.nodeUrl,
    allowInsecureDevMode: cfg.allowInsecureDevMode,
  });
  const server = createBridgeServer({ agent, apiKey: cfg.apiKey, port: cfg.port, host: cfg.host });
  server.listen(cfg.port, cfg.host, () => {
    process.stderr.write(
      `ergo-agent-server listening on http://${cfg.host}:${cfg.port} ` +
        `(${cfg.network}${cfg.apiKey ? ", auth: X-API-Key" : ", no auth"})\n`
    );
  });
}
