import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { createBridgeServer } from "../server.js";
import type { AddressInfo } from "node:net";

function fakeAgent(): unknown {
  return {
    config: {},
    async getBalance() {
      return { nanoErgs: 5_000_000_000n, ergs: "5" };
    },
    async getHeight() {
      return 1_234_567;
    },
  };
}

async function withServer<T>(opts: { apiKey?: string }, fn: (port: number) => Promise<T>): Promise<T> {
  const server = createBridgeServer({
    agent: fakeAgent() as never,
    apiKey: opts.apiKey,
    port: 0,
    host: "127.0.0.1",
  });
  await new Promise<void>((res) => server.listen(0, "127.0.0.1", () => res()));
  const port = (server.address() as AddressInfo).port;
  try {
    return await fn(port);
  } finally {
    await new Promise<void>((res) => server.close(() => res()));
  }
}

describe("createBridgeServer — end-to-end", () => {
  it("serves /health over HTTP", async () => {
    await withServer({}, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/health`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as Record<string, unknown>;
      assert.equal(body.status, "ok");
    });
  });

  it("serves /balance with bigint serialised as string", async () => {
    await withServer({}, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/balance`);
      const body = (await res.json()) as Record<string, unknown>;
      assert.equal(body.nano_ergs, "5000000000");
      assert.equal(body.ergs, "5");
    });
  });

  it("returns 401 when --api-key is set and request omits the header", async () => {
    await withServer({ apiKey: "secret" }, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/balance`);
      assert.equal(res.status, 401);
    });
  });

  it("accepts /balance when X-API-Key matches", async () => {
    await withServer({ apiKey: "secret" }, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/balance`, {
        headers: { "X-API-Key": "secret" },
      });
      assert.equal(res.status, 200);
    });
  });

  it("returns 400 on invalid JSON", async () => {
    await withServer({}, async (port) => {
      const res = await fetch(`http://127.0.0.1:${port}/task-hash`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      });
      assert.equal(res.status, 400);
      const body = (await res.json()) as Record<string, unknown>;
      assert.equal(body.code, "INVALID_JSON");
    });
  });
});
