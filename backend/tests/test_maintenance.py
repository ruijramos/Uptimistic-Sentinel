from datetime import timedelta
from app.models.base import utc_now
from app.models.target import Target
from app.models.check_log import CheckLog
from app.worker.maintenance import prune_old_check_logs
from app.services.settings_service import SettingsService
from sqlalchemy import select


def test_prune_old_check_logs(app, db_session):
    """Verify that records older than retention threshold are safely deleted."""
    with app.app_context():
        SettingsService.set(db_session, "log_retention_days", 10)

        target = Target(
            name="Logged Target",
            protocol="HTTP",
            host_or_url="http://logged.local"
        )
        db_session.add(target)
        db_session.commit()

        now = utc_now()
        # Old log: 15 days ago (should be pruned)
        old_log = CheckLog(
            target_id=target.id,
            checked_at=now - timedelta(days=15),
            is_success=True,
            response_time_ms=50
        )
        # Fresh log: 2 days ago (should be kept)
        fresh_log = CheckLog(
            target_id=target.id,
            checked_at=now - timedelta(days=2),
            is_success=True,
            response_time_ms=60
        )
        db_session.add_all([old_log, fresh_log])
        db_session.commit()

        # Run maintenance
        deleted = prune_old_check_logs(db_session)
        assert deleted == 1

        remaining = db_session.execute(select(CheckLog)).scalars().all()
        assert len(remaining) == 1
        assert remaining[0].id == fresh_log.id
