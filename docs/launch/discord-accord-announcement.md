# Discord/community announcement draft: Accord Protocol

Use one tailored post per community. Do not cross-post identical copy.

## Agent developer / MCP communities

We launched Accord Protocol, an open standard for autonomous agent work agreements:

https://accordprotocol.ai/

The short version: x402 verifies payment; Accord verifies completion.

Accord adds Agreement Objects, Verification Receipts and Settlement Receipts around paid agent/tool work. For MCP tool builders, the relevant path is Accord/MCP: wrap a tool call with payment verification, optional verification and settlement metadata.

Accord/MCP guide:
https://accordprotocol.ai/learn/accord-mcp-paid-tools/

Mock paid MCP repo-audit demo:
https://github.com/accord-protocol/accord-protocol/tree/main/examples/15-paid-mcp-repo-audit

Current status is alpha / testnet-first and NOT CERTIFIED FOR MAINNET:
https://accordprotocol.ai/status/

Looking for feedback on the paid-tool lifecycle and what verifier hooks should look like for real tool builders.

## x402 / payment infrastructure communities

We launched Accord Protocol:

https://accordprotocol.ai/

Accord is not a replacement for x402. It is the work-agreement layer around payment.

The distinction:

- x402 verifies payment for paid HTTP resources.
- Accord records what work was promised, how it was verified and how settlement was recorded.

Accord vs x402:
https://accordprotocol.ai/learn/accord-vs-x402/

Accord/402 flow:
https://accordprotocol.ai/learn/accord-402-flow/

Repo:
https://github.com/accord-protocol/accord-protocol

Current posture is alpha / testnet-first and audit-gated:
https://accordprotocol.ai/status/

Looking for feedback on the boundary between payment proof, agreement hash, verification receipt and settlement receipt.

## Ergo / rail communities

We launched Accord Protocol:

https://accordprotocol.ai/

Accord is an open standard for autonomous agent work agreements. It records terms, verification and settlement receipts around paid agent work.

Ergo is the first reference programmable-settlement rail, but Accord is rail-agnostic.

Why Ergo is the first reference rail:
https://accordprotocol.ai/learn/why-ergo-reference-rail/

Rail adapters:
https://accordprotocol.ai/learn/rail-adapters/

Security posture:
https://accordprotocol.ai/security/

Current mainnet status is NOT CERTIFIED FOR MAINNET. We are looking for feedback from ErgoScript, Sigma-state and rail-adapter reviewers before any stronger production claims.
