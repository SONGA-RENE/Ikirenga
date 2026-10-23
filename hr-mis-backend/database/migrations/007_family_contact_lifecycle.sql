-- =====================================================
-- 007: FAMILY CONTACT RECORD LIFECYCLE
-- =====================================================

ALTER TABLE employee_family_contacts
ADD COLUMN IF NOT EXISTS is_active boolean
  NOT NULL
  DEFAULT TRUE;

ALTER TABLE employee_family_contacts
ADD COLUMN IF NOT EXISTS archived_at
  timestamp with time zone;

ALTER TABLE employee_family_contacts
ADD COLUMN IF NOT EXISTS archived_by_user_id
  integer;

ALTER TABLE employee_family_contacts
DROP CONSTRAINT IF EXISTS
  employee_family_contact_archived_by_fkey;

ALTER TABLE employee_family_contacts
ADD CONSTRAINT
  employee_family_contact_archived_by_fkey
FOREIGN KEY (archived_by_user_id)
REFERENCES app_users(id)
ON DELETE SET NULL;

ALTER TABLE employee_family_contacts
DROP CONSTRAINT IF EXISTS
  valid_family_contact_archive_state;

ALTER TABLE employee_family_contacts
ADD CONSTRAINT
  valid_family_contact_archive_state
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
  one_primary_family_contact_per_employee;

CREATE UNIQUE INDEX
  one_primary_family_contact_per_employee
ON employee_family_contacts(employee_id)
WHERE
  is_primary = TRUE
  AND is_active = TRUE;

CREATE INDEX
  active_family_contacts_employee_index
ON employee_family_contacts(
  employee_id,
  contact_type
)
WHERE is_active = TRUE;