import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encodeSigmaCollByte, MAX_TASK_OUTPUT_BYTES } from "../encoding.js";
import { ErgoAgentPayError } from "../types.js";

describe("encodeSigmaCollByte", () => {
  it("encodes the empty string as 0e00", () => {
    assert.equal(encodeSigmaCollByte(new Uint8Array()), "0e00");
  });

  it("encodes one byte (0xff) as 0e01ff", () => {
    assert.equal(encodeSigmaCollByte(Uint8Array.of(0xff)), "0e01ff");
  });

  it("encodes 32 bytes with a 0x20 length prefix", () => {
    const bytes = new Uint8Array(32).fill(0xab);
    const out = encodeSigmaCollByte(bytes);
    assert.equal(out.slice(0, 4), "0e20");
    assert.equal(out.length, 4 + 64);
  });

  it("encodes the 255-byte boundary case", () => {
    const bytes = new Uint8Array(MAX_TASK_OUTPUT_BYTES).fill(0xab);
    const out = encodeSigmaCollByte(bytes);
    assert.equal(out.slice(0, 4), "0eff");
    assert.equal(out.length, 4 + MAX_TASK_OUTPUT_BYTES * 2);
  });

  it("rejects 256 bytes with INVALID_ENCODING", () => {
    const bytes = new Uint8Array(MAX_TASK_OUTPUT_BYTES + 1).fill(0xab);
    assert.throws(
      () => encodeSigmaCollByte(bytes),
      (e: unknown) =>
        e instanceof ErgoAgentPayError &&
        e.code === "INVALID_ENCODING" &&
        /256 bytes/.test(e.message)
    );
  });

  it("works with plain number arrays too", () => {
    assert.equal(encodeSigmaCollByte([1, 2, 3]), "0e03010203");
  });

  it("works with Buffer", () => {
    const buf = Buffer.from([0xde, 0xad, 0xbe, 0xef]);
    assert.equal(encodeSigmaCollByte(buf), "0e04deadbeef");
  });
});
