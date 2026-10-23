-- =====================================================
-- 008: EDUCATION RECORD LIFECYCLE
-- =====================================================

ALTER TABLE employee_education_records
ADD COLUMN IF NOT EXISTS is_active boolean
  NOT NULL
  DEFAULT TRUE;

ALTER TABLE employee_education_records
ADD COLUMN IF NOT EXISTS archived_at
  timestamp with time zone;

ALTER TABLE employee_education_records
ADD COLUMN IF NOT EXISTS archived_by_user_id
  integer;

ALTER TABLE employee_education_records
DROP CONSTRAINT IF EXISTS
  employee_education_archived_by_fkey;

ALTER TABLE employee_education_records
ADD CONSTRAINT
  employee_education_archived_by_fkey
FOREIGN KEY (archived_by_user_id)
REFERENCES app_users(id)
ON DELETE SET NULL;

ALTER TABLE employee_education_records
DROP CONSTRAINT IF EXISTS
  valid_education_archive_state;

ALTER TABLE employee_education_records
ADD CONSTRAINT
  valid_education_archive_state
CHECK (
  (
    is_active = TRUE
    AND archived_at IS NULL
    AND archived_by_user_id IS NULL
  )
  OR
  (
    is_active = FALSE
    AND archived_at IS NOT NULL
  )
);

DROP INDEX IF EXISTS
  one_highest_qualification_per_employee;

CREATE UNIQUE INDEX
  one_highest_qualification_per_employee
ON employee_education_records(employee_id)
WHERE
  is_highest_qualification = TRUE
  AND is_active = TRUE;

CREATE INDEX
  active_employee_education_index
ON employee_education_records(
  employee_id,
  graduation_year DESC
)
WHERE is_active = TRUE;