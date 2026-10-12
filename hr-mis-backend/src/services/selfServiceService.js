import pool from "../config/database.js";

export async function findMyEmployeeProfile(employeeId) {
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

  return result.rows[0];
}

export async function findMyContracts(employeeId) {
  const result = await pool.query(
    `
      SELECT
        id,
        contract_type AS "contractType",
        start_date AS "startDate",
        end_date AS "endDate",
        status,
        termination_date AS "terminationDate",
        termination_reason AS "terminationReason",
        created_at AS "createdAt"
      FROM contracts
      WHERE employee_id = $1
      ORDER BY start_date DESC
    `,
    [employeeId],
  );

  return result.rows;
}

export async function findMyLeaveRequests(employeeId) {
  const result = await pool.query(
    `
      SELECT
        leave_requests.id,

        leave_types.id AS "leaveTypeId",
        leave_types.code AS "leaveTypeCode",
        leave_types.name AS "leaveTypeName",

        leave_requests.start_date AS "startDate",
        leave_requests.end_date AS "endDate",
        leave_requests.requested_days AS "requestedDays",
        leave_requests.reason,
        leave_requests.status,

        leave_requests.decision_note AS "decisionNote",
        leave_requests.decision_at AS "decisionAt",

        decision_user.full_name AS "decidedBy",

        leave_requests.created_at AS "createdAt",
        leave_requests.updated_at AS "updatedAt"

      FROM leave_requests

      JOIN leave_types
        ON leave_types.id =
           leave_requests.leave_type_id

      LEFT JOIN app_users AS decision_user
        ON decision_user.id =
           leave_requests.decided_by_user_id

      WHERE leave_requests.employee_id = $1

      ORDER BY leave_requests.created_at DESC
    `,
    [employeeId],
  );

  return result.rows;
}