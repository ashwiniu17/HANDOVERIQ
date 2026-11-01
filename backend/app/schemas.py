from datetime import datetime, timezone
from typing import Annotated, Any, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    ValidationInfo,
    field_validator,
)
from pydantic_core import PydanticCustomError

# Must match PROJECT_STATUSES in models.py (a test checks this).
ProjectStatus = Literal["draft", "in_review", "approved", "shared"]


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def _collapse_spaces(value: Any) -> Any:
    """Trim the text and squeeze any run of whitespace into one space."""
    if isinstance(value, str):
        return " ".join(value.split())
    return value  # not text: let Pydantic report the type error


def _blank_to_none(value: Any) -> Any:
    """Trim the text; an empty or whitespace-only result becomes None."""
    if isinstance(value, str):
        return value.strip() or None
    return value


def _to_utc(value: datetime) -> datetime:
    # A naive value is treated as UTC, because we only ever store UTC.
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _to_iso_z(value: datetime) -> str:
    return _to_utc(value).isoformat().replace("+00:00", "Z")


# A timestamp that is always UTC in Python and written as "...Z" in JSON.
UTCTimestamp = Annotated[
    datetime,
    AfterValidator(_to_utc),
    PlainSerializer(_to_iso_z, return_type=str, when_used="json"),
]


# ---------------------------------------------------------------------------
# Request schemas (what the client may send)
# ---------------------------------------------------------------------------
class ProjectBase(BaseModel):
    """The four editable fields and their rules. Not used directly."""

    # extra="forbid": unknown fields (including "status") are rejected, not ignored.
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [
                {
                    "name": "Atlas Migration",
                    "description": "Moving the billing service to the new platform.",
                    "outgoing_member": "Alice Rao",
                    "incoming_member": "Bob Mehta",
                }
            ]
        },
    )

    # Field order matters: outgoing_member must come before incoming_member,
    # because the "different people" check reads the already-validated outgoing_member.
    name: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=2000)
    outgoing_member: str = Field(min_length=1, max_length=100)
    incoming_member: str = Field(min_length=1, max_length=100)

    # "before" validators run first, so the length limits apply to the cleaned text.
    @field_validator("name", "outgoing_member", "incoming_member", mode="before")
    @classmethod
    def clean_required_text(cls, value: Any) -> Any:
        return _collapse_spaces(value)

    @field_validator("description", mode="before")
    @classmethod
    def clean_description(cls, value: Any) -> Any:
        return _blank_to_none(value)

    @field_validator("incoming_member")
    @classmethod
    def members_must_differ(cls, value: str, info: ValidationInfo) -> str:
        outgoing = info.data.get("outgoing_member")  # missing if it failed validation
        if outgoing is not None and value.casefold() == outgoing.casefold():
            raise PydanticCustomError(
                "same_member",
                "The incoming member must be a different person than the outgoing member.",
            )
        return value


class ProjectCreate(ProjectBase):
    """Body of POST /api/projects. The status always starts as 'draft'."""


class ProjectUpdate(ProjectBase):
    """Body of PUT /api/projects/{id}. A full replacement of the four editable fields."""


# ---------------------------------------------------------------------------
# Response schema (what the API returns)
# ---------------------------------------------------------------------------
class ProjectRead(BaseModel):
    # from_attributes lets Pydantic read values straight from a SQLAlchemy Project object.
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None
    outgoing_member: str
    incoming_member: str
    status: ProjectStatus
    created_at: UTCTimestamp
    updated_at: UTCTimestamp