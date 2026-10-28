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

async function findEmployeeById(employeeId, client = pool) {
  const result = await client.query(
    `
      SELECT
        employees.id,
        employees.staff_number AS "staffNumber",
        employees.first_name AS "firstName",
        employees.last_name AS "lastName",
        employees.email,
        employees.photo_filename AS "photoFilename",
        employees.is_active
          AS "isActive",

        employees.employment_status
          AS "employmentStatus",

        employees.status_effective_date
          AS "statusEffectiveDate",

        employees.last_working_date
          AS "lastWorkingDate",

        employees.employment_status_reason
          AS "employmentStatusReason",

        employees.created_at
          AS "createdAt",
        employees.updated_at AS "updatedAt",
        positions.id AS "positionId",
        positions.title AS "position",
        departments.id AS "departmentId",
        departments.name AS "department"
      FROM employees
      LEFT JOIN positions
        ON positions.id = employees.position_id
      LEFT JOIN departments
        ON departments.id = positions.department_id
      WHERE employees.id = $1
    `,
    [employeeId],
  );

  return result.rows[0] || null;
}

export async function findAll() {
  const result = await pool.query(
    `
      SELECT
        employees.id,

        employees.staff_number
          AS "staffNumber",

        employees.first_name
          AS "firstName",

        employees.last_name
          AS "lastName",

        employees.email,

        employees.photo_filename
          AS "photoFilename",

        employees.is_active
          AS "isActive",

        employees.employment_status
          AS "employmentStatus",

        employees.status_effective_date
          AS "statusEffectiveDate",

        employees.last_working_date
          AS "lastWorkingDate",

        employees.employment_status_reason
          AS "employmentStatusReason",

        employees.created_at
          AS "createdAt",

        employees.updated_at
          AS "updatedAt",

        positions.id
          AS "positionId",

        positions.title
          AS "position",

        departments.id
          AS "departmentId",

        departments.name
          AS "department"

      FROM employees

      LEFT JOIN positions
        ON positions.id =
          employees.position_id

      LEFT JOIN departments
        ON departments.id =
          positions.department_id

      ORDER BY
        employees.first_name,
        employees.last_name
    `,
  );

  return result.rows;
}

export async function findById(employeeId) {
  return findEmployeeById(employeeId);
}

export async function create(employeeData, createdByUserId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const positionResult = await client.query(
      `
        SELECT
          positions.id,
          positions.position_code
            AS "positionCode",
          positions.title,
          positions.is_active AS "isActive",
          departments.name AS department

        FROM positions

        JOIN departments
          ON departments.id =
            positions.department_id

        WHERE positions.id = $1

        FOR UPDATE OF positions
      `,
      [employeeData.positionId],
    );

    const position = positionResult.rows[0];

    if (!position) {
      const error = new Error("Selected position does not exist");

      error.statusCode = 404;
      throw error;
    }

    if (!position.isActive) {
      const error = new Error("Selected position is inactive");

      error.statusCode = 409;
      throw error;
    }

    const occupationResult = await client.query(
      `
          SELECT
            employee_position_assignments.id,
            employee_position_assignments.employee_id
              AS "employeeId",

            CONCAT(
              employees.first_name,
              ' ',
              employees.last_name
            ) AS "employeeName"

          FROM employee_position_assignments

          JOIN employees
            ON employees.id =
              employee_position_assignments.employee_id

          WHERE
            employee_position_assignments.position_id =
              $1
            AND
              employee_position_assignments.end_date
                IS NULL
        `,
      [employeeData.positionId],
    );

    if (occupationResult.rows[0]) {
      const error = new Error(
        `The selected position is already occupied by ` +
          `${occupationResult.rows[0].employeeName}`,
      );

      error.statusCode = 409;
      throw error;
    }

    const employeeResult = await client.query(
      `
          INSERT INTO employees (
            staff_number,
            first_name,
            last_name,
            email,
            position_id
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5
          )
          RETURNING
            id,
            staff_number AS "staffNumber",
            first_name AS "firstName",
            last_name AS "lastName",
            email,
            is_active AS "isActive",
            created_at AS "createdAt",
            updated_at AS "updatedAt",
            position_id AS "positionId"
        `,
      [
        employeeData.staffNumber,
        employeeData.firstName,
        employeeData.lastName,
        employeeData.email,
        employeeData.positionId,
      ],
    );

    const employee = employeeResult.rows[0];

    await client.query(
      `
        INSERT INTO employee_position_assignments (
          employee_id,
          position_id,
          assignment_type,
          start_date,
          assigned_by_user_id,
          assignment_note
        )
        VALUES (
          $1,
          $2,
          'SUBSTANTIVE',
          CURRENT_DATE,
          $3,
          'Initial position assigned during employee creation'
        )
      `,
      [employee.id, employeeData.positionId, createdByUserId],
    );

    await client.query("COMMIT");

    return {
      ...employee,
      positionCode: position.positionCode,
      position: position.title,
      department: position.department,
    };
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
      values,
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    const employee = await findEmployeeById(result.rows[0].id, false, client);

    await client.query("COMMIT");

    return employee;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deactivate(employeeId, endedByUserId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const employeeResult = await client.query(
      `
          SELECT
            id,
            staff_number AS "staffNumber",
            first_name AS "firstName",
            last_name AS "lastName",
            email,
            is_active AS "isActive",
            position_id AS "positionId"

          FROM employees

          WHERE id = $1

          FOR UPDATE
        `,
      [employeeId],
    );

    const employee = employeeResult.rows[0];

    if (!employee) {
      await client.query("ROLLBACK");
      return null;
    }

    if (!employee.isActive) {
      const error = new Error("Employee is already inactive");

      error.statusCode = 409;
      throw error;
    }

    const updateResult = await client.query(
      `
          UPDATE employees
          SET
            is_active = FALSE,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING
            id,
            staff_number AS "staffNumber",
            first_name AS "firstName",
            last_name AS "lastName",
            email,
            is_active AS "isActive",
            position_id AS "positionId",
            updated_at AS "updatedAt"
        `,
      [employeeId],
    );

    await client.query(
      `
        UPDATE employee_position_assignments
        SET
          end_date = CURRENT_DATE,
          ended_by_user_id = $2,
          assignment_note =
            CASE
              WHEN assignment_note IS NULL
                OR BTRIM(assignment_note) = ''
              THEN
                'Assignment ended because employee was deactivated'
              ELSE
                assignment_note ||
                E'\nAssignment ended because employee was deactivated'
            END,
          updated_at = CURRENT_TIMESTAMP
        WHERE employee_id = $1
          AND end_date IS NULL
      `,
      [employeeId, endedByUserId],
    );

    await client.query("COMMIT");

    return updateResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateEmployeePhoto(employeeId, photoFilename) {
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
      previousPhotoFilename: existingEmployee.previousPhotoFilename,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function verifyEmployeeServiceStartDate(
  employeeId,
  { continuousServiceStartDate, changeReason },
  changedByUserId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const employeeResult = await client.query(
      `
        SELECT
          id,
          staff_number AS "staffNumber",
          first_name AS "firstName",
          last_name AS "lastName",
          continuous_service_start_date
            AS "continuousServiceStartDate",
          service_start_date_verified
            AS "serviceStartDateVerified"
        FROM employees
        WHERE id = $1
        FOR UPDATE
      `,
      [employeeId],
    );

    const employee = employeeResult.rows[0];

    if (!employee) {
      const error = new Error("Employee not found");

      error.statusCode = 404;
      throw error;
    }

    const dateResult = await client.query(
      `
        SELECT
          CURRENT_DATE::text AS "today",
          ($1::date + INTERVAL '1 year')::date::text
            AS "annualLeaveEligibleFrom"
      `,
      [continuousServiceStartDate],
    );

    const { today, annualLeaveEligibleFrom } = dateResult.rows[0];

    if (continuousServiceStartDate > today) {
      const error = new Error(
        "Continuous service start date cannot be in the future",
      );

      error.statusCode = 400;
      throw error;
    }

    await client.query(
      `
        INSERT INTO employee_service_date_history (
          employee_id,
          previous_service_start_date,
          new_service_start_date,
          previous_verified,
          change_reason,
          changed_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        employeeId,
        employee.continuousServiceStartDate,
        continuousServiceStartDate,
        employee.serviceStartDateVerified,
        changeReason,
        changedByUserId,
      ],
    );

    const updateResult = await client.query(
      `
        UPDATE employees
        SET
          continuous_service_start_date = $2,
          service_start_date_verified = TRUE,
          service_start_date_updated_at =
            CURRENT_TIMESTAMP,
          service_start_date_updated_by_user_id = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING
          id,
          staff_number AS "staffNumber",
          first_name AS "firstName",
          last_name AS "lastName",
          continuous_service_start_date
            AS "continuousServiceStartDate",
          service_start_date_verified
            AS "serviceStartDateVerified",
          service_start_date_updated_at
            AS "serviceStartDateUpdatedAt",
          service_start_date_updated_by_user_id
            AS "serviceStartDateUpdatedByUserId"
      `,
      [employeeId, continuousServiceStartDate, changedByUserId],
    );

    await client.query("COMMIT");

    return {
      ...updateResult.rows[0],
      annualLeaveEligibleFrom,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
