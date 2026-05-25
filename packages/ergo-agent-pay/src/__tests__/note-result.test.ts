import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { extractOutputBoxId } from "../transactions.js";

describe("extractOutputBoxId", () => {
  it("extracts a signer-provided output box id by index", () => {
    const boxId = "a".repeat(64);
    const tx = {
      outputs: [
        { boxId },
        { boxId: "b".repeat(64) },
      ],
    };

    assert.equal(extractOutputBoxId(tx, 0), boxId);
    assert.equal(extractOutputBoxId(tx, 1), "b".repeat(64));
  });

  it("ignores missing or malformed output ids", () => {
    assert.equal(extractOutputBoxId({}, 0), undefined);
    assert.equal(extractOutputBoxId({ outputs: [{ boxId: "abc" }] }, 0), undefined);
    assert.equal(extractOutputBoxId({ outputs: [{ id: "a".repeat(64) }] }, 0), undefined);
  });
});
