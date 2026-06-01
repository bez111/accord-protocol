# mcp.so listing copy

Draft copy. Do not submit without checking current package availability and
[`docs/status.md`](../status.md). Accord is testnet-first and not
mainnet-certified.

Submission text for the public [mcp.so](https://mcp.so) registry. The
`mcp.json` manifest lives at
[`packages/ergo-agent-mcp/mcp.json`](../../packages/ergo-agent-mcp/mcp.json)
and is the machine-readable form; this file is the human-readable
description for the website.

---

**Name:** Ergo Agent

**Slug:** `ergo-agent`

**One-liner:** Testnet-first MCP server for Accord's Ergo reference rail:
agents can inspect Ergo balances and Note boxes, build unsigned payment
transactions, compute task hashes, and prototype paywalled tools.

**Long description:**

`ergo-agent-mcp` is the MCP server for Accord's maintained Ergo reference
rail. It exposes the lifecycle tools from `ergo-agent-pay` — balance and UTxO
inspection, unsigned payment building, Note inspection, Reserve creation,
Note issuance/redemption, Tracker deployment, settlement batching, and the
BLAKE2b-256 task-hash utility — as MCP tools any compatible host
(Claude Desktop, Cursor, Windsurf, Continue, ...) can call.

Most MCP servers run their tools for free. This one ships a
`createPaywalledTool` helper so a server author can gate any tool
behind a testnet Note by default: the tool's input schema gets `note_box_id` and
`task_output` injected automatically, the wrapper verifies the Note
on-chain, redeems it inline (when a signer is configured), and
otherwise returns a structured 402-style error.

This brings MCP into the agent-economy story. An LLM-driven agent can prototype
paid tool access through a testnet Note, while server authors can experiment
with paid compute, inference or scraping flows before any production rail is
certified.

**Tags:** ergo · agent-payments · ai-agents · blockchain · stablecoin
· model-context-protocol · agent-economy · blake2b

**Homepage:** https://accordprotocol.ai/
**Documentation:** https://accordprotocol.ai/learn/accord-mcp-paid-tools/
**Repository:** https://github.com/accord-protocol/accord-protocol
**License:** MIT
**Maintainer:** [Accord Protocol](https://github.com/accord-protocol)

**Configuration block (claude_desktop_config.json):**

```json
{
  "mcpServers": {
    "ergo-agent": {
      "command": "npx",
      "args": ["ergo-agent-mcp", "--address", "YOUR_ERGO_ADDRESS", "--network", "testnet"]
    }
  }
}
```

Replace `YOUR_ERGO_ADDRESS` with an Ergo wallet address (Nautilus,
Lace via Ergo cardano-style, etc.). Get free testnet ERG at
https://testnet.ergofaucet.org.

**Status:**

- npm: `ergo-agent-mcp@0.3.2` — maintained reference package.
- Accord/MCP wrapper: `@accord-protocol/mcp@0.4.2`.
- Mainnet: blocked at the audit gate. Testnet/demo workflows only.
- Source repo: https://github.com/accord-protocol/accord-protocol
- Public Accord/MCP guide: https://accordprotocol.ai/learn/accord-mcp-paid-tools/
- Public status: https://accordprotocol.ai/status/

**Caveats for the listing reviewer:**

Mainnet writes are deliberately gated behind an external audit. The
SDK refuses to issue Notes / create Reserves / deploy Trackers on
mainnet unless the supplied ergoTree's hash appears in
`AUDITED_ERGOTREES.json` with `mainnetAllowed: true`, currently
unsigned. This is documented at the top of the SECURITY.md and on
every error message users will see if they try.
