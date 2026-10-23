from contextlib import contextmanager
from typing import Generator
from flask import g
from flask_cors import CORS
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, scoped_session
from app.config import settings
from app.models.base import Base

cors = CORS()


class Database:
    """
    SQLAlchemy 2.0 database management utility supporting both
    Flask request context and standalone worker processes.
    """

    def __init__(self):
        self.engine = None
        self._session_factory = None
        self.scoped_session = None

    def init_app(self, app):
        db_url = app.config.get("DATABASE_URL", settings.DATABASE_URL)
        
        # Configure connection pool
        pool_kwargs = {
            "echo": app.config.get("FLASK_DEBUG", False),
            "pool_pre_ping": True,
        }
        if "sqlite" in db_url:
            # SQLite does not support standard pool size / max overflow
            from sqlalchemy.pool import StaticPool
            if ":memory:" in db_url:
                pool_kwargs["connect_args"] = {"check_same_thread": False}
                pool_kwargs["poolclass"] = StaticPool
        else:
            pool_kwargs.update({
                "pool_size": 10,
                "max_overflow": 20,
                "pool_recycle": 1800,
            })

        self.engine = create_engine(db_url, **pool_kwargs)
        self._session_factory = sessionmaker(
            bind=self.engine,
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )
        self.scoped_session = scoped_session(self._session_factory)

        # Register teardown hook to clean up request sessions
        @app.teardown_appcontext
        def cleanup_session(exception=None):
            if hasattr(g, "_db_session"):
                g._db_session.close()
            self.scoped_session.remove()

    @property
    def session(self) -> Session:
        """
        Retrieves the session for the current Flask request or thread context.
        """
        if not hasattr(g, "_db_session"):
            g._db_session = self._session_factory()
        return g._db_session

    @contextmanager
    def get_session(self) -> Generator[Session, None, None]:
        """
        Context manager for standalone background worker processes and CLI commands.
        Ensures proper commit, rollback on error, and session closure.
        """
        if not self._session_factory:
            raise RuntimeError("Database engine has not been initialized. Call init_app first.")
        session: Session = self._session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    def create_all(self):
        """Creates all tables directly (useful for tests and sqlite)."""
        if self.engine:
            Base.metadata.create_all(self.engine)

    def drop_all(self):
        """Drops all tables directly."""
        if self.engine:
            Base.metadata.drop_all(self.engine)


db = Database()
