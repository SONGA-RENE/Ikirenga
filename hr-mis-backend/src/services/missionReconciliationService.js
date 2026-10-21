import pool from "../config/database.js";

const allowedExpenseCategories = new Set([
  "TRANSPORT",
  "ACCOMMODATION",
  "MEALS",
  "VISA",
  "INSURANCE",
  "COMMUNICATION",
  "OTHER",
]);

function serviceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeCurrency(value) {
  const currency = String(value || "RWF")
    .trim()
    .toUpperCase();

  if (
    currency.length < 3 ||
    currency.length > 10
  ) {
    throw serviceError(
      "Currency must contain between 3 and 10 characters",
      400,
    );
  }

  return currency;
}

function moneyToCents(value, fieldName) {
  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    throw serviceError(
      `${fieldName} must be a valid non-negative number`,
      400,
    );
  }

  return Math.round(amount * 100);
}

async function findUserEmployee(
  client,
  userId,
) {
  const result = await client.query(
    `
      SELECT
        app_users.id AS "userId",
        app_users.employee_id AS "employeeId",
        app_users.is_active AS "userIsActive",
        employees.is_active AS "employeeIsActive"
      FROM app_users
      JOIN employees
        ON employees.id = app_users.employee_id
      WHERE app_users.id = $1
    `,
    [userId],
  );

  const user = result.rows[0];

  if (
    !user ||
    !user.userIsActive ||
    !user.employeeIsActive
  ) {
    throw serviceError(
      "An active employee account is required",
      403,
    );
  }

  return user;
}

async function calculateAccountableAmount(
  client,
  missionId,
  employeeId,
  currency,
) {
  const result = await client.query(
    `
      SELECT
        COALESCE(
          SUM(disbursements.amount),
          0
        ) AS "amountReceived"

      FROM mission_disbursements
        AS disbursements

      JOIN mission_funding_items AS funding
        ON funding.id =
          disbursements.funding_item_id
        AND funding.mission_id =
          disbursements.mission_id

      WHERE
        disbursements.mission_id = $1
        AND disbursements.participant_employee_id = $2
        AND disbursements.currency = $3
        AND disbursements.status = 'PAID'
        AND funding.requires_reconciliation = TRUE
    `,
    [
      missionId,
      employeeId,
      currency,
    ],
  );

  return Number(
    result.rows[0].amountReceived,
  );
}

export async function createReconciliationDraft({
  missionId,
  currency,
  declarationNote,
  userId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await findUserEmployee(
      client,
      userId,
    );

    const missionResult = await client.query(
      `
        SELECT
          missions.id,
          missions.mission_number
            AS "missionNumber",
          missions.status,
          missions.end_date AS "endDate",

          missions.end_date <= CURRENT_DATE
            AS "missionHasEnded"

        FROM missions

        JOIN mission_participants
          ON mission_participants.mission_id =
            missions.id
          AND mission_participants.employee_id =
            $2

        WHERE missions.id = $1

        FOR UPDATE OF missions
      `,
      [
        missionId,
        user.employeeId,
      ],
    );

    const mission = missionResult.rows[0];

    if (!mission) {
      throw serviceError(
        "Mission not found or you are not a participant",
        404,
      );
    }

    if (mission.status !== "APPROVED") {
      throw serviceError(
        "A reconciliation can only be created while the mission is approved",
        409,
      );
    }

    if (!mission.missionHasEnded) {
      throw serviceError(
        "A reconciliation cannot be created before the mission end date",
        409,
      );
    }

    const normalizedCurrency =
      normalizeCurrency(currency);

    const amountReceived =
      await calculateAccountableAmount(
        client,
        missionId,
        user.employeeId,
        normalizedCurrency,
      );

    if (amountReceived <= 0) {
      throw serviceError(
        `No paid accountable advance was found in ${normalizedCurrency}`,
        409,
      );
    }

    const existingResult = await client.query(
      `
        SELECT id
        FROM mission_expense_reconciliations
        WHERE
          mission_id = $1
          AND participant_employee_id = $2
          AND currency = $3
      `,
      [
        missionId,
        user.employeeId,
        normalizedCurrency,
      ],
    );

    if (existingResult.rows[0]) {
      throw serviceError(
        "A reconciliation already exists for this mission, participant and currency",
        409,
      );
    }

    const insertResult = await client.query(
      `
        INSERT INTO mission_expense_reconciliations (
          mission_id,
          participant_employee_id,
          status,
          amount_received,
          amount_accounted_for,
          amount_returned,
          currency,
          declaration_note,
          created_by_user_id
        )
        VALUES (
          $1,
          $2,
          'DRAFT',
          $3,
          0,
          0,
          $4,
          $5,
          $6
        )
        RETURNING
          id,
          mission_id AS "missionId",

          participant_employee_id
            AS "participantEmployeeId",

          status,

          amount_received
            AS "amountReceived",

          amount_accounted_for
            AS "amountAccountedFor",

          amount_returned
            AS "amountReturned",

          currency,

          declaration_note
            AS "declarationNote",

          created_by_user_id
            AS "createdByUserId",

          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        missionId,
        user.employeeId,
        amountReceived,
        normalizedCurrency,
        declarationNote?.trim() || null,
        userId,
      ],
    );

    await client.query("COMMIT");

    return insertResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function addReconciliationItem({
  missionId,
  reconciliationId,
  costCategory,
  description,
  expenseDate,
  amount,
  notes,
  receiptExceptionReason,
  userId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await findUserEmployee(
      client,
      userId,
    );

    const reconciliationResult =
      await client.query(
        `
          SELECT
            reconciliation.id,
            reconciliation.status,

            reconciliation.amount_received
              AS "amountReceived",

            missions.start_date
              AS "startDate",

            missions.end_date
              AS "endDate",

            missions.status
              AS "missionStatus"

          FROM mission_expense_reconciliations
            AS reconciliation

          JOIN missions
            ON missions.id =
              reconciliation.mission_id

          WHERE
            reconciliation.id = $1
            AND reconciliation.mission_id = $2
            AND reconciliation.participant_employee_id = $3

          FOR UPDATE OF reconciliation, missions
        `,
        [
          reconciliationId,
          missionId,
          user.employeeId,
        ],
      );

    const reconciliation =
      reconciliationResult.rows[0];

    if (!reconciliation) {
      throw serviceError(
        "Reconciliation not found",
        404,
      );
    }

    if (
      !["DRAFT", "REJECTED"].includes(
        reconciliation.status,
      )
    ) {
      throw serviceError(
        "Only a draft or rejected reconciliation can be edited",
        409,
      );
    }

    if (
      reconciliation.missionStatus !==
      "APPROVED"
    ) {
      throw serviceError(
        "The mission is no longer open for reconciliation",
        409,
      );
    }

    const normalizedCategory =
      String(costCategory || "")
        .trim()
        .toUpperCase();

    if (
      !allowedExpenseCategories.has(
        normalizedCategory,
      )
    ) {
      throw serviceError(
        "Invalid reconciliation expense category",
        400,
      );
    }

    const normalizedDescription =
      description?.trim();

    if (!normalizedDescription) {
      throw serviceError(
        "Expense description is required",
        400,
      );
    }

    const normalizedAmount = Number(amount);

    if (
      !Number.isFinite(normalizedAmount) ||
      normalizedAmount <= 0
    ) {
      throw serviceError(
        "Expense amount must be greater than zero",
        400,
      );
    }

    if (!expenseDate) {
      throw serviceError(
        "Expense date is required",
        400,
      );
    }

    const dateResult = await client.query(
      `
        SELECT
          $1::date BETWEEN $2::date AND $3::date
            AS "isWithinMission"
      `,
      [
        expenseDate,
        reconciliation.startDate,
        reconciliation.endDate,
      ],
    );

    if (!dateResult.rows[0].isWithinMission) {
      throw serviceError(
        "Expense date must fall within the mission dates",
        400,
      );
    }

    const currentTotalResult =
      await client.query(
        `
          SELECT
            COALESCE(
              SUM(amount),
              0
            ) AS "currentTotal"

          FROM mission_reconciliation_items

          WHERE reconciliation_id = $1
        `,
        [reconciliationId],
      );

    const currentTotal = Number(
      currentTotalResult.rows[0]
        .currentTotal,
    );

    if (
      currentTotal + normalizedAmount >
      Number(reconciliation.amountReceived)
    ) {
      throw serviceError(
        "Expense items cannot exceed the accountable amount received",
        409,
      );
    }

    const insertResult = await client.query(
  `
    INSERT INTO mission_reconciliation_items (
      reconciliation_id,
      cost_category,
      description,
      expense_date,
      amount,
      notes,
      receipt_exception_reason
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

      reconciliation_id
        AS "reconciliationId",

      cost_category AS "costCategory",
      description,
      expense_date AS "expenseDate",
      amount,
      notes,

      receipt_exception_reason
        AS "receiptExceptionReason",

      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `,
  [
    reconciliationId,
    normalizedCategory,
    normalizedDescription,
    expenseDate,
    normalizedAmount,
    notes?.trim() || null,

    receiptExceptionReason?.trim() ||
      null,
  ],
);

    await client.query(
      `
        UPDATE mission_expense_reconciliations
        SET
          amount_accounted_for = (
            SELECT COALESCE(
              SUM(amount),
              0
            )
            FROM mission_reconciliation_items
            WHERE reconciliation_id = $1
          ),
          status = 'DRAFT',
          rejected_by_user_id = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [reconciliationId],
    );

    await client.query("COMMIT");

    return insertResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findReconciliationById({
  missionId,
  reconciliationId,
  userId,
  userRole,
}) {
  const result = await pool.query(
    `
      SELECT
        reconciliation.id,
        reconciliation.mission_id
          AS "missionId",

        missions.mission_number
          AS "missionNumber",

        missions.title AS "missionTitle",

        reconciliation.participant_employee_id
          AS "participantEmployeeId",

        employees.staff_number
          AS "staffNumber",

        CONCAT(
          employees.first_name,
          ' ',
          employees.last_name
        ) AS "participantName",

        reconciliation.status,

        reconciliation.amount_received
          AS "amountReceived",

        reconciliation.amount_accounted_for
          AS "amountAccountedFor",

        reconciliation.amount_returned
          AS "amountReturned",

        (
          reconciliation.amount_received
          - reconciliation.amount_accounted_for
          - reconciliation.amount_returned
        ) AS "outstandingBalance",

        reconciliation.currency,

        reconciliation.declaration_note
          AS "declarationNote",

        reconciliation.submitted_at
          AS "submittedAt",

        reconciliation.verified_at
          AS "verifiedAt",

        reconciliation.rejection_reason
          AS "rejectionReason",

        reconciliation.created_at
          AS "createdAt",

        reconciliation.updated_at
          AS "updatedAt",

        owner.id AS "ownerUserId"

      FROM mission_expense_reconciliations
        AS reconciliation

      JOIN missions
        ON missions.id =
          reconciliation.mission_id

      JOIN employees
        ON employees.id =
          reconciliation.participant_employee_id

      LEFT JOIN app_users AS owner
        ON owner.employee_id =
          reconciliation.participant_employee_id

      WHERE
        reconciliation.id = $1
        AND reconciliation.mission_id = $2
    `,
    [
      reconciliationId,
      missionId,
    ],
  );

  const reconciliation = result.rows[0];

  if (!reconciliation) {
    return null;
  }

  const privilegedRoles = new Set([
    "ADMIN",
    "HR",
    "FINANCE",
  ]);

  if (
    !privilegedRoles.has(userRole) &&
    reconciliation.ownerUserId !== userId
  ) {
    throw serviceError(
      "You do not have permission to view this reconciliation",
      403,
    );
  }

  delete reconciliation.ownerUserId;

    const itemResult = await pool.query(
      `
        SELECT
          items.id,

          items.reconciliation_id
            AS "reconciliationId",

          items.cost_category
            AS "costCategory",

          items.description,
          items.expense_date AS "expenseDate",
          items.amount,
          items.notes,

          items.receipt_exception_reason
            AS "receiptExceptionReason",

          (
            SELECT COUNT(*)::integer
            FROM mission_documents
            WHERE
              mission_documents
                .reconciliation_item_id =
                items.id
              AND mission_documents
                .document_type = 'RECEIPT'
          ) AS "receiptCount",

          (
            EXISTS (
              SELECT 1
              FROM mission_documents
              WHERE
                mission_documents
                  .reconciliation_item_id =
                  items.id
                AND mission_documents
                  .document_type = 'RECEIPT'
            )
          ) AS "hasReceipt",

          items.created_at AS "createdAt",
          items.updated_at AS "updatedAt"

        FROM mission_reconciliation_items
          AS items

        WHERE items.reconciliation_id = $1

        ORDER BY
          items.expense_date,
          items.id
      `,
      [reconciliationId],
    );
    const actionResult = await pool.query(
    `
      SELECT
        actions.id,
        actions.decision,
        actions.comment,

        actions.amount_received
          AS "amountReceived",

        actions.amount_accounted_for
          AS "amountAccountedFor",

        actions.amount_returned
          AS "amountReturned",

        actions.outstanding_balance
          AS "outstandingBalance",

        actions.action_by_user_id
          AS "actionByUserId",

        users.full_name AS "actionBy",

        actions.acted_at AS "actedAt"

      FROM mission_reconciliation_actions
        AS actions

      JOIN app_users AS users
        ON users.id =
          actions.action_by_user_id

      WHERE
        actions.reconciliation_id = $1

      ORDER BY
        actions.acted_at,
        actions.id
    `,
    [reconciliationId],
  );

  return {
  ...reconciliation,
  items: itemResult.rows,
  actionHistory: actionResult.rows,
};
}

export async function submitReconciliation({
  missionId,
  reconciliationId,
  amountReturned,
  declarationNote,
  userId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await findUserEmployee(
      client,
      userId,
    );

    const result = await client.query(
      `
        SELECT
          reconciliation.id,
          reconciliation.status,
          reconciliation.currency,

          reconciliation.amount_received
            AS "amountReceived",

          missions.status
            AS "missionStatus",

          missions.end_date <= CURRENT_DATE
            AS "missionHasEnded"

        FROM mission_expense_reconciliations
          AS reconciliation

        JOIN missions
          ON missions.id =
            reconciliation.mission_id

        WHERE
          reconciliation.id = $1
          AND reconciliation.mission_id = $2
          AND reconciliation.participant_employee_id = $3

        FOR UPDATE OF reconciliation, missions
      `,
      [
        reconciliationId,
        missionId,
        user.employeeId,
      ],
    );

    const reconciliation = result.rows[0];

    if (!reconciliation) {
      throw serviceError(
        "Reconciliation not found",
        404,
      );
    }

    if (
      !["DRAFT", "REJECTED"].includes(
        reconciliation.status,
      )
    ) {
      throw serviceError(
        "Reconciliation has already been submitted",
        409,
      );
    }

    if (
      reconciliation.missionStatus !==
      "APPROVED"
    ) {
      throw serviceError(
        "The mission is not open for reconciliation",
        409,
      );
    }

    if (!reconciliation.missionHasEnded) {
      throw serviceError(
        "Reconciliation cannot be submitted before the mission end date",
        409,
      );
    }

    const refreshedAmountReceived =
      await calculateAccountableAmount(
        client,
        missionId,
        user.employeeId,
        reconciliation.currency,
      );

    const itemTotalResult = await client.query(
      `
        SELECT
          COALESCE(
            SUM(amount),
            0
          ) AS "amountAccountedFor"

        FROM mission_reconciliation_items

        WHERE reconciliation_id = $1
      `,
      [reconciliationId],
    );

    const supportResult = await client.query(
      `
        SELECT
          COUNT(*)::integer
            AS "totalExpenseItems",

          (
            COUNT(*)
            FILTER (
              WHERE
                NOT EXISTS (
                  SELECT 1
                  FROM mission_documents
                  WHERE
                    mission_documents
                      .reconciliation_item_id =
                      items.id
                    AND mission_documents
                      .document_type = 'RECEIPT'
                )
                AND NULLIF(
                  trim(
                    items.receipt_exception_reason
                  ),
                  ''
                ) IS NULL
            )
          )::integer
            AS "unsupportedExpenseItems"

        FROM mission_reconciliation_items
          AS items

        WHERE
          items.reconciliation_id = $1
      `,
      [reconciliationId],
    );

    const supportStatus =
      supportResult.rows[0];

    if (
      supportStatus.unsupportedExpenseItems > 0
    ) {
      throw serviceError(
        `Reconciliation cannot be submitted: ` +
        `${supportStatus.unsupportedExpenseItems} ` +
        `expense item(s) have neither a receipt nor a documented receipt exception`,
        409,
      );
}

    const amountAccountedFor = Number(
      itemTotalResult.rows[0]
        .amountAccountedFor,
    );

    const returnedCents = moneyToCents(
      amountReturned ?? 0,
      "Amount returned",
    );

    const receivedCents = moneyToCents(
      refreshedAmountReceived,
      "Amount received",
    );

    const accountedCents = moneyToCents(
      amountAccountedFor,
      "Amount accounted for",
    );

    if (
      accountedCents + returnedCents !==
      receivedCents
    ) {
      const outstanding =
        (
          receivedCents -
          accountedCents -
          returnedCents
        ) / 100;

      throw serviceError(
        `Reconciliation is not balanced. Outstanding balance: ${outstanding.toFixed(
          2,
        )} ${reconciliation.currency}`,
        409,
      );
    }

    const normalizedDeclaration =
      declarationNote?.trim();

    if (!normalizedDeclaration) {
      throw serviceError(
        "Reconciliation declaration is required",
        400,
      );
    }

    const updateResult = await client.query(
      `
        UPDATE mission_expense_reconciliations
        SET
          status = 'SUBMITTED',
          amount_received = $3,
          amount_accounted_for = $4,
          amount_returned = $5,
          declaration_note = $6,
          submitted_by_user_id = $7,
          submitted_at = CURRENT_TIMESTAMP,

          verified_by_user_id = NULL,
          verified_at = NULL,
          rejected_by_user_id = NULL,
          rejected_at = NULL,
          rejection_reason = NULL,

          updated_at = CURRENT_TIMESTAMP

        WHERE
          id = $1
          AND mission_id = $2

        RETURNING
          id,
          mission_id AS "missionId",

          participant_employee_id
            AS "participantEmployeeId",

          status,

          amount_received
            AS "amountReceived",

          amount_accounted_for
            AS "amountAccountedFor",

          amount_returned
            AS "amountReturned",

          (
            amount_received
            - amount_accounted_for
            - amount_returned
          ) AS "outstandingBalance",

          currency,

          declaration_note
            AS "declarationNote",

          submitted_by_user_id
            AS "submittedByUserId",

          submitted_at AS "submittedAt",

          updated_at AS "updatedAt"
      `,
      [
        reconciliationId,
        missionId,
        refreshedAmountReceived,
        amountAccountedFor,
        returnedCents / 100,
        normalizedDeclaration,
        userId,
      ],
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
export async function findPendingReconciliations({
  page = 1,
  limit = 10,
}) {
  const offset = (page - 1) * limit;

  const countResult = await pool.query(
    `
      SELECT COUNT(*)::integer AS total
      FROM mission_expense_reconciliations
      WHERE status = 'SUBMITTED'
    `,
  );

  const result = await pool.query(
    `
      SELECT
        reconciliation.id,

        reconciliation.mission_id
          AS "missionId",

        missions.mission_number
          AS "missionNumber",

        missions.title AS "missionTitle",
        missions.destination,
        missions.start_date AS "startDate",
        missions.end_date AS "endDate",

        reconciliation.participant_employee_id
          AS "participantEmployeeId",

        employees.staff_number
          AS "staffNumber",

        CONCAT(
          employees.first_name,
          ' ',
          employees.last_name
        ) AS "participantName",

        positions.title AS "position",
        departments.name AS "department",

        reconciliation.amount_received
          AS "amountReceived",

        reconciliation.amount_accounted_for
          AS "amountAccountedFor",

        reconciliation.amount_returned
          AS "amountReturned",

        (
          reconciliation.amount_received
          - reconciliation.amount_accounted_for
          - reconciliation.amount_returned
        ) AS "outstandingBalance",

        reconciliation.currency,
        reconciliation.declaration_note
          AS "declarationNote",

        reconciliation.status,

        reconciliation.submitted_by_user_id
          AS "submittedByUserId",

        submitter.full_name AS "submittedBy",

        reconciliation.submitted_at
          AS "submittedAt"

      FROM mission_expense_reconciliations
        AS reconciliation

      JOIN missions
        ON missions.id =
          reconciliation.mission_id

      JOIN employees
        ON employees.id =
          reconciliation.participant_employee_id

      LEFT JOIN positions
        ON positions.id =
          employees.position_id

      LEFT JOIN departments
        ON departments.id =
          positions.department_id

      LEFT JOIN app_users AS submitter
        ON submitter.id =
          reconciliation.submitted_by_user_id

      WHERE reconciliation.status = 'SUBMITTED'

      ORDER BY
        reconciliation.submitted_at,
        reconciliation.id

      LIMIT $1
      OFFSET $2
    `,
    [
      limit,
      offset,
    ],
  );

  const total = countResult.rows[0].total;

  return {
    count: result.rows.length,
    pagination: {
      page,
      limit,
      total,
      totalPages:
        total === 0
          ? 0
          : Math.ceil(total / limit),
    },
    data: result.rows,
  };
}

export async function decideReconciliation({
  missionId,
  reconciliationId,
  decision,
  comment,
  actionByUserId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const normalizedDecision =
      String(decision || "")
        .trim()
        .toUpperCase();

    if (
      !["VERIFIED", "REJECTED"].includes(
        normalizedDecision,
      )
    ) {
      throw serviceError(
        "Decision must be VERIFIED or REJECTED",
        400,
      );
    }

    const reconciliationResult =
      await client.query(
        `
          SELECT
            reconciliation.id,

            reconciliation.mission_id
              AS "missionId",

            reconciliation.participant_employee_id
              AS "participantEmployeeId",

            reconciliation.status,

            reconciliation.amount_received
              AS "amountReceived",

            reconciliation.amount_accounted_for
              AS "amountAccountedFor",

            reconciliation.amount_returned
              AS "amountReturned",

            reconciliation.currency,

            missions.status
              AS "missionStatus"

          FROM mission_expense_reconciliations
            AS reconciliation

          JOIN missions
            ON missions.id =
              reconciliation.mission_id

          WHERE
            reconciliation.id = $1
            AND reconciliation.mission_id = $2

          FOR UPDATE OF reconciliation, missions
        `,
        [
          reconciliationId,
          missionId,
        ],
      );
      

    const reconciliation =
      reconciliationResult.rows[0];

    if (!reconciliation) {
      throw serviceError(
        "Mission reconciliation not found",
        404,
      );
    }

    if (reconciliation.status !== "SUBMITTED") {
      throw serviceError(
        "Only a submitted reconciliation can be verified or rejected",
        409,
      );
    }

    if (
      reconciliation.missionStatus !==
      "APPROVED"
    ) {
      throw serviceError(
        "The mission is no longer open for financial reconciliation",
        409,
      );
    }

    const normalizedComment =
      comment?.trim() || null;

    if (
      normalizedDecision === "REJECTED" &&
      !normalizedComment
    ) {
      throw serviceError(
        "A rejection reason is required",
        400,
      );
    }

    if (normalizedDecision === "VERIFIED") {
      const currentAmountReceived =
        await calculateAccountableAmount(
          client,
          missionId,
          reconciliation.participantEmployeeId,
          reconciliation.currency,
        );

      const itemTotalResult =
        await client.query(
          `
            SELECT
              COALESCE(
                SUM(amount),
                0
              ) AS "amountAccountedFor"

            FROM mission_reconciliation_items

            WHERE reconciliation_id = $1
          `,
          [reconciliationId],
        );

      const currentAccountedAmount = Number(
        itemTotalResult.rows[0]
          .amountAccountedFor,
      );

      const receivedCents = moneyToCents(
        currentAmountReceived,
        "Amount received",
      );

      const storedReceivedCents = moneyToCents(
        reconciliation.amountReceived,
        "Stored amount received",
      );

      const accountedCents = moneyToCents(
        currentAccountedAmount,
        "Amount accounted for",
      );

      const storedAccountedCents = moneyToCents(
        reconciliation.amountAccountedFor,
        "Stored amount accounted for",
      );

      const returnedCents = moneyToCents(
        reconciliation.amountReturned,
        "Amount returned",
      );

      if (
        receivedCents !== storedReceivedCents
      ) {
        throw serviceError(
          "The accountable amount changed after submission. The participant must resubmit the reconciliation",
          409,
        );
      }

      if (
        accountedCents !==
        storedAccountedCents
      ) {
        throw serviceError(
          "The expense-item total changed after submission. The reconciliation must be resubmitted",
          409,
        );
      }

      if (
        accountedCents + returnedCents !==
        receivedCents
      ) {
        throw serviceError(
          "The reconciliation is not balanced and cannot be verified",
          409,
        );
      }

      const supportResult = await client.query(
        `
          SELECT
            (
              COUNT(*)
              FILTER (
                WHERE
                  NOT EXISTS (
                    SELECT 1
                    FROM mission_documents
                    WHERE
                      mission_documents
                        .reconciliation_item_id =
                        items.id
                      AND mission_documents
                        .document_type = 'RECEIPT'
                  )
                  AND NULLIF(
                    trim(
                      items.receipt_exception_reason
                    ),
                    ''
                  ) IS NULL
              )
            )::integer
              AS "unsupportedExpenseItems"

          FROM mission_reconciliation_items
            AS items

          WHERE
            items.reconciliation_id = $1
        `,
        [reconciliationId],
      );

      if (
        supportResult.rows[0]
          .unsupportedExpenseItems > 0
      ) {
        throw serviceError(
          "The reconciliation contains unsupported expenses and cannot be verified",
          409,
        );
      }



      const verificationResult =
        await client.query(
          `
            UPDATE mission_expense_reconciliations
            SET
              status = 'VERIFIED',

              verified_by_user_id = $3,
              verified_at = CURRENT_TIMESTAMP,

              rejected_by_user_id = NULL,
              rejected_at = NULL,
              rejection_reason = NULL,

              updated_at = CURRENT_TIMESTAMP

            WHERE
              id = $1
              AND mission_id = $2

            RETURNING
              id,
              mission_id AS "missionId",

              participant_employee_id
                AS "participantEmployeeId",

              status,

              amount_received
                AS "amountReceived",

              amount_accounted_for
                AS "amountAccountedFor",

              amount_returned
                AS "amountReturned",

              (
                amount_received
                - amount_accounted_for
                - amount_returned
              ) AS "outstandingBalance",

              currency,

              verified_by_user_id
                AS "verifiedByUserId",

              verified_at AS "verifiedAt",
              updated_at AS "updatedAt"
          `,
          [
            reconciliationId,
            missionId,
            actionByUserId,
          ],
        );
        const verified =
            verificationResult.rows[0];

          await client.query(
            `
              INSERT INTO mission_reconciliation_actions (
                reconciliation_id,
                decision,
                comment,
                amount_received,
                amount_accounted_for,
                amount_returned,
                outstanding_balance,
                action_by_user_id
              )
              VALUES (
                $1,
                'VERIFIED',
                $2,
                $3,
                $4,
                $5,
                $6,
                $7
              )
            `,
            [
              reconciliationId,
              normalizedComment,
              verified.amountReceived,
              verified.amountAccountedFor,
              verified.amountReturned,
              verified.outstandingBalance,
              actionByUserId,
            ],
          );
      await client.query("COMMIT");

      return verified;
    }

    const rejectionResult =
      await client.query(
        `
          UPDATE mission_expense_reconciliations
          SET
            status = 'REJECTED',

            rejected_by_user_id = $3,
            rejected_at = CURRENT_TIMESTAMP,
            rejection_reason = $4,

            verified_by_user_id = NULL,
            verified_at = NULL,

            updated_at = CURRENT_TIMESTAMP

          WHERE
            id = $1
            AND mission_id = $2

          RETURNING
            id,
            mission_id AS "missionId",

            participant_employee_id
              AS "participantEmployeeId",

            status,

            amount_received
              AS "amountReceived",

            amount_accounted_for
              AS "amountAccountedFor",

            amount_returned
              AS "amountReturned",

            currency,

            rejected_by_user_id
              AS "rejectedByUserId",

            rejected_at AS "rejectedAt",

            rejection_reason
              AS "rejectionReason",

            updated_at AS "updatedAt"
        `,
        [
          reconciliationId,
          missionId,
          actionByUserId,
          normalizedComment,
        ],
      );

      const rejected =
          rejectionResult.rows[0];

        const rejectedOutstandingBalance =
          Number(rejected.amountReceived) -
          Number(rejected.amountAccountedFor) -
          Number(rejected.amountReturned);

        await client.query(
          `
            INSERT INTO mission_reconciliation_actions (
              reconciliation_id,
              decision,
              comment,
              amount_received,
              amount_accounted_for,
              amount_returned,
              outstanding_balance,
              action_by_user_id
            )
            VALUES (
              $1,
              'REJECTED',
              $2,
              $3,
              $4,
              $5,
              $6,
              $7
            )
          `,
          [
            reconciliationId,
            normalizedComment,
            rejected.amountReceived,
            rejected.amountAccountedFor,
            rejected.amountReturned,
            rejectedOutstandingBalance,
            actionByUserId,
          ],
        );
    await client.query("COMMIT");

    return rejected;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function updateReconciliationItem({
 missionId,
  reconciliationId,
  itemId,
  costCategory,
  description,
  expenseDate,
  amount,
  notes,
  receiptExceptionReason,
  userId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await findUserEmployee(
      client,
      userId,
    );
    const normalizedReceiptException =
  receiptExceptionReason === undefined
    ? currentItem.receiptExceptionReason
    : receiptExceptionReason?.trim() ||
      null;

    const result = await client.query(
      `
        SELECT
          items.id,
          items.cost_category AS "costCategory",
          items.description,
          items.expense_date AS "expenseDate",
          items.amount,
          items.notes,
          items.receipt_exception_reason
          AS "receiptExceptionReason",

          reconciliation.status,

          reconciliation.amount_received
            AS "amountReceived",

          missions.status AS "missionStatus",
          missions.start_date AS "startDate",
          missions.end_date AS "endDate"

        FROM mission_reconciliation_items
          AS items

        JOIN mission_expense_reconciliations
          AS reconciliation
          ON reconciliation.id =
            items.reconciliation_id

        JOIN missions
          ON missions.id =
            reconciliation.mission_id

        WHERE
          items.id = $1
          AND reconciliation.id = $2
          AND reconciliation.mission_id = $3
          AND reconciliation.participant_employee_id = $4

        FOR UPDATE OF
          items,
          reconciliation,
          missions
      `,
      [
        itemId,
        reconciliationId,
        missionId,
        user.employeeId,
      ],
    );

    const currentItem = result.rows[0];

    if (!currentItem) {
      throw serviceError(
        "Reconciliation expense item not found",
        404,
      );
    }

    if (
      !["DRAFT", "REJECTED"].includes(
        currentItem.status,
      )
    ) {
      throw serviceError(
        "Only draft or rejected reconciliation items can be updated",
        409,
      );
    }

    if (
      currentItem.missionStatus !== "APPROVED"
    ) {
      throw serviceError(
        "The mission is no longer open for reconciliation",
        409,
      );
    }

    const normalizedCategory =
      costCategory === undefined
        ? currentItem.costCategory
        : String(costCategory)
            .trim()
            .toUpperCase();

    if (
      !allowedExpenseCategories.has(
        normalizedCategory,
      )
    ) {
      throw serviceError(
        "Invalid reconciliation expense category",
        400,
      );
    }

    const normalizedDescription =
      description === undefined
        ? currentItem.description
        : description?.trim();

    if (!normalizedDescription) {
      throw serviceError(
        "Expense description is required",
        400,
      );
    }

    const normalizedExpenseDate =
      expenseDate === undefined
        ? currentItem.expenseDate
        : expenseDate;

    const dateResult = await client.query(
      `
        SELECT
          $1::date BETWEEN $2::date AND $3::date
            AS "isWithinMission"
      `,
      [
        normalizedExpenseDate,
        currentItem.startDate,
        currentItem.endDate,
      ],
    );

    if (!dateResult.rows[0].isWithinMission) {
      throw serviceError(
        "Expense date must fall within the mission dates",
        400,
      );
    }

    const normalizedAmount =
      amount === undefined
        ? Number(currentItem.amount)
        : Number(amount);

    if (
      !Number.isFinite(normalizedAmount) ||
      normalizedAmount <= 0
    ) {
      throw serviceError(
        "Expense amount must be greater than zero",
        400,
      );
    }

    const otherItemsResult =
      await client.query(
        `
          SELECT
            COALESCE(
              SUM(amount),
              0
            ) AS "otherItemsTotal"

          FROM mission_reconciliation_items

          WHERE
            reconciliation_id = $1
            AND id <> $2
        `,
        [
          reconciliationId,
          itemId,
        ],
      );

    const otherItemsTotal = Number(
      otherItemsResult.rows[0]
        .otherItemsTotal,
    );

    if (
      otherItemsTotal + normalizedAmount >
      Number(currentItem.amountReceived)
    ) {
      throw serviceError(
        "Expense items cannot exceed the accountable amount received",
        409,
      );
    }

    const normalizedNotes =
      notes === undefined
        ? currentItem.notes
        : notes?.trim() || null;

   const updateResult = await client.query(
  `
    UPDATE mission_reconciliation_items
    SET
      cost_category = $2,
      description = $3,
      expense_date = $4,
      amount = $5,
      notes = $6,
      receipt_exception_reason = $7,
      updated_at = CURRENT_TIMESTAMP

    WHERE id = $1

    RETURNING
      id,

      reconciliation_id
        AS "reconciliationId",

      cost_category AS "costCategory",
      description,
      expense_date AS "expenseDate",
      amount,
      notes,

      receipt_exception_reason
        AS "receiptExceptionReason",

      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `,
  [
    itemId,
    normalizedCategory,
    normalizedDescription,
    normalizedExpenseDate,
    normalizedAmount,
    normalizedNotes,
    normalizedReceiptException,
  ],
);

    const newAccountedAmount =
      otherItemsTotal + normalizedAmount;

    await client.query(
      `
        UPDATE mission_expense_reconciliations
        SET
          status = 'DRAFT',
          amount_accounted_for = $2,
          amount_returned = 0,
          submitted_by_user_id = NULL,
          submitted_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [
        reconciliationId,
        newAccountedAmount,
      ],
    );

    await client.query("COMMIT");

    return {
      item: updateResult.rows[0],
      reconciliation: {
        id: reconciliationId,
        status: "DRAFT",
        amountReceived:
          Number(
            currentItem.amountReceived,
          ).toFixed(2),
        amountAccountedFor:
          newAccountedAmount.toFixed(2),
        amountReturned: "0.00",
        outstandingBalance: (
          Number(currentItem.amountReceived) -
          newAccountedAmount
        ).toFixed(2),
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteReconciliationItem({
  missionId,
  reconciliationId,
  itemId,
  userId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const user = await findUserEmployee(
      client,
      userId,
    );

    const result = await client.query(
      `
        SELECT
          items.id,
          items.cost_category AS "costCategory",
          items.description,
          items.amount,

          reconciliation.status,

          reconciliation.amount_received
            AS "amountReceived",

          missions.status AS "missionStatus"

        FROM mission_reconciliation_items
          AS items

        JOIN mission_expense_reconciliations
          AS reconciliation
          ON reconciliation.id =
            items.reconciliation_id

        JOIN missions
          ON missions.id =
            reconciliation.mission_id

        WHERE
          items.id = $1
          AND reconciliation.id = $2
          AND reconciliation.mission_id = $3
          AND reconciliation.participant_employee_id = $4

        FOR UPDATE OF
          items,
          reconciliation,
          missions
      `,
      [
        itemId,
        reconciliationId,
        missionId,
        user.employeeId,
      ],
    );

    const item = result.rows[0];

    if (!item) {
      throw serviceError(
        "Reconciliation expense item not found",
        404,
      );
    }

    if (
      !["DRAFT", "REJECTED"].includes(
        item.status,
      )
    ) {
      throw serviceError(
        "Only draft or rejected reconciliation items can be deleted",
        409,
      );
    }

    if (item.missionStatus !== "APPROVED") {
      throw serviceError(
        "The mission is no longer open for reconciliation",
        409,
      );
    }

    const documentResult =
      await client.query(
        `
          SELECT COUNT(*)::integer
            AS "documentCount"
          FROM mission_documents
          WHERE reconciliation_item_id = $1
        `,
        [itemId],
      );

    if (
      documentResult.rows[0].documentCount > 0
    ) {
      throw serviceError(
        "Delete the attached receipts before deleting this expense item",
        409,
      );
    }

    const deleteResult = await client.query(
      `
        DELETE FROM mission_reconciliation_items
        WHERE id = $1
        RETURNING
          id,
          reconciliation_id
            AS "reconciliationId",
          cost_category AS "costCategory",
          description,
          amount
      `,
      [itemId],
    );

    const totalResult = await client.query(
      `
        SELECT
          COALESCE(
            SUM(amount),
            0
          ) AS "amountAccountedFor"
        FROM mission_reconciliation_items
        WHERE reconciliation_id = $1
      `,
      [reconciliationId],
    );

    const amountAccountedFor = Number(
      totalResult.rows[0]
        .amountAccountedFor,
    );

    await client.query(
      `
        UPDATE mission_expense_reconciliations
        SET
          status = 'DRAFT',
          amount_accounted_for = $2,
          amount_returned = 0,
          submitted_by_user_id = NULL,
          submitted_at = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [
        reconciliationId,
        amountAccountedFor,
      ],
    );

    await client.query("COMMIT");

    return {
      item: deleteResult.rows[0],
      reconciliation: {
        id: reconciliationId,
        status: "DRAFT",
        amountReceived:
          Number(item.amountReceived).toFixed(2),
        amountAccountedFor:
          amountAccountedFor.toFixed(2),
        amountReturned: "0.00",
        outstandingBalance: (
          Number(item.amountReceived) -
          amountAccountedFor
        ).toFixed(2),
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}