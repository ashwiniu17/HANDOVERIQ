from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class InputModel(BaseModel):
    """Request bodies: unknown fields are rejected and text is trimmed."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class OutputModel(BaseModel):
    """Responses built from database objects."""

    model_config = ConfigDict(from_attributes=True)
