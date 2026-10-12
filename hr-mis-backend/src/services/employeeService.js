import pool from "../config/database.js";

const employeeColumns = `
  e.id,
  e.staff_number AS "staffNumber",
  e.first_name AS "firstName",
  e.last_name AS "lastName",
  e.email,
  e.is_active AS "isActive",
  e.created_at AS "createdAt",
  e.updated_at AS "updatedAt",
  p.id AS "positionId",
  p.title AS "position",
  d.id AS "departmentId",
  d.name AS "department"
`;

async function findEmployeeById(
  employeeId,
  includeInactive = false,
  database = pool
) {
  const activeCondition = includeInactive
    ? ""
    : "AND e.is_active = TRUE";

  const result = await database.query(
    `
      SELECT ${employeeColumns}
      FROM employees e
      JOIN positions p
        ON p.id = e.position_id
      JOIN departments d
        ON d.id = p.department_id
      WHERE e.id = $1
        ${activeCondition}
    `,
    [employeeId]
  );

  return result.rows[0] || null;
}

export async function findAll() {
  const result = await pool.query(`
    SELECT ${employeeColumns}
    FROM employees e
    JOIN positions p
      ON p.id = e.position_id
    JOIN departments d
      ON d.id = p.department_id
    WHERE e.is_active = TRUE
    ORDER BY e.id ASC
  `);

  return result.rows;
}

export async function findById(employeeId) {
  return findEmployeeById(employeeId);
}

export async function create(employeeData) {
  const {
    staffNumber,
    firstName,
    lastName,
    email,
    positionId,
  } = employeeData;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        INSERT INTO employees (
          staff_number,
          first_name,
          last_name,
          email,
          position_id
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `,
      [
        staffNumber,
        firstName,
        lastName,
        email,
        positionId,
      ]
    );

    const employee = await findEmployeeById(
      result.rows[0].id,
      false,
      client
    );

    await client.query("COMMIT");

    return employee;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function update(employeeId, updates) {
  const fieldToColumn = {
    staffNumber: "staff_number",
    firstName: "first_name",
    lastName: "last_name",
    email: "email",
    positionId: "position_id",
  };

  const values = [];

  const setClauses = Object.keys(updates).map((field, index) => {
    values.push(updates[field]);

    return `${fieldToColumn[field]} = $${index + 1}`;
  });

  values.push(employeeId);
  const employeeIdPosition = values.length;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        UPDATE employees
        SET
          ${setClauses.join(", ")},
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $${employeeIdPosition}
          AND is_active = TRUE
        RETURNING id
      `,
      values
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const employee = await findEmployeeById(
      result.rows[0].id,
      false,
      client
    );

    await client.query("COMMIT");

    return employee;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deactivate(employeeId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        UPDATE employees
        SET
          is_active = FALSE,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND is_active = TRUE
        RETURNING id
      `,
      [employeeId]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const employee = await findEmployeeById(
      result.rows[0].id,
      true,
      client
    );

    await client.query("COMMIT");

    return employee;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateEmployeePhoto(
  employeeId,
  photoFilename,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      `
        SELECT
          id,
          photo_filename AS "previousPhotoFilename"
        FROM employees
        WHERE id = $1
        FOR UPDATE
      `,
      [employeeId],
    );

    const existingEmployee = existingResult.rows[0];

    if (!existingEmployee) {
      await client.query("ROLLBACK");
      return null;
    }

    const updateResult = await client.query(
      `
        UPDATE employees
        SET
          photo_filename = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING
          id,
          staff_number AS "staffNumber",
          first_name AS "firstName",
          last_name AS "lastName",
          email,
          photo_filename AS "photoFilename",
          updated_at AS "updatedAt"
      `,
      [employeeId, photoFilename],
    );

    await client.query("COMMIT");

    return {
      employee: updateResult.rows[0],
      previousPhotoFilename:
        existingEmployee.previousPhotoFilename,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}