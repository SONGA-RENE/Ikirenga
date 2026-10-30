import pool from "../config/database.js";

const leaveTypeSelect = `
  SELECT
    id,
    code,
    name,

    annual_entitlement
      AS "annualEntitlement",

    is_paid
      AS "isPaid",

    requires_attachment
      AS "requiresAttachment",

    entitlement_mode
      AS "entitlementMode",

    duration_value
      AS "durationValue",

    duration_unit
      AS "durationUnit",

    eligible_gender
      AS "eligibleGender",

    carry_forward_years
      AS "carryForwardYears",

    is_active
      AS "isActive",

    created_at
      AS "createdAt"

  FROM leave_types
`;

export async function findAllLeaveTypes({ activeOnly = false } = {}) {
  const result = await pool.query(
    `
      ${leaveTypeSelect}

      WHERE (
        $1::boolean = FALSE
        OR is_active = TRUE
      )

      ORDER BY name ASC
    `,
    [activeOnly],
  );

  return result.rows;
}

export async function findLeaveTypeById(id) {
  const result = await pool.query(
    `
      ${leaveTypeSelect}
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0] || null;
}

export async function insertLeaveType(leaveType) {
  const {
    code,
    name,
    annualEntitlement,
    isPaid,
    requiresAttachment,
    entitlementMode,
    durationValue,
    durationUnit,
    eligibleGender,
    carryForwardYears,
  } = leaveType;

  const result = await pool.query(
    `
      INSERT INTO leave_types (
        code,
        name,
        annual_entitlement,
        is_paid,
        requires_attachment,
        entitlement_mode,
        duration_value,
        duration_unit,
        eligible_gender,
        carry_forward_years
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7,
        $8,
        $9,
        $10
      )
      RETURNING
        id,
        code,
        name,

        annual_entitlement
          AS "annualEntitlement",

        is_paid
          AS "isPaid",

        requires_attachment
          AS "requiresAttachment",

        entitlement_mode
          AS "entitlementMode",

        duration_value
          AS "durationValue",

        duration_unit
          AS "durationUnit",

        eligible_gender
          AS "eligibleGender",

        carry_forward_years
          AS "carryForwardYears",

        is_active
          AS "isActive",

        created_at
          AS "createdAt"
    `,
    [
      code,
      name,
      annualEntitlement,
      isPaid,
      requiresAttachment,
      entitlementMode,
      durationValue,
      durationUnit,
      eligibleGender,
      carryForwardYears,
    ],
  );

  return result.rows[0];
}
export async function updateLeaveTypeActiveStatus(id, isActive) {
  const result = await pool.query(
    `
      UPDATE leave_types
      SET
        is_active = $2
      WHERE id = $1
      RETURNING
        id,
        code,
        name,
        annual_entitlement
          AS "annualEntitlement",
        is_paid
          AS "isPaid",
        requires_attachment
          AS "requiresAttachment",
        entitlement_mode
          AS "entitlementMode",
        duration_value
          AS "durationValue",
        duration_unit
          AS "durationUnit",
        eligible_gender
          AS "eligibleGender",
        carry_forward_years
          AS "carryForwardYears",
        is_active
          AS "isActive",
        created_at
          AS "createdAt"
    `,
    [id, isActive],
  );

  return result.rows[0];
}
