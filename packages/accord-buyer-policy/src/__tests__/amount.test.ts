import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { add, gt, lte, parseAmount, scaledToDecimal, zero } from "../amount.js";
import { BuyerPolicyError } from "../errors.js";

describe("parseAmount", () => {
  it("parses an integer amount", () => {
    const a = parseAmount("5", "USD", 2);
    assert.equal(a.scaled, 500n);
    assert.equal(a.amount, "5");
  });

  it("parses a fractional amount", () => {
    const a = parseAmount("5.25", "USD", 2);
    assert.equal(a.scaled, 525n);
  });

  it("right-pads short fractional digits", () => {
    const a = parseAmount("5.5", "USD", 2);
    assert.equal(a.scaled, 550n);
  });

  it("accepts zero", () => {
    const a = parseAmount("0", "USD", 2);
    assert.equal(a.scaled, 0n);
  });

  it("rejects amounts with more fractional digits than decimals", () => {
    assert.throws(() => parseAmount("5.123", "USD", 2), /more fractional digits/);
  });

  it("rejects scientific notation", () => {
    assert.throws(() => parseAmount("1e2", "USD", 2), BuyerPolicyError);
  });

  it("rejects negative amounts", () => {
    assert.throws(() => parseAmount("-1", "USD", 2), BuyerPolicyError);
  });

  it("rejects leading plus sign", () => {
    assert.throws(() => parseAmount("+5", "USD", 2), BuyerPolicyError);
  });

  it("rejects leading zeros", () => {
    assert.throws(() => parseAmount("05", "USD", 2), BuyerPolicyError);
  });

  it("rejects non-string amount", () => {
    assert.throws(
      () => parseAmount(5 as unknown as string, "USD", 2),
      /amount must be a decimal string/,
    );
  });

  it("rejects empty currency", () => {
    assert.throws(() => parseAmount("1", "", 2), BuyerPolicyError);
  });

  it("rejects huge decimals", () => {
    assert.throws(() => parseAmount("1", "USD", 99), BuyerPolicyError);
  });

  it("rejects non-integer decimals", () => {
    assert.throws(() => parseAmount("1", "USD", 2.5), BuyerPolicyError);
  });

  it("rejects multiple dots", () => {
    assert.throws(() => parseAmount("1.2.3", "USD", 2), BuyerPolicyError);
  });

  it("rejects whitespace", () => {
    assert.throws(() => parseAmount(" 1 ", "USD", 2), BuyerPolicyError);
  });

  it("preserves precision for very large amounts that would overflow Number", () => {
    const huge = "9007199254740993.99"; // > Number.MAX_SAFE_INTEGER
    const a = parseAmount(huge, "USD", 2);
    assert.equal(a.scaled, 900719925474099399n);
  });
});

describe("add / lte / gt", () => {
  it("adds two amounts", () => {
    const a = parseAmount("1.50", "USD", 2);
    const b = parseAmount("2.25", "USD", 2);
    const sum = add(a, b);
    assert.equal(sum.scaled, 375n);
    assert.equal(sum.amount, "3.75");
  });

  it("rejects mixed-currency addition", () => {
    const usd = parseAmount("1", "USD", 2);
    const erg = parseAmount("1", "ERG", 9);
    assert.throws(() => add(usd, erg), /CURRENCY_MISMATCH|cannot add/);
  });

  it("rejects mixed-decimals comparison", () => {
    const a = parseAmount("1", "USD", 2);
    const b = parseAmount("1", "USD", 3);
    assert.throws(() => lte(a, b), /CURRENCY_MISMATCH|cannot compare/);
  });

  it("compares correctly", () => {
    const a = parseAmount("1", "USD", 2);
    const b = parseAmount("2", "USD", 2);
    assert.equal(lte(a, b), true);
    assert.equal(gt(b, a), true);
    assert.equal(lte(a, a), true);
    assert.equal(gt(a, a), false);
  });
});

describe("scaledToDecimal / zero", () => {
  it("renders trailing zeros stripped", () => {
    assert.equal(scaledToDecimal(500n, 2), "5");
    assert.equal(scaledToDecimal(525n, 2), "5.25");
    assert.equal(scaledToDecimal(0n, 2), "0");
  });

  it("renders amounts smaller than 1 unit", () => {
    assert.equal(scaledToDecimal(1n, 2), "0.01");
    assert.equal(scaledToDecimal(7n, 6), "0.000007");
  });

  it("rejects negative scaled values", () => {
    assert.throws(() => scaledToDecimal(-1n, 2), BuyerPolicyError);
  });

  it("zero() returns the correct shape", () => {
    const z = zero({ currency: "USD", decimals: 2 });
    assert.equal(z.scaled, 0n);
    assert.equal(z.currency, "USD");
    assert.equal(z.decimals, 2);
  });
});
