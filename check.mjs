import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const requiredFiles = [
  "index.html",
  "styles.css",
  "script.js",
  "robots.txt",
  "sitemap.xml",
  "feed.xml",
  "llms.txt",
  "llms-full.txt",
  "agents.txt",
  "manifest.webmanifest",
  ".well-known/accord.json",
  ".well-known/security.txt",
  "assets/logo.svg",
  "assets/og-card.svg",
  "schemas/agreement.v0.schema.json",
  "schemas/verification-receipt.v0.schema.json",
  "schemas/settlement-receipt.v0.schema.json",
  "learn/index.html",
  "learn/agent-work-agreements/index.html",
  "learn/accord-vs-x402/index.html",
  "learn/verification-receipts/index.html",
  "learn/settlement-receipts/index.html",
  "learn/accord-mcp-paid-tools/index.html",
  "learn/rail-adapters/index.html",
  "learn/why-ergo-reference-rail/index.html",
  "learn/conformance-levels/index.html",
  "learn/audit-gated-mainnet/index.html",
  "learn/accord-vs-ap2/index.html",
  "learn/accord-vs-mcp/index.html",
  "learn/accord-402-flow/index.html",
  "learn/paid-mcp-repo-audit-demo/index.html",
  "learn/agreement-object-explained/index.html",
  "learn/buyer-policy-agent-wallets/index.html",
  "learn/what-conformance-does-not-prove/index.html",
  "status/index.html",
  "security/index.html",
  "roadmap/index.html"
];

const requiredHtmlSnippets = [
  "<title>Accord Protocol",
  "rel=\"canonical\" href=\"https://accordprotocol.ai/\"",
  "application/ld+json",
  "FAQPage",
  "SoftwareSourceCode",
  "og:image",
  "twitter:card",
  "href=\"/llms.txt\"",
  "href=\"/learn/\"",
  "href=\"/.well-known/accord.json\"",
  "NOT CERTIFIED FOR MAINNET"
];

const failures = [];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) {
    failures.push(`Missing ${file}`);
  }
}

const htmlPath = join(root, "index.html");
if (existsSync(htmlPath)) {
  const html = readFileSync(htmlPath, "utf8");
  for (const snippet of requiredHtmlSnippets) {
    if (!html.includes(snippet)) {
      failures.push(`index.html missing ${snippet}`);
    }
  }
}

try {
  const accordJson = JSON.parse(readFileSync(join(root, ".well-known/accord.json"), "utf8"));
  JSON.parse(readFileSync(join(root, "manifest.webmanifest"), "utf8"));
  const packagePath = existsSync(join(root, "package.json")) ? join(root, "package.json") : join(root, "..", "package.json");
  if (existsSync(packagePath)) {
    const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));
    const expectedVersion = packageJson.version;
    const surfaces = [
      ["accord.json sdkLine", accordJson.status?.sdkLine],
      ["llms.txt", readFileSync(join(root, "llms.txt"), "utf8")],
      ["index.html", readFileSync(join(root, "index.html"), "utf8")]
    ];
    for (const [label, value] of surfaces) {
      if (!String(value).includes(expectedVersion)) {
        failures.push(`${label} missing package version ${expectedVersion}`);
      }
    }
  }
} catch (error) {
  failures.push(`Invalid JSON: ${error.message}`);
}

if (failures.length) {
  console.error("Site check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Site check passed: SEO, agent discovery and core assets are present.");
