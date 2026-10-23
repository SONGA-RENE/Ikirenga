-- =====================================================
-- 004: TEMPORARY POSITION ASSIGNMENTS
-- =====================================================

ALTER TABLE employee_position_assignments
ADD COLUMN IF NOT EXISTS expected_end_date date;

ALTER TABLE employee_position_assignments
DROP CONSTRAINT IF EXISTS
  valid_expected_assignment_end_date;

ALTER TABLE employee_position_assignments
ADD CONSTRAINT
  valid_expected_assignment_end_date
CHECK (
  expected_end_date IS NULL
  OR expected_end_date >= start_date
);

-- Remove constraints from the original model.
DROP INDEX IF EXISTS
  one_current_position_per_employee;

DROP INDEX IF EXISTS
  one_current_employee_per_position;

-- One employee may own only one substantive position.
CREATE UNIQUE INDEX
  one_current_substantive_position_per_employee
ON employee_position_assignments(employee_id)
WHERE
  end_date IS NULL
  AND assignment_type = 'SUBSTANTIVE';

-- An employee may perform only one temporary assignment
-- at a time. This includes ACTING and INTERIM.
CREATE UNIQUE INDEX
  one_current_temporary_position_per_employee
ON employee_position_assignments(employee_id)
WHERE
  end_date IS NULL
  AND assignment_type IN (
    'ACTING',
    'INTERIM'
  );

-- A position may have only one formal holder.
-- An INTERIM employee occupies a formally vacant seat.
CREATE UNIQUE INDEX
  one_current_formal_holder_per_position
ON employee_position_assignments(position_id)
WHERE
  end_date IS NULL
  AND assignment_type IN (
    'SUBSTANTIVE',
    'INTERIM'
  );

-- An occupied position may have at most one person acting.
CREATE UNIQUE INDEX
  one_current_acting_employee_per_position
ON employee_position_assignments(position_id)
WHERE
  end_date IS NULL
  AND assignment_type = 'ACTING';

CREATE INDEX IF NOT EXISTS
  temporary_assignment_end_date_index
ON employee_position_assignments(
  expected_end_date
)
WHERE
  end_date IS NULL
  AND assignment_type IN (
    'ACTING',
    'INTERIM'
  );

CREATE OR REPLACE VIEW available_positions AS
SELECT
  positions.id,
  positions.position_code,
  positions.title,
  positions.department_id,
  departments.name AS department,
  departments.unit_type AS "unitType",
  positions.reports_to_position_id,
  positions.location_name,
  positions.seat_number,
  positions.description,
  positions.is_active
FROM positions
JOIN departments
  ON departments.id =
    positions.department_id
WHERE positions.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM employee_position_assignments
    WHERE
      employee_position_assignments.position_id =
        positions.id
      AND employee_position_assignments.end_date
        IS NULL
      AND employee_position_assignments.assignment_type
        IN (
          'SUBSTANTIVE',
          'INTERIM'
        )
  );