from typing import Any, Dict, Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.system_setting import SystemSetting

DEFAULT_SETTINGS: Dict[str, Dict[str, Any]] = {
    "alert_recipients": {
        "value": ["admin@internal.corp"],
        "description": "List of destination email addresses for DOWN and RECOVERED alerts.",
    },
    "default_check_interval_seconds": {
        "value": 60,
        "description": "Default check frequency in seconds for new targets.",
    },
    "default_timeout_seconds": {
        "value": 10,
        "description": "Default network probe timeout in seconds.",
    },
    "max_timeout_seconds": {
        "value": 30,
        "description": "Maximum allowed network probe timeout limit in seconds.",
    },
    "default_failure_threshold": {
        "value": 3,
        "description": "Default consecutive failure threshold before declaring a target DOWN.",
    },
    "log_retention_days": {
        "value": 30,
        "description": "Number of days to retain historical check logs before automatic pruning.",
    },
}


class SettingsService:
    """Service to query, update, and seed dynamic system operational settings."""

    @staticmethod
    def seed_defaults(session: Session) -> None:
        """Seeds missing default settings into the database."""
        for key, info in DEFAULT_SETTINGS.items():
            existing = session.execute(
                select(SystemSetting).where(SystemSetting.key == key)
            ).scalar_one_or_none()
            if not existing:
                setting = SystemSetting(
                    key=key,
                    value=info["value"],
                    description=info["description"]
                )
                session.add(setting)
        session.commit()

    @staticmethod
    def get_all(session: Session) -> Dict[str, Any]:
        """Returns all settings mapped by key."""
        stmt = select(SystemSetting)
        results = session.execute(stmt).scalars().all()
        data = {s.key: s.value for s in results}
        # Fall back to defaults for any missing keys
        for key, info in DEFAULT_SETTINGS.items():
            if key not in data:
                data[key] = info["value"]
        return data

    @staticmethod
    def get(session: Session, key: str, default: Any = None) -> Any:
        """Retrieves a single setting value by key."""
        stmt = select(SystemSetting).where(SystemSetting.key == key)
        setting = session.execute(stmt).scalar_one_or_none()
        if setting is not None:
            return setting.value
        if key in DEFAULT_SETTINGS:
            return DEFAULT_SETTINGS[key]["value"]
        return default

    @staticmethod
    def set(session: Session, key: str, value: Any, description: Optional[str] = None) -> SystemSetting:
        """Updates or creates a setting."""
        stmt = select(SystemSetting).where(SystemSetting.key == key)
        setting = session.execute(stmt).scalar_one_or_none()
        if setting:
            setting.value = value
            if description:
                setting.description = description
        else:
            desc = description or DEFAULT_SETTINGS.get(key, {}).get("description")
            setting = SystemSetting(key=key, value=value, description=desc)
            session.add(setting)
        session.commit()
        return setting
