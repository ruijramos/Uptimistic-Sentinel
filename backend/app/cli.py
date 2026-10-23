import click
import logging
import signal
import sys
from flask import Blueprint
from app.extensions import db
from app.services.settings_service import SettingsService
from app.worker.scheduler import SentinelWorker
from app.worker.maintenance import prune_old_check_logs

cli_bp = Blueprint("sentinel_cli", __name__, cli_group=None)
logger = logging.getLogger("sentinel.cli")


@cli_bp.cli.command("run-worker")
@click.option("--concurrency", default=25, help="Number of concurrent prober threads")
def run_worker_command(concurrency):
    """Starts the dedicated Sentinel background monitor worker process."""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
    )
    logger.info("Initializing Sentinel background worker (concurrency=%d)...", concurrency)

    # Ensure default settings are seeded
    with db.get_session() as session:
        SettingsService.seed_defaults(session)

    worker = SentinelWorker(max_concurrent_probes=concurrency)

    def handle_signal(sig, frame):
        logger.info("Shutdown signal received (%s). Exiting worker...", sig)
        worker.stop()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    worker.start()


@cli_bp.cli.command("prune-logs")
def prune_logs_command():
    """Runs manual check logs retention pruning immediately."""
    with db.get_session() as session:
        deleted = prune_old_check_logs(session)
        click.echo(f"Successfully pruned {deleted} check log entries.")


@cli_bp.cli.command("seed-settings")
def seed_settings_command():
    """Seeds default dynamic settings into the database."""
    with db.get_session() as session:
        SettingsService.seed_defaults(session)
        click.echo("Default settings seeded successfully.")
