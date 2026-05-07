#!/usr/bin/env tsx
// ─────────────────────────────────────────────────────────────────────────────
// One-command paid-MCP repo-audit demo.
//
//   $ npm run dev
//
// Prints the Accord lifecycle step-by-step:
//   ✓ Agreement created acc_…
//   ✓ Mock-rail payment accepted
//   ✓ Tool ran → 2 findings
//   ✓ Verification Receipt: accepted
//   ✓ Settlement Receipt: settled
//
// Hard rule from MASTER_PLAN: no manual NOTE_BOX_ID copy/paste, no
// placeholder steps. The Mock rail handles payment derivation
// deterministically; the verifier signs in-process; the agreement is
// resolved from an in-memory store.
// ─────────────────────────────────────────────────────────────────────────────

import { runDemo } from "./buyer/run.js";

const repoFlagIdx = process.argv.indexOf("--repo");
const repo_url =
  repoFlagIdx >= 0 ? process.argv[repoFlagIdx + 1] : undefined;

const trace = await runDemo({ repo_url });

console.log("");
console.log("Accord Protocol — paid MCP repo-audit demo");
console.log("");

if (!trace.ok) {
  console.log(`✗ Tool call failed (code: ${trace.error_code})`);
  process.exit(1);
}

console.log(`  ✓ Agreement created       ${trace.agreement_id}`);
console.log(`     agreement_hash         ${trace.agreement_hash}`);
console.log(`  ✓ Mock-rail payment       accepted`);
console.log(
  `  ✓ Tool ran                ${
    Array.isArray((trace.output as { findings?: unknown[] })?.findings)
      ? (trace.output as { findings: unknown[] }).findings.length
      : 0
  } finding(s)`,
);
console.log(`  ✓ Verification Receipt    ${trace.verification_receipt_id}`);
console.log(`  ✓ Settlement Receipt      ${trace.settlement_receipt_id}`);
console.log("");
console.log("Output:");
console.log(JSON.stringify(trace.output, null, 2));
console.log("");
