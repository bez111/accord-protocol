# Show HN draft: Accord Protocol

**Title:** Show HN: Accord Protocol — agreement receipts for paid agent work

---

We built Accord Protocol, an open standard for autonomous agent work agreements.

The short version:

> x402 verifies payment. Accord verifies completion.

Paid agent/tool workflows need more than a payment proof. They need a shared record of:

- what work was promised;
- what payment authority or proof was used;
- who verified completion;
- whether the work was accepted, rejected or partially accepted;
- how settlement was recorded.

Accord defines three protocol objects around that lifecycle:

- Agreement Object
- Verification Receipt
- Settlement Receipt

It also ships TypeScript packages for canonical hashing/validation, Accord/MCP wrappers, Accord/402 HTTP middleware, rail adapters and L0-L4 conformance checks.

Useful links:

- Website: https://accordprotocol.ai/
- Learn hub: https://accordprotocol.ai/learn/
- Public status: https://accordprotocol.ai/status/
- Security posture: https://accordprotocol.ai/security/
- Repository: https://github.com/accord-protocol/accord-protocol
- Mock paid MCP demo: https://github.com/accord-protocol/accord-protocol/tree/main/examples/15-paid-mcp-repo-audit

Current status is deliberately conservative: Accord v0 is alpha / testnet-first and NOT CERTIFIED FOR MAINNET. The safest first path is the mock-rail paid MCP repository audit demo. Reference rails for Ergo, Rosen, Base/EVM and x402-compatible flows remain audit-gated.

What we would love feedback on:

- the Agreement / Verification Receipt / Settlement Receipt shape;
- whether the Accord/MCP wrapper matches how tool builders want to price work;
- where Accord/402 should sit relative to x402 payment challenges;
- what conformance should prove, and what it should explicitly not claim.

Happy to answer protocol, safety and implementation questions in the thread.
