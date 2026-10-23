import time
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from sqlalchemy import select, and_

from app.extensions import db
from app.models.base import utc_now
from app.models.target import Target
from app.worker.probers import run_probe
from app.services.state_machine import evaluate_target_result
from app.worker.maintenance import prune_old_check_logs

logger = logging.getLogger("sentinel.worker")


class SentinelWorker:
    """
    Dedicated background worker process that polls and executes target probes concurrently.
    Guarantees no thread starvation and safe concurrency without duplicate checks.
    """

    def __init__(self, max_concurrent_probes: int = 25):
        self.max_concurrent_probes = max_concurrent_probes
        self.executor = ThreadPoolExecutor(max_workers=max_concurrent_probes, thread_name_prefix="prober-")
        self.is_running = False
        self._last_maintenance_at = 0.0

    def start(self):
        """Main execution loop of the background worker."""
        logger.info("Starting Uptimistic-Sentinel background worker with %d probe threads", self.max_concurrent_probes)
        self.is_running = True

        while self.is_running:
            try:
                self._poll_and_dispatch()
                self._check_maintenance()
            except Exception as e:
                logger.error("Unexpected error in worker loop: %s", str(e), exc_info=True)

            # Rest briefly before next polling tick
            time.sleep(1.0)

    def stop(self):
        """Stops the worker loop gracefully."""
        logger.info("Stopping background worker...")
        self.is_running = False
        self.executor.shutdown(wait=True)
        logger.info("Worker stopped successfully.")

    def _poll_and_dispatch(self):
        """Fetches active targets due for execution and dispatches them to thread pool."""
        now = utc_now()
        due_targets_info = []

        with db.get_session() as session:
            # Query targets that are active and whose next_run_at is reached
            stmt = select(Target).where(
                and_(
                    Target.is_active.is_(True),
                    (Target.next_run_at <= now) | (Target.next_run_at.is_(None))
                )
            ).limit(self.max_concurrent_probes * 2)

            due_targets = session.execute(stmt).scalars().all()

            for target in due_targets:
                # Eagerly update next_run_at to avoid re-claiming on next tick while check is in-flight
                target.next_run_at = now + timedelta(seconds=target.interval_seconds)
                due_targets_info.append(target.id)

        # Dispatch probe checks asynchronously across the thread pool
        for target_id in due_targets_info:
            self.executor.submit(self._execute_single_target_probe, target_id)

    def _execute_single_target_probe(self, target_id: str):
        """Worker thread entry point for an individual target check."""
        with db.get_session() as session:
            target = session.execute(
                select(Target).where(Target.id == target_id)
            ).scalar_one_or_none()

            if not target or not target.is_active:
                return

            try:
                # Perform network probe (HTTP / TCP / ICMP)
                result = run_probe(target)

                # Process state machine transition & alerting
                evaluate_target_result(session, target, result)

            except Exception as e:
                logger.error("Error executing probe for target %s: %s", target_id, str(e), exc_info=True)

    def _check_maintenance(self):
        """Runs periodic log retention pruning once every 24 hours."""
        now_ts = time.time()
        # 86400 seconds = 24 hours
        if now_ts - self._last_maintenance_at > 86400:
            try:
                with db.get_session() as session:
                    prune_old_check_logs(session)
                self._last_maintenance_at = now_ts
            except Exception as e:
                logger.error("Error running scheduled maintenance: %s", str(e))
