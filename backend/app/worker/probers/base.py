from dataclasses import dataclass
from typing import Optional, Dict, Any


@dataclass
class ProbeResult:
    """Represents the standardized result of a target network probe."""
    is_success: bool
    response_time_ms: int
    status_code: Optional[int] = None
    error_message: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "is_success": self.is_success,
            "response_time_ms": self.response_time_ms,
            "status_code": self.status_code,
            "error_message": self.error_message,
        }
