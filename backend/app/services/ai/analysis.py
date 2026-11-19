"""Ask Claude to extract structured project knowledge from a document."""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

import anthropic
from pydantic import BaseModel, Field, ValidationError, field_validator

from ...core.config import settings
from ...core.errors import AppError
from ...domain import Confidence, KnowledgeCategory
from .prompts import SYSTEM_PROMPT, TOOL, TOOL_NAME, build_user_message

logger = logging.getLogger("handoveriq.ai")

MAX_ITEMS = 60


class ExtractedItem(BaseModel):
    category: KnowledgeCategory
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=10_000)
    source_quote: str = Field(default="", max_length=2_000)
    confidence: Confidence = Confidence.medium

    @field_validator("title", "content", "source_quote", mode="before")
    @classmethod
    def _strip(cls, value):
        return value.strip() if isinstance(value, str) else value


@dataclass
class ExtractedItemChecked:
    item: ExtractedItem
    quote_verified: bool


@dataclass
class ExtractionResult:
    items: list[ExtractedItemChecked]
    truncated: bool
    input_tokens: int | None
    output_tokens: int | None
    model: str
    skipped_items: int = 0
    notes: list[str] = field(default_factory=list)


# ---- quote verification ----------------------------------------------------

_PUNCTUATION = str.maketrans(
    {"\u2018": "'", "\u2019": "'", "\u201c": '"', "\u201d": '"', "\u2013": "-", "\u2014": "-", "\u00a0": " "}
)


def normalize_for_match(text: str) -> str:
    """Make text comparable: same quotes and dashes, single spaces."""
    return re.sub(r"\s+", " ", text.translate(_PUNCTUATION)).strip()


def quote_in_document(quote: str, normalized_document: str) -> bool:
    """True if the quote really appears in the document (ignoring spacing and
    typographic punctuation). This is what makes the evidence trustworthy: the
    model cannot cite words that are not there.
    """
    cleaned = quote.strip().strip("\"'").strip()
    cleaned = cleaned.removeprefix("...").removeprefix("\u2026").removesuffix("...").removesuffix("\u2026")
    cleaned = normalize_for_match(cleaned)
    return len(cleaned) >= 8 and cleaned in normalized_document


# ---- limits ----------------------------------------------------------------

def limit_text(text: str) -> tuple[str, bool]:
    """Cut very long documents at a line boundary. Returns (text, was_cut)."""
    limit = settings.ai_max_input_chars
    if len(text) <= limit:
        return text, False
    cut = text.rfind("\n", 0, limit)
    return text[: cut if cut > limit * 0.8 else limit], True


# ---- the API call ----------------------------------------------------------

def _translate_api_error(exc: anthropic.APIError) -> AppError:
    """Turn an Anthropic SDK failure into an error the user can act on."""
    logger.warning("Anthropic API error: %s: %s", type(exc).__name__, exc)
    if isinstance(exc, anthropic.APITimeoutError):
        return AppError(504, "ai_timeout", "The AI service took too long to answer. Try again, or use a shorter document.")
    if isinstance(exc, anthropic.APIConnectionError):
        return AppError(502, "ai_unreachable", "Could not reach the AI service. Check the server's internet connection and try again.")
    if isinstance(exc, anthropic.RateLimitError):
        return AppError(429, "ai_rate_limited", "The AI service is receiving too many requests. Wait a minute and try again.")
    if isinstance(exc, (anthropic.AuthenticationError, anthropic.PermissionDeniedError)):
        return AppError(502, "ai_auth_failed", "The AI service rejected the configured API key. Check ANTHROPIC_API_KEY.")
    if isinstance(exc, anthropic.NotFoundError):
        return AppError(502, "ai_model_not_found", "The configured AI model was not found. Check ANTHROPIC_MODEL.")
    if isinstance(exc, anthropic.BadRequestError):
        return AppError(
            502,
            "ai_request_rejected",
            "The AI service rejected the request. If this keeps happening, check your Anthropic account's billing and limits.",
        )
    if isinstance(exc, anthropic.InternalServerError) or getattr(exc, "status_code", 0) >= 500:
        return AppError(503, "ai_unavailable", "The AI service is temporarily unavailable or overloaded. Try again in a few minutes.")
    return AppError(502, "ai_error", "The AI service returned an unexpected error. Try again.")


def extract_knowledge(
    client: anthropic.Anthropic, *, project_name: str, document_name: str, text: str
) -> ExtractionResult:
    text_for_model, truncated = limit_text(text)

    try:
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=settings.ai_max_output_tokens,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": build_user_message(project_name, document_name, text_for_model)}],
            tools=[TOOL],
            tool_choice={"type": "tool", "name": TOOL_NAME},
        )
    except anthropic.APIError as exc:
        raise _translate_api_error(exc) from exc

    usage = getattr(response, "usage", None)
    input_tokens = getattr(usage, "input_tokens", None)
    output_tokens = getattr(usage, "output_tokens", None)

    tool_input = next(
        (block.input for block in response.content if getattr(block, "type", None) == "tool_use" and block.name == TOOL_NAME),
        None,
    )
    if response.stop_reason == "max_tokens" or not isinstance(tool_input, dict) or not isinstance(tool_input.get("items"), list):
        raise AppError(
            502,
            "ai_bad_response",
            "The AI returned an incomplete answer, so nothing was saved. Try again, or analyze a shorter document.",
        )

    normalized_document = normalize_for_match(text_for_model)
    checked: list[ExtractedItemChecked] = []
    seen: set[str] = set()
    skipped = 0
    for raw in tool_input["items"]:
        try:
            item = ExtractedItem.model_validate(raw)
        except ValidationError:
            skipped += 1
            continue
        fingerprint = normalize_for_match(item.content).lower()
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        checked.append(ExtractedItemChecked(item, quote_in_document(item.source_quote, normalized_document)))
        if len(checked) >= MAX_ITEMS:
            break

    if tool_input["items"] and not checked:
        raise AppError(502, "ai_bad_response", "The AI's answer could not be understood, so nothing was saved. Try again.")

    return ExtractionResult(
        items=checked,
        truncated=truncated,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        model=settings.anthropic_model,
        skipped_items=skipped,
    )
