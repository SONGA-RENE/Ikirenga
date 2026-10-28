BEGIN;

-- =====================================================
-- LEAVE TYPE POLICY METADATA
-- =====================================================

ALTER TABLE leave_types
ADD COLUMN IF NOT EXISTS entitlement_mode
  character varying(30);

ALTER TABLE leave_types
ADD COLUMN IF NOT EXISTS duration_value
  integer;

ALTER TABLE leave_types
ADD COLUMN IF NOT EXISTS duration_unit
  character varying(30);

ALTER TABLE leave_types
ADD COLUMN IF NOT EXISTS eligible_gender
  character varying(20);

ALTER TABLE leave_types
ADD COLUMN IF NOT EXISTS carry_forward_years
  integer;

-- Existing leave-type policies.
UPDATE leave_types
SET
  entitlement_mode = 'ANNUAL_BUCKET',
  duration_value = NULL,
  duration_unit = 'WORKING_DAYS',
  eligible_gender = 'ANY',
  carry_forward_years = 2
WHERE code = 'ANNUAL';

UPDATE leave_types
SET
  entitlement_mode = 'NO_BALANCE',
  duration_value = NULL,
  duration_unit = 'REQUESTED_PERIOD',
  eligible_gender = 'ANY',
  carry_forward_years = 0
WHERE code = 'SICK';

-- Safe defaults for any other existing leave types.
UPDATE leave_types
SET
  entitlement_mode =
    COALESCE(
      entitlement_mode,
      CASE
        WHEN annual_entitlement IS NOT NULL
          THEN 'ANNUAL_BUCKET'
        ELSE 'NO_BALANCE'
      END
    ),

  duration_unit =
    COALESCE(
      duration_unit,
      CASE
        WHEN annual_entitlement IS NOT NULL
          THEN 'WORKING_DAYS'
        ELSE 'REQUESTED_PERIOD'
      END
    ),

  eligible_gender =
    COALESCE(
      eligible_gender,
      'ANY'
    ),

  carry_forward_years =
    COALESCE(
      carry_forward_years,
      0
    );

-- Maternity leave: three calendar months.
INSERT INTO leave_types (
  code,
  name,
  annual_entitlement,
  is_paid,
  requires_attachment,
  is_active,
  entitlement_mode,
  duration_value,
  duration_unit,
  eligible_gender,
  carry_forward_years
)
VALUES (
  'MATERNITY',
  'Maternity Leave',
  NULL,
  TRUE,
  FALSE,
  TRUE,
  'FIXED_DURATION',
  3,
  'CALENDAR_MONTHS',
  'FEMALE',
  0
)
ON CONFLICT (code)
DO UPDATE SET
  name = EXCLUDED.name,
  annual_entitlement =
    EXCLUDED.annual_entitlement,
  is_paid = EXCLUDED.is_paid,
  requires_attachment =
    EXCLUDED.requires_attachment,
  is_active = EXCLUDED.is_active,
  entitlement_mode =
    EXCLUDED.entitlement_mode,
  duration_value =
    EXCLUDED.duration_value,
  duration_unit =
    EXCLUDED.duration_unit,
  eligible_gender =
    EXCLUDED.eligible_gender,
  carry_forward_years =
    EXCLUDED.carry_forward_years;

-- Paternity leave: five working days.
INSERT INTO leave_types (
  code,
  name,
  annual_entitlement,
  is_paid,
  requires_attachment,
  is_active,
  entitlement_mode,
  duration_value,
  duration_unit,
  eligible_gender,
  carry_forward_years
)
VALUES (
  'PATERNITY',
  'Paternity Leave',
  NULL,
  TRUE,
  FALSE,
  TRUE,
  'FIXED_DURATION',
  5,
  'WORKING_DAYS',
  'MALE',
  0
)
ON CONFLICT (code)
DO UPDATE SET
  name = EXCLUDED.name,
  annual_entitlement =
    EXCLUDED.annual_entitlement,
  is_paid = EXCLUDED.is_paid,
  requires_attachment =
    EXCLUDED.requires_attachment,
  is_active = EXCLUDED.is_active,
  entitlement_mode =
    EXCLUDED.entitlement_mode,
  duration_value =
    EXCLUDED.duration_value,
  duration_unit =
    EXCLUDED.duration_unit,
  eligible_gender =
    EXCLUDED.eligible_gender,
  carry_forward_years =
    EXCLUDED.carry_forward_years;

ALTER TABLE leave_types
ALTER COLUMN entitlement_mode
  SET NOT NULL;

ALTER TABLE leave_types
ALTER COLUMN eligible_gender
  SET NOT NULL;

ALTER TABLE leave_types
ALTER COLUMN carry_forward_years
  SET NOT NULL;

ALTER TABLE leave_types
ALTER COLUMN entitlement_mode
  SET DEFAULT 'NO_BALANCE';

ALTER TABLE leave_types
ALTER COLUMN duration_unit
  SET DEFAULT 'REQUESTED_PERIOD';

ALTER TABLE leave_types
ALTER COLUMN eligible_gender
  SET DEFAULT 'ANY';

ALTER TABLE leave_types
ALTER COLUMN carry_forward_years
  SET DEFAULT 0;

ALTER TABLE leave_types
DROP CONSTRAINT IF EXISTS
  valid_leave_entitlement_mode;

ALTER TABLE leave_types
ADD CONSTRAINT
  valid_leave_entitlement_mode
CHECK (
  entitlement_mode IN (
    'ANNUAL_BUCKET',
    'FIXED_DURATION',
    'NO_BALANCE'
  )
);

ALTER TABLE leave_types
DROP CONSTRAINT IF EXISTS
  valid_leave_duration_unit;

ALTER TABLE leave_types
ADD CONSTRAINT
  valid_leave_duration_unit
CHECK (
  duration_unit IN (
    'WORKING_DAYS',
    'CALENDAR_DAYS',
    'CALENDAR_MONTHS',
    'REQUESTED_PERIOD'
  )
);

ALTER TABLE leave_types
DROP CONSTRAINT IF EXISTS
  valid_leave_eligible_gender;

ALTER TABLE leave_types
ADD CONSTRAINT
  valid_leave_eligible_gender
CHECK (
  eligible_gender IN (
    'ANY',
    'MALE',
    'FEMALE'
  )
);

ALTER TABLE leave_types
DROP CONSTRAINT IF EXISTS
  valid_leave_duration_value;

ALTER TABLE leave_types
ADD CONSTRAINT
  valid_leave_duration_value
CHECK (
  duration_value IS NULL
  OR duration_value > 0
);

ALTER TABLE leave_types
DROP CONSTRAINT IF EXISTS
  valid_leave_carry_forward_years;

ALTER TABLE leave_types
ADD CONSTRAINT
  valid_leave_carry_forward_years
CHECK (
  carry_forward_years >= 0
  AND carry_forward_years <= 10
);

ALTER TABLE leave_types
DROP CONSTRAINT IF EXISTS
  valid_leave_policy_configuration;

ALTER TABLE leave_types
ADD CONSTRAINT
  valid_leave_policy_configuration
CHECK (
  (
    entitlement_mode = 'ANNUAL_BUCKET'
    AND annual_entitlement IS NOT NULL
    AND duration_value IS NULL
    AND duration_unit = 'WORKING_DAYS'
  )
  OR
  (
    entitlement_mode = 'FIXED_DURATION'
    AND annual_entitlement IS NULL
    AND duration_value IS NOT NULL
    AND duration_unit IN (
      'WORKING_DAYS',
      'CALENDAR_DAYS',
      'CALENDAR_MONTHS'
    )
    AND carry_forward_years = 0
  )
  OR
  (
    entitlement_mode = 'NO_BALANCE'
    AND annual_entitlement IS NULL
    AND duration_value IS NULL
    AND duration_unit =
      'REQUESTED_PERIOD'
    AND carry_forward_years = 0
  )
);

-- =====================================================
-- POSITION LEAVE APPROVAL ROUTING
-- =====================================================

ALTER TABLE positions
ADD COLUMN IF NOT EXISTS
  leave_approval_route
    character varying(30)
    NOT NULL
    DEFAULT 'STANDARD';

ALTER TABLE positions
DROP CONSTRAINT IF EXISTS
  valid_position_leave_approval_route;

ALTER TABLE positions
ADD CONSTRAINT
  valid_position_leave_approval_route
CHECK (
  leave_approval_route IN (
    'STANDARD',
    'CEO_APPROVAL',
    'CHAIRMAN_APPROVAL'
  )
);

-- CEO leave requires HR verification followed by
-- Chairman approval.
UPDATE positions
SET leave_approval_route =
  'CHAIRMAN_APPROVAL'
WHERE position_code = 'CEO-001';

-- Everyone assigned directly to CEO's Office,
-- except the CEO, requires HR verification and
-- CEO final approval.
UPDATE positions
SET leave_approval_route =
  'CEO_APPROVAL'
WHERE department_id = (
  SELECT id
  FROM departments
  WHERE name = 'CEO''s Office'
  ORDER BY id
  LIMIT 1
)
AND position_code <> 'CEO-001';

-- Directors and Executive Directors also require
-- HR verification followed by CEO approval.
-- This is a one-time data classification. Runtime
-- code will read leave_approval_route and will not
-- inspect job-title text.
UPDATE positions
SET leave_approval_route =
  'CEO_APPROVAL'
WHERE
  position_code <> 'CEO-001'
  AND (
    title ILIKE 'Director of %'
    OR title ILIKE 'Executive Director%'
    OR title =
      'Deputy Chief Executive Officer'
  );

CREATE INDEX IF NOT EXISTS
  positions_leave_approval_route_index
ON positions(leave_approval_route)
WHERE is_active = TRUE;

-- =====================================================
-- LEAVE REQUEST WORKFLOW SNAPSHOT
-- =====================================================

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS
  workflow_version integer
  NOT NULL
  DEFAULT 1;

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS
  approval_route
    character varying(30);

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS
  current_stage
    character varying(20);

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS
  submitted_by_user_id integer;

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS
  submitted_at
    timestamp with time zone;

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS
  final_approved_by_user_id integer;

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS
  final_approved_at
    timestamp with time zone;

-- Preserve existing records as legacy workflow.
UPDATE leave_requests
SET
  workflow_version = 1,
  approval_route =
    COALESCE(
      approval_route,
      'LEGACY'
    ),

  current_stage =
    COALESCE(
      current_stage,
      CASE
        WHEN status = 'PENDING'
          THEN 'LEGACY_REVIEW'
        ELSE 'COMPLETE'
      END
    ),

  submitted_at =
    COALESCE(
      submitted_at,
      created_at
    ),

  final_approved_by_user_id =
    CASE
      WHEN status = 'APPROVED'
      THEN COALESCE(
        final_approved_by_user_id,
        decided_by_user_id
      )
      ELSE final_approved_by_user_id
    END,

  final_approved_at =
    CASE
      WHEN status = 'APPROVED'
      THEN COALESCE(
        final_approved_at,
        decision_at
      )
      ELSE final_approved_at
    END;

ALTER TABLE leave_requests
DROP CONSTRAINT IF EXISTS
  valid_leave_workflow_version;

ALTER TABLE leave_requests
ADD CONSTRAINT
  valid_leave_workflow_version
CHECK (
  workflow_version IN (1, 2)
);

ALTER TABLE leave_requests
DROP CONSTRAINT IF EXISTS
  valid_leave_request_approval_route;

ALTER TABLE leave_requests
ADD CONSTRAINT
  valid_leave_request_approval_route
CHECK (
  approval_route IS NULL
  OR approval_route IN (
    'LEGACY',
    'STANDARD',
    'CEO_APPROVAL',
    'CHAIRMAN_APPROVAL'
  )
);

ALTER TABLE leave_requests
DROP CONSTRAINT IF EXISTS
  valid_leave_request_current_stage;

ALTER TABLE leave_requests
ADD CONSTRAINT
  valid_leave_request_current_stage
CHECK (
  current_stage IS NULL
  OR current_stage IN (
    'LEGACY_REVIEW',
    'SUPERVISOR',
    'HR',
    'CEO',
    'CHAIRMAN',
    'COMPLETE'
  )
);

ALTER TABLE leave_requests
DROP CONSTRAINT IF EXISTS
  leave_requests_submitted_by_fkey;

ALTER TABLE leave_requests
ADD CONSTRAINT
  leave_requests_submitted_by_fkey
FOREIGN KEY (submitted_by_user_id)
REFERENCES app_users(id)
ON DELETE SET NULL;

ALTER TABLE leave_requests
DROP CONSTRAINT IF EXISTS
  leave_requests_final_approved_by_fkey;

ALTER TABLE leave_requests
ADD CONSTRAINT
  leave_requests_final_approved_by_fkey
FOREIGN KEY (final_approved_by_user_id)
REFERENCES app_users(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS
  leave_requests_workflow_queue_index
ON leave_requests(
  status,
  current_stage,
  approval_route
);

-- =====================================================
-- LEAVE APPROVAL REQUIREMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS
  leave_approval_requirements (
    id integer
      GENERATED ALWAYS AS IDENTITY
      PRIMARY KEY,

    leave_request_id integer
      NOT NULL,

    stage character varying(20)
      NOT NULL,

    sequence_order integer
      NOT NULL,

    assigned_user_id integer
      NOT NULL,

    status character varying(20)
      NOT NULL
      DEFAULT 'WAITING',

    completed_by_user_id integer,

    completed_at
      timestamp with time zone,

    created_at
      timestamp with time zone
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    updated_at
      timestamp with time zone
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT
      leave_requirement_request_fkey
    FOREIGN KEY (leave_request_id)
    REFERENCES leave_requests(id)
    ON DELETE CASCADE,

    CONSTRAINT
      leave_requirement_assigned_user_fkey
    FOREIGN KEY (assigned_user_id)
    REFERENCES app_users(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      leave_requirement_completed_user_fkey
    FOREIGN KEY (completed_by_user_id)
    REFERENCES app_users(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      valid_leave_requirement_stage
    CHECK (
      stage IN (
        'SUPERVISOR',
        'HR',
        'CEO',
        'CHAIRMAN'
      )
    ),

    CONSTRAINT
      valid_leave_requirement_sequence
    CHECK (
      sequence_order > 0
    ),

    CONSTRAINT
      valid_leave_requirement_status
    CHECK (
      status IN (
        'WAITING',
        'PENDING',
        'APPROVED',
        'REJECTED',
        'CANCELLED'
      )
    ),

    CONSTRAINT
      valid_leave_requirement_completion
    CHECK (
      (
        status IN (
          'WAITING',
          'PENDING'
        )
        AND completed_by_user_id
          IS NULL
        AND completed_at IS NULL
      )
      OR
      (
        status IN (
          'APPROVED',
          'REJECTED',
          'CANCELLED'
        )
        AND completed_by_user_id
          IS NOT NULL
        AND completed_at
          IS NOT NULL
      )
    ),

    CONSTRAINT
      unique_leave_requirement_sequence
    UNIQUE (
      leave_request_id,
      sequence_order
    ),

    CONSTRAINT
      unique_leave_requirement_stage
    UNIQUE (
      leave_request_id,
      stage
    )
  );

CREATE INDEX IF NOT EXISTS
  leave_requirements_assignee_queue_index
ON leave_approval_requirements(
  assigned_user_id,
  status,
  sequence_order
);

CREATE INDEX IF NOT EXISTS
  leave_requirements_request_status_index
ON leave_approval_requirements(
  leave_request_id,
  status
);

-- =====================================================
-- LEAVE APPROVAL ACTION AUDIT
-- =====================================================

CREATE TABLE IF NOT EXISTS
  leave_approval_actions (
    id integer
      GENERATED ALWAYS AS IDENTITY
      PRIMARY KEY,

    leave_request_id integer
      NOT NULL,

    requirement_id integer
      NOT NULL,

    stage character varying(20)
      NOT NULL,

    decision character varying(20)
      NOT NULL,

    comment text,

    action_by_user_id integer
      NOT NULL,

    delegation_id integer,

    acted_at
      timestamp with time zone
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT
      leave_action_request_fkey
    FOREIGN KEY (leave_request_id)
    REFERENCES leave_requests(id)
    ON DELETE CASCADE,

    CONSTRAINT
      leave_action_requirement_fkey
    FOREIGN KEY (requirement_id)
    REFERENCES leave_approval_requirements(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      leave_action_user_fkey
    FOREIGN KEY (action_by_user_id)
    REFERENCES app_users(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      leave_action_delegation_fkey
    FOREIGN KEY (delegation_id)
    REFERENCES approval_delegations(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      valid_leave_action_stage
    CHECK (
      stage IN (
        'SUPERVISOR',
        'HR',
        'CEO',
        'CHAIRMAN'
      )
    ),

    CONSTRAINT
      valid_leave_action_decision
    CHECK (
      decision IN (
        'APPROVED',
        'REJECTED'
      )
    ),

    CONSTRAINT
      valid_leave_action_comment
    CHECK (
      decision <> 'REJECTED'
      OR (
        comment IS NOT NULL
        AND LENGTH(TRIM(comment)) >= 5
      )
    )
  );

CREATE INDEX IF NOT EXISTS
  leave_actions_request_history_index
ON leave_approval_actions(
  leave_request_id,
  acted_at
);

CREATE INDEX IF NOT EXISTS
  leave_actions_user_history_index
ON leave_approval_actions(
  action_by_user_id,
  acted_at
);

COMMIT;