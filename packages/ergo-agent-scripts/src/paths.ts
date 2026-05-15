import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export function moduleDir(importMetaUrl: string | undefined): string {
  if (typeof __dirname !== "undefined") return __dirname;
  if (importMetaUrl) return dirname(fileURLToPath(importMetaUrl));
  throw new Error("Unable to resolve package directory.");
}
