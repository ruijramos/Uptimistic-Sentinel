from typing import List, Optional
from pydantic import BaseModel, Field, EmailStr, field_validator


class SystemSettingsSchema(BaseModel):
    alert_recipients: List[str] = Field(
        default_factory=lambda: ["admin@internal.corp"],
        description="Destination email addresses for DOWN and RECOVERED alerts"
    )
    default_check_interval_seconds: int = Field(default=60, ge=10, le=3600)
    default_timeout_seconds: int = Field(default=10, ge=1, le=60)
    max_timeout_seconds: int = Field(default=30, ge=1, le=120)
    default_failure_threshold: int = Field(default=3, ge=1, le=20)
    log_retention_days: int = Field(default=30, ge=1, le=365)

    @field_validator("alert_recipients")
    @classmethod
    def validate_emails(cls, recipients: List[str]) -> List[str]:
        cleaned = []
        for email in recipients:
            trimmed = email.strip()
            if not trimmed or "@" not in trimmed:
                raise ValueError(f"Invalid email address: {email}")
            cleaned.append(trimmed)
        if not cleaned:
            raise ValueError("At least one alert recipient email must be specified.")
        return cleaned


class TestEmailRequestSchema(BaseModel):
    recipient: Optional[str] = Field(default=None, description="Optional override recipient for testing SMTP")
