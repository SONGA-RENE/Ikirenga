BEGIN;

ALTER TABLE contracts
DROP CONSTRAINT IF EXISTS
  valid_contract_type;

ALTER TABLE contracts
ADD CONSTRAINT valid_contract_type
CHECK (
  contract_type IN (
    'PERMANENT',
    'FIXED_TERM',
    'INTERNSHIP'
  )
);

ALTER TABLE contracts
DROP CONSTRAINT IF EXISTS
  valid_contract_type_end_date;

ALTER TABLE contracts
ADD CONSTRAINT valid_contract_type_end_date
CHECK (
  (
    contract_type = 'PERMANENT'
    AND end_date IS NULL
  )
  OR
  (
    contract_type IN (
      'FIXED_TERM',
      'INTERNSHIP'
    )
    AND end_date IS NOT NULL
  )
);

COMMIT;