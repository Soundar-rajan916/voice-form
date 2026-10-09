"""add_document_upload_and_proposals

Revision ID: d1e2f3a4b5c6
Revises: f6999aa43ce4
Create Date: 2026-10-09 15:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, Sequence[str], None] = 'f6999aa43ce4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Add allow_document_upload to forms table
    with op.batch_alter_table('forms', schema=None) as batch_op:
        batch_op.add_column(sa.Column('allow_document_upload', sa.Boolean(), server_default='1', nullable=False))

    # 2. Add source, evidence, source_confidence to submission_answers table
    with op.batch_alter_table('submission_answers', schema=None) as batch_op:
        batch_op.add_column(sa.Column('source', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('evidence', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('source_confidence', sa.Float(), nullable=True))

    # 3. Create submission_proposals table
    op.create_table(
        'submission_proposals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('submission_id', sa.Integer(), sa.ForeignKey('submissions.id', ondelete='CASCADE'), nullable=False),
        sa.Column('field_id', sa.Integer(), sa.ForeignKey('form_fields.id', ondelete='CASCADE'), nullable=False),
        sa.Column('value', sa.Text(), nullable=False),
        sa.Column('confidence', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('evidence', sa.Text(), nullable=True),
        sa.Column('page', sa.Integer(), nullable=True),
        sa.Column('read_method', sa.String(length=50), nullable=False, server_default='text_layer'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='pending'),
        sa.Column('alternatives', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_submission_proposals_id'), 'submission_proposals', ['id'], unique=False)

def downgrade() -> None:
    op.drop_index(op.f('ix_submission_proposals_id'), table_name='submission_proposals')
    op.drop_table('submission_proposals')

    with op.batch_alter_table('submission_answers', schema=None) as batch_op:
        batch_op.drop_column('source_confidence')
        batch_op.drop_column('evidence')
        batch_op.drop_column('source')

    with op.batch_alter_table('forms', schema=None) as batch_op:
        batch_op.drop_column('allow_document_upload')
