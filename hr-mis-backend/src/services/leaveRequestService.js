import pool from "../config/database.js";

async function calculateWorkingDays(
  client,
  startDate,
  endDate,
) {
  const result = await client.query(
    `
      SELECT COUNT(*)::integer AS days
      FROM generate_series(
        $1::date,
        $2::date,
        '1 day'::interval
      ) AS calendar_day
      WHERE EXTRACT(ISODOW FROM calendar_day)
        BETWEEN 1 AND 5
        AND NOT EXISTS (
          SELECT 1
          FROM public_holidays
          WHERE holiday_date = calendar_day::date
        )
    `,
    [startDate, endDate],
  );

  return result.rows[0].days;
}

export async function findAllLeaveRequests() {
  const result = await pool.query(`
    SELECT
      leave_requests.id,

      employees.id AS "employeeId",
      employees.staff_number AS "staffNumber",
      employees.first_name AS "firstName",
      employees.last_name AS "lastName",

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
      leave_requests.created_at AS "createdAt",
      leave_requests.updated_at AS "updatedAt"

    FROM leave_requests

    JOIN employees
      ON employees.id = leave_requests.employee_id

    JOIN leave_types
      ON leave_types.id = leave_requests.leave_type_id

    ORDER BY leave_requests.created_at DESC
  `);

  return result.rows;
}

export async function findLeaveRequestById(id) {
  const result = await pool.query(
    `
      SELECT
        leave_requests.id,

        employees.id AS "employeeId",
        employees.staff_number AS "staffNumber",
        employees.first_name AS "firstName",
        employees.last_name AS "lastName",

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
        leave_requests.created_at AS "createdAt",
        leave_requests.updated_at AS "updatedAt"

      FROM leave_requests

      JOIN employees
        ON employees.id = leave_requests.employee_id

      JOIN leave_types
        ON leave_types.id = leave_requests.leave_type_id

      WHERE leave_requests.id = $1
    `,
    [id],
  );

  return result.rows[0];
}

export async function insertLeaveRequest(leaveRequest) {
  const {
    employeeId,
    leaveTypeId,
    startDate,
    endDate,
    reason,
  } = leaveRequest;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const employeeResult = await client.query(
      `
        SELECT
          id,
          is_active AS "isActive",
          CURRENT_DATE::text AS "today"
        FROM employees
        WHERE id = $1
      `,
      [employeeId],
    );

    const employee = employeeResult.rows[0];

    if (!employee) {
      const error = new Error("Employee not found");
      error.statusCode = 404;
      throw error;
    }

    if (!employee.isActive) {
      const error = new Error(
        "Inactive employees cannot request leave",
      );
      error.statusCode = 409;
      throw error;
    }

    if (startDate < employee.today) {
      const error = new Error(
        "Leave start date cannot be in the past",
      );
      error.statusCode = 400;
      throw error;
    }

    const leaveTypeResult = await client.query(
      `
        SELECT
          id,
          name,
          is_active AS "isActive",
          requires_attachment AS "requiresAttachment"
        FROM leave_types
        WHERE id = $1
      `,
      [leaveTypeId],
    );

    const leaveType = leaveTypeResult.rows[0];

    if (!leaveType) {
      const error = new Error("Leave type not found");
      error.statusCode = 404;
      throw error;
    }

    if (!leaveType.isActive) {
      const error = new Error(
        "The selected leave type is inactive",
      );
      error.statusCode = 409;
      throw error;
    }

    const contractResult = await client.query(
      `
        SELECT id
        FROM contracts
        WHERE employee_id = $1
          AND status IN ('ACTIVE', 'UPCOMING')
          AND start_date <= $2::date
          AND (
            end_date IS NULL
            OR end_date >= $3::date
          )
        LIMIT 1
      `,
      [employeeId, startDate, endDate],
    );

    if (!contractResult.rows[0]) {
      const error = new Error(
        "No employment contract covers the requested leave period",
      );
      error.statusCode = 409;
      throw error;
    }

    const requestedDays = await calculateWorkingDays(
      client,
      startDate,
      endDate,
    );

    if (requestedDays <= 0) {
      const error = new Error(
        "The selected period contains no working days",
      );
      error.statusCode = 400;
      throw error;
    }

    const result = await client.query(
      `
        INSERT INTO leave_requests (
          employee_id,
          leave_type_id,
          start_date,
          end_date,
          requested_days,
          reason
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING
          id,
          employee_id AS "employeeId",
          leave_type_id AS "leaveTypeId",
          start_date AS "startDate",
          end_date AS "endDate",
          requested_days AS "requestedDays",
          reason,
          status,
          created_at AS "createdAt"
      `,
      [
        employeeId,
        leaveTypeId,
        startDate,
        endDate,
        requestedDays,
        reason,
      ],
    );

    await client.query("COMMIT");

    return {
      ...result.rows[0],
      requiresAttachment: leaveType.requiresAttachment,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}  
 
export async function approveLeaveRequest(
  requestId,
  approverUserId,
  decisionNote = null,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      `
        SELECT
          leave_requests.id,
          leave_requests.employee_id AS "employeeId",
          leave_requests.leave_type_id AS "leaveTypeId",
          leave_requests.requested_days AS "requestedDays",
          leave_requests.status,
          EXTRACT(
            YEAR FROM leave_requests.start_date
          )::integer AS "leaveYear",
          leave_types.annual_entitlement AS "annualEntitlement"
        FROM leave_requests
        JOIN leave_types
          ON leave_types.id =
             leave_requests.leave_type_id
        WHERE leave_requests.id = $1
        FOR UPDATE OF leave_requests
      `,
      [requestId],
    );

    const leaveRequest = requestResult.rows[0];

    if (!leaveRequest) {
      const error = new Error("Leave request not found");
      error.statusCode = 404;
      throw error;
    }

    if (leaveRequest.status !== "PENDING") {
      const error = new Error(
        `Only a pending request can be approved. Current status: ${leaveRequest.status}`,
      );
      error.statusCode = 409;
      throw error;
    }

    let balance = null;

    if (leaveRequest.annualEntitlement !== null) {
      await client.query(
        `
          INSERT INTO employee_leave_entitlements (
            employee_id,
            leave_type_id,
            leave_year,
            entitled_days
          )
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (
            employee_id,
            leave_type_id,
            leave_year
          )
          DO NOTHING
        `,
        [
          leaveRequest.employeeId,
          leaveRequest.leaveTypeId,
          leaveRequest.leaveYear,
          leaveRequest.annualEntitlement,
        ],
      );

      const entitlementResult = await client.query(
        `
          SELECT entitled_days AS "entitledDays"
          FROM employee_leave_entitlements
          WHERE employee_id = $1
            AND leave_type_id = $2
            AND leave_year = $3
          FOR UPDATE
        `,
        [
          leaveRequest.employeeId,
          leaveRequest.leaveTypeId,
          leaveRequest.leaveYear,
        ],
      );

      const entitledDays =
        entitlementResult.rows[0].entitledDays;

      const usedResult = await client.query(
        `
          SELECT
            COALESCE(SUM(requested_days), 0)::integer
              AS "usedDays"
          FROM leave_requests
          WHERE employee_id = $1
            AND leave_type_id = $2
            AND EXTRACT(YEAR FROM start_date) = $3
            AND status = 'APPROVED'
        `,
        [
          leaveRequest.employeeId,
          leaveRequest.leaveTypeId,
          leaveRequest.leaveYear,
        ],
      );

      const usedDays = usedResult.rows[0].usedDays;
      const remainingBeforeApproval =
        entitledDays - usedDays;

      if (
        leaveRequest.requestedDays >
        remainingBeforeApproval
      ) {
        const error = new Error(
          `Insufficient leave balance. Available: ${remainingBeforeApproval} day(s), requested: ${leaveRequest.requestedDays} day(s)`,
        );

        error.statusCode = 409;
        throw error;
      }

      balance = {
        entitledDays,
        usedDays:
          usedDays + leaveRequest.requestedDays,
        remainingDays:
          remainingBeforeApproval -
          leaveRequest.requestedDays,
      };
    }

const updateResult = await client.query(
  `
    UPDATE leave_requests
    SET
      status = 'APPROVED',
      decision_note = $2,
      decided_by_user_id = $3,
      decision_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING
      id,
      employee_id AS "employeeId",
      leave_type_id AS "leaveTypeId",
      start_date AS "startDate",
      end_date AS "endDate",
      requested_days AS "requestedDays",
      status,
      decision_note AS "decisionNote",
      decided_by_user_id AS "decidedByUserId",
      decision_at AS "decisionAt"
  `,
  [requestId, decisionNote, approverUserId],
);

    await client.query("COMMIT");

    return {
      leaveRequest: updateResult.rows[0],
      balance,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function rejectLeaveRequest(
  requestId,
  decisionNote,
) {
  const result = await pool.query(
    `
      UPDATE leave_requests
      SET
        status = 'REJECTED',
        decision_note = $2,
        decision_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND status = 'PENDING'
      RETURNING
        id,
        employee_id AS "employeeId",
        leave_type_id AS "leaveTypeId",
        start_date AS "startDate",
        end_date AS "endDate",
        requested_days AS "requestedDays",
        status,
        decision_note AS "decisionNote",
        decision_at AS "decisionAt"
    `,
    [requestId, decisionNote],
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  const existingRequest =
    await findLeaveRequestById(requestId);

  if (!existingRequest) {
    const error = new Error("Leave request not found");
    error.statusCode = 404;
    throw error;
  }

  const error = new Error(
    `Only a pending request can be rejected. Current status: ${existingRequest.status}`,
  );

  error.statusCode = 409;
  throw error;
}
export async function findEmployeeLeaveBalances(
  employeeId,
  year,
) {
  const employeeResult = await pool.query(
    `
      SELECT id
      FROM employees
      WHERE id = $1
    `,
    [employeeId],
  );

  if (!employeeResult.rows[0]) {
    const error = new Error("Employee not found");
    error.statusCode = 404;
    throw error;
  }

  const result = await pool.query(
    `
      WITH approved_leave AS (
        SELECT
          leave_type_id,
          COALESCE(SUM(requested_days), 0)::integer
            AS used_days
        FROM leave_requests
        WHERE employee_id = $1
          AND EXTRACT(YEAR FROM start_date) = $2
          AND status = 'APPROVED'
        GROUP BY leave_type_id
      )

      SELECT
        leave_types.id AS "leaveTypeId",
        leave_types.code,
        leave_types.name,

        COALESCE(
          employee_leave_entitlements.entitled_days,
          leave_types.annual_entitlement
        ) AS "entitledDays",

        COALESCE(
          approved_leave.used_days,
          0
        ) AS "usedDays",

        CASE
          WHEN COALESCE(
            employee_leave_entitlements.entitled_days,
            leave_types.annual_entitlement
          ) IS NULL
          THEN NULL

          ELSE COALESCE(
            employee_leave_entitlements.entitled_days,
            leave_types.annual_entitlement
          ) - COALESCE(
            approved_leave.used_days,
            0
          )
        END AS "remainingDays"

      FROM leave_types

      LEFT JOIN employee_leave_entitlements
        ON employee_leave_entitlements.leave_type_id =
           leave_types.id
        AND employee_leave_entitlements.employee_id = $1
        AND employee_leave_entitlements.leave_year = $2

      LEFT JOIN approved_leave
        ON approved_leave.leave_type_id =
           leave_types.id

      WHERE leave_types.is_active = TRUE

      ORDER BY leave_types.name ASC
    `,
    [employeeId, year],
  );

  return result.rows;
}