"""One error format for the whole API:

    {"error": {"code": "machine_readable", "message": "Human readable.", "details": [...]}}
"""
from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("handoveriq.errors")


class AppError(Exception):
    """An expected failure that should be reported to the client."""

    def __init__(self, status_code: int, code: str, message: str, details: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


def error_response(status_code: int, code: str, message: str, details: Any = None) -> JSONResponse:
    body: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        body["details"] = details
    return JSONResponse(status_code=status_code, content={"error": body})


def _friendly_validation_message(error: dict) -> str:
    kind = error.get("type", "")
    ctx = error.get("ctx") or {}
    if kind == "missing":
        return "This field is required."
    if kind == "string_too_short":
        minimum = ctx.get("min_length", 1)
        return "This field is required." if minimum == 1 else f"Use at least {minimum} characters."
    if kind == "string_too_long":
        return f"Use at most {ctx.get('max_length')} characters."
    if kind == "extra_forbidden":
        return "This field is not allowed."
    if kind in {"value_error", "assertion_error"}:
        return str(ctx.get("error") or error.get("msg", "Invalid value.")).removeprefix("Value error, ")
    return error.get("msg", "Invalid value.")


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError):
        return error_response(exc.status_code, exc.code, exc.message, exc.details)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(_: Request, exc: RequestValidationError):
        details = []
        for error in exc.errors():
            location = [str(part) for part in error.get("loc", ()) if part not in ("body", "query", "path")]
            details.append({"field": ".".join(location) or "request", "message": _friendly_validation_message(error)})
        return error_response(422, "validation_error", "Some of the information you entered is not valid.", details)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(_: Request, exc: StarletteHTTPException):
        message = exc.detail if isinstance(exc.detail, str) else "Request failed."
        return error_response(exc.status_code, "http_error", message)

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception):
        # The details go to the log; the client only gets a safe, generic message.
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return error_response(500, "internal_error", "Something went wrong on our side. Please try again.")
