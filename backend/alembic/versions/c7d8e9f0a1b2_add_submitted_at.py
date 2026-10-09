"""Add submitted_at to submissions and backfill from completed_at

Revision ID: c7d8e9f0a1b2
Revises: bb6eddec4f9c
Create Date: 2026-10-08 16:56:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, Sequence[str], None] = 'bb6eddec4f9c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    with op.batch_alter_table('submissions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('submitted_at', sa.DateTime(), nullable=True))

    # Backfill submitted_at from completed_at and update status 'completed' -> 'submitted'
    op.execute(
        "UPDATE submissions SET submitted_at = completed_at, status = 'submitted' WHERE status = 'completed' OR completed_at IS NOT NULL"
    )

def downgrade() -> None:
    op.execute(
        "UPDATE submissions SET completed_at = submitted_at, status = 'completed' WHERE status = 'submitted' OR submitted_at IS NOT NULL"
    )
    with op.batch_alter_table('submissions', schema=None) as batch_op:
        batch_op.drop_column('submitted_at')
