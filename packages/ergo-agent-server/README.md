# ergo-agent-server

Local HTTP bridge for [`ergo-agent-pay`](../ergo-agent-pay). Closes the
TS↔Python (and any-language) gap by exposing the SDK over a small REST
surface. The Python SDK ships a [`BridgeClient`](../ergo-agent-py) that
talks to it.

The server is intentionally minimal — Node `http` only, no Express. It
listens on `127.0.0.1` by default; exposing it to a network without
`--api-key` is dangerous.

## Install

```bash
npm install -g ergo-agent-server
```

## Run

```bash
ergo-agent-server \
  --address  YOUR_ERGO_ADDRESS \
  --network  testnet \
  --port     3737 \
  --api-key  $(openssl rand -hex 16)
```

Environment variables (CLI flags take precedence):

| Var | Flag |
|---|---|
| `ERGO_ADDRESS` | `--address` |
| `ERGO_NETWORK` | `--network` |
| `ERGO_NODE_URL` | `--node-url` |
| `ERGO_API_KEY` | `--api-key` |
| `ERGO_BRIDGE_PORT` | `--port` (default 3737) |
| `ERGO_BRIDGE_HOST` | `--host` (default 127.0.0.1) |
| `ERGO_ALLOW_INSECURE_DEV_MODE=1` | `--allow-insecure-dev-mode` |

## Endpoints

All requests / responses are JSON. Errors carry a stable `code` field
mirroring `ErgoAgentPayError.code` for client-side switching.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/health` | Public; never requires API key. |
| `GET` | `/balance` | nanoERG returned as string. |
| `GET` | `/height` | |
| `GET` | `/notes/<boxId>` | Returns decoded `NoteInfo`. |
| `POST` | `/notes/<boxId>/redeem` | `{ task_output?, receiver_address? }` |
| `POST` | `/pay` | `{ to, amount, memo? }` |
| `POST` | `/notes` | `{ recipient, value, reserve_box_id, deadline, task_hash?, ... }` |
| `POST` | `/reserves` | `{ collateral, script_ergo_tree?, memo? }` |
| `POST` | `/trackers` | `{ script_ergo_tree }` |
| `POST` | `/settle` | `{ note_box_ids[], task_outputs?, receiver_address? }` |
| `POST` | `/task-hash` | `{ text }` or `{ hex }` → `{ task_hash, algorithm, input_bytes }` |

When `--api-key` is set, every endpoint except `/health` requires the
`X-API-Key` header to match.

### Error shape

```json
{
  "error": "human-readable message",
  "code": "BOX_NOT_FOUND",
  "status": 404
}
```

Status mapping:

| Code | HTTP |
|---|---|
| `INVALID_ADDRESS`, `INVALID_AMOUNT`, `INVALID_HASH`, `INVALID_JSON` | 400 |
| `UNAUTHORISED` | 401 |
| `INSECURE_MAINNET_MODE`, `POLICY_REJECTED`, `APPROVAL_DENIED` | 403 |
| `BOX_NOT_FOUND`, `NOTE_EXPIRED`, `NOTE_INVALID`, `NOT_FOUND` | 404 |
| `NO_SIGNER`, `INSUFFICIENT_FUNDS` | 409 |
| `PAYLOAD_TOO_LARGE` | 413 |
| `NETWORK_ERROR`, `SUBMISSION_FAILED` | 502 |

## Signing

v0 of the daemon does **not** embed a signer — every write endpoint
returns an unsigned EIP-12 transaction in `unsigned_tx`. Callers sign
with Nautilus, AppKit, or another signing process and submit themselves.

A future revision will support a configurable signer (HSM, file-based
key with passphrase). The Python `BridgeClient` already exposes the
unsigned transaction directly so a Python signing daemon can plug in
without API changes.

## Use from Python

```python
from ergo_agent_pay import BridgeClient

bridge = BridgeClient("http://127.0.0.1:3737", api_key="secret")
print(bridge.balance())
print(bridge.task_hash(text="the answer is 42"))
note = bridge.issue_note(
    recipient="9X...",
    value="0.005 ERG",
    reserve_box_id="abc...",
    deadline="+100 blocks",
    task_output="the answer is 42",
)
```

## Compatibility with the safety guardrail

Endpoints that build on-chain state (`/reserves`, `/notes`, `/trackers`)
inherit the SDK's mainnet guardrail. On mainnet without a compiled
`script_ergo_tree`, the request returns
`403 INSECURE_MAINNET_MODE` unless the daemon was started with
`--allow-insecure-dev-mode`.
