import pool from "../config/database.js";

function serviceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;

  return error;
}

async function findNextWorkingDate(client, date) {
  const result = await client.query(
    `
      SELECT
        candidate_date::date::text
          AS "nextWorkingDate"

      FROM GENERATE_SERIES(
        $1::date + 1,
        $1::date + 30,
        INTERVAL '1 day'
      ) AS candidate_date

      LEFT JOIN public_holidays
        ON public_holidays.holiday_date =
          candidate_date::date

      WHERE EXTRACT(
        ISODOW FROM candidate_date
      ) BETWEEN 1 AND 5

        AND public_holidays.id IS NULL

      ORDER BY candidate_date ASC

      LIMIT 1
    `,
    [date],
  );

  return result.rows[0]?.nextWorkingDate || null;
}
export async function grantLeaveEntitlement(
  { employeeId, leaveTypeId, leaveYear, entitledDays, grantNote },
  grantedByUserId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const employeeResult = await client.query(
      `
          SELECT
            id,
            is_active AS "isActive",
            employment_status
              AS "employmentStatus",
            last_working_date
              AS "lastWorkingDate"
          FROM employees
          WHERE id = $1
          FOR UPDATE
        `,
      [employeeId],
    );

    const employee = employeeResult.rows[0];

    if (!employee) {
      throw serviceError("Employee not found", 404);
    }

    if (
      !employee.isActive ||
      ["EXITED", "SUSPENDED"].includes(employee.employmentStatus)
    ) {
      throw serviceError(
        "Leave entitlement cannot be granted to an inactive employee",
        409,
      );
    }

    if (
      employee.employmentStatus === "ON_NOTICE" &&
      employee.lastWorkingDate &&
      leaveYear > Number(employee.lastWorkingDate.slice(0, 4))
    ) {
      throw serviceError(
        `The employee is leaving on ${employee.lastWorkingDate} and cannot receive a ${leaveYear} entitlement`,
        409,
      );
    }

    const leaveTypeResult = await client.query(
      `
          SELECT
            id,
            code,
            name,
            entitlement_mode
              AS "entitlementMode",
            carry_forward_years
              AS "carryForwardYears",
            is_active
              AS "isActive"
          FROM leave_types
          WHERE id = $1
        `,
      [leaveTypeId],
    );

    const leaveType = leaveTypeResult.rows[0];

    if (!leaveType) {
      throw serviceError("Leave type not found", 404);
    }

    if (!leaveType.isActive) {
      throw serviceError("The leave type is inactive", 409);
    }

    if (leaveType.entitlementMode !== "ANNUAL_BUCKET") {
      throw serviceError(
        `${leaveType.name} does not use annual entitlement balances`,
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
            AND start_date <=
              make_date($2, 12, 31)
            AND (
              end_date IS NULL
              OR end_date >=
                make_date($2, 1, 1)
            )
          LIMIT 1
        `,
      [employeeId, leaveYear],
    );

    if (!contractResult.rows[0]) {
      throw serviceError(
        `No employment contract covers any part of ${leaveYear}`,
        409,
      );
    }

    const expiresOnResult = await client.query(
      `
          SELECT make_date(
            $1 +
            COALESCE($2, 0),
            12,
            31
          )::text AS "expiresOn"
        `,
      [leaveYear, leaveType.carryForwardYears],
    );

    const expiresOn = expiresOnResult.rows[0].expiresOn;

    const entitlementResult = await client.query(
      `
          INSERT INTO
            employee_leave_entitlements (
              employee_id,
              leave_type_id,
              leave_year,
              entitled_days,
              expires_on,
              source,
              granted_by_user_id,
              grant_note
            )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            'MANUAL',
            $6,
            $7
          )
          RETURNING
            id,
            employee_id
              AS "employeeId",
            leave_type_id
              AS "leaveTypeId",
            leave_year
              AS "leaveYear",
            entitled_days
              AS "entitledDays",
            expires_on
              AS "expiresOn",
            source,
            granted_by_user_id
              AS "grantedByUserId",
            grant_note
              AS "grantNote",
            created_at
              AS "createdAt"
        `,
      [
        employeeId,
        leaveTypeId,
        leaveYear,
        entitledDays,
        expiresOn,
        grantedByUserId,
        grantNote,
      ],
    );

    const entitlement = entitlementResult.rows[0];

    await client.query(
      `
        INSERT INTO
          leave_balance_transactions (
            employee_id,
            leave_type_id,
            entitlement_id,
            transaction_type,
            days,
            transaction_note,
            action_by_user_id
          )
        VALUES (
          $1,
          $2,
          $3,
          'ENTITLEMENT_GRANTED',
          $4,
          $5,
          $6
        )
      `,
      [
        employeeId,
        leaveTypeId,
        entitlement.id,
        entitledDays,
        grantNote,
        grantedByUserId,
      ],
    );

    await client.query("COMMIT");

    return {
      ...entitlement,
      leaveTypeCode: leaveType.code,
      leaveTypeName: leaveType.name,
      availableDays: entitledDays,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      throw serviceError(
        "This employee already has an entitlement for this leave type and year",
        409,
      );
    }

    throw error;
  } finally {
    client.release();
  }
}
export async function findEmployeeLeaveBalances(employeeId, year) {
  const employeeResult = await pool.query(
    `
      SELECT
        employees.id,

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

        employees.employment_status
          AS "employmentStatus",

        employees.is_active
          AS "isActive",

        profiles.gender

      FROM employees

      LEFT JOIN employee_profiles
        AS profiles
        ON profiles.employee_id =
          employees.id

      WHERE employees.id = $1
    `,
    [employeeId],
  );

  const employee = employeeResult.rows[0];

  if (!employee) {
    const error = new Error("Employee not found");

    error.statusCode = 404;
    throw error;
  }

  const [leaveTypesResult, bucketsResult] = await Promise.all([
    pool.query(
      `
        SELECT
          id,
          code,
          name,

          annual_entitlement
            AS "annualEntitlement",

          entitlement_mode
            AS "entitlementMode",

          duration_value
            AS "durationValue",

          duration_unit
            AS "durationUnit",

          eligible_gender
            AS "eligibleGender",

          carry_forward_years
            AS "carryForwardYears",

          is_paid
            AS "isPaid",

          requires_attachment
            AS "requiresAttachment"

        FROM leave_types
        WHERE is_active = TRUE
        ORDER BY name ASC
      `,
    ),

    pool.query(
      `
        SELECT
          "entitlementId",
          "employeeId",
          "leaveTypeId",
          code,
          name,
          "leaveYear",
          "entitledDays",
          "reservedDays",
          "consumedDays",
          "unexpiredRemainingDays",
          "availableDays",
          "availableFrom",
          "expiresOn",
          "isExpired",
          "isAvailable",
          source,
          "createdAt",
          "updatedAt"

        FROM employee_leave_entitlement_balances

        WHERE "employeeId" = $1

          -- A future entitlement must not be
          -- used before its entitlement year.
          AND "leaveYear" <= $2

          -- Exclude buckets that are already
          -- expired before the requested year.
          AND "expiresOn" >=
            make_date($2, 1, 1)

        ORDER BY
          "leaveTypeId" ASC,
          "leaveYear" ASC,
          "entitlementId" ASC
      `,
      [employeeId, year],
    ),
  ]);

  const balances = leaveTypesResult.rows.map((leaveType) => {
    const usesBalance = leaveType.entitlementMode === "ANNUAL_BUCKET";

    const isEligible =
      leaveType.eligibleGender === "ANY" ||
      (employee.gender && employee.gender === leaveType.eligibleGender);

    if (!usesBalance) {
      return {
        leaveTypeId: leaveType.id,
        code: leaveType.code,
        name: leaveType.name,
        entitlementMode: leaveType.entitlementMode,
        usesBalance: false,
        isPaid: leaveType.isPaid,
        requiresAttachment: leaveType.requiresAttachment,
        durationValue: leaveType.durationValue,
        durationUnit: leaveType.durationUnit,
        eligibleGender: leaveType.eligibleGender,
        isEligible: Boolean(isEligible),
        totalEntitledDays: null,
        totalReservedDays: null,
        totalConsumedDays: null,
        totalAvailableDays: null,
        buckets: [],
      };
    }

    const buckets = bucketsResult.rows.filter(
      (bucket) => bucket.leaveTypeId === leaveType.id,
    );

    const totals = buckets.reduce(
      (summary, bucket) => ({
        entitledDays: summary.entitledDays + bucket.entitledDays,

        reservedDays: summary.reservedDays + bucket.reservedDays,

        consumedDays: summary.consumedDays + bucket.consumedDays,

        remainingDays: summary.remainingDays + bucket.unexpiredRemainingDays,

        availableDays: summary.availableDays + bucket.availableDays,
      }),
      {
        entitledDays: 0,
        reservedDays: 0,
        consumedDays: 0,
        remainingDays: 0,
        availableDays: 0,
      },
    );

    return {
      leaveTypeId: leaveType.id,
      code: leaveType.code,
      name: leaveType.name,
      entitlementMode: leaveType.entitlementMode,
      usesBalance: true,
      isPaid: leaveType.isPaid,
      requiresAttachment: leaveType.requiresAttachment,
      annualEntitlement: leaveType.annualEntitlement,
      carryForwardYears: leaveType.carryForwardYears,
      eligibleGender: leaveType.eligibleGender,
      isEligible: Boolean(isEligible),

      totalEntitledDays: totals.entitledDays,

      totalReservedDays: totals.reservedDays,

      totalConsumedDays: totals.consumedDays,

      totalRemainingDays: totals.remainingDays,

      totalAvailableDays: totals.availableDays,

      buckets: buckets.map((bucket) => ({
        entitlementId: bucket.entitlementId,

        leaveYear: bucket.leaveYear,

        entitledDays: bucket.entitledDays,

        reservedDays: bucket.reservedDays,

        consumedDays: bucket.consumedDays,

        remainingDays: bucket.unexpiredRemainingDays,

        availableDays: bucket.availableDays,

        availableFrom: bucket.availableFrom,

        expiresOn: bucket.expiresOn,

        isAvailable: bucket.isAvailable,

        isExpired: bucket.isExpired,

        source: bucket.source,
      })),
    };
  });

  return {
    employee,
    year,
    balances,
  };
}
export async function generateAnnualEntitlements(asOfDate, generatedByUserId) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const contextResult = await client.query(
      `
        SELECT
          COALESCE(
            $1::date,
            CURRENT_DATE
          )::text AS "asOfDate",

          EXTRACT(
            YEAR FROM COALESCE(
              $1::date,
              CURRENT_DATE
            )
          )::integer AS "targetYear"
      `,
      [asOfDate || null],
    );

    const { asOfDate: resolvedAsOfDate, targetYear } = contextResult.rows[0];

    const policyResult = await client.query(
      `
        SELECT
          id,
          code,
          name,

          annual_entitlement
            AS "annualEntitlement",

          carry_forward_years
            AS "carryForwardYears",

          is_active
            AS "isActive",

          entitlement_mode
            AS "entitlementMode"

        FROM leave_types

        WHERE code = 'ANNUAL'

        FOR UPDATE
      `,
    );

    const policy = policyResult.rows[0];

    if (!policy) {
      const error = new Error("Annual leave policy is not configured");

      error.statusCode = 409;
      throw error;
    }

    if (
      !policy.isActive ||
      policy.entitlementMode !== "ANNUAL_BUCKET" ||
      !Number.isInteger(policy.annualEntitlement) ||
      policy.annualEntitlement <= 0
    ) {
      const error = new Error(
        "Annual leave policy configuration is incomplete",
      );

      error.statusCode = 409;
      throw error;
    }

    const employeeResult = await client.query(
      `
          SELECT
            id,
            staff_number AS "staffNumber",
            first_name AS "firstName",
            last_name AS "lastName",

            employment_status
              AS "employmentStatus",

            last_working_date
              AS "lastWorkingDate",

            continuous_service_start_date
              AS "continuousServiceStartDate",

            service_start_date_verified
              AS "serviceStartDateVerified"

          FROM employees

          WHERE is_active = TRUE
            AND employment_status IN (
              'ACTIVE',
              'ON_NOTICE'
            )

          ORDER BY
            first_name,
            last_name,
            id

          FOR UPDATE
        `,
    );

    const generated = [];
    const skipped = [];
    const ineligible = [];

    for (const employee of employeeResult.rows) {
      if (
        !employee.continuousServiceStartDate ||
        !employee.serviceStartDateVerified
      ) {
        ineligible.push({
          employeeId: employee.id,
          staffNumber: employee.staffNumber,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          reason: "CONTINUOUS_SERVICE_DATE_NOT_VERIFIED",
        });

        continue;
      }

      const eligibilityResult = await client.query(
        `
            SELECT
              (
                $1::date +
                INTERVAL '1 year'
              )::date::text
                AS "firstEligibilityDate",

              EXTRACT(
                YEAR FROM (
                  $1::date +
                  INTERVAL '1 year'
                )
              )::integer
                AS "firstEligibilityYear"
          `,
        [employee.continuousServiceStartDate],
      );

      const { firstEligibilityDate, firstEligibilityYear } =
        eligibilityResult.rows[0];

      if (firstEligibilityDate > resolvedAsOfDate) {
        ineligible.push({
          employeeId: employee.id,
          staffNumber: employee.staffNumber,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          firstEligibilityDate,
          reason: "ONE_YEAR_OF_SERVICE_NOT_COMPLETED",
        });

        continue;
      }

      const firstYearToGenerate = Math.max(
        firstEligibilityYear,
        targetYear - policy.carryForwardYears,
      );

      for (
        let entitlementYear = firstYearToGenerate;
        entitlementYear <= targetYear;
        entitlementYear += 1
      ) {
        const anniversaryResult = await client.query(
          `
              SELECT
                (
                  $1::date +
                  MAKE_INTERVAL(
                    years => (
                      $2 -
                      EXTRACT(
                        YEAR FROM $1::date
                      )::integer
                    )
                  )
                )::date::text
                  AS "anniversaryDate",

                MAKE_DATE(
                  $2 + $3,
                  12,
                  31
                )::text
                  AS "expiresOn"
            `,
          [
            employee.continuousServiceStartDate,
            entitlementYear,
            policy.carryForwardYears,
          ],
        );

        const { anniversaryDate, expiresOn } = anniversaryResult.rows[0];

        if (anniversaryDate > resolvedAsOfDate) {
          skipped.push({
            employeeId: employee.id,
            staffNumber: employee.staffNumber,
            entitlementYear,
            anniversaryDate,
            reason: "ANNIVERSARY_NOT_REACHED",
          });

          continue;
        }

        if (
          employee.lastWorkingDate &&
          anniversaryDate > employee.lastWorkingDate
        ) {
          ineligible.push({
            employeeId: employee.id,
            staffNumber: employee.staffNumber,
            entitlementYear,
            anniversaryDate,
            reason: "ANNIVERSARY_AFTER_LAST_WORKING_DATE",
          });

          continue;
        }

        const contractResult = await client.query(
          `
      SELECT id
      FROM contracts
      WHERE employee_id = $1
        AND status IN (
          'ACTIVE',
          'UPCOMING',
          'EXPIRED',
          'TERMINATED',
          'RENEWED'
        )
        AND start_date <= $2::date
        AND (
          end_date IS NULL
          OR end_date >= $2::date
        )
      ORDER BY start_date DESC
      LIMIT 1
    `,
          [employee.id, resolvedAsOfDate],
        );

        if (!contractResult.rows[0]) {
          ineligible.push({
            employeeId: employee.id,
            staffNumber: employee.staffNumber,
            entitlementYear,
            anniversaryDate,
            reason: "NO_CONTRACT_ON_SERVICE_ANNIVERSARY",
          });

          continue;
        }

        const entitlementResult = await client.query(
          `
              INSERT INTO
                employee_leave_entitlements (
                  employee_id,
                  leave_type_id,
                  leave_year,
                  entitled_days,
                  expires_on,
                  source,
                  granted_by_user_id,
                  grant_note
                )
              VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                'ANNUAL_GENERATION',
                $6,
                $7
              )

              ON CONFLICT (
                employee_id,
                leave_type_id,
                leave_year
              )
              DO NOTHING

              RETURNING
                id,
                employee_id
                  AS "employeeId",
                leave_type_id
                  AS "leaveTypeId",
                leave_year
                  AS "leaveYear",
                entitled_days
                  AS "entitledDays",
                expires_on
                  AS "expiresOn",
                source,
                granted_by_user_id
                  AS "grantedByUserId",
                grant_note
                  AS "grantNote",
                created_at
                  AS "createdAt"
            `,
          [
            employee.id,
            policy.id,
            entitlementYear,
            policy.annualEntitlement,
            expiresOn,
            generatedByUserId,
            `Annual entitlement generated for service anniversary ${anniversaryDate}`,
          ],
        );

        const entitlement = entitlementResult.rows[0];

        if (!entitlement) {
          skipped.push({
            employeeId: employee.id,
            staffNumber: employee.staffNumber,
            entitlementYear,
            anniversaryDate,
            reason: "ENTITLEMENT_ALREADY_EXISTS",
          });

          continue;
        }

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
              NULL,
              'ENTITLEMENT_GRANTED',
              $4,
              $5,
              $6
            )
          `,
          [
            employee.id,
            policy.id,
            entitlement.id,
            policy.annualEntitlement,
            `Annual entitlement generated for ${entitlementYear}`,
            generatedByUserId,
          ],
        );

        generated.push({
          ...entitlement,
          staffNumber: employee.staffNumber,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          anniversaryDate,
        });
      }
    }

    await client.query("COMMIT");

    return {
      asOfDate: resolvedAsOfDate,
      generatedCount: generated.length,
      skippedCount: skipped.length,
      ineligibleCount: ineligible.length,
      generated,
      skipped,
      ineligible,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
