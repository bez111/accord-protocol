import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isLoopbackHost, requiresApiKeyForHost } from "../index.js";

describe("server bind-host safety", () => {
  it("allows loopback hosts without requiring an API key", () => {
    for (const host of ["127.0.0.1", "localhost", "::1", "[::1]"]) {
      assert.equal(isLoopbackHost(host), true, host);
      assert.equal(requiresApiKeyForHost(host), false, host);
    }
  });

  it("requires an API key for non-loopback hosts", () => {
    for (const host of ["0.0.0.0", "::", "192.168.1.10", "example.com"]) {
      assert.equal(isLoopbackHost(host), false, host);
      assert.equal(requiresApiKeyForHost(host), true, host);
    }
  });
});
