from typing import Optional
from pydantic import BaseModel


class CheckLogResponseSchema(BaseModel):
    id: int
    target_id: str
    checked_at: str
    is_success: bool
    response_time_ms: int
    status_code: Optional[int] = None
    error_message: Optional[str] = None


class AlertHistoryResponseSchema(BaseModel):
    id: int
    target_id: str
    triggered_at: str
    alert_type: str
    recipient: str
    is_delivered: bool
    delivery_error: Optional[str] = None
