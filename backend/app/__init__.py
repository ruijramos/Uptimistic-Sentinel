import logging
from flask import Flask, jsonify
from app.config import settings
from app.extensions import db, cors
from app.api import targets_bp, logs_bp, settings_bp
from app.cli import cli_bp
from app.services.settings_service import SettingsService

logger = logging.getLogger("sentinel.app")


def create_app(test_config=None) -> Flask:
    """
    Application Factory for Uptimistic-Sentinel.
    Configures SQLAlchemy 2.0, CORS, REST Blueprints, and CLI commands.
    """
    app = Flask(__name__)

    # Base configuration from settings
    app.config["SECRET_KEY"] = settings.FLASK_SECRET_KEY
    app.config["DATABASE_URL"] = settings.DATABASE_URL
    app.config["FLASK_DEBUG"] = settings.FLASK_DEBUG

    if test_config:
        app.config.update(test_config)

    # Initialize extensions
    db.init_app(app)
    cors.init_app(
        app,
        origins=settings.cors_origin_list,
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    )

    # Register API blueprints
    app.register_blueprint(targets_bp)
    app.register_blueprint(logs_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(cli_bp)

    @app.route("/api/health", methods=["GET"])
    def health_check():
        """Basic service health check."""
        return jsonify({
            "status": "healthy",
            "service": "Uptimistic-Sentinel",
            "version": "1.0.0"
        }), 200

    # Attempt to seed default dynamic settings if database is ready
    with app.app_context():
        try:
            with db.get_session() as session:
                SettingsService.seed_defaults(session)
        except Exception:
            # Table might not exist yet before first migration
            pass

    return app
