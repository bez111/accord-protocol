#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const repoRoot = path.resolve(packageRoot, "../..");
const outRoot = path.join(packageRoot, "fixtures");

fs.rmSync(outRoot, { recursive: true, force: true });
fs.mkdirSync(outRoot, { recursive: true });

for (const name of ["schemas", "test-vectors", "registry"]) {
  fs.cpSync(path.join(repoRoot, name), path.join(outRoot, name), {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}node_modules${path.sep}`),
  });
}

console.log(`Synced conformance fixtures to ${path.relative(repoRoot, outRoot)}`);
