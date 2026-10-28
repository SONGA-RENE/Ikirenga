BEGIN;

ALTER TABLE employee_leave_entitlements
ADD COLUMN available_from DATE;

-- Backfill only where HR has verified the
-- employee's continuous-service date.
UPDATE employee_leave_entitlements
SET available_from =
  (
    employees.continuous_service_start_date
    + MAKE_INTERVAL(
        years => (
          employee_leave_entitlements.leave_year
          - EXTRACT(
              YEAR FROM
                employees.continuous_service_start_date
            )::integer
        )
      )
  )::date
FROM employees
JOIN leave_types
  ON leave_types.code = 'ANNUAL'
WHERE employees.id =
  employee_leave_entitlements.employee_id
  AND leave_types.id =
    employee_leave_entitlements.leave_type_id
  AND employees.service_start_date_verified =
    TRUE
  AND employees.continuous_service_start_date
    IS NOT NULL;

ALTER TABLE employee_leave_entitlements
ADD CONSTRAINT valid_entitlement_availability
CHECK (
  available_from IS NULL
  OR (
    available_from >=
      MAKE_DATE(leave_year, 1, 1)
    AND available_from <=
      MAKE_DATE(leave_year, 12, 31)
    AND available_from <= expires_on
  )
);

CREATE INDEX leave_entitlements_availability_index
ON employee_leave_entitlements (
  employee_id,
  leave_type_id,
  available_from,
  expires_on
);

COMMENT ON COLUMN
employee_leave_entitlements.available_from
IS
  'First date this entitlement bucket may be used. Annual entitlement availability is based on the verified continuous-service anniversary.';

COMMIT;