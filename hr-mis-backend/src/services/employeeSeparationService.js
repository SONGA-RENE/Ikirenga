import pool from "../config/database.js";

export async function createEmployeeSeparation(
  employeeId,
  separationData,
  initiatedByUserId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const employeeResult = await client.query(
      `
          SELECT
            id,
            employment_status
              AS "employmentStatus",
            is_active AS "isActive"
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

    if (!employee.isActive || employee.employmentStatus !== "ACTIVE") {
      const error = new Error(
        "Only an active employee can begin a separation process",
      );
      error.statusCode = 409;
      throw error;
    }

    const existingResult = await client.query(
      `
          SELECT id
          FROM employee_separations
          WHERE employee_id = $1
            AND status IN (
              'PENDING',
              'CONFIRMED'
            )
          FOR UPDATE
        `,
      [employeeId],
    );

    if (existingResult.rowCount > 0) {
      const error = new Error(
        "The employee already has an open separation process",
      );
      error.statusCode = 409;
      throw error;
    }

    const result = await client.query(
      `
        INSERT INTO employee_separations (
          employee_id,
          separation_type,
          status,
          notice_received_date,
          notice_start_date,
          last_working_date,
          reason,
          initiated_by_user_id
        )
        VALUES (
          $1,
          $2,
          'PENDING',
          $3,
          $4,
          $5,
          $6,
          $7
        )
        RETURNING
          id,
          employee_id AS "employeeId",
          separation_type
            AS "separationType",
          status,
          notice_received_date
            AS "noticeReceivedDate",
          notice_start_date
            AS "noticeStartDate",
          last_working_date
            AS "lastWorkingDate",
          reason,
          initiated_by_user_id
            AS "initiatedByUserId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        employeeId,
        separationData.separationType,
        separationData.noticeReceivedDate,
        separationData.noticeStartDate,
        separationData.lastWorkingDate,
        separationData.reason,
        initiatedByUserId,
      ],
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

export async function confirmEmployeeSeparation(
  employeeId,
  separationId,
  confirmedByUserId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const separationResult = await client.query(
      `
          SELECT
            id,
            employee_id AS "employeeId",
            separation_type
              AS "separationType",
            status,
            last_working_date
              AS "lastWorkingDate",
            reason
          FROM employee_separations
          WHERE id = $1
            AND employee_id = $2
          FOR UPDATE
        `,
      [separationId, employeeId],
    );

    const separation = separationResult.rows[0];

    if (!separation) {
      const error = new Error("Employee separation not found");
      error.statusCode = 404;
      throw error;
    }

    if (separation.status !== "PENDING") {
      const error = new Error("Only a pending separation can be confirmed");
      error.statusCode = 409;
      throw error;
    }

    const employeeResult = await client.query(
      `
          SELECT
            id,
            employment_status
              AS "employmentStatus",
            is_active AS "isActive"
          FROM employees
          WHERE id = $1
          FOR UPDATE
        `,
      [employeeId],
    );

    const employee = employeeResult.rows[0];

    if (
      !employee ||
      !employee.isActive ||
      employee.employmentStatus !== "ACTIVE"
    ) {
      const error = new Error(
        "Employee is no longer eligible for separation confirmation",
      );
      error.statusCode = 409;
      throw error;
    }

    const updateResult = await client.query(
      `
          UPDATE employee_separations
          SET
            status = 'CONFIRMED',
            confirmed_by_user_id = $3,
            confirmed_at =
              CURRENT_TIMESTAMP,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = $1
            AND employee_id = $2
            AND status = 'PENDING'
          RETURNING
            id,
            employee_id AS "employeeId",
            separation_type
              AS "separationType",
            status,
            last_working_date
              AS "lastWorkingDate",
            reason,
            confirmed_by_user_id
              AS "confirmedByUserId",
            confirmed_at
              AS "confirmedAt",
            updated_at AS "updatedAt"
        `,
      [separationId, employeeId, confirmedByUserId],
    );

    await client.query(
      `
        UPDATE employees
        SET
          employment_status =
            'ON_NOTICE',
          employment_status_reason =
            $2,
          status_effective_date =
            CURRENT_DATE,
          last_working_date = $3,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [employeeId, separation.reason, separation.lastWorkingDate],
    );

    await client.query(
      `
        INSERT INTO employee_status_history (
          employee_id,
          previous_status,
          new_status,
          effective_date,
          reason,
          changed_by_user_id
        )
        VALUES (
          $1,
          'ACTIVE',
          'ON_NOTICE',
          CURRENT_DATE,
          $2,
          $3
        )
      `,
      [employeeId, separation.reason, confirmedByUserId],
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

export async function cancelEmployeeSeparation(
  employeeId,
  separationId,
  cancellationReason,
  cancelledByUserId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const separationResult = await client.query(
      `
          SELECT
            id,
            employee_id AS "employeeId",
            status
          FROM employee_separations
          WHERE id = $1
            AND employee_id = $2
          FOR UPDATE
        `,
      [separationId, employeeId],
    );

    const separation = separationResult.rows[0];

    if (!separation) {
      const error = new Error("Employee separation not found");
      error.statusCode = 404;
      throw error;
    }

    if (!["PENDING", "CONFIRMED"].includes(separation.status)) {
      const error = new Error(
        "Only a pending or confirmed separation can be cancelled",
      );
      error.statusCode = 409;
      throw error;
    }

    const previousSeparationStatus = separation.status;

    const result = await client.query(
      `
        UPDATE employee_separations
        SET
          status = 'CANCELLED',
          cancellation_reason = $3,
          cancelled_by_user_id = $4,
          cancelled_at =
            CURRENT_TIMESTAMP,
          updated_at =
            CURRENT_TIMESTAMP
        WHERE id = $1
          AND employee_id = $2
          AND status IN (
            'PENDING',
            'CONFIRMED'
          )
        RETURNING
          id,
          employee_id AS "employeeId",
          separation_type
            AS "separationType",
          status,
          cancellation_reason
            AS "cancellationReason",
          cancelled_by_user_id
            AS "cancelledByUserId",
          cancelled_at AS "cancelledAt",
          updated_at AS "updatedAt"
      `,
      [separationId, employeeId, cancellationReason, cancelledByUserId],
    );

    if (previousSeparationStatus === "CONFIRMED") {
      await client.query(
        `
          UPDATE employees
          SET
            employment_status =
              'ACTIVE',
            employment_status_reason =
              NULL,
            status_effective_date =
              CURRENT_DATE,
            last_working_date = NULL,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE id = $1
            AND employment_status =
              'ON_NOTICE'
        `,
        [employeeId],
      );

      await client.query(
        `
          INSERT INTO employee_status_history (
            employee_id,
            previous_status,
            new_status,
            effective_date,
            reason,
            changed_by_user_id
          )
          VALUES (
            $1,
            'ON_NOTICE',
            'ACTIVE',
            CURRENT_DATE,
            $2,
            $3
          )
        `,
        [employeeId, cancellationReason, cancelledByUserId],
      );
    }

    await client.query("COMMIT");

    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findEmployeeSeparations(employeeId) {
  const result = await pool.query(
    `
      SELECT
        separations.id,

        separations.employee_id
          AS "employeeId",

        separations.separation_type
          AS "separationType",

        separations.status,

        separations.notice_received_date
          AS "noticeReceivedDate",

        separations.notice_start_date
          AS "noticeStartDate",

        separations.last_working_date
          AS "lastWorkingDate",

        separations.reason,

        separations.initiated_by_user_id
          AS "initiatedByUserId",

        initiated_by.full_name
          AS "initiatedBy",

        separations.confirmed_by_user_id
          AS "confirmedByUserId",

        confirmed_by.full_name
          AS "confirmedBy",

        separations.confirmed_at
          AS "confirmedAt",

        separations.completed_at
          AS "completedAt",

        separations.cancelled_at
          AS "cancelledAt",

        separations.cancellation_reason
          AS "cancellationReason",

        separations.created_at
          AS "createdAt",

        separations.updated_at
          AS "updatedAt"

      FROM employee_separations
        AS separations

      LEFT JOIN app_users
        AS initiated_by
        ON initiated_by.id =
          separations.initiated_by_user_id

      LEFT JOIN app_users
        AS confirmed_by
        ON confirmed_by.id =
          separations.confirmed_by_user_id

      WHERE separations.employee_id = $1

      ORDER BY
        separations.created_at DESC,
        separations.id DESC
    `,
    [employeeId],
  );

  return result.rows;
}

export async function completeEmployeeSeparation(
  employeeId,
  separationId,
  completedByUserId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const contextResult = await client.query(
      `
          SELECT
            separations.id,
            separations.employee_id
              AS "employeeId",

            separations.separation_type
              AS "separationType",

            separations.status,
            separations.last_working_date
              AS "lastWorkingDate",

            separations.reason,

            employees.staff_number
              AS "staffNumber",

            CONCAT(
              employees.first_name,
              ' ',
              employees.last_name
            ) AS "employeeName",

            employees.employment_status
              AS "employmentStatus",

            employees.is_active
              AS "isActive",

            app_users.id
              AS "employeeUserId",

            CURRENT_DATE::text
              AS "today"

          FROM employee_separations
            AS separations

          JOIN employees
            ON employees.id =
              separations.employee_id

          LEFT JOIN app_users
            ON app_users.employee_id =
              employees.id

          WHERE
            separations.id = $1
            AND separations.employee_id = $2

          FOR UPDATE OF
            separations,
            employees
        `,
      [separationId, employeeId],
    );

    const context = contextResult.rows[0];

    if (!context) {
      const error = new Error("Employee separation not found");

      error.statusCode = 404;
      throw error;
    }

    if (context.status === "COMPLETED") {
      const error = new Error("Employee separation has already been completed");

      error.statusCode = 409;
      throw error;
    }

    if (context.status !== "CONFIRMED") {
      const error = new Error("Only a confirmed separation can be completed");

      error.statusCode = 409;
      throw error;
    }

    if (context.employmentStatus !== "ON_NOTICE") {
      const error = new Error(
        "The employee must be on notice before separation can be completed",
      );

      error.statusCode = 409;
      throw error;
    }

    if (context.lastWorkingDate > context.today) {
      const error = new Error(
        `Separation cannot be completed before ${context.lastWorkingDate}`,
      );

      error.statusCode = 409;
      throw error;
    }

    const blockers = [];

    /*
     * Check whether the employee is still an
     * active department director.
     */
    if (context.employeeUserId) {
      const directorResult = await client.query(
        `
            SELECT
              department_directors.id,
              departments.name
                AS department

            FROM department_directors

            JOIN departments
              ON departments.id =
                department_directors.department_id

            WHERE
              department_directors.director_user_id =
                $1
              AND department_directors.is_active =
                TRUE
          `,
        [context.employeeUserId],
      );

      for (const assignment of directorResult.rows) {
        blockers.push({
          type: "DEPARTMENT_DIRECTOR",
          message: `Employee is still the active director of ${assignment.department}`,
          referenceId: assignment.id,
        });
      }

      /*
       * Pending mission approvals assigned
       * directly to the employee's user account.
       */
      const approvalResult = await client.query(
        `
            SELECT
              requirements.id,
              requirements.mission_id
                AS "missionId",
              requirements.stage,
              missions.mission_number
                AS "missionNumber"

            FROM mission_approval_requirements
              AS requirements

            JOIN missions
              ON missions.id =
                requirements.mission_id

            WHERE
              requirements.assigned_user_id =
                $1
              AND requirements.status =
                'PENDING'
          `,
        [context.employeeUserId],
      );

      for (const approval of approvalResult.rows) {
        blockers.push({
          type: "MISSION_APPROVAL",
          message: `Pending ${approval.stage} approval for mission ${approval.missionNumber}`,
          referenceId: approval.id,
          missionId: approval.missionId,
        });
      }

      /*
       * Active approval delegations must be
       * revoked or reassigned first.
       */
      const delegationResult = await client.query(
        `
            SELECT
              delegations.id,
              delegations.authority_role
                AS "authorityRole",

              CASE
                WHEN
                  delegations.delegator_user_id =
                    $1
                THEN 'DELEGATOR'
                ELSE 'DELEGATE'
              END AS "employeeRole"

            FROM approval_delegations
              AS delegations

            WHERE
              delegations.is_active = TRUE
              AND delegations.ends_at >=
                CURRENT_TIMESTAMP
              AND (
                delegations.delegator_user_id =
                  $1
                OR
                delegations.delegate_user_id =
                  $1
              )
          `,
        [context.employeeUserId],
      );

      for (const delegation of delegationResult.rows) {
        blockers.push({
          type: "APPROVAL_DELEGATION",
          message: `Employee has an active ${delegation.authorityRole} approval delegation as ${delegation.employeeRole.toLowerCase()}`,
          referenceId: delegation.id,
        });
      }
    }

    /*
     * Pending leave requests must be resolved.
     * Approved leave cannot extend beyond the
     * employee's final working date.
     */
    const leaveResult = await client.query(
      `
          SELECT
            leave_requests.id,
            leave_requests.status,
            leave_requests.start_date
              AS "startDate",
            leave_requests.end_date
              AS "endDate",
            leave_types.name
              AS "leaveType"

          FROM leave_requests

          JOIN leave_types
            ON leave_types.id =
              leave_requests.leave_type_id

          WHERE
            leave_requests.employee_id = $1
            AND (
              leave_requests.status =
                'PENDING'
              OR (
                leave_requests.status =
                  'APPROVED'
                AND
                leave_requests.end_date >
                  $2::date
              )
            )
        `,
      [employeeId, context.lastWorkingDate],
    );

    for (const leaveRequest of leaveResult.rows) {
      blockers.push({
        type: "LEAVE_REQUEST",
        message:
          leaveRequest.status === "PENDING"
            ? `Pending ${leaveRequest.leaveType} leave request`
            : `${leaveRequest.leaveType} leave extends beyond the last working date`,
        referenceId: leaveRequest.id,
      });
    }

    /*
     * Prevent exit while the employee is assigned
     * to an unfinished or future mission.
     */
    const missionResult = await client.query(
      `
          SELECT DISTINCT
            missions.id,
            missions.mission_number
              AS "missionNumber",
            missions.status,
            missions.start_date
              AS "startDate",
            missions.end_date
              AS "endDate"

          FROM mission_participants

          JOIN missions
            ON missions.id =
              mission_participants.mission_id

          WHERE
            mission_participants.employee_id =
              $1
            AND missions.status NOT IN (
              'COMPLETED',
              'CANCELLED',
              'REJECTED'
            )
            AND missions.end_date >
              $2::date
        `,
      [employeeId, context.lastWorkingDate],
    );

    for (const mission of missionResult.rows) {
      blockers.push({
        type: "MISSION_PARTICIPATION",
        message: `Employee is assigned to open mission ${mission.missionNumber}`,
        referenceId: mission.id,
      });
    }

    /*
     * Avoid violating the assignment date
     * constraint when closing current positions.
     */
    const invalidAssignmentResult = await client.query(
      `
          SELECT
            assignments.id,
            assignments.start_date
              AS "startDate",
            positions.title AS position

          FROM employee_position_assignments
            AS assignments

          JOIN positions
            ON positions.id =
              assignments.position_id

          WHERE
            assignments.employee_id = $1
            AND assignments.end_date
              IS NULL
            AND assignments.start_date >
              $2::date
        `,
      [employeeId, context.lastWorkingDate],
    );

    for (const assignment of invalidAssignmentResult.rows) {
      blockers.push({
        type: "POSITION_ASSIGNMENT",
        message: `${assignment.position} assignment begins after the proposed last working date`,
        referenceId: assignment.id,
      });
    }

    if (blockers.length > 0) {
      const error = new Error("Employee separation has unresolved blockers");

      error.statusCode = 409;
      error.blockers = blockers;

      throw error;
    }

    /*
     * Terminate contracts that are active on the
     * final working date.
     */
    const terminatedContractsResult = await client.query(
      `
          UPDATE contracts
          SET
            end_date = $2::date,
            termination_date = $2::date,
            termination_reason = $3,
            terminated_by_user_id = $4,
            status = 'TERMINATED',
            updated_at = CURRENT_TIMESTAMP
          WHERE employee_id = $1
            AND status = 'ACTIVE'
          RETURNING id
        `,
      [
        employeeId,
        context.lastWorkingDate,
        `Employment ended through ${context.separationType.toLowerCase()}: ${context.reason}`,
        completedByUserId,
      ],
    );

    /*
     * Future contracts must not activate after
     * the employee has exited.
     */
    const cancelledContractsResult = await client.query(
      `
          UPDATE contracts
          SET
            status = 'CANCELLED',
            cancellation_reason = $2,
            cancelled_at =
              CURRENT_TIMESTAMP,
            cancelled_by_user_id = $3,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE employee_id = $1
            AND status = 'UPCOMING'
          RETURNING id
        `,
      [
        employeeId,
        "Cancelled because the employee separated from PSF",
        completedByUserId,
      ],
    );

    /*
     * End every current position assignment.
     * The position itself remains active and
     * becomes available for another employee.
     */
    const endedAssignmentsResult = await client.query(
      `
          UPDATE employee_position_assignments
          SET
            end_date = $2::date,
            ended_by_user_id = $3,

            assignment_note =
              CASE
                WHEN assignment_note IS NULL
                  OR TRIM(assignment_note) = ''
                THEN $4
                ELSE
                  assignment_note ||
                  E'\\n' ||
                  $4
              END,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE employee_id = $1
            AND end_date IS NULL

          RETURNING id
        `,
      [
        employeeId,
        context.lastWorkingDate,
        completedByUserId,
        `Ended because employment concluded through ${context.separationType.toLowerCase()}`,
      ],
    );

    /*
     * Mark the employee as exited.
     */
    const employeeResult = await client.query(
      `
          UPDATE employees
          SET
            employment_status =
              'EXITED',

            employment_status_reason =
              $2,

            status_effective_date =
              $3::date,

            last_working_date =
              $3::date,

            is_active = FALSE,

            exited_at =
              CURRENT_TIMESTAMP,

            exited_by_user_id =
              $4,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $1
            AND employment_status =
              'ON_NOTICE'

          RETURNING
            id,
            staff_number
              AS "staffNumber",

            first_name
              AS "firstName",

            last_name
              AS "lastName",

            employment_status
              AS "employmentStatus",

            status_effective_date
              AS "statusEffectiveDate",

            last_working_date
              AS "lastWorkingDate",

            employment_status_reason
              AS "employmentStatusReason",

            is_active
              AS "isActive",

            exited_at
              AS "exitedAt",

            exited_by_user_id
              AS "exitedByUserId"
        `,
      [employeeId, context.reason, context.lastWorkingDate, completedByUserId],
    );

    if (employeeResult.rowCount !== 1) {
      const error = new Error(
        "Employee status changed before separation could be completed",
      );

      error.statusCode = 409;
      throw error;
    }

    await client.query(
      `
        INSERT INTO employee_status_history (
          employee_id,
          previous_status,
          new_status,
          effective_date,
          reason,
          changed_by_user_id
        )
        VALUES (
          $1,
          'ON_NOTICE',
          'EXITED',
          $2::date,
          $3,
          $4
        )
      `,
      [employeeId, context.lastWorkingDate, context.reason, completedByUserId],
    );

    /*
     * Disable the user's system account and
     * invalidate previously issued tokens.
     */
    let disabledUserAccounts = 0;

    if (context.employeeUserId) {
      const disabledUserResult = await client.query(
        `
            UPDATE app_users
            SET
              is_active = FALSE,
              auth_version =
                auth_version + 1,
              updated_at =
                CURRENT_TIMESTAMP
            WHERE id = $1
              AND is_active = TRUE
            RETURNING id
          `,
        [context.employeeUserId],
      );

      disabledUserAccounts = disabledUserResult.rowCount;
    }

    /*
     * Complete the separation record.
     */
    const separationResult = await client.query(
      `
          UPDATE employee_separations
          SET
            status = 'COMPLETED',

            completed_by_user_id = $3,

            completed_at =
              CURRENT_TIMESTAMP,

            updated_at =
              CURRENT_TIMESTAMP

          WHERE id = $1
            AND employee_id = $2
            AND status = 'CONFIRMED'

          RETURNING
            id,

            employee_id
              AS "employeeId",

            separation_type
              AS "separationType",

            status,

            notice_received_date
              AS "noticeReceivedDate",

            notice_start_date
              AS "noticeStartDate",

            last_working_date
              AS "lastWorkingDate",

            reason,

            completed_by_user_id
              AS "completedByUserId",

            completed_at
              AS "completedAt",

            updated_at
              AS "updatedAt"
        `,
      [separationId, employeeId, completedByUserId],
    );

    if (separationResult.rowCount !== 1) {
      const error = new Error(
        "Separation status changed before completion could finish",
      );

      error.statusCode = 409;
      throw error;
    }

    await client.query("COMMIT");

    return {
      separation: separationResult.rows[0],

      employee: employeeResult.rows[0],

      completionSummary: {
        terminatedContracts: terminatedContractsResult.rowCount,

        cancelledUpcomingContracts: cancelledContractsResult.rowCount,

        endedPositionAssignments: endedAssignmentsResult.rowCount,

        disabledUserAccounts,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
