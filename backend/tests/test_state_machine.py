from unittest.mock import patch
from app.models.target import Target
from app.models.alert_history import AlertHistory
from app.models.check_log import CheckLog
from app.worker.probers.base import ProbeResult
from app.services.state_machine import evaluate_target_result
from app.services.settings_service import SettingsService
from sqlalchemy import select


@patch("app.services.alert_service.AlertService.send_alert")
def test_state_machine_debounce_and_down_transition(mock_send_alert, app, db_session):
    """
    Verify:
    1. Check failures below threshold transition state to PENDING_DOWN and do NOT send alerts.
    2. Failure count reaching threshold transitions state to DOWN and triggers DOWN alert.
    3. Additional failures while DOWN are suppressed.
    """
    mock_send_alert.return_value = (True, None)

    with app.app_context():
        # Setup settings & target
        SettingsService.set(db_session, "alert_recipients", ["ops@example.com"])
        target = Target(
            name="API Gateway",
            protocol="HTTP",
            host_or_url="http://gateway.corp",
            consecutive_failure_threshold=3,
            current_state="UP",
            consecutive_failures=0
        )
        db_session.add(target)
        db_session.commit()

        # Failure 1 (FailCount = 1) -> PENDING_DOWN (no alert)
        fail_res = ProbeResult(is_success=False, response_time_ms=5000, error_message="Connection timed out")
        evaluate_target_result(db_session, target, fail_res)
        db_session.commit()

        assert target.current_state == "PENDING_DOWN"
        assert target.consecutive_failures == 1
        assert mock_send_alert.call_count == 0

        # Failure 2 (FailCount = 2) -> PENDING_DOWN (no alert)
        evaluate_target_result(db_session, target, fail_res)
        db_session.commit()

        assert target.current_state == "PENDING_DOWN"
        assert target.consecutive_failures == 2
        assert mock_send_alert.call_count == 0

        # Failure 3 (FailCount = 3 == Threshold) -> DOWN (DISPATCH DOWN ALERT)
        evaluate_target_result(db_session, target, fail_res)
        db_session.commit()

        assert target.current_state == "DOWN"
        assert target.consecutive_failures == 3
        assert mock_send_alert.call_count == 1
        call_args = mock_send_alert.call_args[1]
        assert call_args["alert_type"] == "DOWN"
        assert call_args["target_name"] == "API Gateway"

        # Failure 4 (FailCount = 4) -> STILL DOWN (SUPPRESSION - NO ADDITIONAL ALERT)
        evaluate_target_result(db_session, target, fail_res)
        db_session.commit()

        assert target.current_state == "DOWN"
        assert target.consecutive_failures == 4
        assert mock_send_alert.call_count == 1  # Still 1, strictly suppressed!

        # Check that alert history was recorded
        alerts = db_session.execute(select(AlertHistory).where(AlertHistory.target_id == target.id)).scalars().all()
        assert len(alerts) == 1
        assert alerts[0].alert_type == "DOWN"


@patch("app.services.alert_service.AlertService.send_alert")
def test_state_machine_recovery(mock_send_alert, app, db_session):
    """
    Verify:
    1. A target in DOWN state immediately transitions to UP on successful check.
    2. RECOVERED alert is dispatched.
    3. Consecutive failures are reset to 0.
    """
    mock_send_alert.return_value = (True, None)

    with app.app_context():
        SettingsService.set(db_session, "alert_recipients", ["ops@example.com"])
        target = Target(
            name="Payment Service",
            protocol="HTTP",
            host_or_url="http://payment.corp",
            consecutive_failure_threshold=3,
            current_state="DOWN",
            consecutive_failures=5
        )
        db_session.add(target)
        db_session.commit()

        # Success probe
        success_res = ProbeResult(is_success=True, response_time_ms=45, status_code=200)
        evaluate_target_result(db_session, target, success_res)
        db_session.commit()

        assert target.current_state == "UP"
        assert target.consecutive_failures == 0
        assert target.consecutive_successes == 1

        assert mock_send_alert.call_count == 1
        call_args = mock_send_alert.call_args[1]
        assert call_args["alert_type"] == "RECOVERED"
        assert call_args["target_name"] == "Payment Service"


@patch("app.services.alert_service.AlertService.send_alert")
def test_state_machine_transient_blip_recovery(mock_send_alert, app, db_session):
    """
    Verify:
    If a target fails once (enters PENDING_DOWN) and then succeeds,
    it recovers to UP without ever triggering any alerts.
    """
    mock_send_alert.return_value = (True, None)

    with app.app_context():
        target = Target(
            name="Search Service",
            protocol="HTTP",
            host_or_url="http://search.corp",
            consecutive_failure_threshold=3,
            current_state="UP",
            consecutive_failures=0
        )
        db_session.add(target)
        db_session.commit()

        # Blip failure
        fail_res = ProbeResult(is_success=False, response_time_ms=1000, error_message="HTTP 500")
        evaluate_target_result(db_session, target, fail_res)
        db_session.commit()

        assert target.current_state == "PENDING_DOWN"
        assert target.consecutive_failures == 1

        # Next check succeeds
        success_res = ProbeResult(is_success=True, response_time_ms=30, status_code=200)
        evaluate_target_result(db_session, target, success_res)
        db_session.commit()

        assert target.current_state == "UP"
        assert target.consecutive_failures == 0
        assert mock_send_alert.call_count == 0  # Zero emails sent!
