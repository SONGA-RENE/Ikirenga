import pool from "../config/database.js";

export async function findAllPositions() {
  const result = await pool.query(
    `
      SELECT
        positions.id,
        positions.title,
        positions.description,

        positions.department_id
          AS "departmentId",

        departments.name
          AS "department",

        positions.is_active
          AS "isActive",

        positions.created_at
          AS "createdAt",

        positions.updated_at
          AS "updatedAt"

      FROM positions

      JOIN departments
        ON departments.id =
          positions.department_id

      ORDER BY
        departments.name,
        positions.title
    `,
  );

  return result.rows;
}