"""001_initial_schema

Revision ID: 001_initial
Revises: 
Create Date: 2026-10-23 08:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. system_settings
    op.create_table(
        'system_settings',
        sa.Column('key', sa.String(length=64), primary_key=True, nullable=False),
        sa.Column('value', sa.JSON(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )

    # 2. targets
    op.create_table(
        'targets',
        sa.Column('id', sa.String(length=36), primary_key=True, nullable=False),
        sa.Column('name', sa.String(length=128), nullable=False),
        sa.Column('protocol', sa.String(length=16), nullable=False),
        sa.Column('host_or_url', sa.Text(), nullable=False),
        sa.Column('port', sa.Integer(), nullable=True),
        sa.Column('interval_seconds', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('timeout_seconds', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('consecutive_failure_threshold', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('current_state', sa.String(length=20), nullable=False, server_default='UP'),
        sa.Column('consecutive_failures', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('consecutive_successes', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_checked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_state_change_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('next_run_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('protocol_options', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False)
    )
    op.create_index('ix_targets_next_run_at', 'targets', ['next_run_at'])

    # 3. check_logs
    op.create_table(
        'check_logs',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('target_id', sa.String(length=36), sa.ForeignKey('targets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('checked_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_success', sa.Boolean(), nullable=False),
        sa.Column('response_time_ms', sa.Integer(), nullable=False),
        sa.Column('status_code', sa.Integer(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True)
    )
    op.create_index('ix_check_logs_target_id', 'check_logs', ['target_id'])
    op.create_index('ix_check_logs_checked_at', 'check_logs', ['checked_at'])
    op.create_index('ix_check_logs_target_checked', 'check_logs', ['target_id', 'checked_at'])

    # 4. alert_history
    op.create_table(
        'alert_history',
        sa.Column('id', sa.BigInteger(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('target_id', sa.String(length=36), sa.ForeignKey('targets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('triggered_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('alert_type', sa.String(length=16), nullable=False),
        sa.Column('recipient', sa.String(length=255), nullable=False),
        sa.Column('is_delivered', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('delivery_error', sa.Text(), nullable=True)
    )
    op.create_index('ix_alert_history_target_id', 'alert_history', ['target_id'])
    op.create_index('ix_alert_history_triggered_at', 'alert_history', ['triggered_at'])


def downgrade() -> None:
    op.drop_table('alert_history')
    op.drop_table('check_logs')
    op.drop_table('targets')
    op.drop_table('system_settings')
