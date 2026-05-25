import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildRosenReserveConfig,
  buildRosenNoteOptions,
  RS_RESERVE_SCRIPT_NAME,
} from "../index.js";
import type { TokenLookupResult } from "../index.js";
import { tryGetErgoTree } from "ergo-agent-scripts";

const USDT_TOKEN: TokenLookupResult = {
  ergoTokenId: "deadbeef".repeat(8),
  sourceName: "USDT",
  sourceDecimals: 6,
  wrappedDecimals: 6,
  sourceTokenId: "0xdac17f958d2ee523a2206206994597c13d831ec7",
};

describe("buildRosenReserveConfig", () => {
  it("uses the manifest-gated basis_token_reserve_v0 ergoTree", () => {
    const cfg = buildRosenReserveConfig({ token: USDT_TOKEN, collateral: "1 ERG" });
    assert.equal(cfg.scriptName, RS_RESERVE_SCRIPT_NAME);
    assert.equal(cfg.scriptErgoTree, tryGetErgoTree(RS_RESERVE_SCRIPT_NAME));
    assert.equal(cfg.collateral, "1 ERG");
  });

  it("includes a Rosen-prefixed memo for traceability", () => {
    const cfg = buildRosenReserveConfig({ token: USDT_TOKEN, collateral: "1 ERG" });
    assert.match(cfg.memo!, /^rosen:/);
  });

  it("preserves caller memo and appends a Rosen tag", () => {
    const cfg = buildRosenReserveConfig({
      token: USDT_TOKEN,
      collateral: "1 ERG",
      memo: "agent payment 42",
    });
    assert.match(cfg.memo!, /^agent payment 42 \| rosen:/);
  });
});

describe("buildRosenNoteOptions", () => {
  it("attaches the manifest-gated tree + scriptName + tokenId", () => {
    const opts = buildRosenNoteOptions({
      token: USDT_TOKEN,
      recipient: "9XAlpha",
      amount: 5_000_000n,
      reserveBoxId: "abc",
      deadline: "+100 blocks",
      taskHash: "0".repeat(64),
    });
    assert.equal(opts.scriptName, RS_RESERVE_SCRIPT_NAME);
    assert.equal(opts.scriptErgoTree, tryGetErgoTree(RS_RESERVE_SCRIPT_NAME));
    assert.equal(opts.rosenTokenId, USDT_TOKEN.ergoTokenId);
    assert.equal(opts.value, 5_000_000n);
    assert.equal(opts.recipient, "9XAlpha");
  });

  it("forwards optional credentialKey when provided", () => {
    const opts = buildRosenNoteOptions({
      token: USDT_TOKEN,
      recipient: "9XAlpha",
      amount: 1_000_000n,
      reserveBoxId: "abc",
      deadline: "+10 blocks",
      credentialKey: "0xPK",
    });
    assert.equal(opts.credentialKey, "0xPK");
  });

  it("propagates an absolute-height deadline", () => {
    const opts = buildRosenNoteOptions({
      token: USDT_TOKEN,
      recipient: "9XAlpha",
      amount: 1n,
      reserveBoxId: "abc",
      deadline: 1_300_000,
    });
    assert.equal(opts.deadline, 1_300_000);
  });
});
