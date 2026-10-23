import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import String, Integer, Boolean, DateTime, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, utc_now


class Target(Base):
    __tablename__ = "targets"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    protocol: Mapped[str] = mapped_column(String(16), nullable=False)  # HTTP, HTTPS, TCP, ICMP
    host_or_url: Mapped[str] = mapped_column(Text, nullable=False)
    port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    
    interval_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    timeout_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    consecutive_failure_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    current_state: Mapped[str] = mapped_column(String(20), nullable=False, default="UP")  # UP, PENDING_DOWN, DOWN
    consecutive_failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    consecutive_successes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_state_change_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    next_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    
    # JSON payload for headers, expected status codes, verify_ssl, body, etc.
    protocol_options: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    check_logs: Mapped[List["CheckLog"]] = relationship(
        "CheckLog", back_populates="target", cascade="all, delete-orphan",
        order_by="desc(CheckLog.checked_at)"
    )
    alert_history: Mapped[List["AlertHistory"]] = relationship(
        "AlertHistory", back_populates="target", cascade="all, delete-orphan",
        order_by="desc(AlertHistory.triggered_at)"
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "protocol": self.protocol,
            "host_or_url": self.host_or_url,
            "port": self.port,
            "interval_seconds": self.interval_seconds,
            "timeout_seconds": self.timeout_seconds,
            "consecutive_failure_threshold": self.consecutive_failure_threshold,
            "is_active": self.is_active,
            "current_state": self.current_state,
            "consecutive_failures": self.consecutive_failures,
            "consecutive_successes": self.consecutive_successes,
            "last_checked_at": self.last_checked_at.isoformat() if self.last_checked_at else None,
            "last_state_change_at": self.last_state_change_at.isoformat() if self.last_state_change_at else None,
            "next_run_at": self.next_run_at.isoformat() if self.next_run_at else None,
            "protocol_options": self.protocol_options or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
