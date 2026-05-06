#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// compile.mjs — populate ergoTreeHex / treeHashBlake2b256 in predicates.json
//
// Usage:
//   npm install --no-save ergo-lib-wasm-nodejs
//   npm run compile-predicates
//
// The script is intentionally separate from the SDK so consumers do not
// inherit the WASM dependency. The output is committed back into the repo
// (predicates.json) and shipped as static JSON in the npm package.
//
// Why we do not embed pre-compiled trees in the source: without running the
// compiler ourselves we cannot guarantee the bytes; PR #2's safety guardrail
// refuses mainnet writes with unverified ergoTrees, so we would rather ship
// `null` than a wrong value.
// ─────────────────────────────────────────────────────────────────────────────

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { blake2b } from "@noble/hashes/blake2b";

const here = dirname(fileURLToPath(import.meta.url));
const REGISTRY = resolve(here, "../data/predicates.json");

async function loadCompiler() {
  try {
    return await import("ergo-lib-wasm-nodejs");
  } catch (err) {
    process.stderr.write(
      "error: ergo-lib-wasm-nodejs is not installed.\n\n" +
        "Run:\n  npm install --no-save ergo-lib-wasm-nodejs\n\n" +
        "Then re-run this script. ergo-lib-wasm-nodejs is a peer dependency,\n" +
        "intentionally not bundled with this package.\n"
    );
    process.exit(2);
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
  const wasm = await loadCompiler();
  // ergo-lib-wasm-nodejs API surface: ErgoTree, Address, etc. Compilation
  // happens via the dedicated compiler. Adjust the call below to whatever
  // version of the lib you have — major versions move the API around.
  if (!wasm.ErgoTree || typeof wasm.ErgoTree.from_base16_bytes !== "function") {
    process.stderr.write(
      "error: ergo-lib-wasm-nodejs is installed but does not expose ErgoTree.from_base16_bytes().\n" +
        "       Check the lib version and update this script.\n"
    );
    process.exit(2);
  }

  // Sigma compiler entrypoint — the API name varies; we try the common ones.
  const compile =
    typeof wasm.compile === "function"
      ? wasm.compile
      : typeof wasm.compileScript === "function"
      ? wasm.compileScript
      : null;
  if (!compile) {
    process.stderr.write(
      "error: ergo-lib-wasm-nodejs does not expose a compile()/compileScript() entrypoint.\n" +
        "       This script supports the upstream compiler released in 0.24+.\n" +
        "       Compile manually and paste the result into predicates.json instead.\n"
    );
    process.exit(2);
  }

  const text = await readFile(REGISTRY, "utf-8");
  const registry = JSON.parse(text);
  const compiledAt = new Date().toISOString();
  const compilerLabel = `ergo-lib-wasm-nodejs ${wasm.version ?? "unknown"}`;

  for (const entry of registry.predicates) {
    process.stderr.write(`compiling ${entry.name}...\n`);
    let tree;
    try {
      tree = compile(entry.source);
    } catch (err) {
      process.stderr.write(`  failed: ${err && err.message ? err.message : err}\n`);
      process.exit(1);
    }
    // Some compiler versions return an object with .to_base16_bytes(); others
    // return the hex string directly.
    const hex =
      typeof tree === "string"
        ? tree
        : typeof tree.to_base16_bytes === "function"
        ? tree.to_base16_bytes()
        : null;
    if (!hex) {
      process.stderr.write(
        "  failed: compiler returned an unrecognised shape; update this script.\n"
      );
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
