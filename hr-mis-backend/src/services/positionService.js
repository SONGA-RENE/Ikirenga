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

export async function findAvailablePositions() {
  const result = await pool.query(
    `
      SELECT
        available_positions.id,

        available_positions.position_code
          AS "positionCode",

        available_positions.title,

        available_positions.department_id
          AS "departmentId",

        available_positions.department,

        available_positions."unitType",

        available_positions.reports_to_position_id
          AS "reportsToPositionId",

        manager.title AS "reportsToPosition",

        available_positions.location_name
          AS "locationName",

        available_positions.seat_number
          AS "seatNumber",

        available_positions.description,

        available_positions.is_active
          AS "isActive"

      FROM available_positions

      LEFT JOIN positions AS manager
        ON manager.id =
          available_positions.reports_to_position_id

      ORDER BY
        available_positions.department,
        available_positions.title,
        available_positions.location_name
          NULLS FIRST,
        available_positions.seat_number
    `,
  );

  return result.rows;
}

export async function createPosition(
  positionData,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const departmentResult =
      await client.query(
        `
          SELECT
            id,
            name,
            is_active AS "isActive"
          FROM departments
          WHERE id = $1
          FOR UPDATE
        `,
        [positionData.departmentId],
      );

    const department =
      departmentResult.rows[0];

    if (!department) {
      const error = new Error(
        "Organizational unit not found",
      );
      error.statusCode = 404;
      throw error;
    }

    if (!department.isActive) {
      const error = new Error(
        "Positions cannot be created under an inactive organizational unit",
      );
      error.statusCode = 409;
      throw error;
    }

    if (positionData.reportsToPositionId) {
      const managerResult =
        await client.query(
          `
            SELECT
              id,
              title,
              is_active AS "isActive"
            FROM positions
            WHERE id = $1
            FOR UPDATE
          `,
          [positionData.reportsToPositionId],
        );

      const manager = managerResult.rows[0];

      if (!manager) {
        const error = new Error(
          "Reporting position not found",
        );
        error.statusCode = 404;
        throw error;
      }

      if (!manager.isActive) {
        const error = new Error(
          "The reporting position is inactive",
        );
        error.statusCode = 409;
        throw error;
      }
    }

    const result = await client.query(
      `
        INSERT INTO positions (
          department_id,
          position_code,
          title,
          reports_to_position_id,
          location_name,
          seat_number,
          description,
          is_active
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          TRUE
        )
        RETURNING
          id,
          position_code AS "positionCode",
          title,
          department_id AS "departmentId",

          reports_to_position_id
            AS "reportsToPositionId",

          location_name AS "locationName",
          seat_number AS "seatNumber",
          description,
          is_active AS "isActive",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        positionData.departmentId,
        positionData.positionCode,
        positionData.title,
        positionData.reportsToPositionId,
        positionData.locationName,
        positionData.seatNumber,
        positionData.description,
      ],
    );

    await client.query("COMMIT");

    return {
      ...result.rows[0],
      department: department.name,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (
      error.code === "23505" &&
      error.constraint ===
        "positions_position_code_unique"
    ) {
      const conflictError = new Error(
        "Position code already exists",
      );
      conflictError.statusCode = 409;
      throw conflictError;
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function updatePosition(
  positionId,
  changes,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult =
      await client.query(
        `
          SELECT
            id,
            position_code AS "positionCode",
            title,
            department_id AS "departmentId",

            reports_to_position_id
              AS "reportsToPositionId",

            location_name AS "locationName",
            seat_number AS "seatNumber",
            description,
            is_active AS "isActive"

          FROM positions

          WHERE id = $1

          FOR UPDATE
        `,
        [positionId],
      );

    const current = currentResult.rows[0];

    if (!current) {
      await client.query("ROLLBACK");
      return null;
    }

    const departmentId =
      changes.departmentId ??
      current.departmentId;

    const title =
      changes.title ?? current.title;

    const locationName =
      changes.locationName !== undefined
        ? changes.locationName
        : current.locationName;

    const seatNumber =
      changes.seatNumber ??
      current.seatNumber;

    const description =
      changes.description !== undefined
        ? changes.description
        : current.description;

    const reportsToPositionId =
      changes.reportsToPositionId !==
      undefined
        ? changes.reportsToPositionId
        : current.reportsToPositionId;

    const departmentResult =
      await client.query(
        `
          SELECT
            id,
            name,
            is_active AS "isActive"
          FROM departments
          WHERE id = $1
        `,
        [departmentId],
      );

    const department =
      departmentResult.rows[0];

    if (!department) {
      const error = new Error(
        "Organizational unit not found",
      );
      error.statusCode = 404;
      throw error;
    }

    if (!department.isActive) {
      const error = new Error(
        "Position cannot be moved to an inactive organizational unit",
      );
      error.statusCode = 409;
      throw error;
    }

    if (reportsToPositionId === positionId) {
      const error = new Error(
        "A position cannot report to itself",
      );
      error.statusCode = 400;
      throw error;
    }

    if (reportsToPositionId !== null) {
      const managerResult =
        await client.query(
          `
            SELECT
              id,
              title,
              is_active AS "isActive"
            FROM positions
            WHERE id = $1
          `,
          [reportsToPositionId],
        );

      const manager = managerResult.rows[0];

      if (!manager) {
        const error = new Error(
          "Reporting position not found",
        );
        error.statusCode = 404;
        throw error;
      }

      if (!manager.isActive) {
        const error = new Error(
          "The reporting position is inactive",
        );
        error.statusCode = 409;
        throw error;
      }

      const cycleResult =
        await client.query(
          `
            WITH RECURSIVE reporting_chain AS (
              SELECT
                id,
                reports_to_position_id
              FROM positions
              WHERE id = $1

              UNION ALL

              SELECT
                parent.id,
                parent.reports_to_position_id
              FROM positions AS parent

              JOIN reporting_chain
                ON parent.id =
                  reporting_chain.reports_to_position_id
            )
            SELECT 1
            FROM reporting_chain
            WHERE id = $2
            LIMIT 1
          `,
          [
            reportsToPositionId,
            positionId,
          ],
        );

      if (cycleResult.rows[0]) {
        const error = new Error(
          "This reporting relationship would create a hierarchy cycle",
        );
        error.statusCode = 409;
        throw error;
      }
    }

    const result = await client.query(
      `
        UPDATE positions
        SET
          department_id = $2,
          title = $3,
          reports_to_position_id = $4,
          location_name = $5,
          seat_number = $6,
          description = $7,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING
          id,
          position_code AS "positionCode",
          title,
          department_id AS "departmentId",

          reports_to_position_id
            AS "reportsToPositionId",

          location_name AS "locationName",
          seat_number AS "seatNumber",
          description,
          is_active AS "isActive",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        positionId,
        departmentId,
        title,
        reportsToPositionId,
        locationName,
        seatNumber,
        description,
      ],
    );

    await client.query("COMMIT");

    return {
      ...result.rows[0],
      department: department.name,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deactivatePosition(
  positionId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const positionResult =
      await client.query(
        `
          SELECT
            id,
            position_code AS "positionCode",
            title,
            is_active AS "isActive"
          FROM positions
          WHERE id = $1
          FOR UPDATE
        `,
        [positionId],
      );

    const position =
      positionResult.rows[0];

    if (!position) {
      await client.query("ROLLBACK");
      return null;
    }

    if (!position.isActive) {
      const error = new Error(
        "Position is already inactive",
      );
      error.statusCode = 409;
      throw error;
    }

    const occupantResult =
      await client.query(
        `
          SELECT
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

          LIMIT 1
        `,
        [positionId],
      );

    if (occupantResult.rows[0]) {
      const error = new Error(
        `Position cannot be deactivated because it is occupied by ` +
        `${occupantResult.rows[0].employeeName}`,
      );
      error.statusCode = 409;
      throw error;
    }

    const subordinateResult =
      await client.query(
        `
          SELECT COUNT(*)::integer
            AS "activeSubordinates"
          FROM positions
          WHERE reports_to_position_id = $1
            AND is_active = TRUE
        `,
        [positionId],
      );

    if (
      subordinateResult.rows[0]
        .activeSubordinates > 0
    ) {
      const error = new Error(
        "Position cannot be deactivated while active positions report to it",
      );
      error.statusCode = 409;
      throw error;
    }

    const result = await client.query(
      `
        UPDATE positions
        SET
          is_active = FALSE,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING
          id,
          position_code AS "positionCode",
          title,
          is_active AS "isActive",
          updated_at AS "updatedAt"
      `,
      [positionId],
    );

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findActingEligiblePositions() {
  const result = await pool.query(
    `
      SELECT
        positions.id,

        positions.position_code
          AS "positionCode",

        positions.title,

        positions.department_id
          AS "departmentId",

        departments.name AS department,

        departments.unit_type
          AS "unitType",

        positions.location_name
          AS "locationName",

        positions.seat_number
          AS "seatNumber",

        substantive.employee_id
          AS "substantiveEmployeeId",

        substantive_employee.staff_number
          AS "substantiveStaffNumber",

        CONCAT(
          substantive_employee.first_name,
          ' ',
          substantive_employee.last_name
        ) AS "substantiveEmployeeName"

      FROM positions

      JOIN departments
        ON departments.id =
          positions.department_id

      JOIN employee_position_assignments
        AS substantive
        ON substantive.position_id =
          positions.id
        AND substantive.assignment_type =
          'SUBSTANTIVE'
        AND substantive.end_date IS NULL

      JOIN employees AS substantive_employee
        ON substantive_employee.id =
          substantive.employee_id
        AND substantive_employee.is_active =
          TRUE

      WHERE positions.is_active = TRUE

        AND NOT EXISTS (
          SELECT 1
          FROM employee_position_assignments
            AS temporary_assignment

          WHERE
            temporary_assignment.position_id =
              positions.id
            AND temporary_assignment.end_date
              IS NULL
            AND temporary_assignment.assignment_type
              IN (
                'ACTING',
                'INTERIM'
              )
        )

      ORDER BY
        departments.name,
        positions.title,
        positions.location_name NULLS FIRST,
        positions.seat_number
    `,
  );

  return result.rows;
}