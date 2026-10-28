import pool from "../config/database.js";

async function calculateWorkingDays(client, startDate, endDate) {
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

async function findNextWorkingDate(client, date) {
  const result = await client.query(
    `
      SELECT
        dates.candidate_date::date::text
          AS "nextWorkingDate"

      FROM GENERATE_SERIES(
        $1::date + 1,
        $1::date + 30,
        INTERVAL '1 day'
      ) AS dates(candidate_date)

      LEFT JOIN public_holidays
        ON public_holidays.holiday_date =
          dates.candidate_date::date

      WHERE EXTRACT(
        ISODOW
        FROM dates.candidate_date
      ) BETWEEN 1 AND 5

        AND public_holidays.id IS NULL

      ORDER BY
        dates.candidate_date ASC

      LIMIT 1
    `,
    [date],
  );

  return result.rows[0]?.nextWorkingDate || null;
}
function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

async function calculateFixedEndDate(
  client,
  startDate,
  durationValue,
  durationUnit,
) {
  if (durationUnit === "CALENDAR_MONTHS") {
    const result = await client.query(
      `
        SELECT (
          $1::date +
          make_interval(months => $2) -
          INTERVAL '1 day'
        )::date::text AS "endDate"
      `,
      [startDate, durationValue],
    );

    return result.rows[0].endDate;
  }

  if (durationUnit === "WORKING_DAYS") {
    const result = await client.query(
      `
        WITH working_dates AS (
          SELECT
            calendar_day::date
              AS working_date
          FROM generate_series(
            $1::date,
            $1::date + INTERVAL '1 year',
            INTERVAL '1 day'
          ) AS calendar_day
          WHERE EXTRACT(
            ISODOW FROM calendar_day
          ) < 6
            AND NOT EXISTS (
              SELECT 1
              FROM public_holidays
              WHERE holiday_date =
                calendar_day::date
            )
          ORDER BY calendar_day
          LIMIT $2
        )
        SELECT
          MAX(working_date)::text
            AS "endDate"
        FROM working_dates
      `,
      [startDate, durationValue],
    );

    if (!result.rows[0].endDate) {
      throw createServiceError(
        "Unable to calculate the fixed leave end date",
        500,
      );
    }

    return result.rows[0].endDate;
  }

  throw createServiceError(`Unsupported duration unit: ${durationUnit}`, 500);
}

async function findConfiguredApprover(client, authorityStage) {
  const result = await client.query(
    `
      SELECT
        workflow_approvers.user_id
          AS "userId",
        users.full_name
          AS "fullName",
        users.role
      FROM leave_workflow_approvers
        AS workflow_approvers
      JOIN app_users AS users
        ON users.id =
          workflow_approvers.user_id
      WHERE
        workflow_approvers.authority_stage =
          $1
        AND workflow_approvers.is_active =
          TRUE
        AND users.is_active = TRUE
        AND workflow_approvers.effective_from
          <= CURRENT_DATE
        AND (
          workflow_approvers.effective_to
            IS NULL
          OR workflow_approvers.effective_to
            >= CURRENT_DATE
        )
      LIMIT 1
    `,
    [authorityStage],
  );

  const approver = result.rows[0];

  if (!approver) {
    throw createServiceError(
      `No active ${authorityStage} leave approver is configured`,
      409,
    );
  }

  return approver;
}

async function findSupervisorApprover(client, employeePositionId) {
  const result = await client.query(
    `
      SELECT
        supervisor_users.id
          AS "userId",

        supervisor_users.full_name
          AS "fullName",

        supervisor_users.role,

        supervisor_positions.id
          AS "positionId",

        supervisor_positions.position_code
          AS "positionCode",

        supervisor_positions.title
          AS "position"

      FROM positions AS employee_positions

      JOIN positions AS supervisor_positions
        ON supervisor_positions.id =
          employee_positions.reports_to_position_id

      JOIN employee_position_assignments
        AS supervisor_assignments
        ON supervisor_assignments.position_id =
          supervisor_positions.id
        AND supervisor_assignments.end_date
          IS NULL
        AND supervisor_assignments.assignment_type =
          'SUBSTANTIVE'

      JOIN employees AS supervisor_employees
        ON supervisor_employees.id =
          supervisor_assignments.employee_id
        AND supervisor_employees.is_active =
          TRUE

      JOIN app_users AS supervisor_users
        ON supervisor_users.employee_id =
          supervisor_employees.id
        AND supervisor_users.is_active =
          TRUE

      WHERE employee_positions.id = $1
      LIMIT 1
    `,
    [employeePositionId],
  );

  const supervisor = result.rows[0];

  if (!supervisor) {
    throw createServiceError(
      "The employee does not have an active supervisor with a system account",
      409,
    );
  }

  return supervisor;
}

async function resolveWorkflowRequirements(
  client,
  employee,
  submittedByUserId,
) {
  let stages;

  switch (employee.approvalRoute) {
    case "STANDARD": {
      const supervisor = await findSupervisorApprover(
        client,
        employee.positionId,
      );

      const hr = await findConfiguredApprover(client, "HR");

      stages = [
        {
          stage: "SUPERVISOR",
          assignedUserId: supervisor.userId,
          assignedUserName: supervisor.fullName,
        },
        {
          stage: "HR",
          assignedUserId: hr.userId,
          assignedUserName: hr.fullName,
        },
      ];

      break;
    }

    case "CEO_ONLY": {
      const ceo = await findConfiguredApprover(client, "CEO");

      stages = [
        {
          stage: "CEO",
          assignedUserId: ceo.userId,
          assignedUserName: ceo.fullName,
        },
      ];

      break;
    }

    case "CEO_APPROVAL": {
      const hr = await findConfiguredApprover(client, "HR");

      const ceo = await findConfiguredApprover(client, "CEO");

      stages = [
        {
          stage: "HR",
          assignedUserId: hr.userId,
          assignedUserName: hr.fullName,
        },
        {
          stage: "CEO",
          assignedUserId: ceo.userId,
          assignedUserName: ceo.fullName,
        },
      ];

      break;
    }

    case "CHAIRMAN_APPROVAL": {
      const hr = await findConfiguredApprover(client, "HR");

      const chairman = await findConfiguredApprover(client, "CHAIRMAN");

      stages = [
        {
          stage: "HR",
          assignedUserId: hr.userId,
          assignedUserName: hr.fullName,
        },
        {
          stage: "CHAIRMAN",
          assignedUserId: chairman.userId,
          assignedUserName: chairman.fullName,
        },
      ];

      break;
    }

    default:
      throw createServiceError(
        `Unsupported leave approval route: ${employee.approvalRoute}`,
        500,
      );
  }

  const selfApprovalStage = stages.find(
    (stage) => stage.assignedUserId === submittedByUserId,
  );

  if (selfApprovalStage) {
    throw createServiceError(
      `You cannot submit a leave request that assigns the ${selfApprovalStage.stage} approval stage to yourself`,
      409,
    );
  }

  const assignedUserIds = stages.map((stage) => stage.assignedUserId);

  if (new Set(assignedUserIds).size !== assignedUserIds.length) {
    throw createServiceError(
      "The same user cannot complete multiple approval stages for one leave request",
      409,
    );
  }

  return stages.map((stage, index) => ({
    ...stage,
    sequenceOrder: index + 1,
    status: index === 0 ? "PENDING" : "WAITING",
  }));
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

export async function insertLeaveRequest(leaveRequest, submittedByUserId) {
  const { employeeId, leaveTypeId, startDate, endDate, reason } = leaveRequest;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const employeeResult = await client.query(
      `
      SELECT
        employees.id,

        employees.is_active
          AS "isActive",

        employees.employment_status
          AS "employmentStatus",

        employees.last_working_date
          AS "lastWorkingDate",

        employees.continuous_service_start_date
          AS "continuousServiceStartDate",

        employees.service_start_date_verified
          AS "serviceStartDateVerified",

        (
          employees.continuous_service_start_date
          + INTERVAL '1 year'
        )::date::text
          AS "annualLeaveEligibleFrom",

        employee_profiles.gender,

        current_position.assignment_id
          AS "positionAssignmentId",

        current_position.position_id
          AS "positionId",

        current_position.position_code
          AS "positionCode",

        current_position.position_title
          AS "position",

        current_position.department_id
          AS "departmentId",

        current_position.reports_to_position_id
          AS "reportsToPositionId",

        current_position.approval_route
          AS "approvalRoute",

        CURRENT_DATE::text AS "today"

      FROM employees

      LEFT JOIN employee_profiles
        ON employee_profiles.employee_id =
          employees.id

      LEFT JOIN LATERAL (
        SELECT
          assignments.id
            AS assignment_id,

          positions.id
            AS position_id,

          positions.position_code,

          positions.title
            AS position_title,

          positions.department_id,

          positions.reports_to_position_id,

          positions.leave_approval_route
            AS approval_route

        FROM employee_position_assignments
          AS assignments

        JOIN positions
          ON positions.id =
            assignments.position_id

        WHERE assignments.employee_id =
          employees.id

          AND assignments.assignment_type =
            'SUBSTANTIVE'

          AND assignments.start_date <=
            CURRENT_DATE

          AND (
            assignments.end_date IS NULL
            OR assignments.end_date >=
              CURRENT_DATE
          )

        ORDER BY
          assignments.start_date DESC,
          assignments.id DESC

        LIMIT 1
      ) AS current_position
        ON TRUE

      WHERE employees.id = $1
    `,
      [employeeId],
    );

    const employee = employeeResult.rows[0];

    if (!employee) {
      throw createServiceError("Employee not found", 404);
    }

    if (
      !employee.isActive ||
      ["EXITED", "SUSPENDED"].includes(employee.employmentStatus)
    ) {
      throw createServiceError("Only active employees may request leave", 409);
    }

    if (
      employee.employmentStatus === "ON_NOTICE" &&
      employee.lastWorkingDate &&
      startDate > employee.lastWorkingDate
    ) {
      throw createServiceError(
        "Leave cannot start after the employee’s last working date",
        409,
      );
    }

    if (!employee.positionId) {
      throw createServiceError(
        "The employee does not have a current substantive position",
        409,
      );
    }

    if (!employee.approvalRoute) {
      throw createServiceError(
        "The employee’s position does not have a leave approval route",
        409,
      );
    }

    if (startDate < employee.today) {
      throw createServiceError("Leave start date cannot be in the past", 400);
    }

    const leaveTypeResult = await client.query(
      `
      SELECT
        id,
        code,
        name,

        entitlement_mode
          AS "entitlementMode",

        duration_value
          AS "durationValue",

        duration_unit
          AS "durationUnit",

        eligible_gender
          AS "eligibleGender",

        is_active
          AS "isActive",

        requires_attachment
          AS "requiresAttachment"

      FROM leave_types
      WHERE id = $1
    `,
      [leaveTypeId],
    );

    const leaveType = leaveTypeResult.rows[0];

    if (!leaveType) {
      throw createServiceError("Leave type not found", 404);
    }

    if (!leaveType.isActive) {
      throw createServiceError("The selected leave type is inactive", 409);
    }

    if (leaveType.code === "ANNUAL") {
      if (
        !employee.continuousServiceStartDate ||
        !employee.serviceStartDateVerified
      ) {
        throw createServiceError(
          "The employee's continuous service start date must be verified by HR before annual leave can be requested",
          409,
        );
      }

      if (startDate < employee.annualLeaveEligibleFrom) {
        throw createServiceError(
          `Annual leave is available after one year of continuous service. This employee becomes eligible on ${employee.annualLeaveEligibleFrom}`,
          409,
        );
      }
    }
    let resolvedEndDate = endDate;

    if (leaveType.entitlementMode === "FIXED_DURATION") {
      if (!leaveType.durationValue || !leaveType.durationUnit) {
        throw createServiceError(
          `${leaveType.name} does not have a complete duration policy`,
          500,
        );
      }

      resolvedEndDate = await calculateFixedEndDate(
        client,
        startDate,
        leaveType.durationValue,
        leaveType.durationUnit,
      );
    } else if (!resolvedEndDate) {
      throw createServiceError(
        `An end date is required for ${leaveType.name}`,
        400,
      );
    }

    if (resolvedEndDate < startDate) {
      throw createServiceError(
        "Leave end date cannot be before the start date",
        400,
      );
    }

    if (
      leaveType.code === "ANNUAL" &&
      startDate.slice(0, 4) !== resolvedEndDate.slice(0, 4)
    ) {
      throw createServiceError(
        "Annual leave cannot cross calendar years. Submit separate requests for each year.",
        400,
      );
    }

    if (
      employee.employmentStatus === "ON_NOTICE" &&
      employee.lastWorkingDate &&
      resolvedEndDate > employee.lastWorkingDate
    ) {
      throw createServiceError(
        "Leave cannot extend beyond the employee’s last working date",
        409,
      );
    }

    const contractResult = await client.query(
      `
          SELECT id
          FROM contracts
          WHERE employee_id = $1
            AND status IN (
              'ACTIVE',
              'UPCOMING'
            )
            AND start_date <= $2::date
            AND (
              end_date IS NULL
              OR end_date >= $3::date
            )
          ORDER BY start_date DESC
          LIMIT 1
        `,
      [employeeId, startDate, resolvedEndDate],
    );

    if (!contractResult.rows[0]) {
      throw createServiceError(
        "No employment contract covers the requested leave period",
        409,
      );
    }

    const requestedDays = await calculateWorkingDays(
      client,
      startDate,
      resolvedEndDate,
    );

    if (requestedDays <= 0) {
      throw createServiceError(
        "The selected leave period contains no working days",
        400,
      );
    }

    if (leaveType.entitlementMode === "ANNUAL_BUCKET") {
      const balanceResult = await client.query(
        `
      SELECT
        COALESCE(
          SUM("unexpiredRemainingDays"),
          0
        )::integer AS "availableDays"

      FROM employee_leave_entitlement_balances

      WHERE "employeeId" = $1
        AND "leaveTypeId" = $2

        AND "availableFrom"
          IS NOT NULL

        AND "availableFrom" <=
          $3::date

        AND "expiresOn" >=
          $3::date

        AND "unexpiredRemainingDays" >
          0
    `,
        [employeeId, leaveTypeId, startDate],
      );

      const availableDays = balanceResult.rows[0].availableDays;

      if (requestedDays > availableDays) {
        throw createServiceError(
          `Insufficient ${leaveType.name} balance. Available: ${availableDays} day(s), requested: ${requestedDays} day(s)`,
          409,
        );
      }
    }

    const requirements = await resolveWorkflowRequirements(
      client,
      employee,
      submittedByUserId,
    );

    const firstRequirement = requirements[0];

    const requestResult = await client.query(
      `
          INSERT INTO leave_requests (
            employee_id,
            leave_type_id,
            start_date,
            end_date,
            requested_days,
            reason,
            status,
            workflow_version,
            approval_route,
            current_stage,
            submitted_by_user_id,
            submitted_at,
            balance_status,
            return_status
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            'PENDING',
            2,
            $7,
            $8,
            $9,
            CURRENT_TIMESTAMP,
            'PENDING',
            'NOT_APPLICABLE'
          )
          RETURNING
            id,

            employee_id
              AS "employeeId",

            leave_type_id
              AS "leaveTypeId",

            start_date
              AS "startDate",

            end_date
              AS "endDate",

            requested_days
              AS "requestedDays",

            reason,
            status,

            workflow_version
              AS "workflowVersion",

            approval_route
              AS "approvalRoute",

            current_stage
              AS "currentStage",

            submitted_by_user_id
              AS "submittedByUserId",

            submitted_at
              AS "submittedAt",

            balance_status
              AS "balanceStatus",

            return_status
              AS "returnStatus",

            created_at
              AS "createdAt"
        `,
      [
        employeeId,
        leaveTypeId,
        startDate,
        resolvedEndDate,
        requestedDays,
        reason,
        employee.approvalRoute,
        firstRequirement.stage,
        submittedByUserId,
      ],
    );

    const createdRequest = requestResult.rows[0];

    const createdRequirements = [];

    for (const requirement of requirements) {
      const requirementResult = await client.query(
        `
            INSERT INTO
              leave_approval_requirements (
                leave_request_id,
                stage,
                sequence_order,
                assigned_user_id,
                status
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

              leave_request_id
                AS "leaveRequestId",

              stage,

              sequence_order
                AS "sequenceOrder",

              assigned_user_id
                AS "assignedUserId",

              status,

              created_at
                AS "createdAt"
          `,
        [
          createdRequest.id,
          requirement.stage,
          requirement.sequenceOrder,
          requirement.assignedUserId,
          requirement.status,
        ],
      );

      createdRequirements.push({
        ...requirementResult.rows[0],
        assignedUserName: requirement.assignedUserName,
      });
    }

    await client.query("COMMIT");

    return {
      leaveRequest: {
        ...createdRequest,
        leaveTypeCode: leaveType.code,
        leaveTypeName: leaveType.name,
        requiresAttachment: leaveType.requiresAttachment,
      },
      requirements: createdRequirements,
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

      const entitledDays = entitlementResult.rows[0].entitledDays;

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
      const remainingBeforeApproval = entitledDays - usedDays;

      if (leaveRequest.requestedDays > remainingBeforeApproval) {
        const error = new Error(
          `Insufficient leave balance. Available: ${remainingBeforeApproval} day(s), requested: ${leaveRequest.requestedDays} day(s)`,
        );

        error.statusCode = 409;
        throw error;
      }

      balance = {
        entitledDays,
        usedDays: usedDays + leaveRequest.requestedDays,
        remainingDays: remainingBeforeApproval - leaveRequest.requestedDays,
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
  rejectedByUserId,
  decisionNote,
) {
  const result = await pool.query(
    `
      UPDATE leave_requests
      SET
        status = 'REJECTED',
        decision_note = $2,
        decided_by_user_id = $3,
        decision_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND status = 'PENDING'
      RETURNING
        id,
        employee_id
          AS "employeeId",
        leave_type_id
          AS "leaveTypeId",
        start_date
          AS "startDate",
        end_date
          AS "endDate",
        requested_days
          AS "requestedDays",
        status,
        decision_note
          AS "decisionNote",
        decided_by_user_id
          AS "decidedByUserId",
        decision_at
          AS "decisionAt"
    `,
    [requestId, decisionNote, rejectedByUserId],
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  const existingRequest = await findLeaveRequestById(requestId);

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
async function reserveAnnualLeaveFIFO(
  client,
  {
    requestId,
    employeeId,
    leaveTypeId,
    leaveStartDate,
    requestedDays,
    actionByUserId,
  },
) {
  const entitlementResult = await client.query(
    `
      SELECT
        id,

        leave_year
          AS "leaveYear",

        entitled_days
          AS "entitledDays",

        available_from
          AS "availableFrom",

        expires_on
          AS "expiresOn"

      FROM employee_leave_entitlements

      WHERE employee_id = $1
        AND leave_type_id = $2

        AND available_from
          IS NOT NULL

        AND available_from <=
          $3::date

        AND expires_on >=
          $3::date

      ORDER BY
        available_from ASC,
        leave_year ASC,
        id ASC

      FOR UPDATE
    `,
    [employeeId, leaveTypeId, leaveStartDate],
  );

  let daysStillRequired = requestedDays;

  const allocations = [];

  for (const entitlement of entitlementResult.rows) {
    const usageResult = await client.query(
      `
          SELECT
            COALESCE(
              SUM(
                CASE
                  WHEN status = 'RESERVED'
                    THEN allocated_days
                  WHEN status = 'RECONCILED'
                    THEN consumed_days
                  ELSE 0
                END
              ),
              0
            )::integer AS "usedOrReservedDays"
          FROM leave_entitlement_allocations
          WHERE entitlement_id = $1
        `,
      [entitlement.id],
    );

    const usedOrReservedDays = usageResult.rows[0].usedOrReservedDays;

    const availableDays = entitlement.entitledDays - usedOrReservedDays;

    if (availableDays <= 0) {
      continue;
    }

    const allocatedDays = Math.min(availableDays, daysStillRequired);

    const allocationResult = await client.query(
      `
          INSERT INTO
            leave_entitlement_allocations (
              leave_request_id,
              entitlement_id,
              entitlement_year,
              allocated_days,
              status
            )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'RESERVED'
          )
          RETURNING
            id,

            leave_request_id
              AS "leaveRequestId",

            entitlement_id
              AS "entitlementId",

            entitlement_year
              AS "entitlementYear",

            allocated_days
              AS "allocatedDays",

            consumed_days
              AS "consumedDays",

            restored_days
              AS "restoredDays",

            status,

            allocated_at
              AS "allocatedAt"
        `,
      [requestId, entitlement.id, entitlement.leaveYear, allocatedDays],
    );

    await client.query(
      `
        INSERT INTO
          leave_balance_transactions (
            employee_id,
            leave_type_id,
            entitlement_id,
            leave_request_id,
            transaction_type,
            days,
            transaction_note,
            action_by_user_id
          )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          'RESERVED',
          $5,
          $6,
          $7
        )
      `,
      [
        employeeId,
        leaveTypeId,
        entitlement.id,
        requestId,
        allocatedDays,
        `Reserved for approved leave request ${requestId}`,
        actionByUserId,
      ],
    );

    allocations.push(allocationResult.rows[0]);

    daysStillRequired -= allocatedDays;

    if (daysStillRequired === 0) {
      break;
    }
  }

  if (daysStillRequired > 0) {
    throw createServiceError(
      `Leave balance changed during approval. Missing ${daysStillRequired} day(s).`,
      409,
    );
  }

  return allocations;
}
export async function decideLeaveApprovalRequirement({
  requestId,
  requirementId,
  decision,
  comment,
  actionByUserId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT
          requirements.id
            AS "requirementId",

          requirements.stage,

          requirements.sequence_order
            AS "sequenceOrder",

          requirements.assigned_user_id
            AS "assignedUserId",

          requirements.status
            AS "requirementStatus",

          requests.id
            AS "requestId",

          requests.employee_id
            AS "employeeId",

          requests.leave_type_id
            AS "leaveTypeId",

          requests.start_date
            AS "startDate",

          requests.end_date
            AS "endDate",

          requests.requested_days
            AS "requestedDays",

          requests.status
            AS "requestStatus",

          requests.workflow_version
            AS "workflowVersion",

          requests.approval_route
            AS "approvalRoute",

          requests.current_stage
            AS "currentStage",

          requests.submitted_by_user_id
            AS "submittedByUserId",

          leave_types.code
            AS "leaveTypeCode",

          leave_types.name
            AS "leaveTypeName",

          leave_types.entitlement_mode
            AS "entitlementMode"

        FROM leave_approval_requirements
          AS requirements

        JOIN leave_requests AS requests
          ON requests.id =
            requirements.leave_request_id

        JOIN leave_types
          ON leave_types.id =
            requests.leave_type_id

        WHERE requirements.id = $1
          AND requests.id = $2

        FOR UPDATE OF
          requirements,
          requests
      `,
      [requirementId, requestId],
    );

    const workflow = result.rows[0];

    if (!workflow) {
      throw createServiceError("Leave approval requirement not found", 404);
    }

    if (workflow.workflowVersion !== 2) {
      throw createServiceError(
        "This endpoint only supports workflow version 2 requests",
        409,
      );
    }

    if (workflow.requestStatus !== "PENDING") {
      throw createServiceError(
        `The leave request is already ${workflow.requestStatus}`,
        409,
      );
    }

    if (workflow.requirementStatus !== "PENDING") {
      throw createServiceError(
        `This approval stage is ${workflow.requirementStatus}`,
        409,
      );
    }

    if (workflow.assignedUserId !== actionByUserId) {
      throw createServiceError(
        "This approval stage is not assigned to your account",
        403,
      );
    }

    if (workflow.submittedByUserId === actionByUserId) {
      throw createServiceError(
        "You cannot approve your own leave request",
        403,
      );
    }

    await client.query(
      `
        INSERT INTO leave_approval_actions (
          leave_request_id,
          requirement_id,
          stage,
          decision,
          comment,
          action_by_user_id
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6
        )
      `,
      [
        requestId,
        requirementId,
        workflow.stage,
        decision,
        comment,
        actionByUserId,
      ],
    );

    await client.query(
      `
        UPDATE leave_approval_requirements
        SET
          status = $2,
          completed_by_user_id = $3,
          completed_at =
            CURRENT_TIMESTAMP,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [requirementId, decision, actionByUserId],
    );

    if (decision === "REJECTED") {
      await client.query(
        `
          UPDATE leave_approval_requirements
          SET
            status = 'CANCELLED',
            completed_by_user_id = $2,
            completed_at =
              CURRENT_TIMESTAMP,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE leave_request_id = $1
            AND status = 'WAITING'
        `,
        [requestId, actionByUserId],
      );

      const rejectedRequestResult = await client.query(
        `
            UPDATE leave_requests
            SET
              status = 'REJECTED',
              current_stage = 'COMPLETE',
              decision_note = $2,
              decided_by_user_id = $3,
              decision_at =
                CURRENT_TIMESTAMP,
              balance_status =
                'NOT_APPLICABLE',
              return_status =
                'NOT_APPLICABLE',
              updated_at =
                CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING
              id,
              status,

              approval_route
                AS "approvalRoute",

              current_stage
                AS "currentStage",

              balance_status
                AS "balanceStatus",

              return_status
                AS "returnStatus",

              decision_note
                AS "decisionNote",

              decided_by_user_id
                AS "decidedByUserId",

              decision_at
                AS "decisionAt"
          `,
        [requestId, comment, actionByUserId],
      );

      await client.query("COMMIT");

      return {
        leaveRequest: rejectedRequestResult.rows[0],
        completedStage: workflow.stage,
        decision,
        isFinalApproval: false,
        nextStage: null,
        allocations: [],
      };
    }

    const nextRequirementResult = await client.query(
      `
          SELECT
            id,
            stage,
            sequence_order
              AS "sequenceOrder",
            assigned_user_id
              AS "assignedUserId"
          FROM leave_approval_requirements
          WHERE leave_request_id = $1
            AND status = 'WAITING'
            AND sequence_order > $2
          ORDER BY sequence_order ASC
          LIMIT 1
          FOR UPDATE
        `,
      [requestId, workflow.sequenceOrder],
    );

    const nextRequirement = nextRequirementResult.rows[0];

    if (nextRequirement) {
      await client.query(
        `
          UPDATE leave_approval_requirements
          SET
            status = 'PENDING',
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [nextRequirement.id],
      );

      const pendingRequestResult = await client.query(
        `
            UPDATE leave_requests
            SET
              current_stage = $2,
              updated_at =
                CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING
              id,
              status,

              approval_route
                AS "approvalRoute",

              current_stage
                AS "currentStage",

              balance_status
                AS "balanceStatus",

              return_status
                AS "returnStatus"
          `,
        [requestId, nextRequirement.stage],
      );

      await client.query("COMMIT");

      return {
        leaveRequest: pendingRequestResult.rows[0],

        completedStage: workflow.stage,

        decision,

        isFinalApproval: false,

        nextRequirement: {
          id: nextRequirement.id,
          stage: nextRequirement.stage,
          sequenceOrder: nextRequirement.sequenceOrder,
          assignedUserId: nextRequirement.assignedUserId,
          status: "PENDING",
        },

        allocations: [],
      };
    }

    let allocations = [];
    let balanceStatus = "NOT_APPLICABLE";

    if (workflow.entitlementMode === "ANNUAL_BUCKET") {
      allocations = await reserveAnnualLeaveFIFO(client, {
        requestId,
        employeeId: workflow.employeeId,
        leaveTypeId: workflow.leaveTypeId,
        leaveStartDate: workflow.startDate,
        requestedDays: workflow.requestedDays,
        actionByUserId,
      });

      balanceStatus = "RESERVED";
    }

    const approvedRequestResult = await client.query(
      `
          UPDATE leave_requests
          SET
            status = 'APPROVED',
            current_stage = 'COMPLETE',
            decision_note = $2,
            decided_by_user_id = $3,
            decision_at =
              CURRENT_TIMESTAMP,
            final_approved_by_user_id =
              $3,
            final_approved_at =
              CURRENT_TIMESTAMP,
            balance_status = $4,
            return_status =
              'AWAITING_RETURN',
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING
            id,
            employee_id
              AS "employeeId",
            leave_type_id
              AS "leaveTypeId",
            start_date
              AS "startDate",
            end_date
              AS "endDate",
            requested_days
              AS "requestedDays",
            status,
            approval_route
              AS "approvalRoute",
            current_stage
              AS "currentStage",
            final_approved_by_user_id
              AS "finalApprovedByUserId",
            final_approved_at
              AS "finalApprovedAt",
            balance_status
              AS "balanceStatus",
            return_status
              AS "returnStatus"
        `,
      [requestId, comment, actionByUserId, balanceStatus],
    );

    await client.query("COMMIT");

    return {
      leaveRequest: approvedRequestResult.rows[0],
      completedStage: workflow.stage,
      decision,
      isFinalApproval: true,
      nextStage: null,
      allocations,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function findPendingLeaveApprovalsForUser(userId) {
  const result = await pool.query(
    `
      SELECT
        requirements.id
          AS "requirementId",

        requirements.leave_request_id
          AS "leaveRequestId",

        requirements.stage,

        requirements.sequence_order
          AS "sequenceOrder",

        requirements.status
          AS "requirementStatus",

        requirements.assigned_user_id
          AS "assignedUserId",

        requests.status
          AS "requestStatus",

        requests.approval_route
          AS "approvalRoute",

        requests.current_stage
          AS "currentStage",

        requests.start_date
          AS "startDate",

        requests.end_date
          AS "endDate",

        requests.requested_days
          AS "requestedDays",

        requests.reason,

        requests.submitted_at
          AS "submittedAt",

        requests.balance_status
          AS "balanceStatus",

        employees.id
          AS "employeeId",

        employees.staff_number
          AS "staffNumber",

        employees.first_name
          AS "firstName",

        employees.last_name
          AS "lastName",

        CONCAT(
          employees.first_name,
          ' ',
          employees.last_name
        ) AS "employeeName",

        employees.photo_filename
          AS "photoFilename",

        leave_types.id
          AS "leaveTypeId",

        leave_types.code
          AS "leaveTypeCode",

        leave_types.name
          AS "leaveTypeName",

        leave_types.requires_attachment
          AS "requiresAttachment",

        positions.id
          AS "positionId",

        positions.position_code
          AS "positionCode",

        positions.title
          AS "position",

        departments.id
          AS "departmentId",

        departments.name
          AS "department"

      FROM leave_approval_requirements
        AS requirements

      JOIN leave_requests AS requests
        ON requests.id =
          requirements.leave_request_id

      JOIN employees
        ON employees.id =
          requests.employee_id

      JOIN leave_types
        ON leave_types.id =
          requests.leave_type_id

      LEFT JOIN employee_position_assignments
        AS assignments
        ON assignments.employee_id =
          employees.id
        AND assignments.end_date IS NULL
        AND assignments.assignment_type =
          'SUBSTANTIVE'

      LEFT JOIN positions
        ON positions.id =
          assignments.position_id

      LEFT JOIN departments
        ON departments.id =
          positions.department_id

      WHERE requirements.assigned_user_id =
        $1

        AND requirements.status =
          'PENDING'

        AND requests.status =
          'PENDING'

        AND requests.workflow_version = 2

        AND requests.current_stage =
          requirements.stage

      ORDER BY
        requests.submitted_at ASC,
        requirements.id ASC
    `,
    [userId],
  );

  return result.rows;
}
export async function findLeaveWorkflowDetails(requestId, viewer) {
  const requestResult = await pool.query(
    `
      SELECT
        requests.id,

        requests.employee_id
          AS "employeeId",

        requests.leave_type_id
          AS "leaveTypeId",

        requests.start_date
          AS "startDate",

        requests.end_date
          AS "endDate",

        requests.requested_days
          AS "requestedDays",

        requests.reason,
        requests.status,

        requests.workflow_version
          AS "workflowVersion",

        requests.approval_route
          AS "approvalRoute",

        requests.current_stage
          AS "currentStage",

        requests.balance_status
          AS "balanceStatus",

        requests.return_status
          AS "returnStatus",

        requests.cancellation_status
         AS "cancellationStatus",

        requests.submitted_by_user_id
          AS "submittedByUserId",

        submitter.full_name
          AS "submittedBy",

        requests.submitted_at
          AS "submittedAt",

        requests.final_approved_by_user_id
          AS "finalApprovedByUserId",

        final_approver.full_name
          AS "finalApprovedBy",

        requests.final_approved_at
          AS "finalApprovedAt",

        requests.decision_note
          AS "decisionNote",

        requests.decision_at
          AS "decisionAt",

        requests.created_at
          AS "createdAt",

        requests.updated_at
          AS "updatedAt",

        employees.staff_number
          AS "staffNumber",

        employees.first_name
          AS "firstName",

        employees.last_name
          AS "lastName",

        CONCAT(
          employees.first_name,
          ' ',
          employees.last_name
        ) AS "employeeName",

        employees.photo_filename
          AS "photoFilename",

        leave_types.code
          AS "leaveTypeCode",

        leave_types.name
          AS "leaveTypeName",

        leave_types.entitlement_mode
          AS "entitlementMode",

        leave_types.requires_attachment
          AS "requiresAttachment",

        positions.id
          AS "positionId",

        positions.position_code
          AS "positionCode",

        positions.title
          AS "position",

        departments.id
          AS "departmentId",

        departments.name
          AS "department",

        EXISTS (
          SELECT 1
          FROM leave_approval_requirements
            AS viewer_requirements
          WHERE
            viewer_requirements.leave_request_id =
              requests.id
            AND viewer_requirements.assigned_user_id =
              $2
        ) AS "isAssignedApprover"

      FROM leave_requests AS requests

      JOIN employees
        ON employees.id =
          requests.employee_id

      JOIN leave_types
        ON leave_types.id =
          requests.leave_type_id

      LEFT JOIN app_users AS submitter
        ON submitter.id =
          requests.submitted_by_user_id

      LEFT JOIN app_users AS final_approver
        ON final_approver.id =
          requests.final_approved_by_user_id

      LEFT JOIN employee_position_assignments
        AS assignments
        ON assignments.employee_id =
          employees.id
        AND assignments.end_date IS NULL
        AND assignments.assignment_type =
          'SUBSTANTIVE'

      LEFT JOIN positions
        ON positions.id =
          assignments.position_id

      LEFT JOIN departments
        ON departments.id =
          positions.department_id

      WHERE requests.id = $1
    `,
    [requestId, viewer.userId],
  );

  const leaveRequest = requestResult.rows[0];

  if (!leaveRequest) {
    throw createServiceError("Leave request not found", 404);
  }

  const isPrivileged = ["ADMIN", "HR"].includes(viewer.role);

  const isRequestOwner = Number(viewer.employeeId) === leaveRequest.employeeId;

  if (!isPrivileged && !isRequestOwner && !leaveRequest.isAssignedApprover) {
    throw createServiceError(
      "You are not authorized to view this leave request",
      403,
    );
  }

  delete leaveRequest.isAssignedApprover;

  const [
    requirementsResult,
    actionsResult,
    allocationsResult,
    transactionsResult,
    returnResult,
    cancellationsResult,
    cancellationActionsResult,
  ] = await Promise.all([
    pool.query(
      `
        SELECT
          requirements.id,

          requirements.stage,

          requirements.sequence_order
            AS "sequenceOrder",

          requirements.assigned_user_id
            AS "assignedUserId",

          assigned_user.full_name
            AS "assignedUserName",

          assigned_user.role
            AS "assignedUserRole",

          requirements.status,

          requirements.completed_by_user_id
            AS "completedByUserId",

          completed_user.full_name
            AS "completedByUserName",

          requirements.completed_at
            AS "completedAt",

          requirements.created_at
            AS "createdAt",

          requirements.updated_at
            AS "updatedAt"

        FROM leave_approval_requirements
          AS requirements

        JOIN app_users AS assigned_user
          ON assigned_user.id =
            requirements.assigned_user_id

        LEFT JOIN app_users AS completed_user
          ON completed_user.id =
            requirements.completed_by_user_id

        WHERE requirements.leave_request_id =
          $1

        ORDER BY
          requirements.sequence_order ASC
      `,
      [requestId],
    ),

    pool.query(
      `
        SELECT
          actions.id,
          actions.requirement_id
            AS "requirementId",
          actions.stage,
          actions.decision,
          actions.comment,
          actions.action_by_user_id
            AS "actionByUserId",
          users.full_name
            AS "actionByUserName",
          users.role
            AS "actionByUserRole",
          actions.delegation_id
            AS "delegationId",
          actions.acted_at
            AS "actedAt"
        FROM leave_approval_actions
          AS actions
        JOIN app_users AS users
          ON users.id =
            actions.action_by_user_id
        WHERE actions.leave_request_id =
          $1
        ORDER BY actions.acted_at ASC
      `,
      [requestId],
    ),

    pool.query(
      `
        SELECT
          allocations.id,

          allocations.entitlement_id
            AS "entitlementId",

          allocations.entitlement_year
            AS "entitlementYear",

          allocations.allocated_days
            AS "allocatedDays",

          allocations.consumed_days
            AS "consumedDays",

          allocations.restored_days
            AS "restoredDays",

          allocations.status,

          allocations.allocated_at
            AS "allocatedAt",

          allocations.reconciled_at
            AS "reconciledAt",

          entitlements.expires_on
            AS "expiresOn",

          entitlements.source

        FROM leave_entitlement_allocations
          AS allocations

        JOIN employee_leave_entitlements
          AS entitlements
          ON entitlements.id =
            allocations.entitlement_id

        WHERE allocations.leave_request_id =
          $1

        ORDER BY
          allocations.entitlement_year ASC,
          allocations.id ASC
      `,
      [requestId],
    ),

    pool.query(
      `
        SELECT
          transactions.id,

          transactions.transaction_type
            AS "transactionType",

          transactions.days,

          transactions.entitlement_id
            AS "entitlementId",

          transactions.transaction_note
            AS "transactionNote",

          transactions.action_by_user_id
            AS "actionByUserId",

          users.full_name
            AS "actionByUserName",

          transactions.created_at
            AS "createdAt"

        FROM leave_balance_transactions
          AS transactions

        LEFT JOIN app_users AS users
          ON users.id =
            transactions.action_by_user_id

        WHERE transactions.leave_request_id =
          $1

        ORDER BY
          transactions.created_at ASC,
          transactions.id ASC
      `,
      [requestId],
    ),

    pool.query(
      `
        SELECT
          returns.id,

          returns.return_type
            AS "returnType",

          returns.actual_return_date
            AS "actualReturnDate",

          returns.actual_last_leave_date
            AS "actualLastLeaveDate",

          returns.approved_working_days
            AS "approvedWorkingDays",

          returns.consumed_working_days
            AS "consumedWorkingDays",

          returns.unused_working_days
            AS "unusedWorkingDays",

          returns.balance_days_restored
            AS "balanceDaysRestored",

          returns.expired_unused_days
            AS "expiredUnusedDays",

          returns.return_reason
            AS "returnReason",

          returns.status,

          returns.reported_by_user_id
            AS "reportedByUserId",

          reporter.full_name
            AS "reportedByUserName",

          returns.reported_at
            AS "reportedAt",

          returns.verified_by_user_id
            AS "verifiedByUserId",

          verifier.full_name
            AS "verifiedByUserName",

          returns.verified_at
            AS "verifiedAt",

          returns.rejection_reason
            AS "rejectionReason",

          returns.created_at
            AS "createdAt",

          returns.updated_at
            AS "updatedAt"

        FROM leave_return_records AS returns

        LEFT JOIN app_users AS reporter
          ON reporter.id =
            returns.reported_by_user_id

        LEFT JOIN app_users AS verifier
          ON verifier.id =
            returns.verified_by_user_id

        WHERE returns.leave_request_id =
          $1
      `,
      [requestId],
    ),
    pool.query(
      `
    SELECT
      cancellations.id,

      cancellations.leave_request_id
        AS "leaveRequestId",

      cancellations.cancellation_reason
        AS "cancellationReason",

      cancellations.status,

      cancellations.requested_by_user_id
        AS "requestedByUserId",

      requester.full_name
        AS "requestedByUserName",

      cancellations.requested_at
        AS "requestedAt",

      cancellations.decided_by_user_id
        AS "decidedByUserId",

      decision_user.full_name
        AS "decidedByUserName",

      cancellations.decided_at
        AS "decidedAt",

      cancellations.decision_note
        AS "decisionNote",

      cancellations.released_days
        AS "releasedDays",

      cancellations.created_at
        AS "createdAt",

      cancellations.updated_at
        AS "updatedAt"

    FROM leave_cancellation_requests
      AS cancellations

    JOIN app_users AS requester
      ON requester.id =
        cancellations.requested_by_user_id

    LEFT JOIN app_users AS decision_user
      ON decision_user.id =
        cancellations.decided_by_user_id

    WHERE cancellations.leave_request_id =
      $1

    ORDER BY
      cancellations.requested_at ASC,
      cancellations.id ASC
  `,
      [requestId],
    ),

    pool.query(
      `
    SELECT
      actions.id,

      actions.cancellation_request_id
        AS "cancellationRequestId",

      actions.action,

      actions.comment,

      actions.action_by_user_id
        AS "actionByUserId",

      users.full_name
        AS "actionByUserName",

      users.role
        AS "actionByUserRole",

      actions.acted_at
        AS "actedAt"

    FROM leave_cancellation_actions
      AS actions

    JOIN app_users AS users
      ON users.id =
        actions.action_by_user_id

    WHERE actions.leave_request_id =
      $1

    ORDER BY
      actions.acted_at ASC,
      actions.id ASC
  `,
      [requestId],
    ),
  ]);

  let returnRecord = returnResult.rows[0] || null;

  if (returnRecord) {
    const returnActionsResult = await pool.query(
      `
          SELECT
            actions.id,
            actions.action,
            actions.comment,

            actions.action_by_user_id
              AS "actionByUserId",

            users.full_name
              AS "actionByUserName",

            actions.acted_at
              AS "actedAt"

          FROM leave_return_actions
            AS actions

          JOIN app_users AS users
            ON users.id =
              actions.action_by_user_id

          WHERE actions.leave_request_id =
            $1

          ORDER BY
            actions.acted_at ASC,
            actions.id ASC
        `,
      [requestId],
    );

    returnRecord = {
      ...returnRecord,
      actions: returnActionsResult.rows,
    };
  }

  const cancellationHistory = cancellationsResult.rows.map((cancellation) => ({
    ...cancellation,

    actions: cancellationActionsResult.rows.filter(
      (action) => action.cancellationRequestId === cancellation.id,
    ),
  }));

  return {
    leaveRequest,

    approvalRequirements: requirementsResult.rows,

    approvalActions: actionsResult.rows,

    allocations: allocationsResult.rows,

    balanceTransactions: transactionsResult.rows,

    cancellationHistory,

    returnRecord,
  };
}
export async function createLeaveCancellationRequest({
  leaveRequestId,
  cancellationReason,
  requestedByUserId,
  requesterEmployeeId,
  requesterRole,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const leaveResult = await client.query(
      `
          SELECT
            requests.id,
            requests.employee_id
              AS "employeeId",
            requests.status,
            requests.start_date
              AS "startDate",
            requests.cancellation_status
              AS "cancellationStatus",
            requests.final_approved_by_user_id
              AS "finalApprovedByUserId",
            CURRENT_DATE::text
              AS "today"
          FROM leave_requests AS requests
          WHERE requests.id = $1
          FOR UPDATE
        `,
      [leaveRequestId],
    );

    const leaveRequest = leaveResult.rows[0];

    if (!leaveRequest) {
      throw createServiceError("Leave request not found", 404);
    }

    const isOwner = Number(requesterEmployeeId) === leaveRequest.employeeId;

    const canManage = ["ADMIN", "HR"].includes(requesterRole);

    if (!isOwner && !canManage) {
      throw createServiceError(
        "You are not authorized to request cancellation of this leave",
        403,
      );
    }

    if (leaveRequest.status !== "APPROVED") {
      throw createServiceError(
        "Only an approved leave request can enter the cancellation workflow",
        409,
      );
    }

    if (leaveRequest.startDate <= leaveRequest.today) {
      throw createServiceError(
        "Approved leave can only be cancelled before its start date",
        409,
      );
    }

    if (leaveRequest.cancellationStatus === "PENDING") {
      throw createServiceError(
        "This leave request already has a pending cancellation request",
        409,
      );
    }

    if (leaveRequest.cancellationStatus === "APPROVED") {
      throw createServiceError(
        "This leave request has already been cancelled",
        409,
      );
    }

    if (!leaveRequest.finalApprovedByUserId) {
      throw createServiceError(
        "The leave request does not have a recorded final approver",
        409,
      );
    }

    if (leaveRequest.finalApprovedByUserId === requestedByUserId && !isOwner) {
      throw createServiceError(
        "The final approver cannot initiate and decide the same cancellation request",
        409,
      );
    }

    const cancellationResult = await client.query(
      `
          INSERT INTO
            leave_cancellation_requests (
              leave_request_id,
              cancellation_reason,
              requested_by_user_id
            )
          VALUES ($1, $2, $3)
          RETURNING
            id,
            leave_request_id
              AS "leaveRequestId",
            cancellation_reason
              AS "cancellationReason",
            status,
            requested_by_user_id
              AS "requestedByUserId",
            requested_at
              AS "requestedAt",
            released_days
              AS "releasedDays"
        `,
      [leaveRequestId, cancellationReason, requestedByUserId],
    );

    const cancellation = cancellationResult.rows[0];

    await client.query(
      `
        INSERT INTO
          leave_cancellation_actions (
            cancellation_request_id,
            leave_request_id,
            action,
            comment,
            action_by_user_id
          )
        VALUES (
          $1,
          $2,
          'REQUESTED',
          $3,
          $4
        )
      `,
      [cancellation.id, leaveRequestId, cancellationReason, requestedByUserId],
    );

    await client.query(
      `
        UPDATE leave_requests
        SET
          cancellation_status =
            'PENDING',
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [leaveRequestId],
    );

    const approverResult = await client.query(
      `
          SELECT
            id AS "userId",
            full_name AS "fullName",
            role
          FROM app_users
          WHERE id = $1
            AND is_active = TRUE
        `,
      [leaveRequest.finalApprovedByUserId],
    );

    const assignedApprover = approverResult.rows[0];

    if (!assignedApprover) {
      throw createServiceError(
        "The original final approver is not currently active",
        409,
      );
    }

    await client.query("COMMIT");

    return {
      cancellation,
      assignedApprover,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw createServiceError(
        "This leave request already has a pending cancellation request",
        409,
      );
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function decideLeaveCancellationRequest({
  leaveRequestId,
  cancellationId,
  decision,
  decisionNote,
  decidedByUserId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT
          cancellations.id
            AS "cancellationId",
          cancellations.status
            AS "cancellationStatus",
          cancellations.requested_by_user_id
            AS "requestedByUserId",

          requests.id
            AS "leaveRequestId",
          requests.employee_id
            AS "employeeId",
          requests.leave_type_id
            AS "leaveTypeId",
          requests.status
            AS "leaveStatus",
          requests.start_date
            AS "startDate",
          requests.balance_status
            AS "balanceStatus",
          requests.final_approved_by_user_id
            AS "finalApprovedByUserId",

          CURRENT_DATE::text
            AS "today"

        FROM leave_cancellation_requests
          AS cancellations

        JOIN leave_requests AS requests
          ON requests.id =
            cancellations.leave_request_id

        WHERE cancellations.id = $1
          AND requests.id = $2

        FOR UPDATE OF
          cancellations,
          requests
      `,
      [cancellationId, leaveRequestId],
    );

    const cancellation = result.rows[0];

    if (!cancellation) {
      throw createServiceError("Leave cancellation request not found", 404);
    }

    if (cancellation.cancellationStatus !== "PENDING") {
      throw createServiceError(
        `This cancellation request is already ${cancellation.cancellationStatus}`,
        409,
      );
    }

    if (cancellation.finalApprovedByUserId !== decidedByUserId) {
      throw createServiceError(
        "Only the original final leave approver may decide this cancellation",
        403,
      );
    }

    if (cancellation.requestedByUserId === decidedByUserId) {
      throw createServiceError(
        "You cannot decide a cancellation request that you initiated",
        403,
      );
    }

    if (decision === "REJECTED") {
      const rejectedResult = await client.query(
        `
            UPDATE leave_cancellation_requests
            SET
              status = 'REJECTED',
              decided_by_user_id = $2,
              decided_at =
                CURRENT_TIMESTAMP,
              decision_note = $3,
              updated_at =
                CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING
              id,
              leave_request_id
                AS "leaveRequestId",
              status,
              decision_note
                AS "decisionNote",
              decided_by_user_id
                AS "decidedByUserId",
              decided_at
                AS "decidedAt",
              released_days
                AS "releasedDays"
          `,
        [cancellationId, decidedByUserId, decisionNote],
      );

      await client.query(
        `
          INSERT INTO
            leave_cancellation_actions (
              cancellation_request_id,
              leave_request_id,
              action,
              comment,
              action_by_user_id
            )
          VALUES (
            $1,
            $2,
            'REJECTED',
            $3,
            $4
          )
        `,
        [cancellationId, leaveRequestId, decisionNote, decidedByUserId],
      );

      await client.query(
        `
          UPDATE leave_requests
          SET
            cancellation_status =
              'REJECTED',
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [leaveRequestId],
      );

      await client.query("COMMIT");

      return {
        cancellation: rejectedResult.rows[0],
        leaveStatus: cancellation.leaveStatus,
        balanceStatus: cancellation.balanceStatus,
      };
    }

    if (cancellation.leaveStatus !== "APPROVED") {
      throw createServiceError(
        "Only an approved leave request can be cancelled",
        409,
      );
    }

    if (cancellation.startDate <= cancellation.today) {
      throw createServiceError(
        "Leave cancellation can no longer be approved because the leave has already started",
        409,
      );
    }

    const allocationsResult = await client.query(
      `
          SELECT
            id,
            entitlement_id
              AS "entitlementId",
            allocated_days
              AS "allocatedDays",
            status
          FROM leave_entitlement_allocations
          WHERE leave_request_id = $1
          ORDER BY id
          FOR UPDATE
        `,
      [leaveRequestId],
    );

    let releasedDays = 0;

    for (const allocation of allocationsResult.rows) {
      if (allocation.status !== "RESERVED") {
        throw createServiceError(
          "The leave balance allocation is no longer fully reserved",
          409,
        );
      }

      await client.query(
        `
          UPDATE
            leave_entitlement_allocations
          SET
            consumed_days = 0,
            restored_days =
              allocated_days,
            status = 'RELEASED',
            reconciled_at =
              CURRENT_TIMESTAMP,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = $1
        `,
        [allocation.id],
      );

      await client.query(
        `
          INSERT INTO
            leave_balance_transactions (
              employee_id,
              leave_type_id,
              entitlement_id,
              leave_request_id,
              transaction_type,
              days,
              transaction_note,
              action_by_user_id
            )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'RELEASED',
            $5,
            $6,
            $7
          )
        `,
        [
          cancellation.employeeId,
          cancellation.leaveTypeId,
          allocation.entitlementId,
          leaveRequestId,
          allocation.allocatedDays,
          `Released after approved cancellation of leave request ${leaveRequestId}`,
          decidedByUserId,
        ],
      );

      releasedDays += allocation.allocatedDays;
    }

    const approvedCancellationResult = await client.query(
      `
          UPDATE leave_cancellation_requests
          SET
            status = 'APPROVED',
            decided_by_user_id = $2,
            decided_at =
              CURRENT_TIMESTAMP,
            decision_note = $3,
            released_days = $4,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING
            id,
            leave_request_id
              AS "leaveRequestId",
            status,
            cancellation_reason
              AS "cancellationReason",
            decision_note
              AS "decisionNote",
            decided_by_user_id
              AS "decidedByUserId",
            decided_at
              AS "decidedAt",
            released_days
              AS "releasedDays"
        `,
      [cancellationId, decidedByUserId, decisionNote, releasedDays],
    );

    await client.query(
      `
        INSERT INTO
          leave_cancellation_actions (
            cancellation_request_id,
            leave_request_id,
            action,
            comment,
            action_by_user_id
          )
        VALUES (
          $1,
          $2,
          'APPROVED',
          $3,
          $4
        )
      `,
      [cancellationId, leaveRequestId, decisionNote, decidedByUserId],
    );

    const nextBalanceStatus =
      cancellation.balanceStatus === "RESERVED" ? "RELEASED" : "NOT_APPLICABLE";

    const leaveUpdateResult = await client.query(
      `
          UPDATE leave_requests
          SET
            status = 'CANCELLED',
            cancellation_status =
              'APPROVED',
            balance_status = $2,
            return_status =
              'NOT_APPLICABLE',
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING
            id,
            status,
            cancellation_status
              AS "cancellationStatus",
            balance_status
              AS "balanceStatus",
            return_status
              AS "returnStatus"
        `,
      [leaveRequestId, nextBalanceStatus],
    );

    await client.query("COMMIT");

    return {
      cancellation: approvedCancellationResult.rows[0],
      leaveRequest: leaveUpdateResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function findPendingLeaveCancellationsForUser(userId) {
  const result = await pool.query(
    `
      SELECT
        cancellations.id
          AS "cancellationId",

        cancellations.leave_request_id
          AS "leaveRequestId",

        cancellations.cancellation_reason
          AS "cancellationReason",

        cancellations.status
          AS "cancellationStatus",

        cancellations.requested_by_user_id
          AS "requestedByUserId",

        requester.full_name
          AS "requestedByUserName",

        cancellations.requested_at
          AS "requestedAt",

        requests.status
          AS "leaveStatus",

        requests.start_date
          AS "startDate",

        requests.end_date
          AS "endDate",

        requests.requested_days
          AS "requestedDays",

        requests.approval_route
          AS "approvalRoute",

        requests.balance_status
          AS "balanceStatus",

        requests.final_approved_by_user_id
          AS "assignedDecisionUserId",

        employees.id
          AS "employeeId",

        employees.staff_number
          AS "staffNumber",

        employees.first_name
          AS "firstName",

        employees.last_name
          AS "lastName",

        CONCAT(
          employees.first_name,
          ' ',
          employees.last_name
        ) AS "employeeName",

        employees.photo_filename
          AS "photoFilename",

        leave_types.id
          AS "leaveTypeId",

        leave_types.code
          AS "leaveTypeCode",

        leave_types.name
          AS "leaveTypeName",

        positions.id
          AS "positionId",

        positions.position_code
          AS "positionCode",

        positions.title
          AS "position",

        departments.id
          AS "departmentId",

        departments.name
          AS "department",

        COALESCE(
          (
            SELECT SUM(
              allocations.allocated_days
            )::integer
            FROM leave_entitlement_allocations
              AS allocations
            WHERE
              allocations.leave_request_id =
                requests.id
              AND allocations.status =
                'RESERVED'
          ),
          0
        ) AS "reservedDays"

      FROM leave_cancellation_requests
        AS cancellations

      JOIN leave_requests AS requests
        ON requests.id =
          cancellations.leave_request_id

      JOIN employees
        ON employees.id =
          requests.employee_id

      JOIN leave_types
        ON leave_types.id =
          requests.leave_type_id

      JOIN app_users AS requester
        ON requester.id =
          cancellations.requested_by_user_id

      LEFT JOIN employee_position_assignments
        AS assignments
        ON assignments.employee_id =
          employees.id
        AND assignments.end_date IS NULL
        AND assignments.assignment_type =
          'SUBSTANTIVE'

      LEFT JOIN positions
        ON positions.id =
          assignments.position_id

      LEFT JOIN departments
        ON departments.id =
          positions.department_id

      WHERE
        cancellations.status =
          'PENDING'

        AND requests.status =
          'APPROVED'

        AND requests.cancellation_status =
          'PENDING'

        AND requests.final_approved_by_user_id =
          $1

      ORDER BY
        cancellations.requested_at ASC,
        cancellations.id ASC
    `,
    [userId],
  );

  return result.rows;
}
export async function findEmployeeLeaveRequests({
  employeeId,
  status = null,
  limit,
  offset,
}) {
  const parameters = [employeeId, status, limit, offset];

  const [countResult, requestsResult] = await Promise.all([
    pool.query(
      `
        SELECT COUNT(*)::integer
          AS "total"
        FROM leave_requests
        WHERE employee_id = $1
          AND (
            $2::text IS NULL
            OR status = $2
          )
      `,
      [employeeId, status],
    ),

    pool.query(
      `
        SELECT
          requests.id,

          requests.leave_type_id
            AS "leaveTypeId",

          leave_types.code
            AS "leaveTypeCode",

          leave_types.name
            AS "leaveTypeName",

          requests.start_date
            AS "startDate",

          requests.end_date
            AS "endDate",

          requests.requested_days
            AS "requestedDays",

          requests.reason,
          requests.status,

          requests.workflow_version
            AS "workflowVersion",

          requests.approval_route
            AS "approvalRoute",

          requests.current_stage
            AS "currentStage",

          requests.balance_status
            AS "balanceStatus",

          requests.return_status
            AS "returnStatus",

          requests.cancellation_status
            AS "cancellationStatus",

          requests.submitted_at
            AS "submittedAt",

          requests.final_approved_at
            AS "finalApprovedAt",

          final_approver.full_name
            AS "finalApprovedBy",

          pending_requirement.id
            AS "pendingRequirementId",

          pending_requirement.stage
            AS "pendingStage",

          pending_requirement.assigned_user_id
            AS "pendingAssignedUserId",

          pending_user.full_name
            AS "pendingAssignedUserName",

          latest_cancellation.id
            AS "latestCancellationId",

          latest_cancellation.status
            AS "latestCancellationStatus",

          latest_cancellation.cancellation_reason
            AS "latestCancellationReason",

          return_record.id
            AS "returnRecordId",

          return_record.return_type
            AS "returnType",

          return_record.status
            AS "returnRecordStatus",

          return_record.actual_return_date
            AS "actualReturnDate",

          requests.created_at
            AS "createdAt",

          requests.updated_at
            AS "updatedAt"

        FROM leave_requests AS requests

        JOIN leave_types
          ON leave_types.id =
            requests.leave_type_id

        LEFT JOIN app_users
          AS final_approver
          ON final_approver.id =
            requests.final_approved_by_user_id

        LEFT JOIN LATERAL (
          SELECT
            requirements.id,
            requirements.stage,
            requirements.assigned_user_id
          FROM leave_approval_requirements
            AS requirements
          WHERE
            requirements.leave_request_id =
              requests.id
            AND requirements.status =
              'PENDING'
          ORDER BY
            requirements.sequence_order ASC
          LIMIT 1
        ) AS pending_requirement
          ON TRUE

        LEFT JOIN app_users AS pending_user
          ON pending_user.id =
            pending_requirement.assigned_user_id

        LEFT JOIN LATERAL (
          SELECT
            cancellations.id,
            cancellations.status,
            cancellations.cancellation_reason
          FROM leave_cancellation_requests
            AS cancellations
          WHERE
            cancellations.leave_request_id =
              requests.id
          ORDER BY
            cancellations.requested_at DESC,
            cancellations.id DESC
          LIMIT 1
        ) AS latest_cancellation
          ON TRUE

        LEFT JOIN leave_return_records
          AS return_record
          ON return_record.leave_request_id =
            requests.id

        WHERE requests.employee_id = $1

          AND (
            $2::text IS NULL
            OR requests.status = $2
          )

        ORDER BY
          COALESCE(
            requests.submitted_at,
            requests.created_at
          ) DESC,
          requests.id DESC

        LIMIT $3
        OFFSET $4
      `,
      parameters,
    ),
  ]);

  return {
    requests: requestsResult.rows,
    total: countResult.rows[0].total,
  };
}
export async function reportLeaveReturn(
  requestId,
  { returnType, actualReturnDate, returnReason },
  reportingUser,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      `
          SELECT
            leave_requests.id,

            leave_requests.employee_id
              AS "employeeId",

            leave_requests.leave_type_id
              AS "leaveTypeId",

            leave_requests.start_date
              AS "startDate",

            leave_requests.end_date
              AS "endDate",

            leave_requests.requested_days
              AS "requestedDays",

            leave_requests.status,

            leave_requests.balance_status
              AS "balanceStatus",

            leave_requests.return_status
              AS "returnStatus",

            leave_requests.cancellation_status
              AS "cancellationStatus",

            CURRENT_DATE::text
              AS "today"

          FROM leave_requests

          WHERE leave_requests.id = $1

          FOR UPDATE
        `,
      [requestId],
    );

    const leaveRequest = requestResult.rows[0];

    if (!leaveRequest) {
      throw createServiceError("Leave request not found", 404);
    }

    const mayReportForEmployee =
      ["ADMIN", "HR"].includes(reportingUser.role) ||
      Number(reportingUser.employeeId) === leaveRequest.employeeId;

    if (!mayReportForEmployee) {
      throw createServiceError(
        "You are not authorized to report this employee's return from leave",
        403,
      );
    }

    if (leaveRequest.status !== "APPROVED") {
      throw createServiceError(
        "Only an approved leave request can have a return reported",
        409,
      );
    }

    if (leaveRequest.returnStatus !== "AWAITING_RETURN") {
      throw createServiceError(
        `A return cannot be reported when the current return status is ${leaveRequest.returnStatus}`,
        409,
      );
    }

    if (
      leaveRequest.cancellationStatus === "PENDING" ||
      leaveRequest.cancellationStatus === "APPROVED"
    ) {
      throw createServiceError(
        "A return cannot be reported while the leave has a pending or approved cancellation",
        409,
      );
    }

    if (actualReturnDate < leaveRequest.startDate) {
      throw createServiceError(
        "Actual return date cannot be before the approved leave start date",
        400,
      );
    }

    if (actualReturnDate > leaveRequest.today) {
      throw createServiceError(
        "Actual return date cannot be in the future",
        400,
      );
    }

    const returnDateWorkingDays = await calculateWorkingDays(
      client,
      actualReturnDate,
      actualReturnDate,
    );

    if (returnDateWorkingDays !== 1) {
      throw createServiceError("Actual return date must be a working day", 400);
    }

    const scheduledReturnDate = await findNextWorkingDate(
      client,
      leaveRequest.endDate,
    );

    let actualLastLeaveDate;

    if (returnType === "SCHEDULED_RETURN") {
      if (actualReturnDate !== scheduledReturnDate) {
        throw createServiceError(
          `The scheduled return date for this leave is ${scheduledReturnDate}`,
          400,
        );
      }

      actualLastLeaveDate = leaveRequest.endDate;
    } else {
      if (actualReturnDate > leaveRequest.endDate) {
        throw createServiceError(
          "An early return date cannot be after the approved leave end date",
          400,
        );
      }

      const previousDateResult = await client.query(
        `
            SELECT
              ($1::date - 1)::text
                AS "previousDate"
          `,
        [actualReturnDate],
      );

      actualLastLeaveDate = previousDateResult.rows[0].previousDate;
    }

    const consumedWorkingDays =
      actualLastLeaveDate < leaveRequest.startDate
        ? 0
        : await calculateWorkingDays(
            client,
            leaveRequest.startDate,
            actualLastLeaveDate,
          );

    if (consumedWorkingDays > leaveRequest.requestedDays) {
      throw createServiceError(
        "Calculated consumed days exceed the approved leave days",
        409,
      );
    }

    const unusedWorkingDays = leaveRequest.requestedDays - consumedWorkingDays;

    const returnResult = await client.query(
      `
          INSERT INTO leave_return_records (
            leave_request_id,
            return_type,
            actual_return_date,
            actual_last_leave_date,
            approved_working_days,
            consumed_working_days,
            balance_days_restored,
            expired_unused_days,
            return_reason,
            status,
            reported_by_user_id
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            0,
            0,
            $7,
            'REPORTED',
            $8
          )
          RETURNING
            id,

            leave_request_id
              AS "leaveRequestId",

            return_type
              AS "returnType",

            actual_return_date
              AS "actualReturnDate",

            actual_last_leave_date
              AS "actualLastLeaveDate",

            approved_working_days
              AS "approvedWorkingDays",

            consumed_working_days
              AS "consumedWorkingDays",

            unused_working_days
              AS "unusedWorkingDays",

            balance_days_restored
              AS "balanceDaysRestored",

            expired_unused_days
              AS "expiredUnusedDays",

            return_reason
              AS "returnReason",

            status,

            reported_by_user_id
              AS "reportedByUserId",

            reported_at
              AS "reportedAt"
        `,
      [
        requestId,
        returnType,
        actualReturnDate,
        actualLastLeaveDate,
        leaveRequest.requestedDays,
        consumedWorkingDays,
        returnReason,
        reportingUser.id,
      ],
    );

    const returnRecord = returnResult.rows[0];

    await client.query(
      `
        INSERT INTO leave_return_actions (
          leave_return_record_id,
          leave_request_id,
          action,
          comment,
          action_by_user_id
        )
        VALUES (
          $1,
          $2,
          'REPORTED',
          $3,
          $4
        )
      `,
      [
        returnRecord.id,
        requestId,
        returnReason || "Scheduled return reported",
        reportingUser.id,
      ],
    );

    await client.query(
      `
        UPDATE leave_requests
        SET
          return_status =
            'RETURN_REPORTED',
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [requestId],
    );

    await client.query("COMMIT");

    return returnRecord;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function verifyLeaveReturn(
  requestId,
  returnRecordId,
  verifiedByUserId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const returnResult = await client.query(
      `
          SELECT
            returns.id,

            returns.leave_request_id
              AS "leaveRequestId",

            returns.return_type
              AS "returnType",

            returns.actual_return_date
              AS "actualReturnDate",

            returns.approved_working_days
              AS "approvedWorkingDays",

            returns.consumed_working_days
              AS "consumedWorkingDays",

            returns.unused_working_days
              AS "unusedWorkingDays",

            returns.status
              AS "returnRecordStatus",

            requests.employee_id
              AS "employeeId",

            requests.leave_type_id
              AS "leaveTypeId",

            requests.status
              AS "leaveStatus",

            requests.balance_status
              AS "balanceStatus",

            requests.return_status
              AS "returnStatus"

          FROM leave_return_records
            AS returns

          JOIN leave_requests AS requests
            ON requests.id =
              returns.leave_request_id

          WHERE returns.id = $1
            AND returns.leave_request_id =
              $2

          FOR UPDATE OF returns, requests
        `,
      [returnRecordId, requestId],
    );

    const returnRecord = returnResult.rows[0];

    if (!returnRecord) {
      throw createServiceError("Leave return record not found", 404);
    }

    if (returnRecord.leaveStatus !== "APPROVED") {
      throw createServiceError(
        "Only an approved leave can have its return verified",
        409,
      );
    }

    if (
      returnRecord.returnRecordStatus !== "REPORTED" ||
      returnRecord.returnStatus !== "RETURN_REPORTED"
    ) {
      throw createServiceError(
        "Only a reported leave return can be verified",
        409,
      );
    }

    let totalRestoredDays = 0;
    let totalExpiredUnusedDays = 0;

    if (returnRecord.balanceStatus === "RESERVED") {
      const allocationsResult = await client.query(
        `
            SELECT
              allocations.id,

              allocations.entitlement_id
                AS "entitlementId",

              allocations.allocated_days
                AS "allocatedDays",

              allocations.status,

              entitlements.leave_year
                AS "entitlementYear",

              entitlements.available_from
                AS "availableFrom",

              entitlements.expires_on
                AS "expiresOn"

            FROM leave_entitlement_allocations
              AS allocations

            JOIN employee_leave_entitlements
              AS entitlements
              ON entitlements.id =
                allocations.entitlement_id

            WHERE allocations.leave_request_id =
              $1

            ORDER BY
              entitlements.available_from ASC,
              entitlements.leave_year ASC,
              entitlements.id ASC

            FOR UPDATE OF allocations
          `,
        [requestId],
      );

      const allocations = allocationsResult.rows;

      const totalAllocatedDays = allocations.reduce(
        (total, allocation) => total + allocation.allocatedDays,
        0,
      );

      if (totalAllocatedDays !== returnRecord.approvedWorkingDays) {
        throw createServiceError(
          "Reserved entitlement allocations do not match the approved leave days",
          409,
        );
      }

      if (allocations.some((allocation) => allocation.status !== "RESERVED")) {
        throw createServiceError(
          "One or more entitlement allocations have already been reconciled or released",
          409,
        );
      }

      let daysStillToConsume = returnRecord.consumedWorkingDays;

      for (const allocation of allocations) {
        const consumedDays = Math.min(
          allocation.allocatedDays,
          daysStillToConsume,
        );

        const restoredDays = allocation.allocatedDays - consumedDays;

        daysStillToConsume -= consumedDays;

        const restoredToValidBucket =
          allocation.expiresOn >= returnRecord.actualReturnDate
            ? restoredDays
            : 0;

        const expiredUnusedDays = restoredDays - restoredToValidBucket;

        totalRestoredDays += restoredToValidBucket;

        totalExpiredUnusedDays += expiredUnusedDays;

        await client.query(
          `
            UPDATE leave_entitlement_allocations
            SET
              consumed_days = $2,
              restored_days = $3,
              status = 'RECONCILED',
              reconciled_at =
                CURRENT_TIMESTAMP,
              updated_at =
                CURRENT_TIMESTAMP
            WHERE id = $1
          `,
          [allocation.id, consumedDays, restoredDays],
        );

        if (consumedDays > 0) {
          await client.query(
            `
              INSERT INTO
                leave_balance_transactions (
                  employee_id,
                  leave_type_id,
                  entitlement_id,
                  leave_request_id,
                  transaction_type,
                  days,
                  transaction_note,
                  action_by_user_id
                )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                'CONSUMED',
                $5,
                $6,
                $7
              )
            `,
            [
              returnRecord.employeeId,
              returnRecord.leaveTypeId,
              allocation.entitlementId,
              requestId,
              consumedDays,
              `Consumed after verified return for leave request ${requestId}`,
              verifiedByUserId,
            ],
          );
        }

        if (restoredToValidBucket > 0) {
          await client.query(
            `
              INSERT INTO
                leave_balance_transactions (
                  employee_id,
                  leave_type_id,
                  entitlement_id,
                  leave_request_id,
                  transaction_type,
                  days,
                  transaction_note,
                  action_by_user_id
                )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                'RESTORED',
                $5,
                $6,
                $7
              )
            `,
            [
              returnRecord.employeeId,
              returnRecord.leaveTypeId,
              allocation.entitlementId,
              requestId,
              restoredToValidBucket,
              `Unused days restored after verified return for leave request ${requestId}`,
              verifiedByUserId,
            ],
          );
        }

        if (expiredUnusedDays > 0) {
          await client.query(
            `
              INSERT INTO
                leave_balance_transactions (
                  employee_id,
                  leave_type_id,
                  entitlement_id,
                  leave_request_id,
                  transaction_type,
                  days,
                  transaction_note,
                  action_by_user_id
                )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                'EXPIRED',
                $5,
                $6,
                $7
              )
            `,
            [
              returnRecord.employeeId,
              returnRecord.leaveTypeId,
              allocation.entitlementId,
              requestId,
              expiredUnusedDays,
              `Unused days had expired when return was verified for leave request ${requestId}`,
              verifiedByUserId,
            ],
          );
        }
      }

      if (daysStillToConsume > 0) {
        throw createServiceError(
          "Consumed leave days exceed the reserved entitlement allocations",
          409,
        );
      }
    }

    const verifiedResult = await client.query(
      `
          UPDATE leave_return_records
          SET
            status = 'VERIFIED',

            balance_days_restored = $2,

            expired_unused_days = $3,

            verified_by_user_id = $4,

            verified_at =
              CURRENT_TIMESTAMP,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $1

          RETURNING
            id,

            leave_request_id
              AS "leaveRequestId",

            return_type
              AS "returnType",

            actual_return_date
              AS "actualReturnDate",

            approved_working_days
              AS "approvedWorkingDays",

            consumed_working_days
              AS "consumedWorkingDays",

            unused_working_days
              AS "unusedWorkingDays",

            balance_days_restored
              AS "balanceDaysRestored",

            expired_unused_days
              AS "expiredUnusedDays",

            status,

            verified_by_user_id
              AS "verifiedByUserId",

            verified_at
              AS "verifiedAt"
        `,
      [
        returnRecordId,
        totalRestoredDays,
        totalExpiredUnusedDays,
        verifiedByUserId,
      ],
    );

    await client.query(
      `
        INSERT INTO leave_return_actions (
          leave_return_record_id,
          leave_request_id,
          action,
          comment,
          action_by_user_id
        )
        VALUES (
          $1,
          $2,
          'VERIFIED',
          $3,
          $4
        )
      `,
      [
        returnRecordId,
        requestId,
        `Return verified: ${returnRecord.consumedWorkingDays} consumed day(s), ${totalRestoredDays} restored day(s)`,
        verifiedByUserId,
      ],
    );

    await client.query(
      `
    UPDATE leave_requests
    SET
      return_status =
        'RETURN_VERIFIED',

      actual_return_date = $2,

      balance_status =
        CASE
          WHEN balance_status =
            'RESERVED'
          THEN 'RECONCILED'
          ELSE balance_status
        END,

      updated_at =
        CURRENT_TIMESTAMP

    WHERE id = $1
  `,
      [requestId, returnRecord.actualReturnDate],
    );

    await client.query("COMMIT");

    return verifiedResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function rejectLeaveReturn(
  requestId,
  returnRecordId,
  rejectionReason,
  rejectedByUserId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT
          returns.id,
          returns.status
            AS "returnRecordStatus",

          requests.id
            AS "leaveRequestId",

          requests.return_status
            AS "returnStatus"

        FROM leave_return_records
          AS returns

        JOIN leave_requests AS requests
          ON requests.id =
            returns.leave_request_id

        WHERE returns.id = $1
          AND requests.id = $2

        FOR UPDATE OF returns, requests
      `,
      [returnRecordId, requestId],
    );

    const record = result.rows[0];

    if (!record) {
      throw createServiceError("Leave return record not found", 404);
    }

    if (
      record.returnRecordStatus !== "REPORTED" ||
      record.returnStatus !== "RETURN_REPORTED"
    ) {
      throw createServiceError("Only a reported return can be rejected", 409);
    }

    const rejectedResult = await client.query(
      `
          UPDATE leave_return_records
          SET
            status = 'REJECTED',

            rejected_by_user_id = $2,

            rejected_at =
              CURRENT_TIMESTAMP,

            rejection_reason = $3,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $1

          RETURNING
            id,

            leave_request_id
              AS "leaveRequestId",

            return_type
              AS "returnType",

            actual_return_date
              AS "actualReturnDate",

            consumed_working_days
              AS "consumedWorkingDays",

            unused_working_days
              AS "unusedWorkingDays",

            status,

            rejected_by_user_id
              AS "rejectedByUserId",

            rejected_at
              AS "rejectedAt",

            rejection_reason
              AS "rejectionReason"
        `,
      [returnRecordId, rejectedByUserId, rejectionReason],
    );

    await client.query(
      `
        INSERT INTO leave_return_actions (
          leave_return_record_id,
          leave_request_id,
          action,
          comment,
          action_by_user_id
        )
        VALUES (
          $1,
          $2,
          'REJECTED',
          $3,
          $4
        )
      `,
      [returnRecordId, requestId, rejectionReason, rejectedByUserId],
    );

    await client.query(
      `
        UPDATE leave_requests
        SET
          return_status =
            'AWAITING_RETURN',

          updated_at =
            CURRENT_TIMESTAMP

        WHERE id = $1
      `,
      [requestId],
    );

    await client.query("COMMIT");

    return rejectedResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function correctLeaveReturn(
  requestId,
  returnRecordId,
  { returnType, actualReturnDate, returnReason },
  correctingUser,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT
          returns.id,

          returns.status
            AS "returnRecordStatus",

          requests.employee_id
            AS "employeeId",

          requests.start_date
            AS "startDate",

          requests.end_date
            AS "endDate",

          requests.requested_days
            AS "requestedDays",

          requests.status
            AS "leaveStatus",

          requests.return_status
            AS "returnStatus",

          CURRENT_DATE::text
            AS "today"

        FROM leave_return_records
          AS returns

        JOIN leave_requests AS requests
          ON requests.id =
            returns.leave_request_id

        WHERE returns.id = $1
          AND requests.id = $2

        FOR UPDATE OF returns, requests
      `,
      [returnRecordId, requestId],
    );

    const record = result.rows[0];

    if (!record) {
      throw createServiceError("Leave return record not found", 404);
    }

    const mayCorrect =
      ["ADMIN", "HR"].includes(correctingUser.role) ||
      Number(correctingUser.employeeId) === record.employeeId;

    if (!mayCorrect) {
      throw createServiceError(
        "You are not authorized to correct this return record",
        403,
      );
    }

    if (
      record.leaveStatus !== "APPROVED" ||
      record.returnRecordStatus !== "REJECTED" ||
      record.returnStatus !== "AWAITING_RETURN"
    ) {
      throw createServiceError(
        "Only a rejected return record can be corrected",
        409,
      );
    }

    if (actualReturnDate < record.startDate) {
      throw createServiceError(
        "Actual return date cannot be before the leave start date",
        400,
      );
    }

    if (actualReturnDate > record.today) {
      throw createServiceError(
        "Actual return date cannot be in the future",
        400,
      );
    }

    const isWorkingDay = await calculateWorkingDays(
      client,
      actualReturnDate,
      actualReturnDate,
    );

    if (isWorkingDay !== 1) {
      throw createServiceError("Actual return date must be a working day", 400);
    }

    const scheduledReturnDate = await findNextWorkingDate(
      client,
      record.endDate,
    );

    let actualLastLeaveDate;

    if (returnType === "SCHEDULED_RETURN") {
      if (actualReturnDate !== scheduledReturnDate) {
        throw createServiceError(
          `The scheduled return date is ${scheduledReturnDate}`,
          400,
        );
      }

      actualLastLeaveDate = record.endDate;
    } else {
      if (actualReturnDate > record.endDate) {
        throw createServiceError(
          "An early return date cannot be after the approved leave end date",
          400,
        );
      }

      const previousResult = await client.query(
        `
            SELECT
              ($1::date - 1)::text
                AS "previousDate"
          `,
        [actualReturnDate],
      );

      actualLastLeaveDate = previousResult.rows[0].previousDate;
    }

    const consumedWorkingDays =
      actualLastLeaveDate < record.startDate
        ? 0
        : await calculateWorkingDays(
            client,
            record.startDate,
            actualLastLeaveDate,
          );

    if (consumedWorkingDays > record.requestedDays) {
      throw createServiceError(
        "Calculated consumed days exceed approved leave days",
        409,
      );
    }

    const correctedResult = await client.query(
      `
          UPDATE leave_return_records
          SET
            return_type = $2,

            actual_return_date = $3,

            actual_last_leave_date = $4,

            approved_working_days = $5,

            consumed_working_days = $6,

            balance_days_restored = 0,

            expired_unused_days = 0,

            return_reason = $7,

            status = 'REPORTED',

            reported_by_user_id = $8,

            reported_at =
              CURRENT_TIMESTAMP,

            verified_by_user_id = NULL,

            verified_at = NULL,

            rejected_by_user_id = NULL,

            rejected_at = NULL,

            rejection_reason = NULL,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $1

          RETURNING
            id,

            leave_request_id
              AS "leaveRequestId",

            return_type
              AS "returnType",

            actual_return_date
              AS "actualReturnDate",

            actual_last_leave_date
              AS "actualLastLeaveDate",

            approved_working_days
              AS "approvedWorkingDays",

            consumed_working_days
              AS "consumedWorkingDays",

            unused_working_days
              AS "unusedWorkingDays",

            return_reason
              AS "returnReason",

            status,

            reported_by_user_id
              AS "reportedByUserId",

            reported_at
              AS "reportedAt"
        `,
      [
        returnRecordId,
        returnType,
        actualReturnDate,
        actualLastLeaveDate,
        record.requestedDays,
        consumedWorkingDays,
        returnReason,
        correctingUser.id,
      ],
    );

    await client.query(
      `
        INSERT INTO leave_return_actions (
          leave_return_record_id,
          leave_request_id,
          action,
          comment,
          action_by_user_id
        )
        VALUES (
          $1,
          $2,
          'CORRECTED',
          $3,
          $4
        )
      `,
      [
        returnRecordId,
        requestId,
        returnReason || "Scheduled return information corrected",
        correctingUser.id,
      ],
    );

    const leaveRequestResult = await client.query(
      `
    UPDATE leave_requests
    SET
      return_status = 'RETURN_REPORTED',
      actual_return_date = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING
      id,
      status,
      balance_status AS "balanceStatus",
      return_status AS "returnStatus",
      actual_return_date AS "actualReturnDate",
      updated_at AS "updatedAt"
  `,
      [requestId],
    );

    await client.query("COMMIT");

    return {
      returnRecord: correctedResult.rows[0],
      leaveRequest: leaveRequestResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function findPendingLeaveReturns() {
  const result = await pool.query(
    `
      SELECT
        returns.id
          AS "returnRecordId",

        returns.leave_request_id
          AS "leaveRequestId",

        returns.return_type
          AS "returnType",

        returns.actual_return_date
          AS "actualReturnDate",

        returns.actual_last_leave_date
          AS "actualLastLeaveDate",

        returns.approved_working_days
          AS "approvedWorkingDays",

        returns.consumed_working_days
          AS "consumedWorkingDays",

        returns.unused_working_days
          AS "unusedWorkingDays",

        returns.return_reason
          AS "returnReason",

        returns.status
          AS "returnRecordStatus",

        returns.reported_by_user_id
          AS "reportedByUserId",

        reporting_users.full_name
          AS "reportedByUserName",

        returns.reported_at
          AS "reportedAt",

        requests.status
          AS "leaveStatus",

        requests.start_date
          AS "startDate",

        requests.end_date
          AS "endDate",

        requests.requested_days
          AS "requestedDays",

        requests.balance_status
          AS "balanceStatus",

        requests.return_status
          AS "returnStatus",

        employees.id
          AS "employeeId",

        employees.staff_number
          AS "staffNumber",

        employees.first_name
          AS "firstName",

        employees.last_name
          AS "lastName",

        CONCAT(
          employees.first_name,
          ' ',
          employees.last_name
        ) AS "employeeName",

        profiles.photo_filename
          AS "photoFilename",

        leave_types.id
          AS "leaveTypeId",

        leave_types.code
          AS "leaveTypeCode",

        leave_types.name
          AS "leaveTypeName",

        positions.id
          AS "positionId",

        positions.position_code
          AS "positionCode",

        positions.title
          AS "position",

        departments.id
          AS "departmentId",

        departments.name
          AS "department"

      FROM leave_return_records AS returns

      JOIN leave_requests AS requests
        ON requests.id =
          returns.leave_request_id

      JOIN employees
        ON employees.id =
          requests.employee_id

      JOIN leave_types
        ON leave_types.id =
          requests.leave_type_id

      LEFT JOIN app_users AS reporting_users
        ON reporting_users.id =
          returns.reported_by_user_id

      LEFT JOIN employee_profiles AS profiles
        ON profiles.employee_id =
          employees.id

      LEFT JOIN employee_position_assignments
        AS assignments
        ON assignments.employee_id =
          employees.id
        AND assignments.assignment_type =
          'SUBSTANTIVE'
        AND assignments.start_date <=
          CURRENT_DATE
        AND (
          assignments.end_date IS NULL
          OR assignments.end_date >=
            CURRENT_DATE
        )

      LEFT JOIN positions
        ON positions.id =
          assignments.position_id

      LEFT JOIN departments
        ON departments.id =
          positions.department_id

      WHERE returns.status = 'REPORTED'
        AND requests.status = 'APPROVED'
        AND requests.return_status =
          'RETURN_REPORTED'

      ORDER BY
        returns.reported_at ASC,
        returns.id ASC
    `,
  );

  return result.rows;
}
