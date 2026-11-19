"""Creating the Anthropic client."""
from __future__ import annotations

import anthropic

from ...core.config import settings
from ...core.errors import AppError


def get_ai_client() -> anthropic.Anthropic:
    """The client used for analysis. API routes depend on this function, which
    lets the tests substitute a client that talks to a fake server.
    """
    if not settings.ai_configured:
        raise AppError(
            503,
            "ai_not_configured",
            "AI analysis is not set up yet. Add ANTHROPIC_API_KEY to the backend settings and restart the server.",
        )
    return anthropic.Anthropic(
        api_key=settings.anthropic_api_key,
        timeout=settings.ai_timeout_seconds,
        max_retries=2,  # the SDK retries rate limits, overloads and connection errors itself
    )
