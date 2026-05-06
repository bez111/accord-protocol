import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertProductionSafety } from "../safety.js";
import type { AuditPolicy } from "../safety.js";
import { ErgoAgentPayError } from "../types.js";

const PASS: AuditPolicy = () => ({ ok: true });
const FAIL: AuditPolicy = () => ({ ok: false, reason: "stub-rejected" });

describe("assertProductionSafety — testnet bypass", () => {
  it("allows testnet without a script and no audit policy", async () => {
    await assert.doesNotReject(() =>
      assertProductionSafety({
        operation: "createReserve",
        network: "testnet",
        scriptErgoTree: undefined,
      })
    );
  });

  it("allows testnet with an arbitrary tree and no audit policy", async () => {
    await assert.doesNotReject(() =>
      assertProductionSafety({
        operation: "createReserve",
        network: "testnet",
        scriptErgoTree: "deadbeef",
      })
    );
  });
});

describe("assertProductionSafety — mainnet box-shape gate", () => {
  it("rejects mainnet without a script and without P2PK opt-in", async () => {
    await assert.rejects(
      () =>
        assertProductionSafety({
          operation: "createReserve",
          network: "mainnet",
          scriptErgoTree: undefined,
          auditPolicy: PASS,
        }),
      (e: unknown) =>
        e instanceof ErgoAgentPayError && e.code === "INSECURE_MAINNET_MODE"
    );
  });

  it("rejects empty-string scriptErgoTree as missing", async () => {
    await assert.rejects(
      () =>
        assertProductionSafety({
          operation: "deployTracker",
          network: "mainnet",
          scriptErgoTree: "",
          auditPolicy: PASS,
        }),
      (e: unknown) =>
        e instanceof ErgoAgentPayError && e.code === "INSECURE_MAINNET_MODE"
    );
  });

  it("dangerouslyAllowInsecureMainnetP2PK lets mainnet write a P2PK box", async () => {
    await assert.doesNotReject(() =>
      assertProductionSafety({
        operation: "createReserve",
        network: "mainnet",
        scriptErgoTree: undefined,
        dangerouslyAllowInsecureMainnetP2PK: true,
      })
    );
  });

  it("legacy allowInsecureDevMode still works (deprecated alias)", async () => {
    await assert.doesNotReject(() =>
      assertProductionSafety({
        operation: "createReserve",
        network: "mainnet",
        scriptErgoTree: undefined,
        allowInsecureDevMode: true,
      })
    );
  });
});

describe("assertProductionSafety — mainnet audit gate", () => {
  it("rejects when no auditPolicy is configured (without dangerous opt-in)", async () => {
    await assert.rejects(
      () =>
        assertProductionSafety({
          operation: "issueNote",
          network: "mainnet",
          scriptErgoTree: "100204a00b08cd...",
        }),
      (e: unknown) =>
        e instanceof ErgoAgentPayError && e.code === "UNAUDITED_ERGOTREE"
    );
  });

  it("rejects when auditPolicy returns ok=false", async () => {
    await assert.rejects(
      () =>
        assertProductionSafety({
          operation: "issueNote",
          network: "mainnet",
          scriptErgoTree: "deadbeef",
          auditPolicy: FAIL,
        }),
      (e: unknown) =>
        e instanceof ErgoAgentPayError &&
        e.code === "UNAUDITED_ERGOTREE" &&
        /stub-rejected/.test(e.message)
    );
  });

  it("allows when auditPolicy returns ok=true", async () => {
    await assert.doesNotReject(() =>
      assertProductionSafety({
        operation: "issueNote",
        network: "mainnet",
        scriptErgoTree: "deadbeef",
        auditPolicy: PASS,
      })
    );
  });

  it("dangerouslyAllowUnauditedErgoTree bypasses audit check", async () => {
    await assert.doesNotReject(() =>
      assertProductionSafety({
        operation: "issueNote",
        network: "mainnet",
        scriptErgoTree: "deadbeef",
        dangerouslyAllowUnauditedErgoTree: true,
      })
    );
  });

  it("auditPolicy receives the supplied tree and scriptName", async () => {
    let observed: { tree: string; name: string | undefined } | null = null;
    const spy: AuditPolicy = (tree, name) => {
      observed = { tree, name };
      return { ok: true };
    };
    await assertProductionSafety({
      operation: "issueNote",
      network: "mainnet",
      scriptErgoTree: "abc123",
      scriptName: "credential_v0",
      auditPolicy: spy,
    });
    assert.deepEqual(observed, { tree: "abc123", name: "credential_v0" });
  });
});

describe("assertProductionSafety — error messages", () => {
  it("INSECURE_MAINNET_MODE message names the operation", async () => {
    try {
      await assertProductionSafety({
        operation: "issueNote",
        network: "mainnet",
        scriptErgoTree: undefined,
      });
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof ErgoAgentPayError);
      assert.match(err.message, /issueNote/);
      assert.match(err.message, /scriptErgoTree/);
    }
  });

  it("UNAUDITED_ERGOTREE message points at auditPolicy", async () => {
    try {
      await assertProductionSafety({
        operation: "issueNote",
        network: "mainnet",
        scriptErgoTree: "deadbeef",
      });
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof ErgoAgentPayError);
      assert.match(err.message, /auditPolicy/);
    }
  });
});
