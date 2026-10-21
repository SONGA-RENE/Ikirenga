import pool from "../config/database.js";

export async function getFinanceDashboard() {
  const [
    disbursementResult,
    reconciliationResult,
    fundingResult,
  ] = await Promise.all([
    pool.query(
      `
        SELECT
          currency,

          COUNT(*)::integer
            AS "totalDisbursements",

          (
            COUNT(*)
            FILTER (
              WHERE status = 'PENDING'
            )
          )::integer
            AS "pendingDisbursements",

          (
            COUNT(*)
            FILTER (
              WHERE status = 'PAID'
            )
          )::integer
            AS "paidDisbursements",

          (
            COUNT(*)
            FILTER (
              WHERE status = 'CANCELLED'
            )
          )::integer
            AS "cancelledDisbursements",

          COALESCE(
            SUM(amount)
            FILTER (
              WHERE status = 'PENDING'
            ),
            0
          ) AS "pendingAmount",

          COALESCE(
            SUM(amount)
            FILTER (
              WHERE status = 'PAID'
            ),
            0
          ) AS "paidAmount",

          COALESCE(
            SUM(amount)
            FILTER (
              WHERE status = 'CANCELLED'
            ),
            0
          ) AS "cancelledAmount"

        FROM mission_disbursements

        GROUP BY currency
        ORDER BY currency
      `,
    ),

    pool.query(
      `
        SELECT
          COUNT(*)::integer
            AS "totalReconciliations",

          (
            COUNT(*)
            FILTER (
              WHERE status = 'DRAFT'
            )
          )::integer
            AS "draftReconciliations",

          (
            COUNT(*)
            FILTER (
              WHERE status = 'SUBMITTED'
            )
          )::integer
            AS "submittedReconciliations",

          (
            COUNT(*)
            FILTER (
              WHERE status = 'VERIFIED'
            )
          )::integer
            AS "verifiedReconciliations",

          (
            COUNT(*)
            FILTER (
              WHERE status = 'REJECTED'
            )
          )::integer
            AS "rejectedReconciliations",

          (
            COUNT(*)
            FILTER (
              WHERE
                amount_received
                - amount_accounted_for
                - amount_returned
                <> 0
            )
          )::integer
            AS "reconciliationsWithBalance"

        FROM mission_expense_reconciliations
      `,
    ),

    pool.query(
      `
        SELECT
          currency,

          COALESCE(
            SUM(approved_amount),
            0
          ) AS "totalApprovedFunding",

          COALESCE(
            SUM(approved_amount)
            FILTER (
              WHERE funding_source = 'PSF'
            ),
            0
          ) AS "psfFunding",

          COALESCE(
            SUM(approved_amount)
            FILTER (
              WHERE funding_source IN (
                'HOST_INSTITUTION',
                'PARTNER',
                'OTHER'
              )
            ),
            0
          ) AS "externalFunding",

          COALESCE(
            SUM(approved_amount)
            FILTER (
              WHERE funding_source =
                'EMPLOYEE_REIMBURSEMENT'
            ),
            0
          ) AS "reimbursableFunding"

        FROM mission_funding_items

        GROUP BY currency
        ORDER BY currency
      `,
    ),
  ]);

  const pendingMissionResult =
    await pool.query(
      `
        WITH accountable_advances AS (
          SELECT
            disbursements.mission_id,
            disbursements
              .participant_employee_id
              AS employee_id,
            disbursements.currency,
            SUM(disbursements.amount)
              AS accountable_amount

          FROM mission_disbursements
            AS disbursements

          JOIN mission_funding_items
            AS funding
            ON funding.id =
              disbursements.funding_item_id
            AND funding.mission_id =
              disbursements.mission_id

          WHERE
            disbursements.status = 'PAID'
            AND funding.requires_reconciliation =
              TRUE

          GROUP BY
            disbursements.mission_id,
            disbursements
              .participant_employee_id,
            disbursements.currency
        )

        SELECT
          COUNT(
            DISTINCT missions.id
          )::integer
            AS "missionsAwaitingFinance",

          COUNT(
            DISTINCT missions.id
          ) FILTER (
            WHERE EXISTS (
              SELECT 1
              FROM mission_disbursements
              WHERE
                mission_disbursements.mission_id =
                  missions.id
                AND mission_disbursements.status =
                  'PENDING'
            )
          )::integer
            AS "missionsWithPendingPayments",

          COUNT(
            DISTINCT advances.mission_id
          ) FILTER (
            WHERE
              reconciliation.id IS NULL
              OR reconciliation.status
                <> 'VERIFIED'
              OR reconciliation.amount_received
                <> advances.accountable_amount
              OR (
                reconciliation.amount_received
                - reconciliation
                  .amount_accounted_for
                - reconciliation
                  .amount_returned
              ) <> 0
          )::integer
            AS "missionsWithOutstandingReconciliation"

        FROM missions

        LEFT JOIN accountable_advances
          AS advances
          ON advances.mission_id =
            missions.id

        LEFT JOIN
          mission_expense_reconciliations
            AS reconciliation
          ON reconciliation.mission_id =
            advances.mission_id
          AND reconciliation
            .participant_employee_id =
            advances.employee_id
          AND reconciliation.currency =
            advances.currency

        WHERE missions.status = 'APPROVED'
          AND (
            EXISTS (
              SELECT 1
              FROM mission_disbursements
              WHERE
                mission_disbursements.mission_id =
                  missions.id
                AND mission_disbursements.status =
                  'PENDING'
            )
            OR (
              advances.mission_id IS NOT NULL
              AND (
                reconciliation.id IS NULL
                OR reconciliation.status
                  <> 'VERIFIED'
                OR reconciliation.amount_received
                  <> advances.accountable_amount
                OR (
                  reconciliation.amount_received
                  - reconciliation
                    .amount_accounted_for
                  - reconciliation
                    .amount_returned
                ) <> 0
              )
            )
          )
      `,
    );

  return {
    overview: {
      ...reconciliationResult.rows[0],
      ...pendingMissionResult.rows[0],
    },
    fundingByCurrency:
      fundingResult.rows,
    disbursementsByCurrency:
      disbursementResult.rows,
  };
}

export async function getMissionClosureReadiness() {
  const result = await pool.query(
    `
      WITH report_summary AS (
        SELECT
          participants.mission_id,

          COUNT(
            participants.id
          )::integer
            AS total_participants,

          (
            COUNT(reports.id)
            FILTER (
              WHERE reports.status = 'SUBMITTED'
            )
          )::integer
            AS submitted_reports,

          (
            COUNT(reports.id)
            FILTER (
              WHERE reports.status = 'DRAFT'
            )
          )::integer
            AS draft_reports

        FROM mission_participants
          AS participants

        LEFT JOIN mission_reports AS reports
          ON reports.mission_id =
            participants.mission_id
          AND reports
            .submitted_by_employee_id =
            participants.employee_id

        GROUP BY participants.mission_id
      ),

      disbursement_summary AS (
        SELECT
          mission_id,

          (
            COUNT(*)
            FILTER (
              WHERE status = 'PENDING'
            )
          )::integer
            AS pending_disbursements,

          (
            COUNT(*)
            FILTER (
              WHERE status = 'PAID'
            )
          )::integer
            AS paid_disbursements

        FROM mission_disbursements

        GROUP BY mission_id
      ),

      accountable_advances AS (
        SELECT
          disbursements.mission_id,

          disbursements
            .participant_employee_id
            AS employee_id,

          disbursements.currency,

          SUM(disbursements.amount)
            AS accountable_amount

        FROM mission_disbursements
          AS disbursements

        JOIN mission_funding_items AS funding
          ON funding.id =
            disbursements.funding_item_id
          AND funding.mission_id =
            disbursements.mission_id

        WHERE
          disbursements.status = 'PAID'
          AND funding.requires_reconciliation =
            TRUE

        GROUP BY
          disbursements.mission_id,
          disbursements
            .participant_employee_id,
          disbursements.currency
      ),

      finance_summary AS (
        SELECT
          advances.mission_id,

          COUNT(*)::integer
            AS required_reconciliations,

          (
            COUNT(*)
            FILTER (
              WHERE
                reconciliation.status =
                  'VERIFIED'
                AND reconciliation
                  .amount_received =
                  advances.accountable_amount
                AND (
                  reconciliation.amount_received
                  - reconciliation
                    .amount_accounted_for
                  - reconciliation
                    .amount_returned
                ) = 0
            )
          )::integer
            AS cleared_reconciliations

        FROM accountable_advances AS advances

        LEFT JOIN
          mission_expense_reconciliations
            AS reconciliation
          ON reconciliation.mission_id =
            advances.mission_id
          AND reconciliation
            .participant_employee_id =
            advances.employee_id
          AND reconciliation.currency =
            advances.currency

        GROUP BY advances.mission_id
      )

      SELECT
        missions.id,

        missions.mission_number
          AS "missionNumber",

        missions.title,
        missions.destination,

        missions.start_date
          AS "startDate",

        missions.end_date
          AS "endDate",

        missions.status,

        COALESCE(
          reports.total_participants,
          0
        )::integer
          AS "totalParticipants",

        COALESCE(
          reports.submitted_reports,
          0
        )::integer
          AS "submittedReports",

        COALESCE(
          reports.draft_reports,
          0
        )::integer
          AS "draftReports",

        (
          COALESCE(
            reports.total_participants,
            0
          )
          - COALESCE(
            reports.submitted_reports,
            0
          )
          - COALESCE(
            reports.draft_reports,
            0
          )
        )::integer
          AS "missingReports",

        COALESCE(
          payments.pending_disbursements,
          0
        )::integer
          AS "pendingDisbursements",

        COALESCE(
          payments.paid_disbursements,
          0
        )::integer
          AS "paidDisbursements",

        COALESCE(
          finance.required_reconciliations,
          0
        )::integer
          AS "requiredReconciliations",

        COALESCE(
          finance.cleared_reconciliations,
          0
        )::integer
          AS "clearedReconciliations"

      FROM missions

      LEFT JOIN report_summary AS reports
        ON reports.mission_id = missions.id

      LEFT JOIN disbursement_summary AS payments
        ON payments.mission_id = missions.id

      LEFT JOIN finance_summary AS finance
        ON finance.mission_id = missions.id

      WHERE
        missions.status = 'APPROVED'
        AND missions.end_date <= CURRENT_DATE

      ORDER BY
        missions.end_date,
        missions.id
    `,
  );

  const missions = result.rows.map(
    (mission) => {
      const blockers = [];

      if (mission.totalParticipants === 0) {
        blockers.push(
          "Mission has no participants",
        );
      }

      if (
        mission.submittedReports !==
        mission.totalParticipants
      ) {
        blockers.push(
          `${mission.submittedReports} of ` +
          `${mission.totalParticipants} reports submitted`,
        );
      }

      if (
        mission.pendingDisbursements > 0
      ) {
        blockers.push(
          `${mission.pendingDisbursements} pending disbursement(s)`,
        );
      }

      if (
        mission.clearedReconciliations !==
        mission.requiredReconciliations
      ) {
        blockers.push(
          `${mission.clearedReconciliations} of ` +
          `${mission.requiredReconciliations} reconciliations cleared`,
        );
      }

      return {
        ...mission,
        readyForClosure:
          blockers.length === 0,
        blockers,
      };
    },
  );

  return {
    count: missions.length,
    readyCount: missions.filter(
      (mission) =>
        mission.readyForClosure,
    ).length,
    blockedCount: missions.filter(
      (mission) =>
        !mission.readyForClosure,
    ).length,
    data: missions,
  };
}