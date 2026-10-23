import os
import pytest
from app import create_app
from app.extensions import db
from app.models.base import Base


@pytest.fixture(scope="session")
def app():
    """Create test Flask application with in-memory SQLite database."""
    test_config = {
        "TESTING": True,
        "DATABASE_URL": "sqlite:///:memory:",
        "FLASK_SECRET_KEY": "test-secret-key",
        "FLASK_DEBUG": False,
    }
    app = create_app(test_config)

    with app.app_context():
        # Create all tables in in-memory database
        Base.metadata.create_all(db.engine)
        yield app
        Base.metadata.drop_all(db.engine)


@pytest.fixture(scope="function")
def client(app):
    """A test client for the app."""
    return app.test_client()


@pytest.fixture(scope="function")
def db_session(app):
    """Provides a transactional database session that resets after each test."""
    with app.app_context():
        # Clear existing rows to isolate test functions
        with db.get_session() as session:
            for table in reversed(Base.metadata.sorted_tables):
                session.execute(table.delete())
        yield db.session
