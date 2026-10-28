BEGIN;

ALTER TABLE leave_requests
ADD COLUMN actual_return_date DATE;

-- Backfill already verified returns.
UPDATE leave_requests
SET actual_return_date =
  returns.actual_return_date
FROM leave_return_records AS returns
WHERE returns.leave_request_id =
  leave_requests.id
  AND returns.status = 'VERIFIED';

ALTER TABLE leave_requests
ADD CONSTRAINT valid_leave_actual_return_date
CHECK (
  actual_return_date IS NULL
  OR actual_return_date >= start_date
);

ALTER TABLE leave_requests
DROP CONSTRAINT no_overlapping_leave_requests;

-- The upper boundary is exclusive:
-- [start date, return date)
--
-- If no early return exists, end_date + 1
-- preserves the original inclusive leave period.
ALTER TABLE leave_requests
ADD CONSTRAINT no_overlapping_leave_requests
EXCLUDE USING gist (
  employee_id WITH =,

  DATERANGE(
    start_date,

    CASE
      WHEN actual_return_date IS NOT NULL
        AND actual_return_date <= end_date
      THEN actual_return_date

      ELSE end_date + 1
    END,

    '[)'
  ) WITH &&
)
WHERE (
  status IN (
    'PENDING',
    'APPROVED'
  )
);

CREATE INDEX leave_requests_actual_return_index
ON leave_requests (
  employee_id,
  actual_return_date
)
WHERE actual_return_date IS NOT NULL;

COMMIT;