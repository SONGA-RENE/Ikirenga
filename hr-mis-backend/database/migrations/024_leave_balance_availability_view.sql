BEGIN;

CREATE OR REPLACE VIEW
employee_leave_entitlement_balances
AS

WITH allocation_totals AS (
  SELECT
    allocations.entitlement_id,

    COALESCE(
      SUM(
        CASE
          WHEN allocations.status =
            'RESERVED'
          THEN allocations.allocated_days
          ELSE 0
        END
      ),
      0
    )::integer AS reserved_days,

    COALESCE(
      SUM(
        CASE
          WHEN allocations.status =
            'RECONCILED'
          THEN allocations.consumed_days
          ELSE 0
        END
      ),
      0
    )::integer AS consumed_days

  FROM leave_entitlement_allocations
    AS allocations

  GROUP BY allocations.entitlement_id
)

SELECT
  entitlements.id
    AS "entitlementId",

  entitlements.employee_id
    AS "employeeId",

  entitlements.leave_type_id
    AS "leaveTypeId",

  leave_types.code,
  leave_types.name,

  entitlements.leave_year
    AS "leaveYear",

  entitlements.entitled_days
    AS "entitledDays",

  COALESCE(
    allocation_totals.reserved_days,
    0
  ) AS "reservedDays",

  COALESCE(
    allocation_totals.consumed_days,
    0
  ) AS "consumedDays",

  GREATEST(
    entitlements.entitled_days
      - COALESCE(
          allocation_totals.reserved_days,
          0
        )
      - COALESCE(
          allocation_totals.consumed_days,
          0
        ),
    0
  ) AS "unexpiredRemainingDays",

  CASE
    WHEN entitlements.available_from
      IS NULL
    THEN 0

    WHEN entitlements.available_from >
      CURRENT_DATE
    THEN 0

    WHEN entitlements.expires_on <
      CURRENT_DATE
    THEN 0

    ELSE GREATEST(
      entitlements.entitled_days
        - COALESCE(
            allocation_totals.reserved_days,
            0
          )
        - COALESCE(
            allocation_totals.consumed_days,
            0
          ),
      0
    )
  END AS "availableDays",

  entitlements.expires_on
    AS "expiresOn",

  entitlements.expires_on <
    CURRENT_DATE
    AS "isExpired",

  entitlements.source,

  entitlements.created_at
    AS "createdAt",

  entitlements.updated_at
    AS "updatedAt",

  -- New fields must remain at the end so that
  -- CREATE OR REPLACE VIEW preserves the
  -- existing view column order.
  entitlements.available_from
    AS "availableFrom",

  (
    entitlements.available_from
      IS NOT NULL
    AND entitlements.available_from <=
      CURRENT_DATE
    AND entitlements.expires_on >=
      CURRENT_DATE
  ) AS "isAvailable"

FROM employee_leave_entitlements
  AS entitlements

JOIN leave_types
  ON leave_types.id =
    entitlements.leave_type_id

LEFT JOIN allocation_totals
  ON allocation_totals.entitlement_id =
    entitlements.id;

COMMIT;