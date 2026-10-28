-- database/migrations/018_leave_workflow_approvers.sql

BEGIN;

CREATE TABLE leave_workflow_approvers (
  id integer
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  authority_stage character varying(20)
    NOT NULL,

  user_id integer
    NOT NULL,

  is_active boolean
    NOT NULL
    DEFAULT TRUE,

  effective_from date
    NOT NULL
    DEFAULT CURRENT_DATE,

  effective_to date,

  assigned_by_user_id integer,

  assignment_note text,

  created_at timestamp with time zone
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at timestamp with time zone
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT leave_workflow_approver_user_fkey
    FOREIGN KEY (user_id)
    REFERENCES app_users(id)
    ON DELETE RESTRICT,

  CONSTRAINT leave_workflow_approver_assigned_by_fkey
    FOREIGN KEY (assigned_by_user_id)
    REFERENCES app_users(id)
    ON DELETE SET NULL,

  CONSTRAINT valid_leave_workflow_authority_stage
    CHECK (
      authority_stage IN (
        'HR',
        'CEO',
        'CHAIRMAN'
      )
    ),

  CONSTRAINT valid_leave_workflow_approver_dates
    CHECK (
      effective_to IS NULL
      OR effective_to >= effective_from
    )
);

CREATE UNIQUE INDEX
  one_active_leave_approver_per_stage
ON leave_workflow_approvers(authority_stage)
WHERE is_active = TRUE;

CREATE INDEX
  leave_workflow_approver_user_index
ON leave_workflow_approvers(user_id);

CREATE INDEX
  leave_workflow_approver_effective_dates_index
ON leave_workflow_approvers(
  authority_stage,
  effective_from,
  effective_to
);

COMMIT;