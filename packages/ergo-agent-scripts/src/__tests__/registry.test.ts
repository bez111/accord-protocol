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
  it("returns the compiled task_hash_v0 tree", () => {
    const tree = tryGetErgoTree("task_hash_v0");
    assert.ok(tree, "task_hash_v0 ergoTreeHex must be populated");
    assert.match(tree!, /^[0-9a-fA-F]+$/);
    assert.equal(tree!.length % 2, 0);
  });

  it("returns the compiled credential_v0 tree", () => {
    const tree = tryGetErgoTree("credential_v0");
    assert.ok(tree, "credential_v0 ergoTreeHex must be populated");
    assert.match(tree!, /^[0-9a-fA-F]+$/);
  });

  it("the two trees differ", () => {
    assert.notEqual(tryGetErgoTree("task_hash_v0"), tryGetErgoTree("credential_v0"));
  });
});

describe("tree bytes match recorded BLAKE2b-256 hashes", () => {
  it("task_hash_v0 hash matches", () => {
    const tree = tryGetErgoTree("task_hash_v0")!;
    const recorded = getPredicate("task_hash_v0").treeHashBlake2b256!;
    assert.equal(hashErgoTree(tree), recorded);
  });

  it("credential_v0 hash matches", () => {
    const tree = tryGetErgoTree("credential_v0")!;
    const recorded = getPredicate("credential_v0").treeHashBlake2b256!;
    assert.equal(hashErgoTree(tree), recorded);
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
  it("accepts the canonical task_hash_v0 tree", () => {
    const tree = tryGetErgoTree("task_hash_v0")!;
    assert.deepEqual(verifyErgoTree("task_hash_v0", tree), { ok: true });
  });

  it("accepts the canonical credential_v0 tree", () => {
    const tree = tryGetErgoTree("credential_v0")!;
    assert.deepEqual(verifyErgoTree("credential_v0", tree), { ok: true });
  });

  it("rejects a tree that does not match the recorded hash", () => {
    const result = verifyErgoTree("task_hash_v0", "deadbeef");
    assert.equal(result.ok, false);
    if (result.ok === false) {
      assert.match(result.reason, /tree hash mismatch/);
    }
  });

  it("rejects a tree from one predicate when verified as another", () => {
    const taskTree = tryGetErgoTree("task_hash_v0")!;
    const result = verifyErgoTree("credential_v0", taskTree);
    assert.equal(result.ok, false);
  });
});
