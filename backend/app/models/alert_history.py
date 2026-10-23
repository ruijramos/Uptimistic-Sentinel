from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import BigInteger, Integer, String, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, utc_now


class AlertHistory(Base):
    __tablename__ = "alert_history"

    id: Mapped[int] = mapped_column(
        BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True
    )
    target_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("targets.id", ondelete="CASCADE"), nullable=False, index=True
    )
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, index=True
    )
    alert_type: Mapped[str] = mapped_column(String(16), nullable=False)  # 'DOWN', 'RECOVERED'
    recipient: Mapped[str] = mapped_column(String(255), nullable=False)
    is_delivered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    delivery_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationship
    target: Mapped["Target"] = relationship("Target", back_populates="alert_history")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "target_id": self.target_id,
            "triggered_at": self.triggered_at.isoformat() if self.triggered_at else None,
            "alert_type": self.alert_type,
            "recipient": self.recipient,
            "is_delivered": self.is_delivered,
            "delivery_error": self.delivery_error,
        }
