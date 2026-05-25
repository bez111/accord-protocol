#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const warnings = [];

function exists(p) {
  return fs.existsSync(path.join(root, p));
}

function read(p) {
  return fs.readFileSync(path.join(root, p), 'utf8');
}

function readJson(p) {
  return JSON.parse(read(p));
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function warn(condition, message) {
  if (!condition) warnings.push(message);
}

const accordPackages = [
  ['packages/accord-core/package.json', '@accord-protocol/core'],
  ['packages/accord-mcp/package.json', '@accord-protocol/mcp'],
  ['packages/accord-gateway/package.json', '@accord-protocol/gateway'],
  ['packages/accord-rails/package.json', '@accord-protocol/rails'],
  ['packages/accord-rails-ergo/package.json', '@accord-protocol/rails-ergo'],
  ['packages/accord-rails-rosen/package.json', '@accord-protocol/rails-rosen'],
  ['packages/accord-rails-base/package.json', '@accord-protocol/rails-base'],
  ['packages/accord-rails-x402/package.json', '@accord-protocol/rails-x402'],
  ['packages/accord-conformance/package.json', '@accord-protocol/conformance'],
  ['packages/accord-buyer-policy/package.json', '@accord-protocol/buyer-policy'],
];

const referencePackages = [
  ['packages/ergo-agent-pay/package.json', 'ergo-agent-pay'],
  ['packages/ergo-agent-cli/package.json', 'ergo-agent-cli'],
  ['packages/ergo-agent-api/package.json', 'ergo-agent-api'],
  ['packages/ergo-agent-mcp/package.json', 'ergo-agent-mcp'],
  ['packages/ergo-agent-server/package.json', 'ergo-agent-server'],
  ['packages/ergo-agent-scripts/package.json', 'ergo-agent-scripts'],
  ['packages/ergo-agent-rosen/package.json', 'ergo-agent-rosen'],
  ['packages/agentpay-base/package.json', 'agentpay-base'],
];

for (const [pkgPath, expectedName] of accordPackages) {
  assert(exists(pkgPath), `${pkgPath} is missing`);
  if (!exists(pkgPath)) continue;
  const pkg = readJson(pkgPath);
  assert(pkg.name === expectedName, `${pkgPath}: expected name ${expectedName}, got ${pkg.name}`);
  assert(pkg.version === '0.4.2', `${pkg.name}: expected version 0.4.2, got ${pkg.version}`);
  assert(pkg.license === 'MIT', `${pkg.name}: missing MIT license`);
  assert(pkg.publishConfig?.access === 'public', `${pkg.name}: publishConfig.access must be public`);
  assert(pkg.repository?.url?.includes('accord-protocol/accord-protocol'), `${pkg.name}: repository.url should point to accord-protocol/accord-protocol`);
  assert(pkg.repository?.directory, `${pkg.name}: repository.directory missing`);
  assert(pkg.homepage, `${pkg.name}: homepage missing`);
  assert(pkg.bugs?.url, `${pkg.name}: bugs.url missing`);
  assert(pkg.files?.includes('dist'), `${pkg.name}: files should include dist`);
  assert(pkg.files?.includes('README.md'), `${pkg.name}: files should include README.md`);
}

for (const [pkgPath, expectedName] of referencePackages) {
  assert(exists(pkgPath), `${pkgPath} is missing`);
  if (!exists(pkgPath)) continue;
  const pkg = readJson(pkgPath);
  assert(pkg.name === expectedName, `${pkgPath}: expected name ${expectedName}, got ${pkg.name}`);
  assert(pkg.version === '0.3.2', `${pkg.name}: expected version 0.3.2, got ${pkg.version}`);
  assert(pkg.license === 'MIT', `${pkg.name}: missing MIT license`);
  assert(pkg.publishConfig?.access === 'public', `${pkg.name}: publishConfig.access must be public`);
  assert(pkg.repository?.directory, `${pkg.name}: repository.directory missing`);
  assert(pkg.homepage, `${pkg.name}: homepage missing`);
  assert(pkg.bugs?.url, `${pkg.name}: bugs.url missing`);
}

const pyproject = read('packages/ergo-agent-py/pyproject.toml');
assert(pyproject.includes('version = "0.3.2"'), 'Python pyproject.toml must remain version 0.3.2 for reference rail release');
const pyInit = read('packages/ergo-agent-py/ergo_agent_pay/__init__.py');
assert(pyInit.includes('__version__ = "0.3.2"'), 'Python __init__.py must remain version 0.3.2');
assert(exists('LICENSE'), 'root LICENSE file must exist');
assert(exists('scripts/check-cjs-exports.mjs'), 'CommonJS export smoke script must exist');
assert(exists('.github/ISSUE_TEMPLATE/release_work.md'), 'release-work issue template must exist');

const rootPkg = readJson('package.json');
assert(rootPkg.workspaces?.includes('examples/15-paid-mcp-repo-audit'), 'examples/15-paid-mcp-repo-audit must remain a tested workspace demo');
assert(rootPkg.workspaces?.includes('examples/16-paid-mcp-ergo-testnet'), 'examples/16-paid-mcp-ergo-testnet must remain a tested workspace demo');
assert(rootPkg.scripts?.['cjs:check'] === 'node scripts/check-cjs-exports.mjs', 'package.json must expose npm run cjs:check');
assert(rootPkg.scripts?.['release:preflight'] === 'node scripts/release-preflight.mjs', 'package.json must expose npm run release:preflight');
assert(rootPkg.scripts?.['release:preflight:pack'] === 'node scripts/release-preflight.mjs --pack', 'package.json must expose npm run release:preflight:pack');
assert(rootPkg.scripts?.['pilots:check'] === 'node scripts/check-pilot-results.mjs', 'package.json must expose npm run pilots:check');
assert(rootPkg.scripts?.['pilots:todo'] === 'node scripts/list-pilot-blockers.mjs', 'package.json must expose npm run pilots:todo');
assert(rootPkg.scripts?.['pilots:sage:live'] === 'node scripts/check-sage-receipt-evidence.mjs', 'package.json must expose npm run pilots:sage:live');
assert(rootPkg.scripts?.['npm:publish-status'] === 'node scripts/check-npm-publish-status.mjs', 'package.json must expose npm run npm:publish-status');
const example16Pkg = readJson('examples/16-paid-mcp-ergo-testnet/package.json');
assert(example16Pkg.scripts?.preflight === 'tsx scripts/preflight.ts', 'example 16 workspace must expose npm run preflight');
assert(example16Pkg.scripts?.typecheck === 'tsc --noEmit', 'example 16 workspace must expose npm run typecheck');
assert(Boolean(example16Pkg.scripts?.test), 'example 16 workspace must expose npm test');

const pilotDocs = [
  'docs/testnet-wallet-setup.md',
  'docs/pilots/README.md',
  'docs/pilots/EXTERNAL_INPUTS.md',
  'docs/pilots/result-template.md',
  'docs/pilots/mock-mcp-paid-tool.md',
  'docs/pilots/ergo-testnet-note-settlement.md',
  'docs/pilots/rosen-wrapped-token-architecture.md',
  'docs/pilots/base-sepolia-contract-rail.md',
  'docs/pilots/x402-facilitator-integration.md',
];

for (const pilotDoc of pilotDocs) {
  assert(exists(pilotDoc), `${pilotDoc} must exist for P4 pilot readiness`);
}
assert(
  exists('docs/pilots/results/2026-05-15-mock-mcp-paid-tool.md'),
  'docs/pilots/results/2026-05-15-mock-mcp-paid-tool.md must preserve the completed mock pilot result',
);
assert(exists('scripts/check-pilot-results.mjs'), 'scripts/check-pilot-results.mjs must exist for P4 pilot result readiness');
assert(exists('scripts/check-sage-receipt-evidence.mjs'), 'scripts/check-sage-receipt-evidence.mjs must exist for Sage live receipt evidence');
assert(exists('scripts/check-npm-publish-status.mjs'), 'scripts/check-npm-publish-status.mjs must exist for npm publish diagnostics');

function assertLocalMarkdownLinks(docPath) {
  const dir = path.dirname(docPath);
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
  const markdownWithoutCode = read(docPath)
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]+`/g, '');
  for (const match of markdownWithoutCode.matchAll(linkPattern)) {
    const href = match[1].split('#')[0];
    if (!href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:')) continue;
    const target = path.normalize(path.join(dir, href));
    assert(exists(target), `${docPath} has a broken local link: ${href}`);
  }
}

function collectMarkdownFiles(dir, output = []) {
  if (!exists(dir)) return output;
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['.git', 'node_modules', 'dist'].includes(entry.name)) continue;
      if (rel === 'docs/basis') continue;
      collectMarkdownFiles(rel, output);
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      output.push(rel);
    }
  }
  return output;
}

for (const pilotDoc of pilotDocs) {
  if (exists(pilotDoc)) assertLocalMarkdownLinks(pilotDoc);
}

const pilotReadme = read('docs/pilots/README.md');
assert(pilotReadme.includes('No pilot in this folder certifies mainnet use'), 'docs/pilots/README.md must preserve mainnet warning');
assert(pilotReadme.includes('result-template.md'), 'docs/pilots/README.md must link the pilot result template');
assert(pilotReadme.includes('npm run pilots:check'), 'docs/pilots/README.md must document npm run pilots:check');
assert(pilotReadme.includes('npm run pilots:todo'), 'docs/pilots/README.md must document npm run pilots:todo');
assert(pilotReadme.includes('npm run pilots:sage:live'), 'docs/pilots/README.md must document npm run pilots:sage:live');
assert(pilotReadme.includes('check also reports current P4 progress'), 'docs/pilots/README.md must describe the P4 progress check');
assert(pilotReadme.includes('## Pending Pilots'), 'docs/pilots/README.md must track pending P4 pilots');
assert(pilotReadme.includes('EXTERNAL_INPUTS.md'), 'docs/pilots/README.md must link external pilot inputs');
assert(pilotReadme.includes('results/2026-05-15-mock-mcp-paid-tool.md'), 'docs/pilots/README.md must link the completed mock pilot result');
assert(
  pilotReadme.includes('results/2026-05-24-sage-ergo-testnet-full-receipt-recheck.md'),
  'docs/pilots/README.md must link the latest Sage full receipt recheck',
);
const externalInputs = read('docs/pilots/EXTERNAL_INPUTS.md');
assert(externalInputs.includes('Do not mark a pilot as complete'), 'external inputs doc must forbid fake pilot completion');
assert(externalInputs.includes('AUDITED_ERGOTREES.json') && externalInputs.includes('AUDITED_CONTRACTS.json'), 'external inputs doc must cover signed manifest inputs');
assert(externalInputs.includes('npm run pilots:sage:live'), 'external inputs doc must mention the Sage live receipt recheck');
const mockPilotResult = read('docs/pilots/results/2026-05-15-mock-mcp-paid-tool.md');
assert(mockPilotResult.includes('| Result | `pass` |'), 'mock pilot result must record pass status');
assert(mockPilotResult.includes('Achieved: L4'), 'mock pilot result must include conformance L4 evidence');
assert(mockPilotResult.includes('does not certify mainnet use'), 'mock pilot result must preserve the mainnet warning');
const sageFullReceiptRecheck = read('docs/pilots/results/2026-05-24-sage-ergo-testnet-full-receipt-recheck.md');
assert(sageFullReceiptRecheck.includes('| Result | `pass` |'), 'latest Sage full receipt recheck must record pass once schemas pass');
assert(sageFullReceiptRecheck.includes('full_receipt_bundle'), 'latest Sage full receipt recheck must record full_receipt_bundle evidence');
assert(sageFullReceiptRecheck.includes('schema-valid'), 'latest Sage full receipt recheck must preserve the schema-valid result');
assert(sageFullReceiptRecheck.includes('issues/71'), 'latest Sage full receipt recheck must link the tracked schema issue');
const example16Readme = read('examples/16-paid-mcp-ergo-testnet/README.md');
assert(example16Readme.includes('docs/testnet-wallet-setup.md'), 'example 16 must link the testnet wallet setup guide');
assert(example16Readme.includes('npm run preflight -- --reserve-setup'), 'example 16 must document reserve setup preflight');
assert(example16Readme.includes('common/setup.ts` still contains the placeholder signer'), 'example 16 must document signer preflight');
const testnetWalletSetup = read('docs/testnet-wallet-setup.md');
assert(testnetWalletSetup.includes('npm run preflight -- --reserve-setup'), 'testnet wallet setup guide must mention example 16 reserve preflight');

const status = read('docs/status.md');
assert(status.includes('NOT CERTIFIED FOR MAINNET'), 'docs/status.md must include NOT CERTIFIED FOR MAINNET');
assert(status.includes('mainnetAllowed: true'), 'docs/status.md must describe the mainnetAllowed audit gate');
assert(status.includes('Sage full receipt live recheck'), 'docs/status.md must mention the Sage full receipt live recheck');
assert(status.includes('docs/RAIL_MATURITY_MATRIX.md'), 'docs/status.md must link the rail maturity matrix');
assert(status.includes('docs/audit/'), 'docs/status.md must link the public audit posture');
assert(status.includes('Public launch posts, mcp.so submission, and broad community distribution remain'), 'docs/status.md must keep public launch distribution deferred until launch gates pass');
assert(status.includes('Deferred until launch readiness gates pass'), 'docs/status.md must expose public launch status');
assert(status.includes('Search console submission | Deferred until'), 'docs/status.md must defer search submission until launch readiness gates pass');
assert(status.includes('HN/Reddit/X/Discord/mcp.so posts | Drafted') && status.includes('deferred until launch readiness gates pass'), 'docs/status.md must defer launch posts until launch readiness gates pass');

const readme = read('README.md');
assert(readme.includes('docs/STRATEGIC_NORTH_STAR.md'), 'README.md must link the strategic north star');
assert(readme.includes('docs/RAIL_MATURITY_MATRIX.md'), 'README.md must link the rail maturity matrix');
assert(readme.includes('docs/audit/'), 'README.md must link the public audit posture');
assert(readme.includes('docs/LAUNCH_READINESS.md'), 'README.md must link launch readiness gates');
assert(readme.includes('docs/PROVIDER_ONBOARDING.md'), 'README.md must link provider onboarding');
assert(readme.includes('Public launch status'), 'README.md must expose public launch status');
assert(readme.includes('mcp.so distribution are intentionally deferred'), 'README.md must defer broad launch distribution');

const strategicNorthStar = read('docs/STRATEGIC_NORTH_STAR.md');
assert(strategicNorthStar.includes('open trust and receipt layer for the agent economy'), 'docs/STRATEGIC_NORTH_STAR.md must define the Accord north star');
assert(strategicNorthStar.includes('docs/RAIL_MATURITY_MATRIX.md'), 'docs/STRATEGIC_NORTH_STAR.md must link the rail maturity matrix');
assert(strategicNorthStar.includes('docs/audit/'), 'docs/STRATEGIC_NORTH_STAR.md must link the public audit posture');
assert(strategicNorthStar.includes('agree -> authorize/pay -> perform -> verify -> receipt -> settle'), 'docs/STRATEGIC_NORTH_STAR.md must preserve the full work lifecycle');
assert(strategicNorthStar.includes('mainnetAllowed: true'), 'docs/STRATEGIC_NORTH_STAR.md must keep the audit/mainnet gate explicit');
assert(strategicNorthStar.includes('not to add dozens of features'), 'docs/STRATEGIC_NORTH_STAR.md must keep the focus on trust over feature sprawl');

const launchReadiness = read('docs/LAUNCH_READINESS.md');
assert(launchReadiness.includes('docs/STRATEGIC_NORTH_STAR.md'), 'docs/LAUNCH_READINESS.md must link the strategic north star');
assert(launchReadiness.includes('docs/RAIL_MATURITY_MATRIX.md'), 'docs/LAUNCH_READINESS.md must link the rail maturity matrix');
assert(launchReadiness.includes('detailed audit work papers remain private'), 'docs/LAUNCH_READINESS.md must keep private audit papers out of public launch docs');
assert(launchReadiness.includes('mcp.so'), 'docs/LAUNCH_READINESS.md must mention mcp.so launch gating');
assert(launchReadiness.includes('issues/70'), 'docs/LAUNCH_READINESS.md must link the final distribution issue');
assert(launchReadiness.includes('npm run pilots:sage:live'), 'docs/LAUNCH_READINESS.md must include the Sage live receipt check');
assert(launchReadiness.includes('mainnetAllowed: true'), 'docs/LAUNCH_READINESS.md must keep launch separate from mainnet promotion');

const providerOnboarding = read('docs/PROVIDER_ONBOARDING.md');
assert(providerOnboarding.includes('Accord-compatible does not mean mainnet-certified'), 'docs/PROVIDER_ONBOARDING.md must avoid mainnet overclaims');
assert(providerOnboarding.includes('examples/17-provider-onboarding-kit'), 'docs/PROVIDER_ONBOARDING.md must link the provider onboarding kit');
assert(providerOnboarding.includes('Agreement') && providerOnboarding.includes('Verification Receipt') && providerOnboarding.includes('Settlement Receipt'), 'docs/PROVIDER_ONBOARDING.md must cover all Accord v0 receipt objects');
assert(providerOnboarding.includes('npx accord-conformance'), 'docs/PROVIDER_ONBOARDING.md must tell providers to run conformance');
assert(providerOnboarding.includes('Sage is the current public example'), 'docs/PROVIDER_ONBOARDING.md must point providers to the live Sage example');

const providerKitFiles = [
  'examples/17-provider-onboarding-kit/README.md',
  'examples/17-provider-onboarding-kit/.well-known/accord/index.json',
  'examples/17-provider-onboarding-kit/.well-known/accord/agreement-template.json',
  'examples/17-provider-onboarding-kit/provider-profile.json',
  'examples/17-provider-onboarding-kit/receipts/agreement.json',
  'examples/17-provider-onboarding-kit/receipts/verification-receipt.json',
  'examples/17-provider-onboarding-kit/receipts/settlement-receipt.json',
  'examples/17-provider-onboarding-kit/badge.md',
  'examples/17-provider-onboarding-kit/registry-pr.md',
];
for (const kitFile of providerKitFiles) {
  assert(exists(kitFile), `${kitFile} must exist for provider onboarding`);
}
const providerKitProfile = readJson('examples/17-provider-onboarding-kit/provider-profile.json');
assert(providerKitProfile.type === 'accord.provider_profile.v0', 'provider onboarding kit must include a provider_profile.v0 record');
assert(providerKitProfile.mainnet_status === 'not_certified', 'provider onboarding kit must not claim mainnet certification');
assert(providerKitProfile.conformance?.level === 'L0', 'provider onboarding kit must start at an L0 conformance claim');
const providerKitAgreement = readJson('examples/17-provider-onboarding-kit/receipts/agreement.json');
const providerKitVerification = readJson('examples/17-provider-onboarding-kit/receipts/verification-receipt.json');
const providerKitSettlement = readJson('examples/17-provider-onboarding-kit/receipts/settlement-receipt.json');
assert(providerKitAgreement.type === 'accord.agreement.v0', 'provider onboarding kit must include an Agreement sample');
assert(providerKitVerification.type === 'accord.verification_receipt.v0', 'provider onboarding kit must include a Verification Receipt sample');
assert(providerKitSettlement.type === 'accord.settlement_receipt.v0', 'provider onboarding kit must include a Settlement Receipt sample');
assert(providerKitVerification.agreement_id === providerKitAgreement.agreement_id, 'provider onboarding kit receipt must bind to the sample Agreement');
assert(providerKitSettlement.agreement_id === providerKitAgreement.agreement_id, 'provider onboarding kit settlement must bind to the sample Agreement');

const professionalizationRoadmap = read('docs/PROFESSIONALIZATION_ROADMAP.md');
assert(professionalizationRoadmap.includes('docs/STRATEGIC_NORTH_STAR.md'), 'docs/PROFESSIONALIZATION_ROADMAP.md must link the strategic north star');
assert(professionalizationRoadmap.includes('docs/RAIL_MATURITY_MATRIX.md'), 'docs/PROFESSIONALIZATION_ROADMAP.md must link the rail maturity matrix');
assert(professionalizationRoadmap.includes('private audit scope'), 'docs/PROFESSIONALIZATION_ROADMAP.md must keep detailed audit scope private');
assert(professionalizationRoadmap.includes('Deferred until the pre-launch gates pass'), 'docs/PROFESSIONALIZATION_ROADMAP.md must defer #70 until pre-launch gates pass');
assert(professionalizationRoadmap.includes('provider onboarding path'), 'docs/PROFESSIONALIZATION_ROADMAP.md must keep provider onboarding in near-term polish');

const railMaturityMatrix = read('docs/RAIL_MATURITY_MATRIX.md');
for (const required of ['Mock rail', 'Sage on Ergo testnet', 'Base Sepolia', 'x402', 'Rosen']) {
  assert(railMaturityMatrix.includes(required), `docs/RAIL_MATURITY_MATRIX.md must cover ${required}`);
}
assert(railMaturityMatrix.includes('mainnetAllowed: true'), 'docs/RAIL_MATURITY_MATRIX.md must preserve the mainnet audit gate');
assert(railMaturityMatrix.includes('2026-05-24-sage-ergo-testnet-full-receipt-recheck.md'), 'docs/RAIL_MATURITY_MATRIX.md must link Sage live receipt evidence');
assert(railMaturityMatrix.includes('2026-05-23-base-sepolia-contract-rail.md'), 'docs/RAIL_MATURITY_MATRIX.md must link Base Sepolia live evidence');

const auditReadme = read('docs/audit/README.md');
assert(auditReadme.includes('Detailed threat models'), 'docs/audit/README.md must state detailed audit papers stay private');
assert(auditReadme.includes('mainnetAllowed: true'), 'docs/audit/README.md must preserve the exact mainnet promotion gate');
assert(auditReadme.includes('conformance output') && auditReadme.includes('do not count'), 'docs/audit/README.md must state conformance is not enough for mainnet');

const developerGoldenPath = read('docs/DEVELOPER_GOLDEN_PATH.md');
assert(developerGoldenPath.includes('docs/PROVIDER_ONBOARDING.md'), 'docs/DEVELOPER_GOLDEN_PATH.md must link provider onboarding');
assert(developerGoldenPath.includes('docs/LAUNCH_READINESS.md'), 'docs/DEVELOPER_GOLDEN_PATH.md must link launch readiness');

const sageProviderProfile = read('registry/providers/sage.json');
assert(sageProviderProfile.includes('passes Accord v0 schema and semantic checks'), 'Sage provider profile must record the live schema-valid result');
assert(sageProviderProfile.includes('npm run pilots:sage:live'), 'Sage provider profile must point to the live receipt recheck');

const contributing = read('CONTRIBUTING.md');
assert(contributing.includes('NOT CERTIFIED FOR MAINNET'), 'CONTRIBUTING.md must preserve the mainnet warning');
assert(contributing.includes('npm run cjs:check'), 'CONTRIBUTING.md must document cjs:check');
assert(contributing.includes('npm run release:check'), 'CONTRIBUTING.md must document release:check');
assert(contributing.includes('npm run release:preflight -- --allow-branch --pack'), 'CONTRIBUTING.md must document branch release preflight');
assert(!contributing.includes('Every example must work on Ergo testnet with real API calls'), 'CONTRIBUTING.md must not contain stale Ergo-only example guidance');

const pullRequestTemplate = read('.github/pull_request_template.md');
assert(pullRequestTemplate.includes('npm run release:check'), 'pull request template must prompt for release:check when relevant');
assert(pullRequestTemplate.includes('npm run release:preflight -- --allow-branch --pack'), 'pull request template must prompt for branch release preflight when relevant');
const releaseIssueTemplate = read('.github/ISSUE_TEMPLATE/release_work.md');
assert(releaseIssueTemplate.includes('No audit manifest is promoted to `mainnetAllowed: true`'), 'release issue template must preserve mainnet safety posture');
assert(releaseIssueTemplate.includes('npm run release:preflight -- --allow-branch --pack'), 'release issue template must prompt for branch release preflight');

const packageMatrix = read('docs/PACKAGE_MATRIX.md');
for (const [, expectedName] of [...accordPackages, ...referencePackages]) {
  assert(packageMatrix.includes(expectedName), `docs/PACKAGE_MATRIX.md must mention ${expectedName}`);
}
assert(packageMatrix.includes('ergo-agent-pay` Python'), 'docs/PACKAGE_MATRIX.md must mention the Python ergo-agent-pay package');
assert(packageMatrix.includes('NOT') || packageMatrix.includes('Not certified'), 'docs/PACKAGE_MATRIX.md must preserve a conservative mainnet posture');

const releaseChecklist = read('docs/RELEASE-CHECKLIST.md');
assert(releaseChecklist.includes('npm run cjs:check'), 'docs/RELEASE-CHECKLIST.md must document cjs:check');
assert(releaseChecklist.includes('npm run npm:publish-status'), 'docs/RELEASE-CHECKLIST.md must document npm publish status check');
assert(releaseChecklist.includes('Trusted Publishing'), 'docs/RELEASE-CHECKLIST.md must document npm Trusted Publishing setup');
assert(releaseChecklist.includes('npm run release:preflight -- --allow-branch --pack'), 'docs/RELEASE-CHECKLIST.md must document PR-branch pack smoke');
assert(releaseChecklist.includes('npm run release:preflight:pack'), 'docs/RELEASE-CHECKLIST.md must document main-branch pack smoke');
assert(releaseChecklist.includes('including the Python reference package tests, venv install smoke, and pilot result checks'), 'docs/RELEASE-CHECKLIST.md must state release preflight includes Python tests, install smoke, and pilot result checks');
assert(releaseChecklist.includes('installs all 18 packages into a fresh temporary project'), 'docs/RELEASE-CHECKLIST.md must describe install-in-tempdir package smoke');
assert(releaseChecklist.includes('runs the packaged `accord-conformance` CLI from outside the repository root'), 'docs/RELEASE-CHECKLIST.md must describe packaged conformance CLI smoke');

const publishingGuide = read('PUBLISHING.md');
assert(publishingGuide.includes('npm run npm:publish-status'), 'PUBLISHING.md must document npm publish status check');
assert(publishingGuide.includes('Trusted Publishing'), 'PUBLISHING.md must document npm Trusted Publishing');
assert(publishingGuide.includes('E404'), 'PUBLISHING.md must document npm E404 publish diagnosis');

const exampleModes = read('docs/EXAMPLE_MODES.md');
for (const entry of fs.readdirSync(path.join(root, 'examples'), { withFileTypes: true })) {
  if (entry.isDirectory()) {
    assert(exampleModes.includes(entry.name), `docs/EXAMPLE_MODES.md must mention examples/${entry.name}`);
  }
}
assert(exampleModes.includes('No example in this repository is mainnet-certified'), 'docs/EXAMPLE_MODES.md must preserve the mainnet warning');

for (const [docPath, banned] of [
  ['docs/api-reference.md', 'Compiled reserve script (production)'],
  ['packages/ergo-agent-rosen/README.md', 'network: "mainnet"'],
  ['packages/ergo-agent-rosen/README.md', 'published mainnet config JSON'],
  ['packages/ergo-agent-rosen/README.md', 'audited `basis_token_reserve_v0` tree'],
  ['packages/accord-rails-rosen/README.md', 'ROSEN_MAINNET'],
  ['packages/accord-rails-rosen/README.md', 'peer deps for production use'],
  ['packages/accord-rails-rosen/src/types.ts', 'ROSEN_MAINNET'],
  ['packages/accord-rails-rosen/src/types.ts', 'Example mainnet'],
  ['examples/11-cross-chain-rosen/README.md', 'rosen-mainnet-tokens.json'],
  ['examples/11-cross-chain-rosen/README.md', 'Rosen mainnet TokenMap JSON'],
  ['examples/11-cross-chain-rosen/agent.ts', 'REPLACE_AFTER_SUBMISSION'],
  ['examples/11-cross-chain-rosen/package.json', 'audited basis_token_reserve_v0'],
  ['docs/launch/README.md', 'public launch of `ergo-agent-economy` v0.3.0'],
  ['docs/launch/x-thread.md', "What's audited:"],
  ['docs/launch/hn-launch.md', 'Audited compiled ergoTrees'],
  ['docs/launch/discord-announcement.md', 'pay sub-agents in real money'],
  ['docs/launch/discord-announcement.md', 'built-in escrow'],
  ['docs/launch/mcp-so-listing.md', 'Testnet works fully'],
]) {
  assert(!read(docPath).includes(banned), `${docPath} must not include legacy mainnet-ready wording: ${banned}`);
}

const stalePrWording = /\b(?:PR-\d+|PR\s*#\d+|PR#\d+|this PR)\b/i;
const publicReadmeDocs = [
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'docs/api-reference.md',
  'docs/canonical-json.md',
  'docs/EXAMPLE_MODES.md',
  'docs/PACKAGE_MATRIX.md',
  'docs/status.md',
  'registry/README.md',
  ...fs.readdirSync(path.join(root, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}/README.md`)
    .filter(exists),
  ...fs.readdirSync(path.join(root, 'examples'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `examples/${entry.name}/README.md`)
    .filter(exists),
];

for (const docPath of publicReadmeDocs) {
  assert(!stalePrWording.test(read(docPath)), `${docPath} must not include stale PR-number wording`);
}

const markdownDocs = [
  'README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'CHANGELOG.md',
  'PUBLISHING.md',
  'RELEASING.md',
  ...collectMarkdownFiles('docs'),
  ...collectMarkdownFiles('examples'),
  ...collectMarkdownFiles('packages'),
  ...collectMarkdownFiles('registry'),
].filter((docPath, index, all) => exists(docPath) && all.indexOf(docPath) === index);

for (const docPath of markdownDocs) {
  assertLocalMarkdownLinks(docPath);
}

const security = read('SECURITY.md');
assert(security.includes('NOT CERTIFIED FOR MAINNET'), 'SECURITY.md must include NOT CERTIFIED FOR MAINNET');

const changelog = read('CHANGELOG.md');
assert(changelog.includes('## [0.4.2]'), 'CHANGELOG.md must contain a v0.4.2 release entry before tag');

const publishNpm = read('.github/workflows/publish-npm.yml');
assert(publishNpm.includes('workflow_dispatch'), 'publish-npm.yml should allow manual workflow_dispatch reruns after publish fixes');
assert(publishNpm.includes('id-token: write'), 'publish-npm.yml should allow npm Trusted Publishing via OIDC');
assert(publishNpm.includes('already on npm; skipping.'), 'publish-npm.yml manual reruns must stay idempotent via skip-if-already-published guards');
assert(publishNpm.includes('prepublish-gates:'), 'publish-npm.yml should run repository-wide prepublish gates before package publish jobs');
assert(publishNpm.includes('npm run npm:publish-status'), 'publish-npm.yml should report npm publish status before package publish jobs');
assert(!publishNpm.includes('secrets.NPM_TOKEN'), 'publish-npm.yml should publish via Trusted Publishing/OIDC, not the legacy NPM_TOKEN secret');
assert(publishNpm.includes('npm run cjs:check'), 'publish-npm.yml prepublish gates should run CommonJS export smoke');
assert(publishNpm.includes('npm test --workspaces --if-present'), 'publish-npm.yml prepublish gates should run all workspace tests before publishing any package');
assert(publishNpm.includes('needs: [prepublish-gates]'), 'foundation npm publish jobs should depend on prepublish-gates');
assert(publishNpm.includes('- ergo-agent-pay') && publishNpm.includes('- ergo-agent-scripts') && publishNpm.includes('- agentpay-base'), 'accord-conformance publish job should depend on legacy foundation packages');
assert(publishNpm.includes('npm test -w ergo-agent-cli'), 'ergo-agent-cli publish job should run tests');
assert(publishNpm.includes('npm test -w ergo-agent-mcp'), 'ergo-agent-mcp publish job should run tests');
const publishPypi = read('.github/workflows/publish-pypi.yml');
assert(publishPypi.includes('python -m unittest discover -s tests -v'), 'publish-pypi.yml should run Python unit tests before publishing');
assert(publishPypi.includes('python -m build'), 'publish-pypi.yml should build the Python distribution');
assert(publishPypi.includes('twine check dist/*'), 'publish-pypi.yml should validate Python dist metadata before publishing');
assert(publishPypi.includes('Install wheel smoke'), 'publish-pypi.yml should install the built wheel before publishing');
assert(publishPypi.includes('pip install dist/*.whl'), 'publish-pypi.yml wheel smoke should install the built wheel');
const releaseReadinessWorkflow = read('.github/workflows/ci-release-readiness.yml');
assert(releaseReadinessWorkflow.includes('npm run cjs:check'), 'ci-release-readiness.yml must run CommonJS export smoke after build');
assert(releaseReadinessWorkflow.includes('npm run pilots:check'), 'ci-release-readiness.yml must run pilot result checks');
assert(releaseReadinessWorkflow.includes('CONTRIBUTING.md'), 'ci-release-readiness.yml must run when CONTRIBUTING.md changes');
assert(releaseReadinessWorkflow.includes('registry/**'), 'ci-release-readiness.yml must run when registry files change');
assert(releaseReadinessWorkflow.includes('.github/pull_request_template.md'), 'ci-release-readiness.yml must run when the PR template changes');
assert(releaseReadinessWorkflow.includes('.github/ISSUE_TEMPLATE/**'), 'ci-release-readiness.yml must run when issue templates change');
assert(releaseReadinessWorkflow.includes('.github/workflows/**'), 'ci-release-readiness.yml must run when any workflow changes');
for (const workflowName of fs.readdirSync(path.join(root, '.github/workflows')).filter((name) => name.endsWith('.yml'))) {
  const workflowPath = `.github/workflows/${workflowName}`;
  const workflow = read(workflowPath);
  assert(!workflow.includes('actions/checkout@v4'), `${workflowPath} must use actions/checkout@v6`);
  assert(!workflow.includes('actions/setup-node@v4'), `${workflowPath} must use actions/setup-node@v6`);
  assert(!workflow.includes('actions/setup-python@v5'), `${workflowPath} must use actions/setup-python@v6`);
  if (/actions\/(?:checkout|setup-node|setup-python)@/.test(workflow)) {
    assert(
      workflow.includes('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: "true"'),
      `${workflowPath} must opt JavaScript actions into the Node 24 runtime`,
    );
  }
}
const releasePreflight = read('scripts/release-preflight.mjs');
assert(releasePreflight.includes('npm", ["run", "cjs:check"]'), 'release-preflight must run npm run cjs:check');
assert(releasePreflight.includes('CommonJS export smoke'), 'release-preflight must name the CommonJS export smoke gate');
assert(releasePreflight.includes('Python reference package tests'), 'release-preflight must run Python reference package tests');
assert(releasePreflight.includes('Python package install smoke'), 'release-preflight must run Python package install smoke');
assert(releasePreflight.includes('npm", ["run", "pilots:check"]'), 'release-preflight must run npm run pilots:check');
assert(releasePreflight.includes('packaged conformance L4'), 'release-preflight must run packaged conformance CLI smoke');

function collectMainnetAllowed(value, locations = [], pathParts = []) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectMainnetAllowed(v, locations, [...pathParts, String(i)]));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'mainnetAllowed' && v === true) {
        locations.push([...pathParts, k].join('.'));
      }
      collectMainnetAllowed(v, locations, [...pathParts, k]);
    }
  }
  return locations;
}

for (const manifestPath of [
  'packages/ergo-agent-scripts/data/AUDITED_ERGOTREES.json',
  'packages/agentpay-base/data/AUDITED_CONTRACTS.json',
]) {
  if (!exists(manifestPath)) continue;
  const manifest = readJson(manifestPath);
  const promoted = collectMainnetAllowed(manifest);
  assert(promoted.length === 0, `${manifestPath}: has mainnetAllowed=true entries: ${promoted.join(', ')}`);
}

if (warnings.length) {
  console.log('Warnings:');
  for (const message of warnings) console.log(`- ${message}`);
  console.log('');
}

if (errors.length) {
  console.error('Release readiness check failed:');
  for (const message of errors) console.error(`- ${message}`);
  process.exit(1);
}

console.log('Release readiness check passed.');
