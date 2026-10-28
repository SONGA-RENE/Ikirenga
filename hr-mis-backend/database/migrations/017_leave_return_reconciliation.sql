BEGIN;

-- =====================================================
-- LEAVE RETURN STATUS
-- =====================================================

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS return_status
  character varying(25);

-- Existing records remain legacy because their actual
-- return-to-work history was not captured.
UPDATE leave_requests
SET return_status =
  COALESCE(
    return_status,
    'LEGACY'
  );

ALTER TABLE leave_requests
ALTER COLUMN return_status
  SET NOT NULL;

ALTER TABLE leave_requests
ALTER COLUMN return_status
  SET DEFAULT 'NOT_APPLICABLE';

ALTER TABLE leave_requests
DROP CONSTRAINT IF EXISTS
  valid_leave_request_return_status;

ALTER TABLE leave_requests
ADD CONSTRAINT
  valid_leave_request_return_status
CHECK (
  return_status IN (
    'LEGACY',
    'NOT_APPLICABLE',
    'AWAITING_RETURN',
    'RETURN_REPORTED',
    'RETURN_VERIFIED'
  )
);

CREATE INDEX IF NOT EXISTS
  leave_requests_return_queue_index
ON leave_requests(
  return_status,
  end_date,
  status
);

-- =====================================================
-- LEAVE RETURN AND RECALL RECORDS
-- =====================================================

CREATE TABLE IF NOT EXISTS
  leave_return_records (
    id integer
      GENERATED ALWAYS AS IDENTITY
      PRIMARY KEY,

    leave_request_id integer
      NOT NULL,

    return_type character varying(30)
      NOT NULL,

    actual_return_date date
      NOT NULL,

    actual_last_leave_date date
      NOT NULL,

    approved_working_days integer
      NOT NULL,

    consumed_working_days integer
      NOT NULL,

    unused_working_days integer
      GENERATED ALWAYS AS (
        approved_working_days -
        consumed_working_days
      ) STORED,

    balance_days_restored integer
      NOT NULL
      DEFAULT 0,

    expired_unused_days integer
      NOT NULL
      DEFAULT 0,

    return_reason text,

    status character varying(20)
      NOT NULL
      DEFAULT 'REPORTED',

    reported_by_user_id integer
      NOT NULL,

    reported_at
      timestamp with time zone
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    verified_by_user_id integer,

    verified_at
      timestamp with time zone,

    rejected_by_user_id integer,

    rejected_at
      timestamp with time zone,

    rejection_reason text,

    created_at
      timestamp with time zone
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    updated_at
      timestamp with time zone
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT
      unique_leave_return_record
    UNIQUE (leave_request_id),

    CONSTRAINT
      leave_return_request_fkey
    FOREIGN KEY (leave_request_id)
    REFERENCES leave_requests(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      leave_return_reported_by_fkey
    FOREIGN KEY (reported_by_user_id)
    REFERENCES app_users(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      leave_return_verified_by_fkey
    FOREIGN KEY (verified_by_user_id)
    REFERENCES app_users(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      leave_return_rejected_by_fkey
    FOREIGN KEY (rejected_by_user_id)
    REFERENCES app_users(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      valid_leave_return_type
    CHECK (
      return_type IN (
        'SCHEDULED_RETURN',
        'EMPLOYER_RECALL',
        'VOLUNTARY_EARLY_RETURN'
      )
    ),

    CONSTRAINT
      valid_leave_return_status
    CHECK (
      status IN (
        'REPORTED',
        'VERIFIED',
        'REJECTED'
      )
    ),

    CONSTRAINT
      valid_leave_return_dates
    CHECK (
      actual_return_date >
      actual_last_leave_date
    ),

    CONSTRAINT
      valid_leave_return_approved_days
    CHECK (
      approved_working_days > 0
    ),

    CONSTRAINT
      valid_leave_return_consumed_days
    CHECK (
      consumed_working_days >= 0
      AND consumed_working_days <=
        approved_working_days
    ),

    CONSTRAINT
      valid_leave_return_restored_days
    CHECK (
      balance_days_restored >= 0
      AND expired_unused_days >= 0
      AND balance_days_restored +
        expired_unused_days <=
        (
          approved_working_days -
          consumed_working_days
        )
    ),

    CONSTRAINT
      valid_leave_return_reason
    CHECK (
      return_type = 'SCHEDULED_RETURN'
      OR (
        return_reason IS NOT NULL
        AND LENGTH(
          TRIM(return_reason)
        ) >= 5
      )
    ),

    CONSTRAINT
      valid_leave_return_decision
    CHECK (
      (
        status = 'REPORTED'
        AND verified_by_user_id IS NULL
        AND verified_at IS NULL
        AND rejected_by_user_id IS NULL
        AND rejected_at IS NULL
        AND rejection_reason IS NULL
      )
      OR
      (
        status = 'VERIFIED'
        AND verified_by_user_id
          IS NOT NULL
        AND verified_at IS NOT NULL
        AND rejected_by_user_id IS NULL
        AND rejected_at IS NULL
        AND rejection_reason IS NULL
      )
      OR
      (
        status = 'REJECTED'
        AND verified_by_user_id IS NULL
        AND verified_at IS NULL
        AND rejected_by_user_id
          IS NOT NULL
        AND rejected_at IS NOT NULL
        AND rejection_reason IS NOT NULL
        AND LENGTH(
          TRIM(rejection_reason)
        ) >= 5
      )
    )
  );

CREATE INDEX IF NOT EXISTS
  leave_returns_status_queue_index
ON leave_return_records(
  status,
  actual_return_date
);

CREATE INDEX IF NOT EXISTS
  leave_returns_reported_by_index
ON leave_return_records(
  reported_by_user_id,
  reported_at
);

-- =====================================================
-- RETURN ACTION AUDIT
-- =====================================================

CREATE TABLE IF NOT EXISTS
  leave_return_actions (
    id integer
      GENERATED ALWAYS AS IDENTITY
      PRIMARY KEY,

    leave_return_record_id integer
      NOT NULL,

    leave_request_id integer
      NOT NULL,

    action character varying(20)
      NOT NULL,

    comment text,

    action_by_user_id integer
      NOT NULL,

    acted_at
      timestamp with time zone
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT
      leave_return_action_record_fkey
    FOREIGN KEY (
      leave_return_record_id
    )
    REFERENCES leave_return_records(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      leave_return_action_request_fkey
    FOREIGN KEY (leave_request_id)
    REFERENCES leave_requests(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      leave_return_action_user_fkey
    FOREIGN KEY (action_by_user_id)
    REFERENCES app_users(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      valid_leave_return_action
    CHECK (
      action IN (
        'REPORTED',
        'VERIFIED',
        'REJECTED',
        'CORRECTED'
      )
    ),

    CONSTRAINT
      valid_leave_return_action_comment
    CHECK (
      action <> 'REJECTED'
      OR (
        comment IS NOT NULL
        AND LENGTH(TRIM(comment)) >= 5
      )
    )
  );

CREATE INDEX IF NOT EXISTS
  leave_return_actions_history_index
ON leave_return_actions(
  leave_request_id,
  acted_at
);

COMMIT;