import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  bridgeUrl,
  BridgeUrlBuilder,
  DEFAULT_ROSEN_HOST,
  RosenIntegrationError,
} from "../index.js";

describe("bridgeUrl", () => {
  it("builds a URL targeting the default host", () => {
    const url = bridgeUrl({
      from: "ethereum",
      to: "ergo",
      asset: "USDT",
      amount: "5",
      recipient: "9hRjC9Sxc1ASEqp7w4dV8mY1ZGcRGbvTUmPuctYzCwGu7AHWvQ7",
    });
    assert.ok(url.startsWith(DEFAULT_ROSEN_HOST));
    const u = new URL(url);
    assert.equal(u.searchParams.get("from"), "ethereum");
    assert.equal(u.searchParams.get("to"), "ergo");
    assert.equal(u.searchParams.get("token"), "USDT");
    assert.equal(u.searchParams.get("amount"), "5");
    assert.equal(
      u.searchParams.get("address"),
      "9hRjC9Sxc1ASEqp7w4dV8mY1ZGcRGbvTUmPuctYzCwGu7AHWvQ7"
    );
  });

  it("URL-encodes special characters in amount and recipient", () => {
    const url = bridgeUrl({
      from: "ethereum",
      to: "ergo",
      asset: "USDT",
      amount: "5.5",
      recipient: "9X+Y/Z=",
    });
    const u = new URL(url);
    assert.equal(u.searchParams.get("amount"), "5.5");
    assert.equal(u.searchParams.get("address"), "9X+Y/Z=");
  });

  it("omits empty optional params", () => {
    const url = bridgeUrl({ from: "bitcoin", to: "ergo", asset: "BTC" });
    const u = new URL(url);
    assert.equal(u.searchParams.get("amount"), null);
    assert.equal(u.searchParams.get("address"), null);
  });

  it("supports a custom host", () => {
    const url = new BridgeUrlBuilder({ host: "https://testnet.rosen.example/" }).bridge({
      from: "ethereum",
      to: "ergo",
      asset: "USDT",
    });
    assert.ok(url.startsWith("https://testnet.rosen.example/?"));
  });

  it("rejects same source and destination", () => {
    assert.throws(
      () => bridgeUrl({ from: "ergo", to: "ergo", asset: "USDT" }),
      (e: unknown) =>
        e instanceof RosenIntegrationError && /same/i.test(e.message)
    );
  });

  it("rejects unknown chains", () => {
    assert.throws(
      // @ts-expect-error — intentionally invalid
      () => bridgeUrl({ from: "solana", to: "ergo", asset: "SOL" }),
      (e: unknown) =>
        e instanceof RosenIntegrationError && e.code === "UNSUPPORTED_CHAIN"
    );
  });

  it("supports every documented Rosen chain in both directions", () => {
    const chains = [
      "ergo",
      "ethereum",
      "binance",
      "bitcoin",
      "bitcoin-runes",
      "cardano",
      "doge",
    ] as const;
    for (const a of chains) {
      for (const b of chains) {
        if (a === b) continue;
        assert.doesNotThrow(() => bridgeUrl({ from: a, to: b, asset: "X" }));
      }
    }
  });
});
