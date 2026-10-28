BEGIN;

-- =====================================================
-- CANCELLATION STATUS ON LEAVE REQUEST
-- =====================================================

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS
  cancellation_status
  character varying(20)
  NOT NULL
  DEFAULT 'NONE';

ALTER TABLE leave_requests
DROP CONSTRAINT IF EXISTS
  valid_leave_request_cancellation_status;

ALTER TABLE leave_requests
ADD CONSTRAINT
  valid_leave_request_cancellation_status
CHECK (
  cancellation_status IN (
    'NONE',
    'PENDING',
    'APPROVED',
    'REJECTED'
  )
);

-- =====================================================
-- LEAVE CANCELLATION REQUESTS
-- =====================================================

CREATE TABLE leave_cancellation_requests (
  id integer
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  leave_request_id integer
    NOT NULL,

  cancellation_reason text
    NOT NULL,

  status character varying(20)
    NOT NULL
    DEFAULT 'PENDING',

  requested_by_user_id integer
    NOT NULL,

  requested_at timestamp with time zone
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  decided_by_user_id integer,

  decided_at timestamp with time zone,

  decision_note text,

  released_days integer
    NOT NULL
    DEFAULT 0,

  created_at timestamp with time zone
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at timestamp with time zone
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT
    leave_cancellation_request_leave_fkey
  FOREIGN KEY (leave_request_id)
  REFERENCES leave_requests(id)
  ON DELETE RESTRICT,

  CONSTRAINT
    leave_cancellation_requested_by_fkey
  FOREIGN KEY (requested_by_user_id)
  REFERENCES app_users(id)
  ON DELETE RESTRICT,

  CONSTRAINT
    leave_cancellation_decided_by_fkey
  FOREIGN KEY (decided_by_user_id)
  REFERENCES app_users(id)
  ON DELETE RESTRICT,

  CONSTRAINT
    valid_leave_cancellation_status
  CHECK (
    status IN (
      'PENDING',
      'APPROVED',
      'REJECTED'
    )
  ),

  CONSTRAINT
    valid_leave_cancellation_reason
  CHECK (
    LENGTH(
      TRIM(cancellation_reason)
    ) >= 5
  ),

  CONSTRAINT
    valid_leave_cancellation_released_days
  CHECK (
    released_days >= 0
  ),

  CONSTRAINT
    valid_leave_cancellation_decision
  CHECK (
    (
      status = 'PENDING'
      AND decided_by_user_id IS NULL
      AND decided_at IS NULL
      AND decision_note IS NULL
      AND released_days = 0
    )
    OR
    (
      status = 'APPROVED'
      AND decided_by_user_id IS NOT NULL
      AND decided_at IS NOT NULL
    )
    OR
    (
      status = 'REJECTED'
      AND decided_by_user_id IS NOT NULL
      AND decided_at IS NOT NULL
      AND decision_note IS NOT NULL
      AND LENGTH(
        TRIM(decision_note)
      ) >= 5
      AND released_days = 0
    )
  )
);

CREATE UNIQUE INDEX
  one_pending_cancellation_per_leave
ON leave_cancellation_requests(
  leave_request_id
)
WHERE status = 'PENDING';

CREATE INDEX
  leave_cancellation_status_queue_index
ON leave_cancellation_requests(
  status,
  requested_at
);

CREATE INDEX
  leave_cancellation_request_history_index
ON leave_cancellation_requests(
  leave_request_id,
  requested_at DESC
);

-- =====================================================
-- IMMUTABLE CANCELLATION ACTION HISTORY
-- =====================================================

CREATE TABLE leave_cancellation_actions (
  id integer
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  cancellation_request_id integer
    NOT NULL,

  leave_request_id integer
    NOT NULL,

  action character varying(20)
    NOT NULL,

  comment text,

  action_by_user_id integer
    NOT NULL,

  acted_at timestamp with time zone
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT
    leave_cancellation_action_request_fkey
  FOREIGN KEY (cancellation_request_id)
  REFERENCES leave_cancellation_requests(id)
  ON DELETE RESTRICT,

  CONSTRAINT
    leave_cancellation_action_leave_fkey
  FOREIGN KEY (leave_request_id)
  REFERENCES leave_requests(id)
  ON DELETE RESTRICT,

  CONSTRAINT
    leave_cancellation_action_user_fkey
  FOREIGN KEY (action_by_user_id)
  REFERENCES app_users(id)
  ON DELETE RESTRICT,

  CONSTRAINT
    valid_leave_cancellation_action
  CHECK (
    action IN (
      'REQUESTED',
      'APPROVED',
      'REJECTED'
    )
  ),

  CONSTRAINT
    valid_leave_cancellation_action_comment
  CHECK (
    action <> 'REJECTED'
    OR (
      comment IS NOT NULL
      AND LENGTH(TRIM(comment)) >= 5
    )
  )
);

CREATE INDEX
  leave_cancellation_actions_history_index
ON leave_cancellation_actions(
  leave_request_id,
  acted_at
);

COMMIT;