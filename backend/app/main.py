from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import init_db
from .errors import register_error_handlers
from .routers import documents, projects
from .routers import handovers
from .routers import demo


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once at startup: create any missing database tables.
    init_db()
    yield


app = FastAPI(title="HANDOVERIQ API", version="0.1.0", lifespan=lifespan)

# CORS: browsers block a page on localhost:3000 from calling localhost:8000
# unless the backend explicitly allows that origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(projects.router)
app.include_router(documents.router)
app.include_router(handovers.router)
app.include_router(demo.router)


@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": "handoveriq-backend",
        # Only reports whether a key is set. The key itself is never returned.
        "anthropic_configured": bool(settings.anthropic_api_key),
    }