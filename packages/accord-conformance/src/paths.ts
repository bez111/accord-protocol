import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function moduleDir(importMetaUrl: string | undefined): string {
  if (typeof __dirname !== "undefined") return __dirname;
  if (importMetaUrl) return path.dirname(fileURLToPath(importMetaUrl));
  throw new Error("Unable to resolve package directory.");
}

export function hasConformanceFixtures(root: string): boolean {
  return (
    fs.existsSync(path.join(root, "schemas")) &&
    fs.existsSync(path.join(root, "test-vectors")) &&
    fs.existsSync(path.join(root, "registry"))
  );
}

export function packagedFixtureRoot(): string {
  return path.resolve(moduleDir(import.meta.url), "../fixtures");
}

export function resolveDefaultRepoRoot(cwd = process.cwd()): string {
  const localRoot = path.resolve(cwd);
  if (hasConformanceFixtures(localRoot)) return localRoot;

  const packagedRoot = packagedFixtureRoot();
  if (hasConformanceFixtures(packagedRoot)) return packagedRoot;

  return localRoot;
}
