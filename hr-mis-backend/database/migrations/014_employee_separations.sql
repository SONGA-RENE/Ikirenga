BEGIN;

CREATE TABLE IF NOT EXISTS
  employee_separations (
    id integer
      GENERATED ALWAYS AS IDENTITY
      PRIMARY KEY,

    employee_id integer
      NOT NULL,

    separation_type
      character varying(30)
      NOT NULL,

    status
      character varying(20)
      NOT NULL
      DEFAULT 'PENDING',

    notice_received_date date,

    notice_start_date date,

    last_working_date date
      NOT NULL,

    reason text
      NOT NULL,

    initiated_by_user_id integer
      NOT NULL,

    confirmed_by_user_id integer,

    completed_by_user_id integer,

    cancelled_by_user_id integer,

    confirmed_at
      timestamp with time zone,

    completed_at
      timestamp with time zone,

    cancelled_at
      timestamp with time zone,

    cancellation_reason text,

    created_at
      timestamp with time zone
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    updated_at
      timestamp with time zone
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT
      employee_separation_employee_fkey
    FOREIGN KEY (employee_id)
    REFERENCES employees(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      employee_separation_initiated_by_fkey
    FOREIGN KEY (initiated_by_user_id)
    REFERENCES app_users(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      employee_separation_confirmed_by_fkey
    FOREIGN KEY (confirmed_by_user_id)
    REFERENCES app_users(id)
    ON DELETE SET NULL,

    CONSTRAINT
      employee_separation_completed_by_fkey
    FOREIGN KEY (completed_by_user_id)
    REFERENCES app_users(id)
    ON DELETE SET NULL,

    CONSTRAINT
      employee_separation_cancelled_by_fkey
    FOREIGN KEY (cancelled_by_user_id)
    REFERENCES app_users(id)
    ON DELETE SET NULL,

    CONSTRAINT
      valid_employee_separation_type
    CHECK (
      separation_type IN (
        'RESIGNATION',
        'CONTRACT_END',
        'TERMINATION',
        'RETIREMENT',
        'REDUNDANCY',
        'DEATH',
        'OTHER'
      )
    ),

    CONSTRAINT
      valid_employee_separation_status
    CHECK (
      status IN (
        'PENDING',
        'CONFIRMED',
        'COMPLETED',
        'CANCELLED'
      )
    ),

    CONSTRAINT
      valid_employee_separation_reason
    CHECK (
      LENGTH(TRIM(reason)) >= 5
    ),

    CONSTRAINT
      valid_resignation_notice
    CHECK (
      separation_type <> 'RESIGNATION'
      OR notice_received_date IS NOT NULL
    ),

    CONSTRAINT
      valid_notice_dates
    CHECK (
      notice_start_date IS NULL
      OR last_working_date >=
        notice_start_date
    ),

    CONSTRAINT
      valid_completed_separation
    CHECK (
      status <> 'COMPLETED'
      OR (
        completed_by_user_id IS NOT NULL
        AND completed_at IS NOT NULL
      )
    ),

    CONSTRAINT
      valid_cancelled_separation
    CHECK (
      status <> 'CANCELLED'
      OR (
        cancelled_by_user_id IS NOT NULL
        AND cancelled_at IS NOT NULL
        AND cancellation_reason IS NOT NULL
        AND LENGTH(
          TRIM(cancellation_reason)
        ) >= 5
      )
    )
  );

-- Prevent multiple simultaneous separation processes.
CREATE UNIQUE INDEX IF NOT EXISTS
  one_open_separation_per_employee
ON employee_separations(employee_id)
WHERE status IN (
  'PENDING',
  'CONFIRMED'
);

CREATE INDEX IF NOT EXISTS
  employee_separation_status_index
ON employee_separations(
  status,
  last_working_date
);

CREATE INDEX IF NOT EXISTS
  employee_separation_employee_index
ON employee_separations(
  employee_id,
  created_at DESC
);

COMMIT;