# Reddit launch draft: Accord Protocol

Use this as a discussion post, not a drive-by link drop. Choose one relevant subreddit first, adapt the title to local rules, and stay in the comments.

## Candidate title

We built Accord Protocol: agreement and completion receipts for paid AI agent work

## Post

We built Accord Protocol, an open standard for autonomous agent work agreements.

The problem we are trying to solve is that paid agent workflows need more than a payment event. If an automated buyer pays a tool or agent, the system still needs a shared record of:

- what work was promised;
- what payment authority or proof was used;
- who verified the output;
- whether the work was accepted, rejected or partially accepted;
- how settlement was recorded.

The short version is:

> x402 verifies payment. Accord verifies completion.

Accord defines three protocol objects around that lifecycle:

- Agreement Object
- Verification Receipt
- Settlement Receipt

It also ships TypeScript packages for canonical hashing/validation, Accord/MCP wrappers, Accord/402 HTTP middleware, rail adapters and conformance checks.

Useful links:

- Website: https://accordprotocol.ai/
- Learn hub: https://accordprotocol.ai/learn/
- Accord vs x402: https://accordprotocol.ai/learn/accord-vs-x402/
- Accord/MCP paid tools: https://accordprotocol.ai/learn/accord-mcp-paid-tools/
- Repository: https://github.com/accord-protocol/accord-protocol
- Mock paid MCP demo: https://github.com/accord-protocol/accord-protocol/tree/main/examples/15-paid-mcp-repo-audit
- Status: https://accordprotocol.ai/status/

Important safety note: Accord v0 is alpha / testnet-first and NOT CERTIFIED FOR MAINNET. The mock paid MCP demo is the safest first path because it runs without real funds, a chain node or a facilitator.

The feedback we are looking for:

- Does the Agreement / Verification Receipt / Settlement Receipt model match how people expect paid agent work to be audited?
- Where should Accord/MCP sit in real MCP tool flows?
- Is the x402 boundary clear enough?
- What should conformance prove, and what should it explicitly not claim?
