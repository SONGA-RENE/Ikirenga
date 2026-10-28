BEGIN;

-- =====================================================
-- ENTITLEMENT EXPIRY AND AUDIT INFORMATION
-- =====================================================

ALTER TABLE employee_leave_entitlements
ADD COLUMN IF NOT EXISTS expires_on date;

ALTER TABLE employee_leave_entitlements
ADD COLUMN IF NOT EXISTS source
  character varying(30);

ALTER TABLE employee_leave_entitlements
ADD COLUMN IF NOT EXISTS granted_by_user_id
  integer;

ALTER TABLE employee_leave_entitlements
ADD COLUMN IF NOT EXISTS grant_note text;

-- Annual leave from year Y remains usable through
-- 31 December of Y + 2.
UPDATE employee_leave_entitlements
SET
  expires_on =
    MAKE_DATE(
      leave_year + 3,
      1,
      1
    ) - 1,

  source =
    COALESCE(
      source,
      'LEGACY'
    )
WHERE expires_on IS NULL
   OR source IS NULL;

ALTER TABLE employee_leave_entitlements
ALTER COLUMN expires_on
  SET NOT NULL;

ALTER TABLE employee_leave_entitlements
ALTER COLUMN source
  SET NOT NULL;

ALTER TABLE employee_leave_entitlements
ALTER COLUMN source
  SET DEFAULT 'MANUAL';

ALTER TABLE employee_leave_entitlements
DROP CONSTRAINT IF EXISTS
  valid_leave_entitlement_source;

ALTER TABLE employee_leave_entitlements
ADD CONSTRAINT
  valid_leave_entitlement_source
CHECK (
  source IN (
    'LEGACY',
    'ANNUAL_GENERATION',
    'MANUAL',
    'ADJUSTMENT'
  )
);

ALTER TABLE employee_leave_entitlements
DROP CONSTRAINT IF EXISTS
  valid_leave_entitlement_expiry;

ALTER TABLE employee_leave_entitlements
ADD CONSTRAINT
  valid_leave_entitlement_expiry
CHECK (
  expires_on >=
    MAKE_DATE(
      leave_year,
      1,
      1
    )
);

ALTER TABLE employee_leave_entitlements
DROP CONSTRAINT IF EXISTS
  employee_leave_entitlement_granted_by_fkey;

ALTER TABLE employee_leave_entitlements
ADD CONSTRAINT
  employee_leave_entitlement_granted_by_fkey
FOREIGN KEY (granted_by_user_id)
REFERENCES app_users(id)
ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS
  leave_entitlements_expiry_index
ON employee_leave_entitlements(
  employee_id,
  leave_type_id,
  expires_on
);

-- =====================================================
-- REQUEST BALANCE LIFECYCLE
-- =====================================================

ALTER TABLE leave_requests
ADD COLUMN IF NOT EXISTS balance_status
  character varying(20);

UPDATE leave_requests
SET balance_status =
  COALESCE(
    balance_status,
    'LEGACY'
  );

ALTER TABLE leave_requests
ALTER COLUMN balance_status
  SET NOT NULL;

ALTER TABLE leave_requests
ALTER COLUMN balance_status
  SET DEFAULT 'PENDING';

ALTER TABLE leave_requests
DROP CONSTRAINT IF EXISTS
  valid_leave_request_balance_status;

ALTER TABLE leave_requests
ADD CONSTRAINT
  valid_leave_request_balance_status
CHECK (
  balance_status IN (
    'LEGACY',
    'PENDING',
    'NOT_APPLICABLE',
    'RESERVED',
    'RECONCILED',
    'RELEASED'
  )
);

-- =====================================================
-- FIFO ENTITLEMENT ALLOCATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS
  leave_entitlement_allocations (
    id integer
      GENERATED ALWAYS AS IDENTITY
      PRIMARY KEY,

    leave_request_id integer
      NOT NULL,

    entitlement_id integer
      NOT NULL,

    entitlement_year integer
      NOT NULL,

    allocated_days integer
      NOT NULL,

    consumed_days integer
      NOT NULL
      DEFAULT 0,

    restored_days integer
      NOT NULL
      DEFAULT 0,

    status character varying(20)
      NOT NULL
      DEFAULT 'RESERVED',

    allocated_at
      timestamp with time zone
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    reconciled_at
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
      leave_allocation_request_fkey
    FOREIGN KEY (leave_request_id)
    REFERENCES leave_requests(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      leave_allocation_entitlement_fkey
    FOREIGN KEY (entitlement_id)
    REFERENCES employee_leave_entitlements(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      valid_leave_allocation_year
    CHECK (
      entitlement_year >= 2000
      AND entitlement_year <= 2100
    ),

    CONSTRAINT
      valid_leave_allocated_days
    CHECK (
      allocated_days > 0
    ),

    CONSTRAINT
      valid_leave_consumed_days
    CHECK (
      consumed_days >= 0
    ),

    CONSTRAINT
      valid_leave_restored_days
    CHECK (
      restored_days >= 0
    ),

    CONSTRAINT
      valid_leave_allocation_totals
    CHECK (
      consumed_days + restored_days
      <= allocated_days
    ),

    CONSTRAINT
      valid_leave_allocation_status
    CHECK (
      status IN (
        'RESERVED',
        'RECONCILED',
        'RELEASED'
      )
    ),

    CONSTRAINT
      valid_leave_allocation_reconciliation
    CHECK (
      (
        status = 'RESERVED'
        AND consumed_days = 0
        AND restored_days = 0
        AND reconciled_at IS NULL
      )
      OR
      (
        status = 'RECONCILED'
        AND consumed_days +
          restored_days =
          allocated_days
        AND reconciled_at IS NOT NULL
      )
      OR
      (
        status = 'RELEASED'
        AND consumed_days = 0
        AND restored_days =
          allocated_days
        AND reconciled_at IS NOT NULL
      )
    ),

    CONSTRAINT
      unique_leave_request_entitlement
    UNIQUE (
      leave_request_id,
      entitlement_id
    )
  );

CREATE INDEX IF NOT EXISTS
  leave_allocations_request_index
ON leave_entitlement_allocations(
  leave_request_id,
  status
);

CREATE INDEX IF NOT EXISTS
  leave_allocations_entitlement_index
ON leave_entitlement_allocations(
  entitlement_id,
  status
);

-- =====================================================
-- LEAVE BALANCE TRANSACTION AUDIT
-- =====================================================

CREATE TABLE IF NOT EXISTS
  leave_balance_transactions (
    id integer
      GENERATED ALWAYS AS IDENTITY
      PRIMARY KEY,

    employee_id integer
      NOT NULL,

    leave_type_id integer
      NOT NULL,

    entitlement_id integer
      NOT NULL,

    leave_request_id integer,

    transaction_type
      character varying(30)
      NOT NULL,

    days integer
      NOT NULL,

    transaction_note text,

    action_by_user_id integer,

    created_at
      timestamp with time zone
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT
      leave_balance_transaction_employee_fkey
    FOREIGN KEY (employee_id)
    REFERENCES employees(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      leave_balance_transaction_type_fkey
    FOREIGN KEY (leave_type_id)
    REFERENCES leave_types(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      leave_balance_transaction_entitlement_fkey
    FOREIGN KEY (entitlement_id)
    REFERENCES employee_leave_entitlements(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      leave_balance_transaction_request_fkey
    FOREIGN KEY (leave_request_id)
    REFERENCES leave_requests(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      leave_balance_transaction_user_fkey
    FOREIGN KEY (action_by_user_id)
    REFERENCES app_users(id)
    ON DELETE SET NULL,

    CONSTRAINT
      valid_leave_balance_transaction_type
    CHECK (
      transaction_type IN (
        'ENTITLEMENT_GRANTED',
        'RESERVED',
        'CONSUMED',
        'RESTORED',
        'RELEASED',
        'EXPIRED',
        'ADJUSTED_IN',
        'ADJUSTED_OUT'
      )
    ),

    CONSTRAINT
      valid_leave_balance_transaction_days
    CHECK (
      days > 0
    )
  );

CREATE INDEX IF NOT EXISTS
  leave_balance_transactions_employee_index
ON leave_balance_transactions(
  employee_id,
  leave_type_id,
  created_at
);

CREATE INDEX IF NOT EXISTS
  leave_balance_transactions_request_index
ON leave_balance_transactions(
  leave_request_id,
  created_at
)
WHERE leave_request_id IS NOT NULL;

-- =====================================================
-- ENTITLEMENT BALANCE VIEW
-- =====================================================

CREATE OR REPLACE VIEW
  employee_leave_entitlement_balances
AS
WITH allocation_totals AS (
  SELECT
    leave_entitlement_allocations.entitlement_id,

    COALESCE(
      SUM(
        CASE
          WHEN
            leave_entitlement_allocations.status =
              'RESERVED'
          THEN
            leave_entitlement_allocations.allocated_days
          ELSE 0
        END
      ),
      0
    )::integer AS reserved_days,

    COALESCE(
      SUM(
        CASE
          WHEN
            leave_entitlement_allocations.status =
              'RECONCILED'
          THEN
            leave_entitlement_allocations.consumed_days
          ELSE 0
        END
      ),
      0
    )::integer AS consumed_days

  FROM leave_entitlement_allocations

  GROUP BY
    leave_entitlement_allocations.entitlement_id
)

SELECT
  entitlements.id
    AS "entitlementId",

  entitlements.employee_id
    AS "employeeId",

  entitlements.leave_type_id
    AS "leaveTypeId",

  leave_types.code,
  leave_types.name,

  entitlements.leave_year
    AS "leaveYear",

  entitlements.entitled_days
    AS "entitledDays",

  COALESCE(
    allocation_totals.reserved_days,
    0
  ) AS "reservedDays",

  COALESCE(
    allocation_totals.consumed_days,
    0
  ) AS "consumedDays",

  GREATEST(
    entitlements.entitled_days
      - COALESCE(
          allocation_totals.reserved_days,
          0
        )
      - COALESCE(
          allocation_totals.consumed_days,
          0
        ),
    0
  )::integer AS "unexpiredRemainingDays",

  CASE
    WHEN
      entitlements.expires_on <
        CURRENT_DATE
    THEN 0

    ELSE GREATEST(
      entitlements.entitled_days
        - COALESCE(
            allocation_totals.reserved_days,
            0
          )
        - COALESCE(
            allocation_totals.consumed_days,
            0
          ),
      0
    )
  END::integer AS "availableDays",

  entitlements.expires_on
    AS "expiresOn",

  (
    entitlements.expires_on <
      CURRENT_DATE
  ) AS "isExpired",

  entitlements.source,
  entitlements.created_at
    AS "createdAt",

  entitlements.updated_at
    AS "updatedAt"

FROM employee_leave_entitlements
  AS entitlements

JOIN leave_types
  ON leave_types.id =
    entitlements.leave_type_id

LEFT JOIN allocation_totals
  ON allocation_totals.entitlement_id =
    entitlements.id;

COMMIT;