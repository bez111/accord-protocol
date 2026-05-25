"""Round-trip tests for BridgeClient against a stub HTTP server."""

from __future__ import annotations

import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any

from ergo_agent_pay import BridgeClient, ErgoAgentPayError


class _Stub(BaseHTTPRequestHandler):
    """Stub server: returns whatever the test wired up via `responses`."""

    responses: dict[tuple[str, str], tuple[int, dict[str, Any]]] = {}
    received: list[dict[str, Any]] = []

    def log_message(self, *_: object) -> None:  # silence stderr
        return

    def _send(self, status: int, body: dict[str, Any]) -> None:
        payload = json.dumps(body).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _handle(self, method: str) -> None:
        body_text = ""
        if method != "GET":
            length = int(self.headers.get("Content-Length", "0") or 0)
            body_text = self.rfile.read(length).decode("utf-8") if length else ""

        record = {
            "method": method,
            "path": self.path,
            "body": json.loads(body_text) if body_text else None,
            "headers": {k.lower(): v for k, v in self.headers.items()},
        }
        self.received.append(record)

        key = (method, self.path)
        if key in self.responses:
            status, body = self.responses[key]
        else:
            status, body = 404, {"error": f"no stub for {key}", "code": "NOT_FOUND", "status": 404}
        self._send(status, body)

    def do_GET(self) -> None:
        self._handle("GET")

    def do_POST(self) -> None:
        self._handle("POST")


class StubServer:
    def __init__(self) -> None:
        _Stub.responses = {}
        _Stub.received = []
        self.server = HTTPServer(("127.0.0.1", 0), _Stub)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    @property
    def base_url(self) -> str:
        host, port = self.server.server_address
        return f"http://{host}:{port}"

    def expect(self, method: str, path: str, body: dict[str, Any], status: int = 200) -> None:
        _Stub.responses[(method, path)] = (status, body)

    def received(self) -> list[dict[str, Any]]:
        return _Stub.received

    def close(self) -> None:
        self.server.shutdown()
        self.server.server_close()


# ── Tests ────────────────────────────────────────────────────────────────────

class BridgeClientTest(unittest.TestCase):
    def setUp(self) -> None:
        self.stub = StubServer()
        self.client = BridgeClient(self.stub.base_url)

    def tearDown(self) -> None:
        self.stub.close()

    # ── reads ────────────────────────────────────────────────────────────

    def test_health(self) -> None:
        self.stub.expect("GET", "/health", {"status": "ok"})
        self.assertEqual(self.client.health(), {"status": "ok"})

    def test_balance(self) -> None:
        self.stub.expect("GET", "/balance", {"nano_ergs": "5000", "ergs": "0.000005"})
        bal = self.client.balance()
        self.assertEqual(bal["nano_ergs"], "5000")

    def test_height(self) -> None:
        self.stub.expect("GET", "/height", {"height": 1234567})
        self.assertEqual(self.client.height(), 1234567)

    def test_check_note(self) -> None:
        self.stub.expect(
            "GET",
            "/notes/abc",
            {"box_id": "abc", "value_nano_erg": "5000", "is_expired": False},
        )
        info = self.client.check_note("abc")
        self.assertEqual(info["box_id"], "abc")
        self.assertEqual(info["value_nano_erg"], "5000")

    def test_task_hash_text(self) -> None:
        self.stub.expect(
            "POST",
            "/task-hash",
            {"task_hash": "deadbeef" + "00" * 28, "algorithm": "BLAKE2b-256"},
        )
        digest = self.client.task_hash(text="hello")
        self.assertEqual(digest, "deadbeef" + "00" * 28)
        sent = self.stub.received()[0]
        self.assertEqual(sent["body"], {"text": "hello"})

    def test_task_hash_hex(self) -> None:
        self.stub.expect("POST", "/task-hash", {"task_hash": "x" * 64})
        self.client.task_hash(hex="deadbeef")
        self.assertEqual(self.stub.received()[0]["body"], {"hex": "deadbeef"})

    def test_task_hash_requires_one_input(self) -> None:
        with self.assertRaises(ValueError):
            self.client.task_hash()
        with self.assertRaises(ValueError):
            self.client.task_hash(text="x", hex="ab")

    # ── writes ───────────────────────────────────────────────────────────

    def test_pay(self) -> None:
        self.stub.expect("POST", "/pay", {"submitted": False, "tx_id": None, "unsigned_tx": {}})
        self.client.pay(to="9X", amount="0.001 ERG", memo="hello")
        body = self.stub.received()[0]["body"]
        self.assertEqual(body, {"to": "9X", "amount": "0.001 ERG", "memo": "hello"})

    def test_issue_note_with_task_output_computes_hash(self) -> None:
        self.stub.expect(
            "POST",
            "/task-hash",
            {
                "task_hash": "549ead194a83140a8b12bc38bb74ba7e5b094a5749ea73a7e04156f91cc5260a",
                "algorithm": "BLAKE2b-256",
            },
        )
        self.stub.expect(
            "POST",
            "/notes",
            {
                "submitted": False,
                "note_output": {"value": "5000000", "recipient": "9XAlpha"},
                "unsigned_tx": {},
            },
        )
        self.client.issue_note(
            recipient="9XAlpha",
            value="0.005 ERG",
            reserve_box_id="res1",
            deadline="+100 blocks",
            task_output="the answer is 42",
        )
        # Two requests in order: task-hash, then /notes
        seen = self.stub.received()
        self.assertEqual(seen[0]["path"], "/task-hash")
        self.assertEqual(seen[0]["body"], {"text": "the answer is 42"})
        notes_body = seen[1]["body"]
        self.assertEqual(notes_body["recipient"], "9XAlpha")
        self.assertEqual(
            notes_body["task_hash"],
            "549ead194a83140a8b12bc38bb74ba7e5b094a5749ea73a7e04156f91cc5260a",
        )

    def test_redeem_note(self) -> None:
        self.stub.expect(
            "POST",
            "/notes/abc/redeem",
            {"submitted": False, "redeemed": {"noteBoxId": "abc"}},
        )
        self.client.redeem_note("abc", task_output="the answer is 42", receiver_address="9XReceiver")
        body = self.stub.received()[0]["body"]
        self.assertEqual(body["task_output"], "the answer is 42")
        self.assertEqual(body["receiver_address"], "9XReceiver")

    def test_create_reserve(self) -> None:
        self.stub.expect("POST", "/reserves", {"reserve": {"value": "1000", "hasScript": False}})
        self.client.create_reserve(collateral="1 ERG", memo="r1")
        body = self.stub.received()[0]["body"]
        self.assertEqual(body, {"collateral": "1 ERG", "memo": "r1"})

    def test_settle_batch(self) -> None:
        self.stub.expect("POST", "/settle", {"settlement": {"noteCount": 2, "totalValue": "0"}})
        self.client.settle_batch(
            note_box_ids=["a", "b"],
            task_outputs={"a": "out-a", "b": "out-b"},
            receiver_address="9XR",
        )
        body = self.stub.received()[0]["body"]
        self.assertEqual(body["note_box_ids"], ["a", "b"])
        self.assertEqual(body["task_outputs"], {"a": "out-a", "b": "out-b"})

    # ── errors ───────────────────────────────────────────────────────────

    def test_http_error_translated_to_ErgoAgentPayError(self) -> None:
        self.stub.expect(
            "POST",
            "/notes",
            {"error": "Missing required field \"reserve_box_id\".", "code": "INVALID_AMOUNT", "status": 400},
            status=400,
        )
        with self.assertRaises(ErgoAgentPayError) as cm:
            self.client.issue_note(
                recipient="9X",
                value="0.005 ERG",
                reserve_box_id="abc",
                deadline="+100 blocks",
            )
        self.assertEqual(cm.exception.code, "INVALID_AMOUNT")

    def test_unauthorised_propagates_code(self) -> None:
        self.stub.expect(
            "GET",
            "/balance",
            {"error": "no api key", "code": "UNAUTHORISED", "status": 401},
            status=401,
        )
        with self.assertRaises(ErgoAgentPayError) as cm:
            self.client.balance()
        self.assertEqual(cm.exception.code, "UNAUTHORISED")

    def test_x_api_key_header_is_sent(self) -> None:
        client = BridgeClient(self.stub.base_url, api_key="secret")
        self.stub.expect("GET", "/balance", {"nano_ergs": "1", "ergs": "0"})
        client.balance()
        self.assertEqual(self.stub.received()[0]["headers"]["x-api-key"], "secret")

    def test_network_error_when_server_is_down(self) -> None:
        client = BridgeClient("http://127.0.0.1:1")  # nothing listens here
        with self.assertRaises(ErgoAgentPayError) as cm:
            client.health()
        self.assertEqual(cm.exception.code, "NETWORK_ERROR")


if __name__ == "__main__":
    unittest.main()
