# ergo-agent-scripts

Canonical ErgoScript sources for the v0 acceptance predicates plus a typed
registry slot for the compiled ergoTrees. Ships sources only; the compiled
trees are populated by running `npm run compile-predicates` against
`ergo-lib-wasm-nodejs` (a peer dependency that this package deliberately
does NOT bundle).

This is the package that turns the SDK from "verify-only on testnet" into
"production-safe on mainnet" — once the registry is populated and an
auditor has signed off on the trees, the SDK can pass them as
`scriptErgoTree` to `createReserve`, `issueNote`, and `deployTracker`.

## Why are the trees `null` on first install?

Because shipping unverified ergoTree bytes is exactly the foot-gun PR #2
removed. We do not ship a tree we cannot independently verify, and we
cannot bundle the compiler (it is a megabyte-class WASM module). The
trade-off: consumers who want compiled trees install
`ergo-lib-wasm-nodejs` once, run `npm run compile-predicates`, and commit
the result.

## Install

```bash
npm install ergo-agent-scripts
```

If you only want to inspect the sources, hash a tree, or verify trees
that someone else compiled, that is enough — no WASM dep required.

## Compiling the trees

```bash
npm install --no-save ergo-lib-wasm-nodejs   # one-time dev-only
npm run compile-predicates                   # writes data/predicates.json
npm run verify-predicates                    # sanity-check the registry
```

The compile script:

1. Reads `data/predicates.json`.
2. For every entry, calls the WASM compiler on the `source`.
3. Records `ergoTreeHex` and `treeHashBlake2b256 = blake2b256(ergoTree bytes)`.
4. Stamps `compiledAt` (ISO-8601) and `compiler` (lib name + version).
5. Writes the file back.

Commit the result. The package consumes `data/predicates.json` directly,
so re-publishing rolls the new trees out to all callers.

## API

```ts
import { getPredicate, tryGetErgoTree, verifyErgoTree, hashErgoTree } from "ergo-agent-scripts";

// 1. Look up the source + register layout.
const p = getPredicate("task_hash_v0");
console.log(p.source);
console.log(p.registers);     // { R5: "...", R6: "..." }

// 2. Get the compiled tree, if available.
const tree = tryGetErgoTree("task_hash_v0");
if (tree) {
  await agent.issueNote({ ..., scriptErgoTree: tree });
} else {
  // dev mode (testnet) or compile yourself
}

// 3. Verify a tree someone else handed you.
const result = verifyErgoTree("task_hash_v0", suspiciousTree);
if (!result.ok) throw new Error(result.reason);

// 4. Compute a tree hash directly (utility).
const hash = hashErgoTree(suspiciousTree);
```

## Predicates shipped in v0

| name | purpose | registers |
|---|---|---|
| `task_hash_v0` | Note redemption requires `HEIGHT < R5` and `blake2b256(getVar[0]) == R6`. | R5 expiry (Int), R6 task hash (Coll[Byte]) |
| `credential_v0` | As above, plus `proveDlog(R7)`. | R5, R6, R7 group element |

The sources are committed verbatim to `data/predicates.json` and exported
via `getPredicate(name).source` so a downstream auditor can confirm that
the package shipped the source they reviewed.

## Verifying a registry without the compiler

```bash
npm run verify-predicates
```

Recomputes `blake2b256(ergoTreeHex bytes)` for every populated entry and
checks against the recorded `treeHashBlake2b256`. Reports any mismatch
or unfilled entry. Suitable for a CI pre-publish gate.

## Compatibility with the safety guardrail

When the SDK runs on mainnet without `allowInsecureDevMode`, it refuses
to issue Notes / create Reserves / deploy Trackers without a
`scriptErgoTree`. `tryGetErgoTree(name)` is the canonical way to obtain
that value. When the registry is unfilled `tryGetErgoTree` returns
`null`, the SDK refuses to write, and the host gets a clear error
instead of accidentally producing a P2PK box that masquerades as a
predicate-bound one.
