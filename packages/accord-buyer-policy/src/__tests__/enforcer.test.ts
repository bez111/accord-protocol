import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createBuyerPolicyEnforcer } from "../enforcer.js";
import { BuyerPolicyError } from "../errors.js";
import type { ApprovalRequest, SignerContext } from "../types.js";
import { counterRng, fakeClock, makeAgreement, makePolicy } from "./_helpers.js";

const passSigner = async (_tx: unknown) => "signed-tx-bytes";

describe("createBuyerPolicyEnforcer construction", () => {
  it("rejects missing options", () => {
    assert.throws(
      () => createBuyerPolicyEnforcer(undefined as never),
      BuyerPolicyError,
    );
  });

  it("rejects missing signer", () => {
    assert.throws(
      () =>
        createBuyerPolicyEnforcer({
          policy: makePolicy(),
          signer: undefined as never,
        }),
      /signer must be a function/,
    );
  });

  it("rejects mixed-currency caps", () => {
    assert.throws(
      () =>
        createBuyerPolicyEnforcer({
          policy: makePolicy({
            maxSinglePayment: { amount: "1", currency: "USDC", decimals: 2 },
            maxSessionSpend: { amount: "1", currency: "ERG", decimals: 9 },
          }),
          signer: passSigner,
        }),
      /currency and decimals/,
    );
  });

  it("rejects maxSinglePayment > maxSessionSpend", () => {
    assert.throws(
      () =>
        createBuyerPolicyEnforcer({
          policy: makePolicy({
            maxSinglePayment: { amount: "100", currency: "USDC", decimals: 2 },
            maxSessionSpend: { amount: "50", currency: "USDC", decimals: 2 },
          }),
          signer: passSigner,
        }),
      /maxSinglePayment may not exceed maxSessionSpend/,
    );
  });

  it("rejects requireApprovalAbove > maxSinglePayment", () => {
    assert.throws(
      () =>
        createBuyerPolicyEnforcer({
          policy: makePolicy({
            maxSinglePayment: { amount: "5", currency: "USDC", decimals: 2 },
            requireApprovalAbove: { amount: "10", currency: "USDC", decimals: 2 },
          }),
          signer: passSigner,
        }),
      /requireApprovalAbove may not exceed maxSinglePayment/,
    );
  });

  it("rejects empty allowedRecipients", () => {
    assert.throws(
      () =>
        createBuyerPolicyEnforcer({
          policy: makePolicy({ allowedRecipients: [] }),
          signer: passSigner,
        }),
      /allowedRecipients must be a non-empty array/,
    );
  });

  it("rejects unknown rail", () => {
    assert.throws(
      () =>
        createBuyerPolicyEnforcer({
          policy: makePolicy({
            allowedRails: ["solana" as never],
          }),
          signer: passSigner,
        }),
      /unknown rail/,
    );
  });

  it("rejects mid-string wildcard pattern", () => {
    assert.throws(
      () =>
        createBuyerPolicyEnforcer({
          policy: makePolicy({
            allowedRecipients: ["provider://*-suffix"],
          }),
          signer: passSigner,
        }),
      (err: BuyerPolicyError) => err.code === "POLICY_INVALID_RECIPIENT_PATTERN",
    );
  });

  it("rejects approvalTimeoutMs out of range", () => {
    assert.throws(
      () =>
        createBuyerPolicyEnforcer({
          policy: makePolicy({ approvalTimeoutMs: 50 }),
          signer: passSigner,
        }),
      /approvalTimeoutMs/,
    );
  });

  it("rejects sessionTtlMs out of range", () => {
    assert.throws(
      () =>
        createBuyerPolicyEnforcer({
          policy: makePolicy({ sessionTtlMs: 100 }),
          signer: passSigner,
        }),
      /sessionTtlMs/,
    );
  });
});

describe("openSession", () => {
  it("rejects missing agentId", () => {
    const e = createBuyerPolicyEnforcer({ policy: makePolicy(), signer: passSigner });
    assert.throws(() => e.openSession({ agentId: "" as never }), BuyerPolicyError);
  });

  it("issues unique session ids across calls", () => {
    const e = createBuyerPolicyEnforcer({ policy: makePolicy(), signer: passSigner });
    const a = e.openSession({ agentId: "agent://x" });
    const b = e.openSession({ agentId: "agent://x" });
    assert.notEqual(a.id, b.id);
  });

  it("isKnownSessionId returns false for unknown", () => {
    const e = createBuyerPolicyEnforcer({ policy: makePolicy(), signer: passSigner });
    assert.equal(e.isKnownSessionId("a".repeat(32)), false);
  });

  it("isKnownSessionId returns true for issued", () => {
    const e = createBuyerPolicyEnforcer({ policy: makePolicy(), signer: passSigner });
    const s = e.openSession({ agentId: "agent://x" });
    assert.equal(e.isKnownSessionId(s.id), true);
  });

  it("isKnownSessionId rejects malformed ids without throwing", () => {
    const e = createBuyerPolicyEnforcer({ policy: makePolicy(), signer: passSigner });
    assert.equal(e.isKnownSessionId("not-32-chars"), false);
    assert.equal(e.isKnownSessionId(123 as unknown as string), false);
  });
});

describe("authorize — happy path", () => {
  it("signs a sub-threshold agreement and updates session spend", async () => {
    let signerCalled = 0;
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({ requireApprovalAbove: undefined }),
      signer: async () => {
        signerCalled++;
        return "signed";
      },
    });
    const s = e.openSession({ agentId: "agent://x" });
    const res = await s.authorize({
      agreement: makeAgreement({
        price: { amount: "1.50", currency: "USDC", decimals: 2 },
      }),
      rail: "ergo",
      unsignedTx: { foo: "bar" },
    });
    assert.equal(res.signedTx, "signed");
    assert.equal(signerCalled, 1);
    assert.equal(s.spent.amount, "1.5");
  });

  it("accumulates spend across multiple authorizations", async () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({ requireApprovalAbove: undefined }),
      signer: async () => "signed",
    });
    const s = e.openSession({ agentId: "agent://x" });
    await s.authorize({
      agreement: makeAgreement({
        price: { amount: "1.00", currency: "USDC", decimals: 2 },
      }),
      rail: "ergo",
      unsignedTx: {},
    });
    await s.authorize({
      agreement: makeAgreement({
        agreement_id: "acc_01HX0BUYERPOLICY00000001",
        price: { amount: "2.00", currency: "USDC", decimals: 2 },
      }),
      rail: "ergo",
      unsignedTx: {},
    });
    assert.equal(s.spent.amount, "3");
  });

  it("matches suffix-wildcard recipient", async () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({ requireApprovalAbove: undefined }),
      signer: async () => "signed",
    });
    const s = e.openSession({ agentId: "agent://x" });
    const res = await s.authorize({
      agreement: makeAgreement({
        seller: { id: "provider://summarizer-fast" },
      }),
      rail: "ergo",
      unsignedTx: {},
    });
    assert.equal(res.signedTx, "signed");
  });

  it("passes a minimal signer context with a unique nonce per authorization", async () => {
    const contexts: SignerContext[] = [];
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({ requireApprovalAbove: undefined }),
      randomBytes: counterRng(),
      signer: async (_tx, context) => {
        contexts.push(context);
        return "signed";
      },
    });
    const s = e.openSession({ agentId: "agent://x" });
    await s.authorize({
      agreement: makeAgreement({
        agreement_id: "acc_01HX0BUYERPOLICY000CTX01",
        price: { amount: "1.00", currency: "USDC", decimals: 2 },
      }),
      rail: "ergo",
      unsignedTx: { internal: "not-in-context" },
    });
    await s.authorize({
      agreement: makeAgreement({
        agreement_id: "acc_01HX0BUYERPOLICY000CTX02",
        price: { amount: "1.00", currency: "USDC", decimals: 2 },
      }),
      rail: "ergo",
      unsignedTx: { internal: "not-in-context-either" },
    });

    assert.equal(contexts.length, 2);
    assert.deepEqual(Object.keys(contexts[0] ?? {}).sort(), [
      "agreement_id",
      "nonce",
      "rail",
      "session_id",
    ]);
    assert.equal(contexts[0]?.session_id, s.id);
    assert.equal(contexts[1]?.session_id, s.id);
    assert.equal(contexts[0]?.agreement_id, "acc_01HX0BUYERPOLICY000CTX01");
    assert.equal(contexts[1]?.agreement_id, "acc_01HX0BUYERPOLICY000CTX02");
    assert.match(contexts[0]?.nonce ?? "", /^[0-9a-f]{32}$/);
    assert.match(contexts[1]?.nonce ?? "", /^[0-9a-f]{32}$/);
    assert.notEqual(contexts[0]?.nonce, contexts[1]?.nonce);
  });
});

describe("authorize — denials", () => {
  it("denies when rail is not allowed", async () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({ allowedRails: ["ergo"], requireApprovalAbove: undefined }),
      signer: async () => "signed",
    });
    const s = e.openSession({ agentId: "agent://x" });
    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({
          payment: {
            mode: "note",
            rail: "base",
            reserve_ref: "0xabc",
            deadline: "+480 blocks",
          },
        }),
        rail: "base",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "RAIL_NOT_ALLOWED",
    );
  });

  it("denies when rail and agreement.payment.rail disagree", async () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({ requireApprovalAbove: undefined }),
      signer: async () => "signed",
    });
    const s = e.openSession({ agentId: "agent://x" });
    await assert.rejects(
      s.authorize({
        // agreement says rail=ergo, but caller says rail=x402
        agreement: makeAgreement(),
        rail: "x402",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "RAIL_NOT_ALLOWED",
    );
  });

  it("denies when recipient is not allowed", async () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({ requireApprovalAbove: undefined }),
      signer: async () => "signed",
    });
    const s = e.openSession({ agentId: "agent://x" });
    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({ seller: { id: "provider://malicious" } }),
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "RECIPIENT_NOT_ALLOWED",
    );
  });

  it("denies on currency mismatch", async () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({ requireApprovalAbove: undefined }),
      signer: async () => "signed",
    });
    const s = e.openSession({ agentId: "agent://x" });
    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({
          price: { amount: "1", currency: "ERG", decimals: 9 },
        }),
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "CURRENCY_MISMATCH",
    );
  });

  it("denies above maxSinglePayment", async () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({
        maxSinglePayment: { amount: "5", currency: "USDC", decimals: 2 },
        requireApprovalAbove: undefined,
      }),
      signer: async () => "signed",
    });
    const s = e.openSession({ agentId: "agent://x" });
    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({
          price: { amount: "5.01", currency: "USDC", decimals: 2 },
        }),
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "BUDGET_EXCEEDED_SINGLE",
    );
  });

  it("denies above maxSessionSpend (cumulative)", async () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({
        maxSinglePayment: { amount: "5", currency: "USDC", decimals: 2 },
        maxSessionSpend: { amount: "6", currency: "USDC", decimals: 2 },
        requireApprovalAbove: undefined,
      }),
      signer: async () => "signed",
    });
    const s = e.openSession({ agentId: "agent://x" });
    await s.authorize({
      agreement: makeAgreement({
        price: { amount: "4", currency: "USDC", decimals: 2 },
      }),
      rail: "ergo",
      unsignedTx: {},
    });
    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({
          agreement_id: "acc_01HX0BUYERPOLICY00000002",
          price: { amount: "3", currency: "USDC", decimals: 2 },
        }),
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "BUDGET_EXCEEDED_SESSION",
    );
    // Spend stays at 4, the rejected charge does not bump it.
    assert.equal(s.spent.amount, "4");
  });

  it("denies an invalid agreement before any policy check", async () => {
    let signerCalled = 0;
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy(),
      signer: async () => {
        signerCalled++;
        return "signed";
      },
    });
    const s = e.openSession({ agentId: "agent://x" });
    await assert.rejects(
      s.authorize({
        agreement: { not: "an agreement" },
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "AGREEMENT_INVALID",
    );
    assert.equal(signerCalled, 0);
  });

  it("denies on closed session", async () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy(),
      signer: async () => "signed",
    });
    const s = e.openSession({ agentId: "agent://x" });
    s.close();
    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({
          price: { amount: "1", currency: "USDC", decimals: 2 },
        }),
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "SESSION_CLOSED",
    );
  });

  it("denies on expired session", async () => {
    const clock = fakeClock();
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({ sessionTtlMs: 5_000 }),
      signer: async () => "signed",
      now: clock.now,
      randomBytes: counterRng(),
    });
    const s = e.openSession({ agentId: "agent://x" });
    clock.advance(6_000);
    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({
          price: { amount: "1", currency: "USDC", decimals: 2 },
        }),
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "SESSION_EXPIRED",
    );
  });
});

describe("authorize — approval flow", () => {
  it("calls handler when above threshold and signs on approval", async () => {
    const seenRequests: ApprovalRequest[] = [];
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({
        requireApprovalAbove: { amount: "2", currency: "USDC", decimals: 2 },
      }),
      signer: async () => "signed",
      approvalHandler: async (req) => {
        seenRequests.push(req);
        return { approved: true, approver_id: "human" };
      },
    });
    const s = e.openSession({ agentId: "agent://x" });
    const res = await s.authorize({
      agreement: makeAgreement({
        price: { amount: "3", currency: "USDC", decimals: 2 },
      }),
      rail: "ergo",
      unsignedTx: {},
    });
    assert.equal(res.signedTx, "signed");
    assert.equal(seenRequests.length, 1);
    assert.deepEqual(Object.keys(seenRequests[0] ?? {}).sort(), [
      "agreement_id",
      "buyer_id",
      "issued_at",
      "price",
      "rail",
      "seller_id",
      "session_id",
    ]);
    assert.equal("unsignedTx" in (seenRequests[0] ?? {}), false);
  });

  it("skips handler when below threshold", async () => {
    let handlerCalls = 0;
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({
        requireApprovalAbove: { amount: "2", currency: "USDC", decimals: 2 },
      }),
      signer: async () => "signed",
      approvalHandler: async () => {
        handlerCalls++;
        return { approved: true };
      },
    });
    const s = e.openSession({ agentId: "agent://x" });
    await s.authorize({
      agreement: makeAgreement({
        price: { amount: "1", currency: "USDC", decimals: 2 },
      }),
      rail: "ergo",
      unsignedTx: {},
    });
    assert.equal(handlerCalls, 0);
  });

  it("denies when handler returns approved=false", async () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({
        requireApprovalAbove: { amount: "2", currency: "USDC", decimals: 2 },
      }),
      signer: async () => "signed",
      approvalHandler: async () => ({ approved: false }),
    });
    const s = e.openSession({ agentId: "agent://x" });
    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({
          price: { amount: "3", currency: "USDC", decimals: 2 },
        }),
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "APPROVAL_DENIED",
    );
  });

  it("denies APPROVAL_REQUIRED_NO_HANDLER when no handler is registered", async () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({
        requireApprovalAbove: { amount: "2", currency: "USDC", decimals: 2 },
      }),
      signer: async () => "signed",
    });
    const s = e.openSession({ agentId: "agent://x" });
    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({
          price: { amount: "3", currency: "USDC", decimals: 2 },
        }),
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "APPROVAL_REQUIRED_NO_HANDLER",
    );
  });

  it("denies APPROVAL_TIMEOUT when handler hangs", async () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({
        requireApprovalAbove: { amount: "2", currency: "USDC", decimals: 2 },
        approvalTimeoutMs: 200,
      }),
      signer: async () => "signed",
      approvalHandler: () => new Promise(() => undefined),
    });
    const s = e.openSession({ agentId: "agent://x" });
    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({
          price: { amount: "3", currency: "USDC", decimals: 2 },
        }),
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "APPROVAL_TIMEOUT",
    );
  });

  it("denies APPROVAL_HANDLER_ERROR when handler throws", async () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({
        requireApprovalAbove: { amount: "2", currency: "USDC", decimals: 2 },
      }),
      signer: async () => "signed",
      approvalHandler: async () => {
        throw new Error("upstream failed");
      },
    });
    const s = e.openSession({ agentId: "agent://x" });
    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({
          price: { amount: "3", currency: "USDC", decimals: 2 },
        }),
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "APPROVAL_HANDLER_ERROR",
    );
  });

  it("denies APPROVAL_HANDLER_ERROR when handler returns malformed verdict", async () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({
        requireApprovalAbove: { amount: "2", currency: "USDC", decimals: 2 },
      }),
      signer: async () => "signed",
      approvalHandler: async () => ({ random: "shape" }) as never,
    });
    const s = e.openSession({ agentId: "agent://x" });
    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({
          price: { amount: "3", currency: "USDC", decimals: 2 },
        }),
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "APPROVAL_HANDLER_ERROR",
    );
  });
});

describe("authorize — signer error rolls back budget", () => {
  it("rolls session spend back if signer throws", async () => {
    let attempts = 0;
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({ requireApprovalAbove: undefined }),
      signer: async () => {
        attempts++;
        if (attempts === 1) throw new Error("rail down");
        return "signed";
      },
    });
    const s = e.openSession({ agentId: "agent://x" });

    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({
          price: { amount: "2", currency: "USDC", decimals: 2 },
        }),
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "SIGNER_ERROR",
    );
    // Budget rolled back — the second attempt should succeed.
    assert.equal(s.spent.amount, "0");

    const res = await s.authorize({
      agreement: makeAgreement({
        agreement_id: "acc_01HX0BUYERPOLICY00000099",
        price: { amount: "2", currency: "USDC", decimals: 2 },
      }),
      rail: "ergo",
      unsignedTx: {},
    });
    assert.equal(res.signedTx, "signed");
    assert.equal(s.spent.amount, "2");
  });
});
