import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { route } from "../router.js";
import type { BridgeRequest } from "../router.js";
import { ErgoAgentPayError } from "ergo-agent-pay";
import type { NoteInfo } from "ergo-agent-pay";

// ── Fake agent ───────────────────────────────────────────────────────────────

interface AgentBehaviour {
  balance?: { nanoErgs: bigint; ergs: string };
  height?: number;
  notes?: Record<string, NoteInfo | "missing">;
  payResult?: { unsignedTx: Record<string, unknown>; submitted: boolean; txId?: string };
  issueResult?: ReturnType<typeof makeIssueResult>;
  redeemResult?: { redeemed: { noteBoxId: string; value: string; receiver: string } };
  reserveResult?: { reserve: { value: string; hasScript: boolean } };
  trackerResult?: { tracker: { hasScript: boolean } };
  settleResult?: { settlement: { noteCount: number; totalValue: string; receiver: string } };
}

function makeIssueResult() {
  return {
    noteOutput: {
      value: "0",
      recipient: "9X",
      reserveBoxId: "abc",
      expiryBlock: 0,
    },
  };
}

function fakeAgent(b: AgentBehaviour): unknown {
  return {
    config: {},
    async getBalance() {
      const v = b.balance ?? { nanoErgs: 0n, ergs: "0" };
      return v;
    },
    async getHeight() {
      return b.height ?? 0;
    },
    async checkNote(boxId: string): Promise<NoteInfo> {
      const lookup = b.notes?.[boxId];
      if (!lookup || lookup === "missing") {
        throw new ErgoAgentPayError(`Note box ${boxId} not found.`, "BOX_NOT_FOUND");
      }
      return lookup;
    },
    async pay(_to: string, _amount: unknown, _opts?: unknown) {
      return b.payResult ?? { unsignedTx: {}, submitted: false };
    },
    async issueNote(opts: { recipient: string; value: bigint | number | string; reserveBoxId: string }) {
      const result = b.issueResult ?? makeIssueResult();
      return {
        unsignedTx: {},
        submitted: false,
        ...result,
        noteOutput: {
          ...result.noteOutput,
          recipient: opts.recipient,
          reserveBoxId: opts.reserveBoxId,
        },
      };
    },
    async redeemNote(opts: { noteBoxId: string }) {
      return {
        unsignedTx: {},
        submitted: false,
        ...(b.redeemResult ?? { redeemed: { noteBoxId: opts.noteBoxId, value: "0", receiver: "" } }),
      };
    },
    async createReserve() {
      return {
        unsignedTx: {},
        submitted: false,
        ...(b.reserveResult ?? { reserve: { value: "0", hasScript: false } }),
      };
    },
    async deployTracker() {
      return {
        unsignedTx: {},
        submitted: false,
        ...(b.trackerResult ?? { tracker: { hasScript: true } }),
      };
    },
    async settleBatch(opts: { noteBoxIds: string[] }) {
      return {
        unsignedTx: {},
        submitted: false,
        ...(b.settleResult ?? {
          settlement: { noteCount: opts.noteBoxIds.length, totalValue: "0", receiver: "" },
        }),
      };
    },
  };
}

function makeReq(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): BridgeRequest {
  return {
    method,
    path,
    query: new URLSearchParams(),
    headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])),
    body: body ?? null,
  };
}

function makeNote(overrides: Partial<NoteInfo> = {}): NoteInfo {
  return {
    boxId: "abc",
    value: 5_000_000n,
    ergs: "0.005",
    expiryBlock: 2_000_000,
    currentBlock: 1_000_000,
    isExpired: false,
    raw: {},
    ...overrides,
  };
}

const eq = (a: unknown, b: unknown) => assert.deepStrictEqual(a, b);

// ── tests ────────────────────────────────────────────────────────────────────

describe("GET /health", () => {
  it("returns ok without auth", async () => {
    const r = await route(
      { agent: fakeAgent({}) as never },
      makeReq("GET", "/health")
    );
    assert.equal(r.status, 200);
    assert.equal((r.body as { status: string }).status, "ok");
  });

  it("does not require api-key even when one is configured", async () => {
    const r = await route(
      { agent: fakeAgent({}) as never, apiKey: "secret" },
      makeReq("GET", "/health")
    );
    assert.equal(r.status, 200);
  });
});

describe("authentication", () => {
  it("rejects missing X-API-Key with 401", async () => {
    const r = await route(
      { agent: fakeAgent({}) as never, apiKey: "secret" },
      makeReq("GET", "/balance")
    );
    assert.equal(r.status, 401);
    assert.equal((r.body as { code: string }).code, "UNAUTHORISED");
  });

  it("accepts the configured X-API-Key", async () => {
    const r = await route(
      { agent: fakeAgent({ balance: { nanoErgs: 1n, ergs: "0.000000001" } }) as never, apiKey: "secret" },
      makeReq("GET", "/balance", null, { "x-api-key": "secret" })
    );
    assert.equal(r.status, 200);
  });
});

describe("GET /balance", () => {
  it("returns nano_ergs as a string and ergs as the formatted value", async () => {
    const r = await route(
      { agent: fakeAgent({ balance: { nanoErgs: 5_000_000_000n, ergs: "5" } }) as never },
      makeReq("GET", "/balance")
    );
    eq(r.body, { nano_ergs: "5000000000", ergs: "5" });
  });
});

describe("GET /height", () => {
  it("returns the current height", async () => {
    const r = await route(
      { agent: fakeAgent({ height: 1_234_567 }) as never },
      makeReq("GET", "/height")
    );
    eq(r.body, { height: 1_234_567 });
  });
});

describe("GET /notes/:boxId", () => {
  it("serialises NoteInfo with snake_case keys and string bigints", async () => {
    const r = await route(
      { agent: fakeAgent({ notes: { abc: makeNote({ value: 7n }) } }) as never },
      makeReq("GET", "/notes/abc")
    );
    assert.equal(r.status, 200);
    const body = r.body as Record<string, unknown>;
    assert.equal(body["box_id"], "abc");
    assert.equal(body["value_nano_erg"], "7");
    assert.equal(body["is_expired"], false);
  });

  it("returns 404 for missing notes", async () => {
    const r = await route(
      { agent: fakeAgent({ notes: { abc: "missing" } }) as never },
      makeReq("GET", "/notes/abc")
    );
    assert.equal(r.status, 404);
    assert.equal((r.body as { code: string }).code, "BOX_NOT_FOUND");
  });
});

describe("POST /pay", () => {
  it("requires 'to' and 'amount'", async () => {
    const r = await route(
      { agent: fakeAgent({}) as never },
      makeReq("POST", "/pay", { to: "9X" })
    );
    assert.equal(r.status, 400);
    assert.match((r.body as { error: string }).error, /amount/);
  });

  it("returns submitted/tx_id when the SDK reports submission", async () => {
    const r = await route(
      {
        agent: fakeAgent({
          payResult: { unsignedTx: {}, submitted: true, txId: "tx-payment" },
        }) as never,
      },
      makeReq("POST", "/pay", { to: "9X", amount: "0.001 ERG" })
    );
    assert.equal(r.status, 200);
    eq((r.body as { tx_id: unknown }).tx_id, "tx-payment");
    eq((r.body as { submitted: unknown }).submitted, true);
  });
});

describe("POST /notes (issue)", () => {
  it("rejects when reserve_box_id is missing", async () => {
    const r = await route(
      { agent: fakeAgent({}) as never },
      makeReq("POST", "/notes", {
        recipient: "9X",
        value: "0.005 ERG",
        deadline: "+100 blocks",
      })
    );
    assert.equal(r.status, 400);
    assert.match((r.body as { error: string }).error, /reserve_box_id/);
  });

  it("issues a Note and returns note_output", async () => {
    const r = await route(
      { agent: fakeAgent({}) as never },
      makeReq("POST", "/notes", {
        recipient: "9XAlpha",
        value: "0.005 ERG",
        reserve_box_id: "res1",
        deadline: "+100 blocks",
      })
    );
    assert.equal(r.status, 200);
    const body = r.body as { note_output: { recipient: string; reserveBoxId: string } };
    assert.equal(body.note_output.recipient, "9XAlpha");
    assert.equal(body.note_output.reserveBoxId, "res1");
  });
});

describe("POST /notes/:boxId/redeem", () => {
  it("dispatches redemption with task output and receiver", async () => {
    const r = await route(
      {
        agent: fakeAgent({
          redeemResult: { redeemed: { noteBoxId: "abc", value: "1000", receiver: "9XReceiver" } },
        }) as never,
      },
      makeReq("POST", "/notes/abc/redeem", {
        task_output: "the answer is 42",
        receiver_address: "9XReceiver",
      })
    );
    assert.equal(r.status, 200);
    const body = r.body as { redeemed: { receiver: string; noteBoxId: string } };
    assert.equal(body.redeemed.receiver, "9XReceiver");
    assert.equal(body.redeemed.noteBoxId, "abc");
  });
});

describe("POST /reserves", () => {
  it("returns reserve metadata", async () => {
    const r = await route(
      {
        agent: fakeAgent({
          reserveResult: { reserve: { value: "1000000000", hasScript: false } },
        }) as never,
      },
      makeReq("POST", "/reserves", { collateral: "1 ERG" })
    );
    assert.equal(r.status, 200);
    const body = r.body as { reserve: { value: string; hasScript: boolean } };
    assert.equal(body.reserve.value, "1000000000");
    assert.equal(body.reserve.hasScript, false);
  });
});

describe("POST /trackers", () => {
  it("requires script_ergo_tree", async () => {
    const r = await route(
      { agent: fakeAgent({}) as never },
      makeReq("POST", "/trackers", {})
    );
    assert.equal(r.status, 400);
  });
});

describe("POST /settle", () => {
  it("settles a batch and returns settlement counts", async () => {
    const r = await route(
      {
        agent: fakeAgent({
          settleResult: {
            settlement: { noteCount: 3, totalValue: "5000000", receiver: "9X" },
          },
        }) as never,
      },
      makeReq("POST", "/settle", { note_box_ids: ["a", "b", "c"] })
    );
    assert.equal(r.status, 200);
    const body = r.body as { settlement: { noteCount: number } };
    assert.equal(body.settlement.noteCount, 3);
  });
});

describe("POST /task-hash", () => {
  it("hashes a UTF-8 text input", async () => {
    const r = await route(
      { agent: fakeAgent({}) as never },
      makeReq("POST", "/task-hash", { text: "the answer is 42" })
    );
    assert.equal(r.status, 200);
    eq((r.body as { task_hash: string }).task_hash,
       "549ead194a83140a8b12bc38bb74ba7e5b094a5749ea73a7e04156f91cc5260a");
  });

  it("hashes a hex byte input", async () => {
    const r = await route(
      { agent: fakeAgent({}) as never },
      makeReq("POST", "/task-hash", { hex: "ffffff" })
    );
    eq((r.body as { task_hash: string }).task_hash,
       "6bd599c8d4d3452adecc22922b07a699414605d7e7dd28e57310e9ad29ccf2cf");
  });

  it("rejects an empty body", async () => {
    const r = await route(
      { agent: fakeAgent({}) as never },
      makeReq("POST", "/task-hash", {})
    );
    assert.equal(r.status, 400);
  });

  it("rejects malformed hex", async () => {
    const r = await route(
      { agent: fakeAgent({}) as never },
      makeReq("POST", "/task-hash", { hex: "zzz" })
    );
    assert.equal(r.status, 400);
  });
});

describe("404 routing", () => {
  it("returns NOT_FOUND for unknown paths", async () => {
    const r = await route(
      { agent: fakeAgent({}) as never },
      makeReq("GET", "/nope")
    );
    assert.equal(r.status, 404);
    assert.equal((r.body as { code: string }).code, "NOT_FOUND");
  });
});
