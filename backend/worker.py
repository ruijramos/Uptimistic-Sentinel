import logging
import signal
import sys
from app import create_app
from app.extensions import db
from app.services.settings_service import SettingsService
from app.worker.scheduler import SentinelWorker

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
    )
    logger = logging.getLogger("sentinel.worker")
    logger.info("Starting Sentinel dedicated background worker...")

    app = create_app()
    with app.app_context():
        with db.get_session() as session:
            SettingsService.seed_defaults(session)

        worker = SentinelWorker(max_concurrent_probes=25)

        def handle_signal(sig, frame):
            logger.info("Shutdown signal received (%s). Exiting worker...", sig)
            worker.stop()
            sys.exit(0)

        signal.signal(signal.SIGINT, handle_signal)
        signal.signal(signal.SIGTERM, handle_signal)

        worker.start()
