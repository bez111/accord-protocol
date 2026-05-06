#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// compile.mjs — populate ergoTreeHex / treeHashBlake2b256 in predicates.json
//
// Usage:
//   npm install --no-save @fleet-sdk/compiler
//   npm run compile-predicates
//
// Why @fleet-sdk/compiler and not ergo-lib-wasm-nodejs:
//   ergo-lib-wasm-nodejs ships only the runtime (parse / serialize ergoTrees).
//   The ErgoScript compiler is a separate Sigma.JS-backed package — much
//   smaller than the full Scala / sigmastate-jvm reference compiler, and the
//   only one available as plain npm without a JVM. We treat it as a peer
//   dependency so SDK consumers do not pay for it on install.
//
// What this writes:
//   For every entry in predicates.json:
//     - ergoTreeHex          (compiler output)
//     - treeHashBlake2b256   (BLAKE2b-256 of the raw ergoTree bytes)
//     - compiledAt           (ISO-8601)
//     - compiler             ("@fleet-sdk/compiler <version>")
// ─────────────────────────────────────────────────────────────────────────────

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { blake2b } from "@noble/hashes/blake2b";

const here = dirname(fileURLToPath(import.meta.url));
const REGISTRY = resolve(here, "../data/predicates.json");

async function loadCompiler() {
  try {
    return await import("@fleet-sdk/compiler");
  } catch {
    process.stderr.write(
      "error: @fleet-sdk/compiler is not installed.\n\n" +
        "Run:\n  npm install --no-save @fleet-sdk/compiler\n\n" +
        "Then re-run this script. @fleet-sdk/compiler is a peer dependency,\n" +
        "intentionally not bundled with this package.\n"
    );
    process.exit(2);
  }
}

async function loadCompilerVersion() {
  try {
    const pkgPath = resolve(here, "../node_modules/@fleet-sdk/compiler/package.json");
    const pkg = JSON.parse(await readFile(pkgPath, "utf-8"));
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

function toHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function blake2b256Hex(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return toHex(blake2b(bytes, { dkLen: 32 }));
}

async function main() {
  const compiler = await loadCompiler();
  const version = await loadCompilerVersion();
  if (typeof compiler.compile !== "function") {
    process.stderr.write("error: @fleet-sdk/compiler has no compile() export — incompatible version.\n");
    process.exit(2);
  }

  const text = await readFile(REGISTRY, "utf-8");
  const registry = JSON.parse(text);
  const compiledAt = new Date().toISOString();
  const compilerLabel = `@fleet-sdk/compiler ${version}`;

  for (const entry of registry.predicates) {
    process.stderr.write(`compiling ${entry.name}...\n`);
    let tree;
    try {
      tree = compiler.compile(entry.source);
    } catch (err) {
      process.stderr.write(`  failed: ${err && err.message ? err.message : err}\n`);
      process.exit(1);
    }
    const hex =
      typeof tree?.toHex === "function"
        ? tree.toHex()
        : tree?.bytes
        ? toHex(tree.bytes)
        : null;
    if (!hex) {
      process.stderr.write("  failed: compiler returned an unrecognised shape.\n");
      process.exit(1);
    }
    entry.ergoTreeHex = hex;
    entry.treeHashBlake2b256 = blake2b256Hex(hex);
    entry.compiledAt = compiledAt;
    entry.compiler = compilerLabel;
    process.stderr.write(`  ok — ${hex.length / 2} bytes, hash ${entry.treeHashBlake2b256.slice(0, 16)}...\n`);
  }

  await writeFile(REGISTRY, JSON.stringify(registry, null, 2) + "\n");
  process.stderr.write(`\nwrote ${REGISTRY}\n`);
}

main().catch((err) => {
  process.stderr.write(`fatal: ${err && err.message ? err.message : err}\n`);
  process.exit(1);
});
