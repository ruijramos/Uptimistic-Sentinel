from datetime import timedelta
import logging
from typing import Optional
from sqlalchemy.orm import Session

from app.models.base import utc_now
from app.models.target import Target
from app.models.check_log import CheckLog
from app.models.alert_history import AlertHistory
from app.worker.probers.base import ProbeResult
from app.services.alert_service import AlertService
from app.services.settings_service import SettingsService

logger = logging.getLogger("sentinel.state_machine")


def evaluate_target_result(
    session: Session,
    target: Target,
    result: ProbeResult
) -> None:
    """
    Executes the deterministic state machine transitions on a target based on probe results,
    enforcing debounce thresholds and strictly preventing alert fatigue.
    """
    now = utc_now()
    previous_state = target.current_state
    threshold = target.consecutive_failure_threshold or 3

    # Record check log entry
    log_entry = CheckLog(
        target_id=target.id,
        checked_at=now,
        is_success=result.is_success,
        response_time_ms=result.response_time_ms,
        status_code=result.status_code,
        error_message=result.error_message
    )
    session.add(log_entry)

    target.last_checked_at = now
    target.next_run_at = now + timedelta(seconds=target.interval_seconds)
    target.updated_at = now

    if result.is_success:
        target.consecutive_failures = 0
        target.consecutive_successes += 1

        if previous_state == "DOWN":
            # RECOVERY TRANSITION
            target.current_state = "UP"
            target.last_state_change_at = now
            logger.info("Target '%s' transitioned from DOWN to UP (RECOVERED)", target.name)

            recipients = SettingsService.get(session, "alert_recipients", [])
            if recipients:
                delivered, err = AlertService.send_alert(
                    target_name=target.name,
                    target_protocol=target.protocol,
                    target_host=target.host_or_url,
                    alert_type="RECOVERED",
                    recipients=recipients,
                    latency_ms=result.response_time_ms
                )
                for recipient in recipients:
                    alert_record = AlertHistory(
                        target_id=target.id,
                        triggered_at=now,
                        alert_type="RECOVERED",
                        recipient=recipient,
                        is_delivered=delivered,
                        delivery_error=err
                    )
                    session.add(alert_record)

        elif previous_state == "PENDING_DOWN":
            # Transient failure blip recovered before threshold breach
            target.current_state = "UP"
            target.last_state_change_at = now
            logger.info("Target '%s' transient failure cleared; back to UP", target.name)

    else:
        # Failure detected
        target.consecutive_failures += 1
        target.consecutive_successes = 0

        if previous_state in {"UP", "PENDING_DOWN"}:
            if target.consecutive_failures >= threshold:
                # DOWN TRANSITION
                target.current_state = "DOWN"
                target.last_state_change_at = now
                logger.warning(
                    "Target '%s' reached %d consecutive failures. Declaring DOWN.",
                    target.name, target.consecutive_failures
                )

                recipients = SettingsService.get(session, "alert_recipients", [])
                if recipients:
                    delivered, err = AlertService.send_alert(
                        target_name=target.name,
                        target_protocol=target.protocol,
                        target_host=target.host_or_url,
                        alert_type="DOWN",
                        recipients=recipients,
                        error_reason=result.error_message,
                        consecutive_failures=target.consecutive_failures
                    )
                    for recipient in recipients:
                        alert_record = AlertHistory(
                            target_id=target.id,
                            triggered_at=now,
                            alert_type="DOWN",
                            recipient=recipient,
                            is_delivered=delivered,
                            delivery_error=err
                        )
                        session.add(alert_record)
            else:
                # Within debounce window
                target.current_state = "PENDING_DOWN"
                logger.debug(
                    "Target '%s' check failed (%d/%d). In PENDING_DOWN debounce.",
                    target.name, target.consecutive_failures, threshold
                )

        elif previous_state == "DOWN":
            # Already DOWN: Keep state as DOWN, update metrics, STRICTLY SUPPRESS duplicate notifications
            logger.debug(
                "Target '%s' check failed again (%d consecutive). Notification suppressed.",
                target.name, target.consecutive_failures
            )
