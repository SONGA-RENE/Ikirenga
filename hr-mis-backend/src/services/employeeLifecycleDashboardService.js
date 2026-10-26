import pool from "../config/database.js";

export async function getEmployeeLifecycleDashboard() {
  const [
    overviewResult,
    noticeResult,
    pendingResult,
    dueResult,
    contractAttentionResult,
    recentExitsResult,
  ] = await Promise.all([
    pool.query(
      `
        SELECT
          COUNT(*)::integer
            AS "totalEmployees",

          COUNT(*) FILTER (
            WHERE employment_status =
              'ACTIVE'
          )::integer
            AS "activeEmployees",

          COUNT(*) FILTER (
            WHERE employment_status =
              'ON_NOTICE'
          )::integer
            AS "employeesOnNotice",

          COUNT(*) FILTER (
            WHERE employment_status =
              'SUSPENDED'
          )::integer
            AS "suspendedEmployees",

          COUNT(*) FILTER (
            WHERE employment_status =
              'EXITED'
          )::integer
            AS "exitedEmployees"

        FROM employees
      `,
    ),

    /*
     * Employees currently serving notice.
     */
    pool.query(
      `
        SELECT
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

          employees.last_working_date
            AS "lastWorkingDate",

          employees.employment_status_reason
            AS "employmentStatusReason",

          positions.title
            AS position,

          departments.name
            AS department,

          separations.id
            AS "separationId",

          separations.separation_type
            AS "separationType",

          separations.status
            AS "separationStatus",

          (
            employees.last_working_date -
            CURRENT_DATE
          )::integer AS "daysRemaining",

          (
            employees.last_working_date <=
            CURRENT_DATE
          ) AS "completionDue"

        FROM employees

        LEFT JOIN positions
          ON positions.id =
            employees.position_id

        LEFT JOIN departments
          ON departments.id =
            positions.department_id

        LEFT JOIN LATERAL (
          SELECT
            employee_separations.id,
            employee_separations.separation_type,
            employee_separations.status

          FROM employee_separations

          WHERE
            employee_separations.employee_id =
              employees.id
            AND employee_separations.status =
              'CONFIRMED'

          ORDER BY
            employee_separations.id DESC

          LIMIT 1
        ) AS separations
          ON TRUE

        WHERE
          employees.employment_status =
            'ON_NOTICE'

        ORDER BY
          employees.last_working_date ASC,
          employees.first_name ASC,
          employees.last_name ASC
      `,
    ),

    /*
     * Separation requests awaiting HR
     * confirmation.
     */
    pool.query(
      `
        SELECT
          separations.id
            AS "separationId",

          separations.employee_id
            AS "employeeId",

          employees.staff_number
            AS "staffNumber",

          CONCAT(
            employees.first_name,
            ' ',
            employees.last_name
          ) AS "employeeName",

          employees.photo_filename
            AS "photoFilename",

          separations.separation_type
            AS "separationType",

          separations.notice_received_date
            AS "noticeReceivedDate",

          separations.notice_start_date
            AS "noticeStartDate",

          separations.last_working_date
            AS "lastWorkingDate",

          separations.reason,

          separations.created_at
            AS "createdAt",

          app_users.full_name
            AS "initiatedBy"

        FROM employee_separations
          AS separations

        JOIN employees
          ON employees.id =
            separations.employee_id

        LEFT JOIN app_users
          ON app_users.id =
            separations.initiated_by_user_id

        WHERE
          separations.status =
            'PENDING'

        ORDER BY
          separations.created_at ASC
      `,
    ),

    /*
     * Confirmed separations whose last working
     * date has arrived. The counts below are
     * indicators only; the completion service
     * remains the final authority.
     */
    pool.query(
      `
        SELECT
          separations.id
            AS "separationId",

          separations.employee_id
            AS "employeeId",

          employees.staff_number
            AS "staffNumber",

          CONCAT(
            employees.first_name,
            ' ',
            employees.last_name
          ) AS "employeeName",

          separations.separation_type
            AS "separationType",

          separations.last_working_date
            AS "lastWorkingDate",

          app_users.id
            AS "employeeUserId",

          (
            SELECT COUNT(*)::integer
            FROM department_directors
            WHERE
              department_directors.director_user_id =
                app_users.id
              AND department_directors.is_active =
                TRUE
          ) AS "directorBlockers",

          (
            SELECT COUNT(*)::integer
            FROM mission_approval_requirements
            WHERE
              mission_approval_requirements.assigned_user_id =
                app_users.id
              AND mission_approval_requirements.status =
                'PENDING'
          ) AS "approvalBlockers",

          (
            SELECT COUNT(*)::integer
            FROM approval_delegations
            WHERE
              approval_delegations.is_active =
                TRUE
              AND approval_delegations.ends_at >=
                CURRENT_TIMESTAMP
              AND (
                approval_delegations.delegator_user_id =
                  app_users.id
                OR
                approval_delegations.delegate_user_id =
                  app_users.id
              )
          ) AS "delegationBlockers",

          (
            SELECT COUNT(*)::integer
            FROM leave_requests
            WHERE
              leave_requests.employee_id =
                employees.id
              AND (
                leave_requests.status =
                  'PENDING'
                OR (
                  leave_requests.status =
                    'APPROVED'
                  AND
                  leave_requests.end_date >
                    separations.last_working_date
                )
              )
          ) AS "leaveBlockers",

          (
            SELECT COUNT(DISTINCT missions.id)::integer
            FROM mission_participants
            JOIN missions
              ON missions.id =
                mission_participants.mission_id
            WHERE
              mission_participants.employee_id =
                employees.id
              AND missions.status NOT IN (
                'COMPLETED',
                'CANCELLED',
                'REJECTED'
              )
              AND missions.end_date >
                separations.last_working_date
          ) AS "missionBlockers"

        FROM employee_separations
          AS separations

        JOIN employees
          ON employees.id =
            separations.employee_id

        LEFT JOIN app_users
          ON app_users.employee_id =
            employees.id

        WHERE
          separations.status =
            'CONFIRMED'
          AND separations.last_working_date <=
            CURRENT_DATE

        ORDER BY
          separations.last_working_date ASC
      `,
    ),

    /*
     * Active employees without a compliant
     * active contract.
     */
    pool.query(
      `
        SELECT
          employee_id
            AS "employeeId",

          staff_number
            AS "staffNumber",

          employee_name
            AS "employeeName",

          employment_status
            AS "employmentStatus",

          contract_compliance_status
            AS "contractComplianceStatus",

          active_contract_id
            AS "activeContractId",

          contract_end_date
            AS "contractEndDate",

          position,
          department

        FROM employee_contract_compliance

        WHERE
          employment_status IN (
            'ACTIVE',
            'ON_NOTICE'
          )
          AND contract_compliance_status =
            'ATTENTION_REQUIRED'

        ORDER BY
          employee_name ASC
      `,
    ),

    /*
     * Most recently exited employees.
     */
    pool.query(
      `
        SELECT
          employees.id
            AS "employeeId",

          employees.staff_number
            AS "staffNumber",

          CONCAT(
            employees.first_name,
            ' ',
            employees.last_name
          ) AS "employeeName",

          employees.photo_filename
            AS "photoFilename",

          employees.last_working_date
            AS "lastWorkingDate",

          employees.employment_status_reason
            AS "employmentStatusReason",

          employees.exited_at
            AS "exitedAt",

          positions.title
            AS position,

          departments.name
            AS department,

          separations.separation_type
            AS "separationType"

        FROM employees

        LEFT JOIN positions
          ON positions.id =
            employees.position_id

        LEFT JOIN departments
          ON departments.id =
            positions.department_id

        LEFT JOIN LATERAL (
          SELECT
            employee_separations.separation_type

          FROM employee_separations

          WHERE
            employee_separations.employee_id =
              employees.id
            AND employee_separations.status =
              'COMPLETED'

          ORDER BY
            employee_separations.completed_at
              DESC

          LIMIT 1
        ) AS separations
          ON TRUE

        WHERE
          employees.employment_status =
            'EXITED'

        ORDER BY
          employees.exited_at DESC
            NULLS LAST

        LIMIT 10
      `,
    ),
  ]);

  const dueSeparations = dueResult.rows.map((record) => {
    const blockerCount =
      record.directorBlockers +
      record.approvalBlockers +
      record.delegationBlockers +
      record.leaveBlockers +
      record.missionBlockers;

    return {
      ...record,
      blockerCount,
      readyForCompletion: blockerCount === 0,
    };
  });

  const pendingSeparations = pendingResult.rows;

  const employeesOnNotice = noticeResult.rows;

  const contractAttention = contractAttentionResult.rows;

  const overview = {
    ...overviewResult.rows[0],

    pendingSeparationConfirmations: pendingSeparations.length,

    separationsDue: dueSeparations.length,

    separationsReadyForCompletion: dueSeparations.filter(
      (record) => record.readyForCompletion,
    ).length,

    separationsBlocked: dueSeparations.filter(
      (record) => !record.readyForCompletion,
    ).length,

    contractAttentionRequired: contractAttention.length,
  };

  return {
    overview,
    employeesOnNotice,
    pendingSeparations,
    dueSeparations,
    contractAttention,
    recentExits: recentExitsResult.rows,
  };
}
