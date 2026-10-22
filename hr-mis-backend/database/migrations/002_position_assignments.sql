-- =====================================================
-- 002: ORGANIZATIONAL STRUCTURE AND POSITION ASSIGNMENTS
-- =====================================================

-- =====================================================
-- ORGANIZATIONAL UNIT IMPROVEMENTS
-- =====================================================

ALTER TABLE departments
ADD COLUMN IF NOT EXISTS unit_type
  character varying(30);

ALTER TABLE departments
ADD COLUMN IF NOT EXISTS parent_department_id
  integer;

ALTER TABLE departments
ADD COLUMN IF NOT EXISTS unit_code
  character varying(40);

-- Remove any earlier version before normalizing data.
ALTER TABLE departments
DROP CONSTRAINT IF EXISTS
  valid_department_unit_type;

-- Existing departments are initially treated as departments.
-- Migration 003 will assign their accurate organizational types.
UPDATE departments
SET unit_type = 'DEPARTMENT'
WHERE unit_type IS NULL
   OR unit_type NOT IN (
     'OFFICE',
     'DIRECTORATE',
     'DEPARTMENT',
     'UNIT',
     'SUBSIDIARY',
     'SECRETARIAT',
     'SCHEME'
   );

ALTER TABLE departments
ALTER COLUMN unit_type
SET DEFAULT 'DEPARTMENT';

ALTER TABLE departments
ALTER COLUMN unit_type
SET NOT NULL;

ALTER TABLE departments
ADD CONSTRAINT valid_department_unit_type
CHECK (
  unit_type IN (
    'OFFICE',
    'DIRECTORATE',
    'DEPARTMENT',
    'UNIT',
    'SUBSIDIARY',
    'SECRETARIAT',
    'SCHEME'
  )
);

ALTER TABLE departments
DROP CONSTRAINT IF EXISTS
  departments_parent_department_fkey;

ALTER TABLE departments
ADD CONSTRAINT
  departments_parent_department_fkey
FOREIGN KEY (parent_department_id)
REFERENCES departments(id)
ON DELETE RESTRICT;

CREATE UNIQUE INDEX IF NOT EXISTS
  departments_unit_code_unique
ON departments(unit_code)
WHERE unit_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  departments_parent_department_index
ON departments(parent_department_id);

CREATE INDEX IF NOT EXISTS
  departments_unit_type_index
ON departments(unit_type);

-- =====================================================
-- APPROVED POSITION/SEAT IMPROVEMENTS
-- =====================================================

ALTER TABLE positions
DROP CONSTRAINT IF EXISTS
  unique_position_per_department;

ALTER TABLE positions
ADD COLUMN IF NOT EXISTS position_code
  character varying(50);

ALTER TABLE positions
ADD COLUMN IF NOT EXISTS reports_to_position_id
  integer;

ALTER TABLE positions
ADD COLUMN IF NOT EXISTS location_name
  character varying(150);

ALTER TABLE positions
ADD COLUMN IF NOT EXISTS seat_number
  integer;

-- Normalize any previously created rows.
UPDATE positions
SET seat_number = 1
WHERE seat_number IS NULL
   OR seat_number <= 0;

ALTER TABLE positions
ALTER COLUMN seat_number
SET DEFAULT 1;

ALTER TABLE positions
ALTER COLUMN seat_number
SET NOT NULL;

ALTER TABLE positions
DROP CONSTRAINT IF EXISTS
  positions_reports_to_position_fkey;

ALTER TABLE positions
ADD CONSTRAINT
  positions_reports_to_position_fkey
FOREIGN KEY (reports_to_position_id)
REFERENCES positions(id)
ON DELETE RESTRICT;

ALTER TABLE positions
DROP CONSTRAINT IF EXISTS
  valid_position_seat_number;

ALTER TABLE positions
ADD CONSTRAINT valid_position_seat_number
CHECK (seat_number > 0);

CREATE UNIQUE INDEX IF NOT EXISTS
  positions_position_code_unique
ON positions(position_code)
WHERE position_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS
  positions_reports_to_index
ON positions(reports_to_position_id);

CREATE INDEX IF NOT EXISTS
  positions_department_active_index
ON positions(department_id, is_active);

-- =====================================================
-- POSITION ASSIGNMENT HISTORY
-- =====================================================

CREATE TABLE IF NOT EXISTS
  employee_position_assignments (
    id integer
      GENERATED ALWAYS AS IDENTITY
      PRIMARY KEY,

    employee_id integer
      NOT NULL,

    position_id integer
      NOT NULL,

    assignment_type character varying(20)
      NOT NULL
      DEFAULT 'SUBSTANTIVE',

    start_date date
      NOT NULL
      DEFAULT CURRENT_DATE,

    end_date date,

    assigned_by_user_id integer,

    ended_by_user_id integer,

    assignment_note text,

    created_at timestamp with time zone
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    updated_at timestamp with time zone
      NOT NULL
      DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT
      employee_position_assignment_employee_fkey
    FOREIGN KEY (employee_id)
    REFERENCES employees(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      employee_position_assignment_position_fkey
    FOREIGN KEY (position_id)
    REFERENCES positions(id)
    ON DELETE RESTRICT,

    CONSTRAINT
      employee_position_assignment_assigned_by_fkey
    FOREIGN KEY (assigned_by_user_id)
    REFERENCES app_users(id)
    ON DELETE SET NULL,

    CONSTRAINT
      employee_position_assignment_ended_by_fkey
    FOREIGN KEY (ended_by_user_id)
    REFERENCES app_users(id)
    ON DELETE SET NULL,

    CONSTRAINT
      valid_position_assignment_type
    CHECK (
      assignment_type IN (
        'SUBSTANTIVE',
        'ACTING',
        'INTERIM'
      )
    ),

    CONSTRAINT
      valid_position_assignment_dates
    CHECK (
      end_date IS NULL
      OR end_date >= start_date
    )
  );

-- One employee cannot currently occupy multiple positions.
CREATE UNIQUE INDEX IF NOT EXISTS
  one_current_position_per_employee
ON employee_position_assignments(employee_id)
WHERE end_date IS NULL;

-- One approved position cannot have multiple current occupants.
CREATE UNIQUE INDEX IF NOT EXISTS
  one_current_employee_per_position
ON employee_position_assignments(position_id)
WHERE end_date IS NULL;

CREATE INDEX IF NOT EXISTS
  employee_position_history_index
ON employee_position_assignments(
  employee_id,
  start_date DESC
);

CREATE INDEX IF NOT EXISTS
  position_assignment_history_index
ON employee_position_assignments(
  position_id,
  start_date DESC
);

-- =====================================================
-- PREVENT UNSAFE BACKFILL
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT employees.position_id
    FROM employees
    WHERE employees.is_active = TRUE
    GROUP BY employees.position_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Migration stopped: multiple active employees currently share one position';
  END IF;
END
$$;

-- Create current assignments from existing active employees.
-- employees.position_id remains temporarily for compatibility.
INSERT INTO employee_position_assignments (
  employee_id,
  position_id,
  assignment_type,
  start_date,
  assignment_note
)
SELECT
  employees.id,
  employees.position_id,
  'SUBSTANTIVE',
  employees.created_at::date,
  'Automatically migrated from employees.position_id'
FROM employees
WHERE employees.is_active = TRUE
  AND NOT EXISTS (
    SELECT 1
    FROM employee_position_assignments
    WHERE
      employee_position_assignments.employee_id =
        employees.id
      AND employee_position_assignments.end_date
        IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM employee_position_assignments
    WHERE
      employee_position_assignments.position_id =
        employees.position_id
      AND employee_position_assignments.end_date
        IS NULL
  );

-- =====================================================
-- AVAILABLE POSITIONS VIEW
-- =====================================================

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
  );