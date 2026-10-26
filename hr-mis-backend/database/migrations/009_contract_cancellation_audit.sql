BEGIN;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS
  cancellation_reason text;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS
  cancelled_at timestamp with time zone;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS
  cancelled_by_user_id integer;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS
  terminated_by_user_id integer;

ALTER TABLE contracts
ADD COLUMN IF NOT EXISTS
  updated_at timestamp with time zone
  NOT NULL
  DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE contracts
DROP CONSTRAINT IF EXISTS
  contracts_cancelled_by_user_fkey;

ALTER TABLE contracts
ADD CONSTRAINT
  contracts_cancelled_by_user_fkey
FOREIGN KEY (cancelled_by_user_id)
REFERENCES app_users(id)
ON DELETE SET NULL;

ALTER TABLE contracts
DROP CONSTRAINT IF EXISTS
  contracts_terminated_by_user_fkey;

ALTER TABLE contracts
ADD CONSTRAINT
  contracts_terminated_by_user_fkey
FOREIGN KEY (terminated_by_user_id)
REFERENCES app_users(id)
ON DELETE SET NULL;

-- Preserve older cancelled test records.
UPDATE contracts
SET
  cancellation_reason =
    COALESCE(
      cancellation_reason,
      'Legacy cancellation recorded before audit tracking'
    ),
  cancelled_at =
    COALESCE(
      cancelled_at,
      created_at AT TIME ZONE 'Africa/Kigali'
    ),
  updated_at = CURRENT_TIMESTAMP
WHERE status = 'CANCELLED';

ALTER TABLE contracts
DROP CONSTRAINT IF EXISTS
  valid_contract_cancellation_details;

ALTER TABLE contracts
ADD CONSTRAINT
  valid_contract_cancellation_details
CHECK (
  status <> 'CANCELLED'
  OR (
    cancellation_reason IS NOT NULL
    AND LENGTH(
      TRIM(cancellation_reason)
    ) >= 5
    AND cancelled_at IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS
  contracts_end_date_status_index
ON contracts(status, end_date)
WHERE status = 'ACTIVE'
  AND end_date IS NOT NULL;

COMMIT;