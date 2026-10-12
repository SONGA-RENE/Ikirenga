import pool from "../config/database.js";

export async function findAllLeaveTypes() {
  const result = await pool.query(`
    SELECT
      id,
      code,
      name,
      annual_entitlement AS "annualEntitlement",
      is_paid AS "isPaid",
      requires_attachment AS "requiresAttachment",
      is_active AS "isActive",
      created_at AS "createdAt"
    FROM leave_types
    ORDER BY name ASC
  `);

  return result.rows;
}

export async function findLeaveTypeById(id) {
  const result = await pool.query(
    `
      SELECT
        id,
        code,
        name,
        annual_entitlement AS "annualEntitlement",
        is_paid AS "isPaid",
        requires_attachment AS "requiresAttachment",
        is_active AS "isActive",
        created_at AS "createdAt"
      FROM leave_types
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0];
}

export async function insertLeaveType(leaveType) {
  const {
    code,
    name,
    annualEntitlement,
    isPaid,
    requiresAttachment,
  } = leaveType;

  const result = await pool.query(
    `
      INSERT INTO leave_types (
        code,
        name,
        annual_entitlement,
        is_paid,
        requires_attachment
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        code,
        name,
        annual_entitlement AS "annualEntitlement",
        is_paid AS "isPaid",
        requires_attachment AS "requiresAttachment",
        is_active AS "isActive",
        created_at AS "createdAt"
    `,
    [
      code,
      name,
      annualEntitlement,
      isPaid,
      requiresAttachment,
    ],
  );

  return result.rows[0];
}