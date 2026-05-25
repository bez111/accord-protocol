import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveErgoSideToken,
  listSupportedFromChain,
  RosenIntegrationError,
} from "../index.js";
import type { TokenMapLike } from "../index.js";

// ── Stub TokenMap that mimics the relevant @rosen-bridge/tokens shape ───────

interface TokenSet {
  [chain: string]: {
    tokenId: string;
    name?: string;
    decimals?: number;
    type?: string;
    residency?: string;
  };
}

function stubMap(sets: TokenSet[]): TokenMapLike {
  const decimals = new Map<string, number>();
  for (const set of sets) {
    for (const entry of Object.values(set)) {
      if (entry.tokenId && entry.decimals !== undefined) {
        decimals.set(entry.tokenId, entry.decimals);
      }
    }
  }

  return {
    getTokens(fromChain, toChain) {
      return sets.filter((s) => s[fromChain] && s[toChain]);
    },
    getID(token, chain) {
      return token[chain] && typeof (token[chain] as { tokenId?: string }).tokenId === "string"
        ? (token[chain] as { tokenId: string }).tokenId
        : "";
    },
    getSignificantDecimals(tokenId) {
      return decimals.get(tokenId);
    },
    search(chain, condition) {
      return sets.filter((s) => {
        const entry = s[chain] as Record<string, unknown> | undefined;
        if (!entry) return false;
        for (const [k, v] of Object.entries(condition)) {
          if (entry[k] !== v) return false;
        }
        return true;
      }) as Record<string, unknown>[];
    },
  };
}

const USDT_ETH_SET: TokenSet = {
  ethereum: {
    tokenId: "0xdac17f958d2ee523a2206206994597c13d831ec7",
    name: "USDT",
    decimals: 6,
    type: "erc20",
    residency: "native",
  },
  ergo: {
    tokenId: "ergo-rsusdt-id-deadbeef",
    name: "rsUSDT",
    decimals: 6,
    type: "eip-004",
    residency: "wrapped",
  },
};

const ETH_NATIVE_SET: TokenSet = {
  ethereum: {
    tokenId: "native",
    name: "ETH",
    decimals: 18,
    type: "native",
    residency: "native",
  },
  ergo: {
    tokenId: "ergo-rseth-id-cafebabe",
    name: "rsETH",
    decimals: 9,
    type: "eip-004",
    residency: "wrapped",
  },
};

const BTC_SET: TokenSet = {
  bitcoin: {
    tokenId: "native",
    name: "BTC",
    decimals: 8,
    type: "native",
    residency: "native",
  },
  ergo: {
    tokenId: "ergo-rsbtc-id-1234abcd",
    name: "rsBTC",
    decimals: 8,
    type: "eip-004",
    residency: "wrapped",
  },
};

// ── tests ────────────────────────────────────────────────────────────────────

describe("resolveErgoSideToken", () => {
  it("resolves an ERC-20 token by name", () => {
    const map = stubMap([USDT_ETH_SET]);
    const r = resolveErgoSideToken(map, { chain: "ethereum", name: "USDT" });
    assert.equal(r.ergoTokenId, "ergo-rsusdt-id-deadbeef");
    assert.equal(r.sourceTokenId, "0xdac17f958d2ee523a2206206994597c13d831ec7");
    assert.equal(r.wrappedDecimals, 6);
    assert.equal(r.sourceDecimals, 6);
  });

  it("resolves a native asset (ETH) via the native flag", () => {
    const map = stubMap([ETH_NATIVE_SET]);
    const r = resolveErgoSideToken(map, { chain: "ethereum", native: true });
    assert.equal(r.ergoTokenId, "ergo-rseth-id-cafebabe");
    assert.equal(r.sourceTokenId, "native");
  });

  it("resolves BTC via the native flag", () => {
    const map = stubMap([BTC_SET]);
    const r = resolveErgoSideToken(map, { chain: "bitcoin", native: true });
    assert.equal(r.ergoTokenId, "ergo-rsbtc-id-1234abcd");
  });

  it("rejects ergo-native (ERG isn't bridged)", () => {
    const map = stubMap([USDT_ETH_SET]);
    assert.throws(
      () => resolveErgoSideToken(map, { chain: "ergo", native: true }),
      (e: unknown) =>
        e instanceof RosenIntegrationError && e.code === "UNSUPPORTED_CHAIN"
    );
  });

  it("throws TOKEN_NOT_FOUND when no match", () => {
    const map = stubMap([USDT_ETH_SET]);
    assert.throws(
      () => resolveErgoSideToken(map, { chain: "ethereum", name: "WIF" }),
      (e: unknown) =>
        e instanceof RosenIntegrationError && e.code === "TOKEN_NOT_FOUND"
    );
  });

  it("throws when the search is ambiguous", () => {
    const dupSet: TokenSet = { ...USDT_ETH_SET };
    const map = stubMap([USDT_ETH_SET, dupSet]);
    assert.throws(
      () => resolveErgoSideToken(map, { chain: "ethereum", name: "USDT" }),
      (e: unknown) =>
        e instanceof RosenIntegrationError && /Ambiguous/.test(e.message)
    );
  });

  it("throws MALFORMED_TOKEN_MAP when no Ergo side", () => {
    const broken: TokenSet = {
      ethereum: { tokenId: "0xdead", name: "X", decimals: 6 },
    };
    const map = stubMap([broken]);
    assert.throws(
      () => resolveErgoSideToken(map, { chain: "ethereum", name: "X" }),
      (e: unknown) =>
        e instanceof RosenIntegrationError && e.code === "MALFORMED_TOKEN_MAP"
    );
  });
});

describe("listSupportedFromChain", () => {
  it("returns all assets reachable from a chain", () => {
    const map = stubMap([USDT_ETH_SET, ETH_NATIVE_SET, BTC_SET]);
    const fromEth = listSupportedFromChain(map, "ethereum");
    assert.equal(fromEth.length, 2);
    const ids = fromEth.map((r) => r.ergoTokenId).sort();
    assert.deepEqual(ids, ["ergo-rseth-id-cafebabe", "ergo-rsusdt-id-deadbeef"]);
  });

  it("rejects ergo as source chain", () => {
    const map = stubMap([USDT_ETH_SET]);
    assert.throws(
      () => listSupportedFromChain(map, "ergo"),
      (e: unknown) =>
        e instanceof RosenIntegrationError && e.code === "UNSUPPORTED_CHAIN"
    );
  });

  it("returns empty list when no tokens map a chain pair", () => {
    const map = stubMap([USDT_ETH_SET]);
    const fromBtc = listSupportedFromChain(map, "bitcoin");
    assert.deepEqual(fromBtc, []);
  });
});
