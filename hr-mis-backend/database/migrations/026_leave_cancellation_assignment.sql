BEGIN;

ALTER TABLE leave_cancellation_requests
ADD COLUMN assigned_decision_user_id integer;

ALTER TABLE leave_cancellation_requests
ADD CONSTRAINT leave_cancellation_assigned_decision_user_fkey
FOREIGN KEY (assigned_decision_user_id)
REFERENCES app_users(id)
ON DELETE RESTRICT;

/*
 * Assign any cancellation requests that were already
 * pending before this migration.
 *
 * STANDARD and LEGACY routes go to HR.
 * CEO routes go to the configured CEO.
 * Chairman routes go to the configured Chairman.
 */
UPDATE leave_cancellation_requests
SET assigned_decision_user_id =
  approver.user_id
FROM leave_requests
JOIN LATERAL (
  SELECT
    workflow_approvers.user_id
  FROM leave_workflow_approvers
    AS workflow_approvers
  WHERE workflow_approvers.authority_stage =
    CASE
      WHEN leave_requests.approval_route IN (
        'CEO_ONLY',
        'CEO_APPROVAL'
      )
      THEN 'CEO'

      WHEN leave_requests.approval_route =
        'CHAIRMAN_APPROVAL'
      THEN 'CHAIRMAN'

      ELSE 'HR'
    END

    AND workflow_approvers.is_active = TRUE

    AND workflow_approvers.effective_from <=
      CURRENT_DATE

    AND (
      workflow_approvers.effective_to IS NULL
      OR workflow_approvers.effective_to >=
        CURRENT_DATE
    )

  ORDER BY
    workflow_approvers.effective_from DESC,
    workflow_approvers.id DESC

  LIMIT 1
) AS approver
  ON TRUE

WHERE leave_requests.id =
  leave_cancellation_requests.leave_request_id

  AND leave_cancellation_requests.status =
    'PENDING'

  AND leave_cancellation_requests
    .assigned_decision_user_id IS NULL;

/*
 * Stop the migration if an existing pending request
 * could not be assigned.
 */
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM leave_cancellation_requests
    WHERE status = 'PENDING'
      AND assigned_decision_user_id IS NULL
  ) THEN
    RAISE EXCEPTION
      'One or more pending leave cancellations have no assigned decision user';
  END IF;
END
$$;

/*
 * Historical approved/rejected records may remain NULL,
 * but every pending cancellation must have an assignee.
 */
ALTER TABLE leave_cancellation_requests
ADD CONSTRAINT pending_leave_cancellation_requires_assignee
CHECK (
  status <> 'PENDING'
  OR assigned_decision_user_id IS NOT NULL
);

/*
 * This index supports the cancellation decision inbox.
 */
CREATE INDEX leave_cancellation_assigned_decision_index
ON leave_cancellation_requests (
  assigned_decision_user_id,
  requested_at
)
WHERE status = 'PENDING';

COMMIT;