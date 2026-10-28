BEGIN;

-- =====================================================
-- ADD CEO_ONLY TO POSITION ROUTING
-- =====================================================

ALTER TABLE positions
DROP CONSTRAINT IF EXISTS
  valid_position_leave_approval_route;

ALTER TABLE positions
ADD CONSTRAINT
  valid_position_leave_approval_route
CHECK (
  leave_approval_route IN (
    'STANDARD',
    'CEO_ONLY',
    'CEO_APPROVAL',
    'CHAIRMAN_APPROVAL'
  )
);

-- =====================================================
-- ADD CEO_ONLY TO REQUEST ROUTE SNAPSHOTS
-- =====================================================

ALTER TABLE leave_requests
DROP CONSTRAINT IF EXISTS
  valid_leave_request_approval_route;

ALTER TABLE leave_requests
ADD CONSTRAINT
  valid_leave_request_approval_route
CHECK (
  approval_route IS NULL
  OR approval_route IN (
    'LEGACY',
    'STANDARD',
    'CEO_ONLY',
    'CEO_APPROVAL',
    'CHAIRMAN_APPROVAL'
  )
);

-- =====================================================
-- HR DEPARTMENT LEAVE GOES DIRECTLY TO CEO
-- =====================================================

UPDATE positions
SET leave_approval_route = 'CEO_ONLY'
WHERE position_code IN (
  'HR-DIR-001',
  'HR-OFF-001'
);

-- Ensure both known HR positions were updated.
DO $$
DECLARE
  updated_position_count integer;
BEGIN
  SELECT COUNT(*)
  INTO updated_position_count
  FROM positions
  WHERE position_code IN (
    'HR-DIR-001',
    'HR-OFF-001'
  )
    AND leave_approval_route = 'CEO_ONLY';

  IF updated_position_count <> 2 THEN
    RAISE EXCEPTION
      'Expected exactly two HR positions to use CEO_ONLY, found %',
      updated_position_count;
  END IF;
END
$$;

COMMIT;