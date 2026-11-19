from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .api.routers import auth, dashboard, documents, handovers, knowledge, projects, reports, users
from .core.config import settings
from .core.errors import error_response, register_error_handlers
from .core.logging import configure_logging
from .db.migrate import run_migrations
from .db.session import check_database

logger = logging.getLogger("handoveriq")

# Browsers that cross to another origin must send this header on every
# state-changing request. A malicious site cannot add it without a CORS
# pre-flight, which only the allowed origins pass: this is the CSRF defence.
CSRF_HEADER = "x-requested-with"
CSRF_VALUE = "handoveriq"
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    settings.validate()
    if settings.auto_migrate:
        logger.info("Applying database migrations...")
        run_migrations()
    else:
        logger.info("AUTO_MIGRATE is off; skipping database migrations.")
    if not settings.ai_configured:
        logger.warning("ANTHROPIC_API_KEY is not set: AI analysis is disabled.")
    logger.info("HANDOVERIQ API started (%s).", settings.environment)
    yield


app = FastAPI(
    title="HANDOVERIQ API",
    version="1.0.0",
    description="Project handover and knowledge management. Sign in with POST /api/v1/auth/login, "
    "then use the Authorize button with the returned access_token.",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.enable_docs else None,
    redoc_url=None,
    openapi_url="/api/openapi.json" if settings.enable_docs else None,
)

register_error_handlers(app)


@app.middleware("http")
async def csrf_guard(request: Request, call_next):
    if (
        request.method in UNSAFE_METHODS
        and request.url.path.startswith("/api/")
        # Requests that carry their own Authorization header have no ambient
        # cookie to abuse, so CSRF does not apply to them.
        and not request.headers.get("authorization")
        and request.headers.get(CSRF_HEADER, "").lower() != CSRF_VALUE
    ):
        return error_response(403, "csrf_failed", "This request was blocked because it is missing the required security header.")
    return await call_next(request)


@app.middleware("http")
async def security_headers(request: Request, call_next):
    started = time.perf_counter()
    request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if settings.is_production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # The API serves JSON and downloads, never pages, so lock the CSP down.
    if not request.url.path.startswith("/api/docs"):
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    logger.info(
        "%s %s -> %s (%.0f ms) [%s]",
        request.method, request.url.path, response.status_code, (time.perf_counter() - started) * 1000, request_id,
    )
    return response


# Added last, so it is the outermost layer and also answers pre-flight requests
# and decorates error responses such as the CSRF rejection.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=True,  # needed for the session cookie
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Requested-With", "Authorization"],
    expose_headers=["Content-Disposition", "X-Request-ID"],
)

API_PREFIX = "/api/v1"
for router in (
    auth.router, users.router, projects.router, documents.router,
    handovers.router, knowledge.router, reports.router, dashboard.router,
):
    app.include_router(router, prefix=API_PREFIX)


@app.get("/api/health", tags=["Health"], summary="Is the server and its database working?")
def health() -> dict:
    database_ok = check_database()
    return {
        "status": "ok" if database_ok else "degraded",
        "service": "handoveriq-backend",
        "database": "ok" if database_ok else "unreachable",
        "ai_configured": settings.ai_configured,
    }
