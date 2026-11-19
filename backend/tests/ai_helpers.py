"""A fake Anthropic server, so the REAL SDK code path is exercised without a key.

The Anthropic Python client is built with an httpx transport that answers from
a function. Everything the app does (building the request, parsing the answer,
mapping errors) runs exactly as in production.
"""
from __future__ import annotations

import json

import anthropic
import httpx2 as httpx

from app.api.routers import knowledge as knowledge_router  # noqa: F401  (ensures the app is loaded)
from app.main import app
from app.services.ai.client import get_ai_client


def tool_use_message(items: list[dict], *, stop_reason: str = "tool_use", tool_name: str = "record_project_knowledge") -> dict:
    return {
        "id": "msg_test",
        "type": "message",
        "role": "assistant",
        "model": "claude-test",
        "content": [{"type": "tool_use", "id": "toolu_test", "name": tool_name, "input": {"items": items}}],
        "stop_reason": stop_reason,
        "stop_sequence": None,
        "usage": {"input_tokens": 1234, "output_tokens": 321},
    }


def text_only_message() -> dict:
    return {
        "id": "msg_test", "type": "message", "role": "assistant", "model": "claude-test",
        "content": [{"type": "text", "text": "Sorry, I cannot help."}],
        "stop_reason": "end_turn", "stop_sequence": None,
        "usage": {"input_tokens": 10, "output_tokens": 5},
    }


def api_error(status: int, error_type: str, message: str = "boom") -> httpx.Response:
    return httpx.Response(status, json={"type": "error", "error": {"type": error_type, "message": message}})


def item(category: str, title: str, content: str, quote: str, confidence: str = "high") -> dict:
    return {"category": category, "title": title, "content": content, "source_quote": quote, "confidence": confidence}


GOOD_ITEMS = [
    item("technical_requirement", "Python and PostgreSQL", "The service runs on Python 3.12 with PostgreSQL 16.",
         "The service runs on Python 3.12 with PostgreSQL 16."),
    item("decision", "Use Stripe webhooks", "Stripe webhooks were chosen because polling was too slow.",
         "We decided to use Stripe webhooks because polling was too slow."),
    item("pending_task", "Finish invoice export", "The invoice export must be finished before 30 June.",
         "Pending: finish the invoice export before the 30th of June."),
    item("known_issue", "Nightly sync fails", "The nightly sync fails when the VPN is down.",
         "Known issue: the nightly sync fails when the VPN is down."),
]


class FakeAnthropic:
    """Records the requests it receives and answers with the configured reply."""

    def __init__(self, reply):
        self.reply = reply
        self.requests: list[dict] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        self.requests.append({"headers": dict(request.headers), "body": body, "url": str(request.url)})
        reply = self.reply(len(self.requests)) if callable(self.reply) else self.reply
        if isinstance(reply, httpx.Response):
            return reply
        if isinstance(reply, Exception):
            raise reply
        return httpx.Response(200, json=reply)

    def client(self) -> anthropic.Anthropic:
        return anthropic.Anthropic(
            api_key="sk-ant-test-key",
            http_client=httpx.Client(transport=httpx.MockTransport(self.handler)),
            max_retries=0,
        )

    def install(self) -> "FakeAnthropic":
        app.dependency_overrides[get_ai_client] = self.client
        return self


def install_fake_ai(reply) -> FakeAnthropic:
    return FakeAnthropic(reply).install()
