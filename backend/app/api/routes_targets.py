import json
from datetime import timedelta
from typing import Dict, Any, List
from flask import Blueprint, request, jsonify
from sqlalchemy import select, func, desc
from pydantic import ValidationError

from app.extensions import db
from app.models.base import utc_now
from app.models.target import Target
from app.models.check_log import CheckLog
from app.schemas.target_schema import TargetCreateSchema, TargetUpdateSchema

targets_bp = Blueprint("targets", __name__, url_prefix="/api/targets")


def _enrich_target_metrics(target: Target) -> Dict[str, Any]:
    """Helper to compute 24h uptime percentage, average latency, and sparkline points."""
    session = db.session
    data = target.to_dict()

    now = utc_now()
    since_24h = now - timedelta(hours=24)

    # Compute 24h uptime and avg response time
    stats_query = select(
        func.count(CheckLog.id).label("total"),
        func.count(CheckLog.id).filter(CheckLog.is_success.is_(True)).label("success"),
        func.avg(CheckLog.response_time_ms).filter(CheckLog.is_success.is_(True)).label("avg_latency")
    ).where(
        CheckLog.target_id == target.id,
        CheckLog.checked_at >= since_24h
    )
    total, success, avg_latency = session.execute(stats_query).one()

    if total and total > 0:
        uptime_pct = round((success / total) * 100, 2)
        avg_ms = round(float(avg_latency or 0), 1)
    else:
        uptime_pct = 100.0 if target.current_state == "UP" else 0.0
        avg_ms = 0.0

    # Fetch last 20 check logs for sparkline
    recent_logs = session.execute(
        select(CheckLog.response_time_ms, CheckLog.is_success)
        .where(CheckLog.target_id == target.id)
        .order_by(desc(CheckLog.checked_at))
        .limit(20)
    ).all()

    # Invert so sparkline flows left to right (chronological)
    recent_latencies = [
        row.response_time_ms if row.is_success else 0 
        for row in reversed(recent_logs)
    ]

    data["uptime_percentage_24h"] = uptime_pct
    data["avg_latency_24h_ms"] = avg_ms
    data["recent_latencies"] = recent_latencies
    return data


@targets_bp.route("", methods=["GET"])
def list_targets():
    """List all targets with summary health metrics."""
    session = db.session
    targets = session.execute(
        select(Target).order_by(Target.created_at.asc())
    ).scalars().all()

    enriched = [_enrich_target_metrics(t) for t in targets]
    return jsonify({"targets": enriched, "total": len(enriched)}), 200


@targets_bp.route("", methods=["POST"])
def create_target():
    """Create a new monitored target."""
    raw_data = request.get_json(silent=True) or {}
    try:
        validated = TargetCreateSchema(**raw_data)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": json.loads(err.json())}), 422

    session = db.session
    now = utc_now()
    target = Target(
        name=validated.name,
        protocol=validated.protocol,
        host_or_url=validated.host_or_url.strip(),
        port=validated.port,
        interval_seconds=validated.interval_seconds,
        timeout_seconds=validated.timeout_seconds,
        consecutive_failure_threshold=validated.consecutive_failure_threshold,
        is_active=validated.is_active,
        current_state="UP",
        consecutive_failures=0,
        consecutive_successes=0,
        next_run_at=now,  # Schedule immediate first run
        protocol_options=validated.protocol_options or {},
        created_at=now,
        updated_at=now,
    )
    session.add(target)
    session.commit()

    return jsonify({"target": _enrich_target_metrics(target)}), 201


@targets_bp.route("/<string:target_id>", methods=["GET"])
def get_target(target_id: str):
    """Retrieve details for a single target."""
    session = db.session
    target = session.execute(
        select(Target).where(Target.id == target_id)
    ).scalar_one_or_none()

    if not target:
        return jsonify({"error": "Target not found"}), 404

    return jsonify({"target": _enrich_target_metrics(target)}), 200


@targets_bp.route("/<string:target_id>", methods=["PUT"])
def update_target(target_id: str):
    """Update target properties."""
    session = db.session
    target = session.execute(
        select(Target).where(Target.id == target_id)
    ).scalar_one_or_none()

    if not target:
        return jsonify({"error": "Target not found"}), 404

    raw_data = request.get_json(silent=True) or {}
    try:
        validated = TargetUpdateSchema(**raw_data)
    except ValidationError as err:
        return jsonify({"error": "Validation failed", "details": json.loads(err.json())}), 422

    if validated.name is not None:
        target.name = validated.name
    if validated.protocol is not None:
        target.protocol = validated.protocol
    if validated.host_or_url is not None:
        target.host_or_url = validated.host_or_url.strip()
    if validated.port is not None or "port" in raw_data:
        target.port = validated.port
    if validated.interval_seconds is not None:
        target.interval_seconds = validated.interval_seconds
    if validated.timeout_seconds is not None:
        target.timeout_seconds = validated.timeout_seconds
    if validated.consecutive_failure_threshold is not None:
        target.consecutive_failure_threshold = validated.consecutive_failure_threshold
    if validated.is_active is not None:
        target.is_active = validated.is_active
    if validated.protocol_options is not None:
        target.protocol_options = validated.protocol_options

    target.updated_at = utc_now()
    session.commit()

    return jsonify({"target": _enrich_target_metrics(target)}), 200


@targets_bp.route("/<string:target_id>", methods=["DELETE"])
def delete_target(target_id: str):
    """Remove a monitored target and all associated logs."""
    session = db.session
    target = session.execute(
        select(Target).where(Target.id == target_id)
    ).scalar_one_or_none()

    if not target:
        return jsonify({"error": "Target not found"}), 404

    session.delete(target)
    session.commit()
    return jsonify({"message": f"Target '{target.name}' deleted successfully"}), 200


@targets_bp.route("/<string:target_id>/pause", methods=["POST"])
def pause_target(target_id: str):
    """Pause an active target."""
    session = db.session
    target = session.execute(
        select(Target).where(Target.id == target_id)
    ).scalar_one_or_none()

    if not target:
        return jsonify({"error": "Target not found"}), 404

    target.is_active = False
    target.updated_at = utc_now()
    session.commit()
    return jsonify({"target": _enrich_target_metrics(target)}), 200


@targets_bp.route("/<string:target_id>/resume", methods=["POST"])
def resume_target(target_id: str):
    """Resume monitoring for a paused target."""
    session = db.session
    target = session.execute(
        select(Target).where(Target.id == target_id)
    ).scalar_one_or_none()

    if not target:
        return jsonify({"error": "Target not found"}), 404

    target.is_active = True
    target.consecutive_failures = 0
    target.next_run_at = utc_now()
    target.updated_at = utc_now()
    session.commit()
    return jsonify({"target": _enrich_target_metrics(target)}), 200


@targets_bp.route("/<string:target_id>/check-now", methods=["POST"])
def check_target_now(target_id: str):
    """Execute an immediate on-demand probe for the target."""
    session = db.session
    target = session.execute(
        select(Target).where(Target.id == target_id)
    ).scalar_one_or_none()

    if not target:
        return jsonify({"error": "Target not found"}), 404

    from app.worker.probers import run_probe
    from app.services.state_machine import evaluate_target_result

    # Run check synchronously for manual on-demand trigger
    result = run_probe(target)
    evaluate_target_result(session, target, result)
    session.commit()

    return jsonify({
        "result": result.to_dict(),
        "target": _enrich_target_metrics(target)
    }), 200
