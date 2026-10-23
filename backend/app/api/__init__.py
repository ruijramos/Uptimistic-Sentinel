from flask import Blueprint
from app.api.routes_targets import targets_bp
from app.api.routes_logs import logs_bp
from app.api.routes_settings import settings_bp

__all__ = ["targets_bp", "logs_bp", "settings_bp"]
