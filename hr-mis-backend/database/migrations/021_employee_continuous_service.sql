BEGIN;

ALTER TABLE employees
ADD COLUMN continuous_service_start_date DATE,
ADD COLUMN service_start_date_verified BOOLEAN
  NOT NULL DEFAULT FALSE,
ADD COLUMN service_start_date_updated_at
  TIMESTAMPTZ,
ADD COLUMN service_start_date_updated_by_user_id
  INTEGER;

ALTER TABLE employees
ADD CONSTRAINT employees_service_start_date_user_fkey
FOREIGN KEY (
  service_start_date_updated_by_user_id
)
REFERENCES app_users(id)
ON DELETE SET NULL;

ALTER TABLE employees
ADD CONSTRAINT valid_verified_service_start_date
CHECK (
  service_start_date_verified = FALSE
  OR continuous_service_start_date IS NOT NULL
);

-- Suggest a date for existing employees using their
-- earliest non-cancelled contract.
-- These dates remain unverified until HR confirms them.
UPDATE employees
SET continuous_service_start_date =
  contract_history.first_contract_start_date
FROM (
  SELECT
    employee_id,
    MIN(start_date) AS first_contract_start_date
  FROM contracts
  WHERE status <> 'CANCELLED'
  GROUP BY employee_id
) AS contract_history
WHERE employees.id =
  contract_history.employee_id
AND employees.continuous_service_start_date
  IS NULL;

CREATE INDEX employees_continuous_service_index
ON employees (
  continuous_service_start_date,
  service_start_date_verified
);

COMMENT ON COLUMN
employees.continuous_service_start_date
IS
  'First day of the employee current uninterrupted period of service. Contract renewal does not change this date.';

COMMENT ON COLUMN
employees.service_start_date_verified
IS
  'Indicates that HR verified the continuous service start date. Legacy contract-derived dates remain unverified.';

COMMIT;