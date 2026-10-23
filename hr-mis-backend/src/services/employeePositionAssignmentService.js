import pool from "../config/database.js";

function createServiceError(
  message,
  statusCode,
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function assignEmployeePosition(
  employeeId,
  assignmentData,
  assignedByUserId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const employeeResult =
      await client.query(
        `
          SELECT
            id,
            staff_number AS "staffNumber",
            first_name AS "firstName",
            last_name AS "lastName",
            is_active AS "isActive",
            position_id AS "positionId"

          FROM employees
          WHERE id = $1
          FOR UPDATE
        `,
        [employeeId],
      );

    const employee =
      employeeResult.rows[0];

    if (!employee) {
      throw createServiceError(
        "Employee not found",
        404,
      );
    }

    if (!employee.isActive) {
      throw createServiceError(
        "Positions cannot be assigned to an inactive employee",
        409,
      );
    }

    const positionResult =
      await client.query(
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
        [assignmentData.positionId],
      );

    const position =
      positionResult.rows[0];

    if (!position) {
      throw createServiceError(
        "Position not found",
        404,
      );
    }

    if (!position.isActive) {
      throw createServiceError(
        "The selected position is inactive",
        409,
      );
    }

    const currentAssignmentsResult =
      await client.query(
        `
          SELECT
            assignments.id,
            assignments.employee_id
              AS "employeeId",
            assignments.position_id
              AS "positionId",
            assignments.assignment_type
              AS "assignmentType",
            assignments.start_date
              AS "startDate",

            employees.staff_number
              AS "staffNumber",

            CONCAT(
              employees.first_name,
              ' ',
              employees.last_name
            ) AS "employeeName"

          FROM employee_position_assignments
            AS assignments

          JOIN employees
            ON employees.id =
              assignments.employee_id

          WHERE assignments.end_date IS NULL
            AND (
              assignments.employee_id = $1
              OR assignments.position_id = $2
            )

          FOR UPDATE OF assignments
        `,
        [
          employeeId,
          assignmentData.positionId,
        ],
      );

    const currentAssignments =
      currentAssignmentsResult.rows;

    const employeeSubstantive =
      currentAssignments.find(
        (assignment) =>
          assignment.employeeId ===
            employeeId &&
          assignment.assignmentType ===
            "SUBSTANTIVE",
      );

    const employeeTemporary =
      currentAssignments.find(
        (assignment) =>
          assignment.employeeId ===
            employeeId &&
          ["ACTING", "INTERIM"].includes(
            assignment.assignmentType,
          ),
      );

    const targetSubstantive =
      currentAssignments.find(
        (assignment) =>
          assignment.positionId ===
            assignmentData.positionId &&
          assignment.assignmentType ===
            "SUBSTANTIVE",
      );

    const targetInterim =
      currentAssignments.find(
        (assignment) =>
          assignment.positionId ===
            assignmentData.positionId &&
          assignment.assignmentType ===
            "INTERIM",
      );

    const targetActing =
      currentAssignments.find(
        (assignment) =>
          assignment.positionId ===
            assignmentData.positionId &&
          assignment.assignmentType ===
            "ACTING",
      );

    if (
      employeeSubstantive?.positionId ===
        assignmentData.positionId
    ) {
      throw createServiceError(
        "The employee already holds this substantive position",
        409,
      );
    }

    if (
      assignmentData.assignmentType ===
      "SUBSTANTIVE"
    ) {
      if (
        targetSubstantive ||
        targetInterim
      ) {
        const holder =
          targetSubstantive ||
          targetInterim;

        throw createServiceError(
          `The selected position is currently occupied by ${holder.employeeName}`,
          409,
        );
      }

      if (targetActing) {
        throw createServiceError(
          "End the current acting assignment before making a substantive appointment to this position",
          409,
        );
      }

      if (employeeSubstantive) {
        await client.query(
          `
            UPDATE employee_position_assignments
            SET
              end_date = $2,
              ended_by_user_id = $3,
              assignment_note =
                CASE
                  WHEN assignment_note IS NULL
                    OR BTRIM(assignment_note) = ''
                  THEN
                    'Ended because of substantive transfer'
                  ELSE
                    assignment_note ||
                    E'\nEnded because of substantive transfer'
                END,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
          `,
          [
            employeeSubstantive.id,
            assignmentData.startDate,
            assignedByUserId,
          ],
        );
      }
    }

    if (
      assignmentData.assignmentType ===
      "ACTING"
    ) {
      if (!employeeSubstantive) {
        throw createServiceError(
          "An acting employee must have a substantive position",
          409,
        );
      }

      if (employeeTemporary) {
        throw createServiceError(
          "The employee already has an active temporary assignment",
          409,
        );
      }

      if (!targetSubstantive) {
        throw createServiceError(
          "An acting appointment requires the target position to have a substantive holder",
          409,
        );
      }

      if (
        targetSubstantive.employeeId ===
        employeeId
      ) {
        throw createServiceError(
          "An employee cannot act in their own substantive position",
          409,
        );
      }

      if (targetInterim || targetActing) {
        throw createServiceError(
          "The target position already has an active temporary assignment",
          409,
        );
      }
    }

    if (
      assignmentData.assignmentType ===
      "INTERIM"
    ) {
      if (!employeeSubstantive) {
        throw createServiceError(
          "An interim employee must have a substantive position",
          409,
        );
      }

      if (employeeTemporary) {
        throw createServiceError(
          "The employee already has an active temporary assignment",
          409,
        );
      }

      if (
        targetSubstantive ||
        targetInterim ||
        targetActing
      ) {
        throw createServiceError(
          "An interim appointment requires a completely vacant position",
          409,
        );
      }
    }

    const insertResult =
      await client.query(
        `
          INSERT INTO employee_position_assignments (
            employee_id,
            position_id,
            assignment_type,
            start_date,
            expected_end_date,
            assigned_by_user_id,
            assignment_note
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7
          )
          RETURNING
            id,
            employee_id AS "employeeId",
            position_id AS "positionId",
            assignment_type
              AS "assignmentType",
            start_date AS "startDate",
            expected_end_date
              AS "expectedEndDate",
            end_date AS "endDate",
            assigned_by_user_id
              AS "assignedByUserId",
            assignment_note
              AS "assignmentNote",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [
          employeeId,
          assignmentData.positionId,
          assignmentData.assignmentType,
          assignmentData.startDate,
          assignmentData.expectedEndDate,
          assignedByUserId,
          assignmentData.assignmentNote,
        ],
      );

    if (
      assignmentData.assignmentType ===
      "SUBSTANTIVE"
    ) {
      await client.query(
        `
          UPDATE employees
          SET
            position_id = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [
          employeeId,
          assignmentData.positionId,
        ],
      );
    }

    await client.query("COMMIT");

    return {
      ...insertResult.rows[0],
      employeeName:
        `${employee.firstName} ${employee.lastName}`,
      staffNumber: employee.staffNumber,
      positionCode: position.positionCode,
      position: position.title,
      department: position.department,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw createServiceError(
        "This assignment conflicts with an existing current assignment",
        409,
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function endTemporaryAssignment(
  employeeId,
  assignmentId,
  endData,
  endedByUserId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT
          assignments.id,
          assignments.employee_id
            AS "employeeId",
          assignments.position_id
            AS "positionId",
          assignments.assignment_type
            AS "assignmentType",
          assignments.start_date
            AS "startDate",
          assignments.end_date AS "endDate",

          positions.position_code
            AS "positionCode",
          positions.title AS position

        FROM employee_position_assignments
          AS assignments

        JOIN positions
          ON positions.id =
            assignments.position_id

        WHERE assignments.id = $1
          AND assignments.employee_id = $2

        FOR UPDATE OF assignments
      `,
      [
        assignmentId,
        employeeId,
      ],
    );

    const assignment = result.rows[0];

    if (!assignment) {
      throw createServiceError(
        "Position assignment not found",
        404,
      );
    }

    if (
      !["ACTING", "INTERIM"].includes(
        assignment.assignmentType,
      )
    ) {
      throw createServiceError(
        "Only acting or interim assignments can be ended through this endpoint",
        409,
      );
    }

    if (assignment.endDate) {
      throw createServiceError(
        "This temporary assignment has already ended",
        409,
      );
    }

    const updateResult =
      await client.query(
        `
          UPDATE employee_position_assignments
          SET
            end_date = $3,
            ended_by_user_id = $4,
            assignment_note =
              CASE
                WHEN $5::text IS NULL
                  OR BTRIM($5::text) = ''
                THEN assignment_note
                WHEN assignment_note IS NULL
                  OR BTRIM(assignment_note) = ''
                THEN $5::text
                ELSE
                  assignment_note ||
                  E'\n' ||
                  $5::text
              END,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
            AND employee_id = $2
          RETURNING
            id,
            employee_id AS "employeeId",
            position_id AS "positionId",
            assignment_type
              AS "assignmentType",
            start_date AS "startDate",
            expected_end_date
              AS "expectedEndDate",
            end_date AS "endDate",
            ended_by_user_id
              AS "endedByUserId",
            assignment_note
              AS "assignmentNote",
            updated_at AS "updatedAt"
        `,
        [
          assignmentId,
          employeeId,
          endData.endDate,
          endedByUserId,
          endData.endNote,
        ],
      );

    await client.query("COMMIT");

    return {
      ...updateResult.rows[0],
      positionCode: assignment.positionCode,
      position: assignment.position,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findEmployeePositionHistory(
  employeeId,
) {
  const employeeResult = await pool.query(
    `
      SELECT
        id,
        staff_number AS "staffNumber",
        first_name AS "firstName",
        last_name AS "lastName",
        is_active AS "isActive"
      FROM employees
      WHERE id = $1
    `,
    [employeeId],
  );

  const employee = employeeResult.rows[0];

  if (!employee) {
    return null;
  }

  const assignmentResult =
    await pool.query(
      `
        SELECT
          assignments.id,
          assignments.assignment_type
            AS "assignmentType",
          assignments.start_date
            AS "startDate",
          assignments.expected_end_date
            AS "expectedEndDate",
          assignments.end_date AS "endDate",
          assignments.assignment_note
            AS "assignmentNote",
          assignments.created_at
            AS "createdAt",
          assignments.updated_at
            AS "updatedAt",

          positions.id AS "positionId",
          positions.position_code
            AS "positionCode",
          positions.title AS position,
          positions.location_name
            AS "locationName",

          departments.id AS "departmentId",
          departments.name AS department,

          assigned_by.full_name
            AS "assignedBy",

          ended_by.full_name
            AS "endedBy",

          (
            assignments.end_date IS NULL
          ) AS "isCurrent"

        FROM employee_position_assignments
          AS assignments

        JOIN positions
          ON positions.id =
            assignments.position_id

        JOIN departments
          ON departments.id =
            positions.department_id

        LEFT JOIN app_users AS assigned_by
          ON assigned_by.id =
            assignments.assigned_by_user_id

        LEFT JOIN app_users AS ended_by
          ON ended_by.id =
            assignments.ended_by_user_id

        WHERE assignments.employee_id = $1

        ORDER BY
          assignments.start_date DESC,
          assignments.id DESC
      `,
      [employeeId],
    );

  return {
    ...employee,
    fullName:
      `${employee.firstName} ${employee.lastName}`,
    assignments: assignmentResult.rows,
  };
}