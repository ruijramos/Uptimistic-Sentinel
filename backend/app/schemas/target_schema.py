import re
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator, model_validator


class TargetProtocolOptions(BaseModel):
    method: str = Field(default="GET")
    expected_status_codes: List[int] = Field(default_factory=lambda: [200, 201, 204])
    headers: Dict[str, str] = Field(default_factory=dict)
    verify_ssl: bool = Field(default=True)
    follow_redirects: bool = Field(default=True)


class TargetCreateSchema(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    protocol: str = Field(..., description="HTTP, HTTPS, TCP, or ICMP")
    host_or_url: str = Field(..., min_length=1, max_length=2048)
    port: Optional[int] = Field(default=None, ge=1, le=65535)
    interval_seconds: int = Field(default=60, ge=10, le=3600)
    timeout_seconds: int = Field(default=10, ge=1, le=60)
    consecutive_failure_threshold: int = Field(default=3, ge=1, le=20)
    is_active: bool = Field(default=True)
    protocol_options: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @field_validator("protocol")
    @classmethod
    def validate_protocol(cls, v: str) -> str:
        proto = v.strip().upper()
        allowed = {"HTTP", "HTTPS", "TCP", "ICMP"}
        if proto not in allowed:
            raise ValueError(f"Protocol must be one of {allowed}")
        return proto

    @model_validator(mode="after")
    def validate_host_and_port(self):
        proto = self.protocol
        host = self.host_or_url.strip()

        if proto in {"HTTP", "HTTPS"}:
            if not (host.startswith("http://") or host.startswith("https://")):
                raise ValueError(f"Protocol {proto} requires host_or_url to start with http:// or https://")
        elif proto == "TCP":
            if not self.port:
                raise ValueError("TCP protocol requires a valid port number between 1 and 65535")
        return self


class TargetUpdateSchema(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=128)
    protocol: Optional[str] = None
    host_or_url: Optional[str] = None
    port: Optional[int] = Field(default=None, ge=1, le=65535)
    interval_seconds: Optional[int] = Field(default=None, ge=10, le=3600)
    timeout_seconds: Optional[int] = Field(default=None, ge=1, le=60)
    consecutive_failure_threshold: Optional[int] = Field(default=None, ge=1, le=20)
    is_active: Optional[bool] = None
    protocol_options: Optional[Dict[str, Any]] = None

    @field_validator("protocol")
    @classmethod
    def validate_protocol(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        proto = v.strip().upper()
        allowed = {"HTTP", "HTTPS", "TCP", "ICMP"}
        if proto not in allowed:
            raise ValueError(f"Protocol must be one of {allowed}")
        return proto


class TargetResponseSchema(BaseModel):
    id: str
    name: str
    protocol: str
    host_or_url: str
    port: Optional[int] = None
    interval_seconds: int
    timeout_seconds: int
    consecutive_failure_threshold: int
    is_active: bool
    current_state: str
    consecutive_failures: int
    consecutive_successes: int
    last_checked_at: Optional[str] = None
    last_state_change_at: Optional[str] = None
    next_run_at: Optional[str] = None
    protocol_options: Dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    # Summary metrics for UI cards
    uptime_percentage_24h: Optional[float] = None
    avg_latency_24h_ms: Optional[float] = None
    recent_latencies: Optional[List[int]] = None
