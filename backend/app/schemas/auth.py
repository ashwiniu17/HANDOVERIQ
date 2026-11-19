from __future__ import annotations

from datetime import datetime

from pydantic import EmailStr, Field, field_validator

from .common import InputModel, OutputModel

# Very common passwords that satisfy a length rule but are guessed first.
COMMON_PASSWORDS = {
    "password", "password1", "password123", "12345678", "123456789", "1234567890",
    "qwertyui", "qwerty123", "iloveyou", "11111111", "letmein123", "admin1234",
}


def check_password_strength(value: str) -> str:
    if len(value.strip()) < 8:
        raise ValueError("Use at least 8 characters.")
    if value.lower() in COMMON_PASSWORDS:
        raise ValueError("That password is too common. Choose a less predictable one.")
    return value


class RegisterRequest(InputModel):
    email: EmailStr
    full_name: str = Field(min_length=1, max_length=100)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def _strong_password(cls, value: str) -> str:
        return check_password_strength(value)


class LoginRequest(InputModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(OutputModel):
    id: int
    email: str
    full_name: str
    created_at: datetime


class AuthResponse(OutputModel):
    user: UserOut
    # Returned so API tools (such as the Swagger UI "Authorize" button) can use
    # it. The website itself relies on the HttpOnly session cookie instead.
    access_token: str
    token_type: str = "bearer"


class ProfileUpdate(InputModel):
    full_name: str = Field(min_length=1, max_length=100)


class PasswordChange(InputModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def _strong_password(cls, value: str) -> str:
        return check_password_strength(value)
