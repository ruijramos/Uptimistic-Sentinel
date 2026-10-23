from datetime import timedelta
import logging
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from app.models.base import utc_now
from app.models.check_log import CheckLog
from app.services.settings_service import SettingsService

logger = logging.getLogger("sentinel.maintenance")


def prune_old_check_logs(session: Session) -> int:
    """
    Safely prunes historical check logs older than the configured retention threshold.
    Returns the total number of deleted rows.
    """
    retention_days = SettingsService.get(session, "log_retention_days", 30)
    cutoff = utc_now() - timedelta(days=retention_days)

    logger.info("Executing check logs retention prune. Cutoff date: %s (%d days)", cutoff.isoformat(), retention_days)

    total_deleted = 0
    # In SQLite and PostgreSQL, batch delete or bulk delete
    stmt = delete(CheckLog).where(CheckLog.checked_at < cutoff)
    result = session.execute(stmt)
    total_deleted = result.rowcount
    session.commit()

    logger.info("Pruned %d historical check logs older than %d days", total_deleted, retention_days)
    return total_deleted
