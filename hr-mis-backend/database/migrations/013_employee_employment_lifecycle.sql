BEGIN;

-- =====================================================
-- EMPLOYEE LIFECYCLE
-- =====================================================

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS
  employment_status
  character varying(40)
  NOT NULL
  DEFAULT 'ACTIVE';

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS
  employment_status_reason text;

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS
  status_effective_date date
  NOT NULL
  DEFAULT CURRENT_DATE;

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS
  last_working_date date;

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS
  exited_at timestamp with time zone;

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS
  exited_by_user_id integer;

ALTER TABLE employees
DROP CONSTRAINT IF EXISTS
  employees_exited_by_user_fkey;

ALTER TABLE employees
ADD CONSTRAINT
  employees_exited_by_user_fkey
FOREIGN KEY (exited_by_user_id)
REFERENCES app_users(id)
ON DELETE SET NULL;

-- Preserve existing inactive employees.
UPDATE employees
SET
  employment_status = 'EXITED',
  employment_status_reason =
    COALESCE(
      employment_status_reason,
      'Legacy inactive employee record'
    ),
  status_effective_date =
    COALESCE(
      updated_at::date,
      CURRENT_DATE
    ),
  last_working_date =
    COALESCE(
      last_working_date,
      updated_at::date,
      CURRENT_DATE
    ),
  exited_at =
    COALESCE(
      exited_at,
      updated_at,
      CURRENT_TIMESTAMP
    )
WHERE is_active = FALSE;

ALTER TABLE employees
DROP CONSTRAINT IF EXISTS
  valid_employee_employment_status;

ALTER TABLE employees
ADD CONSTRAINT
  valid_employee_employment_status
CHECK (
  employment_status IN (
    'ACTIVE',
    'SUSPENDED',
    'ON_NOTICE',
    'EXITED'
  )
);

ALTER TABLE employees
DROP CONSTRAINT IF EXISTS
  valid_employee_lifecycle_state;

ALTER TABLE employees
ADD CONSTRAINT
  valid_employee_lifecycle_state
CHECK (
  (
    employment_status = 'EXITED'
    AND is_active = FALSE
    AND last_working_date IS NOT NULL
    AND exited_at IS NOT NULL
    AND employment_status_reason IS NOT NULL
    AND LENGTH(
      TRIM(employment_status_reason)
    ) >= 5
  )
  OR
  (
    employment_status <> 'EXITED'
    AND is_active = TRUE
    AND exited_at IS NULL
  )
);

ALTER TABLE employees
DROP CONSTRAINT IF EXISTS
  valid_notice_last_working_date;

ALTER TABLE employees
ADD CONSTRAINT
  valid_notice_last_working_date
CHECK (
  employment_status <> 'ON_NOTICE'
  OR last_working_date IS NOT NULL
);

CREATE INDEX IF NOT EXISTS
  employees_employment_status_index
ON employees(employment_status);

-- =====================================================
-- EMPLOYMENT STATUS AUDIT HISTORY
-- =====================================================

CREATE TABLE IF NOT EXISTS
  employee_status_history (
    id integer
      GENERATED ALWAYS AS IDENTITY
      PRIMARY KEY,

    employee_id integer
      NOT NULL,

    previous_status
      character varying(40),

    new_status
      character varying(40)
      NOT NULL,

    effective_date date
      NOT NULL,

    reason text
      NOT NULL,

    changed_by_user_id integer,

    created_at timestamp with time zone
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT
      employee_status_history_employee_fkey
    FOREIGN KEY (employee_id)
    REFERENCES employees(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      employee_status_history_user_fkey
    FOREIGN KEY (changed_by_user_id)
    REFERENCES app_users(id)
    ON DELETE SET NULL,

    CONSTRAINT
      valid_employee_history_status
    CHECK (
      new_status IN (
        'ACTIVE',
        'SUSPENDED',
        'ON_NOTICE',
        'EXITED'
      )
    ),

    CONSTRAINT
      valid_employee_history_reason
    CHECK (
      LENGTH(TRIM(reason)) >= 5
    )
  );

CREATE INDEX IF NOT EXISTS
  employee_status_history_employee_index
ON employee_status_history(
  employee_id,
  created_at DESC
);

-- Register the current state of existing employees.
INSERT INTO employee_status_history (
  employee_id,
  previous_status,
  new_status,
  effective_date,
  reason,
  changed_by_user_id
)
SELECT
  employees.id,
  NULL,
  employees.employment_status,
  employees.status_effective_date,
  CASE
    WHEN employees.employment_status =
      'EXITED'
      THEN COALESCE(
        employees.employment_status_reason,
        'Legacy inactive employee record'
      )
    ELSE
      'Initial employment status migrated'
  END,
  NULL
FROM employees
WHERE NOT EXISTS (
  SELECT 1
  FROM employee_status_history
  WHERE
    employee_status_history.employee_id =
      employees.id
);

-- =====================================================
-- DERIVED CONTRACT COMPLIANCE VIEW
-- =====================================================

CREATE OR REPLACE VIEW
  employee_contract_compliance
AS
SELECT
  employees.id AS employee_id,

  employees.staff_number,

  CONCAT(
    employees.first_name,
    ' ',
    employees.last_name
  ) AS employee_name,

  employees.employment_status,

  employees.is_active,

  employees.position_id,

  positions.title AS position,

  departments.id AS department_id,

  departments.name AS department,

  active_contract.id
    AS active_contract_id,

  active_contract.contract_type,

  active_contract.start_date
    AS contract_start_date,

  active_contract.end_date
    AS contract_end_date,

  CASE
    WHEN employees.employment_status =
      'EXITED'
      THEN 'NOT_APPLICABLE'

    WHEN active_contract.id IS NOT NULL
      THEN 'COMPLIANT'

    ELSE 'ATTENTION_REQUIRED'
  END AS contract_compliance_status

FROM employees

LEFT JOIN positions
  ON positions.id =
    employees.position_id

LEFT JOIN departments
  ON departments.id =
    positions.department_id

LEFT JOIN LATERAL (
  SELECT
    contracts.id,
    contracts.contract_type,
    contracts.start_date,
    contracts.end_date
  FROM contracts
  WHERE
    contracts.employee_id =
      employees.id
    AND contracts.status = 'ACTIVE'
    AND contracts.start_date <=
      CURRENT_DATE
    AND (
      contracts.end_date IS NULL
      OR contracts.end_date >=
        CURRENT_DATE
    )
  ORDER BY
    contracts.start_date DESC,
    contracts.id DESC
  LIMIT 1
) AS active_contract
  ON TRUE;

COMMIT;