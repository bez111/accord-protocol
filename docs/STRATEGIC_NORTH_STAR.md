# Accord Strategic North Star

Accord should become the open trust and receipt layer for the agent economy.

It is not just another website, and it is not a single payment integration.
Accord is the standard layer where an agent can:

- receive a machine-readable Agreement;
- pay or reserve value through any compatible rail;
- prove that work was performed;
- receive or emit a signed Verification Receipt;
- record Settlement Receipt evidence;
- pass conformance;
- remain legible to other agents, wallets, providers, registries, and auditors.

## Where Accord Is Now

The project has crossed the line from concept to credible testnet-grade protocol
surface. The repository now has:

- public website and Learn hub;
- v0 schemas and specs;
- published SDK/npm package line;
- conformance tooling;
- completed current-scope testnet pilot matrix;
- Sage live public full receipt bundle;
- Base Sepolia contract rail evidence;
- x402 local facilitator stub;
- Rosen architecture track;
- audit-gated mainnet posture.

This proves the protocol is not imaginary. It does not prove production mainnet
safety.

## Strategic Path

### 1. Distribution And Legitimacy

Close the public launch work only after the launch readiness gates pass:
Search Console, Bing, launch posts, mcp.so, HN, Reddit, X, and Discord.

The goal is discoverability and legitimacy. People and agents should be able to
find Accord, understand its claim, and verify its evidence without private
context.

### 2. Audit And Mainnet Gate

The main strategic blocker is external audit evidence and signed manifests.

No real-fund production rail should be promoted until the relevant artifacts are
covered by external audit reports and exact manifest entries marked
`mainnetAllowed: true`.

The public gate rules live in [`docs/audit/`](./audit/). Detailed audit scope
and threat-model working papers stay private until coordinated disclosure is appropriate.

### 3. Provider Onboarding

Make the path to "Accord-compatible provider" obvious:

- provider template;
- receipt examples;
- conformance command;
- registry entry;
- compatibility badge;
- explicit mainnet and audit status.

The first concrete repository artifact for this path is
[`examples/17-provider-onboarding-kit`](../examples/17-provider-onboarding-kit/).

Compatibility means valid work-agreement and receipt evidence. It does not imply
mainnet certification.

### 4. Rail Maturity

Ergo Notes, Base contracts, x402, and Rosen should become a clear rail matrix,
not one-off demos:

- what each rail is for;
- what risk boundaries apply;
- what receipts are emitted;
- what conformance level is reached;
- what audit status applies.

The current matrix lives in
[`docs/RAIL_MATURITY_MATRIX.md`](./RAIL_MATURITY_MATRIX.md).

### 5. Gateway And Marketplace Layer

After the open standard and audit path are credible, commercial layers can sit
above the protocol:

- hosted gateway;
- provider registry;
- verifier routing;
- dashboards;
- private registries;
- enterprise controls.

Those layers belong above the open Accord Protocol standard, not inside the
standard itself.

### 6. First Real Production Pilot

After audit gates pass, the right production move is a small capped mainnet
flow, not a broad real-funds launch:

- one bounded use case;
- strict limits;
- monitoring;
- rollback;
- signed evidence;
- public postmortem-ready records.

## North Star

Accord should do for agent commerce what checkout infrastructure did for human
commerce, with one crucial difference: the unit is not only payment.

The unit is the full work lifecycle:

```text
agree -> authorize/pay -> perform -> verify -> receipt -> settle
```

The next strategic move is therefore not to add dozens of features. It is to
turn the existing testnet evidence into trust: launch readiness, audit evidence,
provider onboarding, rail maturity, and then controlled mainnet.
