import pool from "../config/database.js";

export async function findEmployeeForStaffCard(
  employeeId,
) {
  const result = await pool.query(
    `
      SELECT
        employees.id,
        employees.staff_number AS "staffNumber",
        employees.first_name AS "firstName",
        employees.last_name AS "lastName",
        employees.email,
        employees.photo_filename AS "photoFilename",
        employees.is_active AS "isActive",

        positions.title AS "position",
        departments.name AS "department",

        staff_cards.id AS "cardId",
        staff_cards.card_number AS "cardNumber",
        staff_cards.verification_token
          AS "verificationToken",
        staff_cards.issued_at AS "issuedAt",
        staff_cards.expires_at AS "expiresAt",
        staff_cards.status AS "cardStatus"

      FROM employees

      LEFT JOIN positions
        ON positions.id = employees.position_id

      LEFT JOIN departments
        ON departments.id = positions.department_id

      LEFT JOIN staff_cards
        ON staff_cards.employee_id = employees.id
        AND staff_cards.status = 'ACTIVE'

      WHERE employees.id = $1
    `,
    [employeeId],
  );

  return result.rows[0];
}