"""add_citizen_desk_schema

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-10-11 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, Sequence[str], None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    # 1. Update users table with is_active and device_name
    user_cols = [c['name'] for c in insp.get_columns('users')]
    with op.batch_alter_table('users', schema=None) as batch_op:
        if 'is_active' not in user_cols:
            batch_op.add_column(sa.Column('is_active', sa.Boolean(), server_default='1', nullable=False))
        if 'device_name' not in user_cols:
            batch_op.add_column(sa.Column('device_name', sa.String(length=255), nullable=True))

    # 2. Update form_fields with is_sensitive_number
    ff_cols = [c['name'] for c in insp.get_columns('form_fields')]
    with op.batch_alter_table('form_fields', schema=None) as batch_op:
        if 'is_sensitive_number' not in ff_cols:
            batch_op.add_column(sa.Column('is_sensitive_number', sa.Boolean(), server_default='0', nullable=False))

    # 3. Update submissions table with channel, reference_number, retention, consent fields
    sub_cols = [c['name'] for c in insp.get_columns('submissions')]
    with op.batch_alter_table('submissions', schema=None) as batch_op:
        if 'reference_number' not in sub_cols:
            batch_op.add_column(sa.Column('reference_number', sa.String(length=32), nullable=True))
        if 'channel' not in sub_cols:
            batch_op.add_column(sa.Column('channel', sa.String(length=30), server_default='online', nullable=False))
        if 'assisted_by' not in sub_cols:
            batch_op.add_column(sa.Column('assisted_by', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_submissions_assisted_by', 'users', ['assisted_by'], ['id'], ondelete='SET NULL')
        if 'kiosk_id' not in sub_cols:
            batch_op.add_column(sa.Column('kiosk_id', sa.Integer(), nullable=True))
            batch_op.create_foreign_key('fk_submissions_kiosk_id', 'users', ['kiosk_id'], ['id'], ondelete='SET NULL')
        if 'consent_at' not in sub_cols:
            batch_op.add_column(sa.Column('consent_at', sa.DateTime(), nullable=True))
        if 'consent_noted_by' not in sub_cols:
            batch_op.add_column(sa.Column('consent_noted_by', sa.String(length=255), nullable=True))
        if 'language_chosen' not in sub_cols:
            batch_op.add_column(sa.Column('language_chosen', sa.String(length=10), server_default='ta', nullable=False))
        if 'retention_expires_at' not in sub_cols:
            batch_op.add_column(sa.Column('retention_expires_at', sa.DateTime(), nullable=True))
        if 'print_count' not in sub_cols:
            batch_op.add_column(sa.Column('print_count', sa.Integer(), server_default='0', nullable=False))

        sub_indexes = [idx['name'] for idx in insp.get_indexes('submissions')]
        if 'ix_submissions_reference_number' not in sub_indexes:
            batch_op.create_index('ix_submissions_reference_number', ['reference_number'], unique=True)
        if 'ix_submissions_retention_expires_at' not in sub_indexes:
            batch_op.create_index('ix_submissions_retention_expires_at', ['retention_expires_at'], unique=False)

    tables = insp.get_table_names()

    # 4. Create audit_logs table
    if 'audit_logs' not in tables:
        op.create_table(
            'audit_logs',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('actor_id', sa.Integer(), nullable=True),
            sa.Column('actor_role', sa.String(length=50), nullable=True),
            sa.Column('action', sa.String(length=50), nullable=False),
            sa.Column('target_type', sa.String(length=50), nullable=True),
            sa.Column('target_id', sa.String(length=100), nullable=True),
            sa.Column('details', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_audit_logs_id'), 'audit_logs', ['id'], unique=False)

    # 5. Create kiosk_help_requests table
    if 'kiosk_help_requests' not in tables:
        op.create_table(
            'kiosk_help_requests',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('kiosk_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
            sa.Column('kiosk_name', sa.String(length=255), nullable=True),
            sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('resolved_at', sa.DateTime(), nullable=True),
            sa.Column('resolved_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_kiosk_help_requests_id'), 'kiosk_help_requests', ['id'], unique=False)

def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'kiosk_help_requests' in tables:
        op.drop_index(op.f('ix_kiosk_help_requests_id'), table_name='kiosk_help_requests')
        op.drop_table('kiosk_help_requests')

    if 'audit_logs' in tables:
        op.drop_index(op.f('ix_audit_logs_id'), table_name='audit_logs')
        op.drop_table('audit_logs')

    with op.batch_alter_table('submissions', schema=None) as batch_op:
        try:
            batch_op.drop_constraint('fk_submissions_kiosk_id', type_='foreignkey')
            batch_op.drop_constraint('fk_submissions_assisted_by', type_='foreignkey')
        except Exception:
            pass
        try:
            batch_op.drop_index('ix_submissions_retention_expires_at')
            batch_op.drop_index('ix_submissions_reference_number')
        except Exception:
            pass
        for col in ['print_count', 'retention_expires_at', 'language_chosen', 'consent_noted_by', 'consent_at', 'kiosk_id', 'assisted_by', 'channel', 'reference_number']:
            try:
                batch_op.drop_column(col)
            except Exception:
                pass

    with op.batch_alter_table('form_fields', schema=None) as batch_op:
        try:
            batch_op.drop_column('is_sensitive_number')
        except Exception:
            pass

    with op.batch_alter_table('users', schema=None) as batch_op:
        for col in ['device_name', 'is_active']:
            try:
                batch_op.drop_column(col)
            except Exception:
                pass
