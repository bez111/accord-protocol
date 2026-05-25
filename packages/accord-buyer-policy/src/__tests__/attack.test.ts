// Security-regression tests. Each name pins a specific attack the design
// claims to defend against. Failing one of these is a security bug, not a
// behaviour change.

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createBuyerPolicyEnforcer } from "../enforcer.js";
import { BuyerPolicyError } from "../errors.js";
import { counterRng, fakeClock, makeAgreement, makePolicy } from "./_helpers.js";

describe("attack: TOCTOU on session budget", () => {
  it("two concurrent authorize() calls cannot collectively exceed maxSessionSpend", async () => {
    let signerEntered = 0;
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({
        maxSinglePayment: { amount: "5", currency: "USDC", decimals: 2 },
        maxSessionSpend: { amount: "5", currency: "USDC", decimals: 2 },
        requireApprovalAbove: undefined,
      }),
      signer: async () => {
        signerEntered++;
        // Slow signer to widen the race window.
        await new Promise((r) => setTimeout(r, 50));
        return "signed";
      },
    });
    const s = e.openSession({ agentId: "agent://x" });
    const a1 = s.authorize({
      agreement: makeAgreement({
        price: { amount: "3", currency: "USDC", decimals: 2 },
      }),
      rail: "ergo",
      unsignedTx: {},
    });
    const a2 = s.authorize({
      agreement: makeAgreement({
        agreement_id: "acc_01HX0BUYERPOLICY0000RACE",
        price: { amount: "3", currency: "USDC", decimals: 2 },
      }),
      rail: "ergo",
      unsignedTx: {},
    });

    const results = await Promise.allSettled([a1, a2]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1, "exactly one authorization must succeed");
    assert.equal(rejected.length, 1, "the second must be rejected");
    const err = (rejected[0] as PromiseRejectedResult).reason as BuyerPolicyError;
    assert.equal(err.code, "BUDGET_EXCEEDED_SESSION");
    // Signer was entered exactly once — the rejected call never reached it.
    assert.equal(signerEntered, 1);
    assert.equal(s.spent.amount, "3");
  });
});

describe("attack: amount precision drift", () => {
  it("amount that is JS-float-equal to cap but BigInt-greater is rejected", async () => {
    // 0.1 + 0.2 in JS Number === 0.30000000000000004; but our parser uses
    // strings + BigInt. Cap is 0.3; agreement says "0.30000000000000004"
    // (representable as a string) — must reject.
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({
        maxSinglePayment: { amount: "0.3", currency: "USDC", decimals: 18 },
        maxSessionSpend: { amount: "10", currency: "USDC", decimals: 18 },
        requireApprovalAbove: undefined,
      }),
      signer: async () => "signed",
    });
    const s = e.openSession({ agentId: "agent://x" });
    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({
          price: {
            amount: "0.300000000000000001",
            currency: "USDC",
            decimals: 18,
          },
        }),
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "BUDGET_EXCEEDED_SINGLE",
    );
  });

  it("rejects an agreement.price.amount that is a JS number", async () => {
    // A malicious or buggy agreement passes a Number instead of a string.
    // Schema validation must catch this before any policy logic runs.
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({ requireApprovalAbove: undefined }),
      signer: async () => "signed",
    });
    const s = e.openSession({ agentId: "agent://x" });
    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({
          price: { amount: 1 as unknown as string, currency: "USDC", decimals: 2 },
        }),
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "AGREEMENT_INVALID",
    );
  });
});

describe("attack: allow-list bypass", () => {
  it("recipient like 'provider://summarizer-fake' does NOT match 'provider://summarizer-' suffix-wildcard if the prefix is exact", async () => {
    // 'provider://summarizer-*' should match 'provider://summarizer-X' but
    // not 'provider://summarizer' (no separator). Specifically, any string
    // that doesn't start with the literal prefix must reject.
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({
        allowedRecipients: ["provider://summarizer-"],
        requireApprovalAbove: undefined,
      }),
      signer: async () => "signed",
    });
    const s = e.openSession({ agentId: "agent://x" });
    // Exact equality matches.
    await s.authorize({
      agreement: makeAgreement({
        seller: { id: "provider://summarizer-" },
      }),
      rail: "ergo",
      unsignedTx: {},
    });
    // Anything that does not start with the literal must reject.
    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({
          agreement_id: "acc_01HX0BUYERPOLICY0000ATK1",
          seller: { id: "evil-provider://summarizer-" },
        }),
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "RECIPIENT_NOT_ALLOWED",
    );
  });

  it("mid-string and leading wildcards are rejected at construction", () => {
    const isPatternErr = (err: BuyerPolicyError) =>
      err.code === "POLICY_INVALID_RECIPIENT_PATTERN";
    assert.throws(
      () =>
        createBuyerPolicyEnforcer({
          policy: makePolicy({ allowedRecipients: ["*"] }),
          signer: async () => "signed",
        }),
      isPatternErr,
    );
    assert.throws(
      () =>
        createBuyerPolicyEnforcer({
          policy: makePolicy({ allowedRecipients: ["*-provider"] }),
          signer: async () => "signed",
        }),
      isPatternErr,
    );
    assert.throws(
      () =>
        createBuyerPolicyEnforcer({
          policy: makePolicy({ allowedRecipients: ["provider://**"] }),
          signer: async () => "signed",
        }),
      isPatternErr,
    );
    assert.throws(
      () =>
        createBuyerPolicyEnforcer({
          policy: makePolicy({ allowedRecipients: ["provider://?"] }),
          signer: async () => "signed",
        }),
      isPatternErr,
    );
  });
});

describe("attack: policy mutation mid-flight", () => {
  it("editing the allowedRecipients array after construction does not re-open the gate", async () => {
    const recipients: string[] = ["provider://repo-audit-v1"];
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({
        allowedRecipients: recipients,
        requireApprovalAbove: undefined,
      }),
      signer: async () => "signed",
    });
    // Caller mutates the array post-construction. The enforcer must have
    // taken its own snapshot.
    recipients.push("provider://malicious");
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
});

describe("attack: information leak via error messages", () => {
  it("error messages do not contain the agreement amount value", async () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({ requireApprovalAbove: undefined }),
      signer: async () => "signed",
    });
    const s = e.openSession({ agentId: "agent://x" });
    try {
      await s.authorize({
        agreement: makeAgreement({
          price: { amount: "999.99", currency: "USDC", decimals: 2 },
        }),
        rail: "ergo",
        unsignedTx: {},
      });
      assert.fail("expected reject");
    } catch (err) {
      const message = (err as BuyerPolicyError).message;
      // Sentinel: the rejected amount value must not appear in the message.
      assert.equal(message.includes("999.99"), false, message);
    }
  });

  it("error messages do not contain the unsigned-tx body", async () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({ requireApprovalAbove: undefined }),
      signer: async () => "signed",
    });
    const s = e.openSession({ agentId: "agent://x" });
    const SECRET = "ULTRA-SECRET-INTERNAL-TX-FIELD";
    try {
      await s.authorize({
        agreement: makeAgreement({
          seller: { id: "provider://malicious" },
        }),
        rail: "ergo",
        unsignedTx: { internal: SECRET },
      });
      assert.fail("expected reject");
    } catch (err) {
      assert.equal(
        (err as BuyerPolicyError).message.includes(SECRET),
        false,
      );
    }
  });
});

describe("attack: session id randomness + constant-time membership", () => {
  it("default RNG produces unpredictable, unique 32-char hex ids", () => {
    // Use the default RNG (crypto.randomBytes), not the counter helper.
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy(),
      signer: async () => "signed",
    });
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const s = e.openSession({ agentId: "agent://x" });
      assert.equal(s.id.length, 32);
      assert.match(s.id, /^[0-9a-f]{32}$/);
      assert.equal(ids.has(s.id), false);
      ids.add(s.id);
    }
  });

  it("isKnownSessionId returns false for a random non-issued id without throwing", () => {
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy(),
      signer: async () => "signed",
      randomBytes: counterRng(),
    });
    e.openSession({ agentId: "agent://x" });
    assert.equal(e.isKnownSessionId("ff".repeat(16)), false);
    assert.equal(e.isKnownSessionId(""), false);
  });
});

describe("attack: replay via reused agreement_id", () => {
  it("two authorize() calls with the same agreement still both deduct from budget — replay control belongs to the rail, not the policy", async () => {
    // This is a documentation test: the buyer-policy is NOT a replay store.
    // It charges per call, period. Replay protection is the rail's job
    // (gateway has the replayStore). We assert this is what happens so the
    // contract is pinned.
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({
        maxSinglePayment: { amount: "5", currency: "USDC", decimals: 2 },
        maxSessionSpend: { amount: "20", currency: "USDC", decimals: 2 },
        requireApprovalAbove: undefined,
      }),
      signer: async () => "signed",
    });
    const s = e.openSession({ agentId: "agent://x" });
    const agreement = makeAgreement({
      price: { amount: "2", currency: "USDC", decimals: 2 },
    });
    await s.authorize({ agreement, rail: "ergo", unsignedTx: {} });
    await s.authorize({ agreement, rail: "ergo", unsignedTx: {} });
    assert.equal(s.spent.amount, "4");
  });
});

describe("attack: daily window enforcement", () => {
  it("rejects when 24h rolling sum would exceed maxDailySpend", async () => {
    const clock = fakeClock();
    const e = createBuyerPolicyEnforcer({
      policy: makePolicy({
        maxSinglePayment: { amount: "5", currency: "USDC", decimals: 2 },
        maxSessionSpend: { amount: "100", currency: "USDC", decimals: 2 },
        maxDailySpend: { amount: "10", currency: "USDC", decimals: 2 },
        requireApprovalAbove: undefined,
      }),
      signer: async () => "signed",
      now: clock.now,
      randomBytes: counterRng(),
    });
    const s = e.openSession({ agentId: "agent://x" });

    // Spend 8 USD now.
    await s.authorize({
      agreement: makeAgreement({
        price: { amount: "5", currency: "USDC", decimals: 2 },
      }),
      rail: "ergo",
      unsignedTx: {},
    });
    await s.authorize({
      agreement: makeAgreement({
        agreement_id: "acc_01HX0BUYERPOLICY0000DAY1",
        price: { amount: "3", currency: "USDC", decimals: 2 },
      }),
      rail: "ergo",
      unsignedTx: {},
    });

    // Another 5 USD within the same window would push 13 > 10.
    await assert.rejects(
      s.authorize({
        agreement: makeAgreement({
          agreement_id: "acc_01HX0BUYERPOLICY0000DAY2",
          price: { amount: "5", currency: "USDC", decimals: 2 },
        }),
        rail: "ergo",
        unsignedTx: {},
      }),
      (err: BuyerPolicyError) => err.code === "BUDGET_EXCEEDED_DAILY",
    );
  });
});
