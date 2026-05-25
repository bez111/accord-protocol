import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseServerConfig } from "../index.js";

describe("MCP server config", () => {
  it("defaults to testnet", () => {
    const c = parseServerConfig([], {});
    assert.equal(c.network, "testnet");
    assert.equal(c.nodeUrl, "https://api-testnet.ergoplatform.com");
  });

  it("allows explicit mainnet", () => {
    const c = parseServerConfig(["--network", "mainnet"], {});
    assert.equal(c.network, "mainnet");
    assert.equal(c.nodeUrl, "https://api.ergoplatform.com");
  });

  it("rejects unknown networks", () => {
    assert.throws(
      () => parseServerConfig(["--network", "bogus"], {}),
      /--network must be "mainnet" or "testnet"/,
    );
  });

  it("lets ERGO_NODE_URL override the network default", () => {
    const c = parseServerConfig([], { ERGO_NODE_URL: "http://127.0.0.1:9053" });
    assert.equal(c.nodeUrl, "http://127.0.0.1:9053");
  });
});
