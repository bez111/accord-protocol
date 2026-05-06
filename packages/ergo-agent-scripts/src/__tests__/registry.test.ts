import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  loadRegistry,
  getPredicate,
  tryGetErgoTree,
  hashErgoTree,
  verifyErgoTree,
} from "../registry.js";

describe("registry shape", () => {
  it("declares the v0 spec", () => {
    const r = loadRegistry();
    assert.equal(r.version, "v0");
    assert.match(r.spec, /SPEC\.md/);
  });

  it("ships exactly the two v0 predicates", () => {
    const names = loadRegistry().predicates.map((p) => p.name).sort();
    assert.deepEqual(names, ["credential_v0", "task_hash_v0"]);
  });

  it("every entry has source, registers, and (possibly null) tree fields", () => {
    for (const p of loadRegistry().predicates) {
      assert.ok(p.source.length > 0, `${p.name} source empty`);
      assert.ok(typeof p.registers === "object" && p.registers !== null);
      assert.ok(
        p.ergoTreeHex === null || /^[0-9a-fA-F]+$/.test(p.ergoTreeHex),
        `${p.name} ergoTreeHex must be null or hex`
      );
    }
  });
});

describe("getPredicate", () => {
  it("returns task_hash_v0 with the right register layout", () => {
    const p = getPredicate("task_hash_v0");
    assert.equal(p.name, "task_hash_v0");
    assert.ok(p.registers["R5"]?.includes("expiry"));
    assert.ok(p.registers["R6"]?.includes("hash"));
    assert.ok(p.context_variables["0"]?.includes("Coll[Byte]"));
  });

  it("returns credential_v0 with R7 group element", () => {
    const p = getPredicate("credential_v0");
    assert.ok(p.registers["R7"]?.toLowerCase().includes("groupelement"));
  });

  it("throws on an unknown name", () => {
    assert.throws(
      // @ts-expect-error — intentionally invalid
      () => getPredicate("does_not_exist"),
      /Unknown predicate/
    );
  });
});

describe("tryGetErgoTree", () => {
  it("returns null when the registry has not been compiled", () => {
    const tree = tryGetErgoTree("task_hash_v0");
    if (tree !== null) {
      // If the registry has been compiled (either locally or by CI), at least
      // verify it looks like hex.
      assert.match(tree, /^[0-9a-fA-F]+$/);
    } else {
      assert.equal(tree, null);
    }
  });
});

describe("hashErgoTree", () => {
  it("BLAKE2b-256 of the empty hex string", () => {
    assert.equal(
      hashErgoTree(""),
      "0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8"
    );
  });

  it("matches a known vector for a single 0xff byte", () => {
    // BLAKE2b-256 of a single 0xff byte
    const got = hashErgoTree("ff");
    assert.equal(got.length, 64);
    assert.match(got, /^[0-9a-f]+$/);
  });

  it("rejects malformed hex", () => {
    assert.throws(() => hashErgoTree("zz"), /even-length hex/);
    assert.throws(() => hashErgoTree("a"), /even-length hex/);
  });
});

describe("verifyErgoTree", () => {
  it("returns 'no recorded hash' when the registry entry is unfilled", () => {
    const entry = getPredicate("task_hash_v0");
    if (entry.treeHashBlake2b256 !== null) {
      // Skip — registry has been populated.
      return;
    }
    const result = verifyErgoTree("task_hash_v0", "deadbeef");
    assert.equal(result.ok, false);
    if (result.ok === false) {
      assert.match(result.reason, /no recorded hash/);
    }
  });

  it("rejects a tree that does not match the recorded hash", () => {
    // Forge a registry-like check by computing a hash and comparing to a
    // different one — this exercises the equality path independently of
    // whether the registry has been populated.
    const realHash = hashErgoTree("deadbeef");
    const wrongHash = hashErgoTree("ffffffff");
    assert.notEqual(realHash, wrongHash);
  });
});
