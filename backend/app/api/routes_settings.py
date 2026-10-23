import json
from flask import Blueprint, request, jsonify
from pydantic import ValidationError
from app.extensions import db
from app.services.settings_service import SettingsService
from app.services.alert_service import AlertService
from app.schemas.setting_schema import SystemSettingsSchema, TestEmailRequestSchema

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")


@settings_bp.route("", methods=["GET"])
def get_settings():
    """Retrieve all dynamic operational system settings."""
    session = db.session
    data = SettingsService.get_all(session)
    return jsonify({"settings": data}), 200


@settings_bp.route("", methods=["PUT"])
def update_settings():
    """Update dynamic operational system settings."""
    raw_data = request.get_json(silent=True) or {}
    try:
        validated = SystemSettingsSchema(**raw_data)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": json.loads(err.json())}), 422

    session = db.session
    SettingsService.set(session, "alert_recipients", validated.alert_recipients)
    SettingsService.set(session, "default_check_interval_seconds", validated.default_check_interval_seconds)
    SettingsService.set(session, "default_timeout_seconds", validated.default_timeout_seconds)
    SettingsService.set(session, "max_timeout_seconds", validated.max_timeout_seconds)
    SettingsService.set(session, "default_failure_threshold", validated.default_failure_threshold)
    SettingsService.set(session, "log_retention_days", validated.log_retention_days)

    return jsonify({
        "message": "Settings updated successfully",
        "settings": SettingsService.get_all(session)
    }), 200


@settings_bp.route("/test-email", methods=["POST"])
def send_test_email():
    """Verify SMTP configuration and send a test notification email."""
    raw_data = request.get_json(silent=True) or {}
    try:
        validated = TestEmailRequestSchema(**raw_data)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": json.loads(err.json())}), 422

    session = db.session
    recipients = (
        [validated.recipient] if validated.recipient 
        else SettingsService.get(session, "alert_recipients", ["admin@internal.corp"])
    )

    success, message = AlertService.send_test_email(recipients)
    status_code = 200 if success else 500

    return jsonify({
        "success": success,
        "message": message,
        "recipients": recipients
    }), status_code
