from flask import Blueprint, request, jsonify
from sqlalchemy import select, desc
from app.extensions import db
from app.models.target import Target
from app.models.check_log import CheckLog
from app.models.alert_history import AlertHistory

logs_bp = Blueprint("logs", __name__, url_prefix="/api")


@logs_bp.route("/targets/<string:target_id>/logs", methods=["GET"])
def get_target_logs(target_id: str):
    """Retrieve historical check logs for a specific target."""
    session = db.session
    target = session.execute(
        select(Target).where(Target.id == target_id)
    ).scalar_one_or_none()

    if not target:
        return jsonify({"error": "Target not found"}), 404

    limit = min(int(request.args.get("limit", 100)), 500)
    offset = max(int(request.args.get("offset", 0)), 0)

    logs = session.execute(
        select(CheckLog)
        .where(CheckLog.target_id == target_id)
        .order_by(desc(CheckLog.checked_at))
        .offset(offset)
        .limit(limit)
    ).scalars().all()

    return jsonify({
        "target_id": target_id,
        "logs": [log.to_dict() for log in logs],
        "limit": limit,
        "offset": offset,
    }), 200


@logs_bp.route("/targets/<string:target_id>/alerts", methods=["GET"])
def get_target_alerts(target_id: str):
    """Retrieve alert notification history for a specific target."""
    session = db.session
    target = session.execute(
        select(Target).where(Target.id == target_id)
    ).scalar_one_or_none()

    if not target:
        return jsonify({"error": "Target not found"}), 404

    alerts = session.execute(
        select(AlertHistory)
        .where(AlertHistory.target_id == target_id)
        .order_by(desc(AlertHistory.triggered_at))
        .limit(50)
    ).scalars().all()

    return jsonify({
        "target_id": target_id,
        "alerts": [alert.to_dict() for alert in alerts]
    }), 200


@logs_bp.route("/alerts", methods=["GET"])
def get_recent_alerts():
    """Retrieve recent alert notifications across all targets."""
    session = db.session
    limit = min(int(request.args.get("limit", 50)), 200)

    alerts_query = (
        select(AlertHistory, Target.name.label("target_name"), Target.protocol.label("target_protocol"))
        .join(Target, AlertHistory.target_id == Target.id)
        .order_by(desc(AlertHistory.triggered_at))
        .limit(limit)
    )
    rows = session.execute(alerts_query).all()

    results = []
    for alert, target_name, target_protocol in rows:
        data = alert.to_dict()
        data["target_name"] = target_name
        data["target_protocol"] = target_protocol
        results.append(data)

    return jsonify({"alerts": results, "total": len(results)}), 200
