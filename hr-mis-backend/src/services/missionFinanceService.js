import pool from "../config/database.js";

const allowedCategories = new Set([
  "TRANSPORT",
  "ACCOMMODATION",
  "PER_DIEM",
  "MEALS",
  "VISA",
  "INSURANCE",
  "COMMUNICATION",
  "OTHER",
]);

const allowedFundingSources = new Set([
  "PSF",
  "HOST_INSTITUTION",
  "PARTNER",
  "EMPLOYEE_REIMBURSEMENT",
  "OTHER",
]);

const allowedDisbursementTypes = new Set([
  "ADVANCE",
  "PER_DIEM",
  "DIRECT_PAYMENT",
  "REIMBURSEMENT",
]);

function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseMoney(value, fieldName) {
  const amount = Number(value);

  if (
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    throw createServiceError(
      `${fieldName} must be a valid non-negative number`,
      400,
    );
  }

  return amount;
}

export async function createMissionFundingItem({
  missionId,
  participantEmployeeId,
  costCategory,
  fundingSource,
  fundingOrganization,
  estimatedAmount,
  approvedAmount,
  currency,
  requiresReconciliation,
  notes,
  createdByUserId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const missionResult = await client.query(
      `
        SELECT
          id,
          mission_number AS "missionNumber",
          status,
          start_date AS "startDate",
          end_date AS "endDate"
        FROM missions
        WHERE id = $1
        FOR UPDATE
      `,
      [missionId],
    );

    const mission = missionResult.rows[0];

    if (!mission) {
      throw createServiceError(
        "Mission not found",
        404,
      );
    }

    if (mission.status !== "APPROVED") {
      throw createServiceError(
        "Funding items can only be added to an approved mission",
        409,
      );
    }

    const normalizedCategory =
      String(costCategory || "")
        .trim()
        .toUpperCase();

    if (!allowedCategories.has(normalizedCategory)) {
      throw createServiceError(
        "Invalid mission cost category",
        400,
      );
    }

    const normalizedFundingSource =
      String(fundingSource || "")
        .trim()
        .toUpperCase();

    if (
      !allowedFundingSources.has(
        normalizedFundingSource,
      )
    ) {
      throw createServiceError(
        "Invalid mission funding source",
        400,
      );
    }

    const normalizedCurrency =
      String(currency || "RWF")
        .trim()
        .toUpperCase();

    if (
      normalizedCurrency.length < 3 ||
      normalizedCurrency.length > 10
    ) {
      throw createServiceError(
        "Currency must contain between 3 and 10 characters",
        400,
      );
    }

    const normalizedEstimatedAmount =
      parseMoney(
        estimatedAmount ?? 0,
        "Estimated amount",
      );

    const normalizedApprovedAmount =
      parseMoney(
        approvedAmount ?? 0,
        "Approved amount",
      );

    let normalizedParticipantId = null;

    if (
      participantEmployeeId !== undefined &&
      participantEmployeeId !== null &&
      participantEmployeeId !== ""
    ) {
      normalizedParticipantId =
        Number(participantEmployeeId);

      if (
        !Number.isInteger(
          normalizedParticipantId,
        ) ||
        normalizedParticipantId <= 0
      ) {
        throw createServiceError(
          "Participant employee ID must be a positive integer",
          400,
        );
      }

      const participantResult =
        await client.query(
          `
            SELECT
              mission_participants.employee_id
                AS "employeeId",

              CONCAT(
                employees.first_name,
                ' ',
                employees.last_name
              ) AS "fullName"

            FROM mission_participants

            JOIN employees
              ON employees.id =
                mission_participants.employee_id

            WHERE
              mission_participants.mission_id = $1
              AND mission_participants.employee_id = $2
          `,
          [
            missionId,
            normalizedParticipantId,
          ],
        );

      if (!participantResult.rows[0]) {
        throw createServiceError(
          "The selected employee is not a participant in this mission",
          400,
        );
      }
    }

    const externalFundingSources = new Set([
      "HOST_INSTITUTION",
      "PARTNER",
      "OTHER",
    ]);

    const normalizedOrganization =
      fundingOrganization?.trim() || null;

    if (
      externalFundingSources.has(
        normalizedFundingSource,
      ) &&
      !normalizedOrganization
    ) {
      throw createServiceError(
        "Funding organization is required for external funding",
        400,
      );
    }

    const normalizedReconciliation =
      requiresReconciliation === true;

    if (
      externalFundingSources.has(
        normalizedFundingSource,
      ) &&
      normalizedReconciliation
    ) {
      throw createServiceError(
        "Externally funded costs cannot require PSF financial reconciliation",
        400,
      );
    }

    const insertResult = await client.query(
      `
        INSERT INTO mission_funding_items (
          mission_id,
          participant_employee_id,
          cost_category,
          funding_source,
          funding_organization,
          estimated_amount,
          approved_amount,
          currency,
          requires_reconciliation,
          notes,
          created_by_user_id
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          $8,
          $9,
          $10,
          $11
        )
        RETURNING
          id,
          mission_id AS "missionId",
          participant_employee_id
            AS "participantEmployeeId",
          cost_category AS "costCategory",
          funding_source AS "fundingSource",
          funding_organization
            AS "fundingOrganization",
          estimated_amount AS "estimatedAmount",
          approved_amount AS "approvedAmount",
          currency,
          requires_reconciliation
            AS "requiresReconciliation",
          notes,
          created_by_user_id
            AS "createdByUserId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        missionId,
        normalizedParticipantId,
        normalizedCategory,
        normalizedFundingSource,
        normalizedOrganization,
        normalizedEstimatedAmount,
        normalizedApprovedAmount,
        normalizedCurrency,
        normalizedReconciliation,
        notes?.trim() || null,
        createdByUserId,
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

export async function findMissionFundingPlan(
  missionId,
) {
  const missionResult = await pool.query(
    `
      SELECT
        missions.id,
        missions.mission_number
          AS "missionNumber",
        missions.title,
        missions.destination,
        missions.mission_type
          AS "missionType",
        missions.start_date AS "startDate",
        missions.end_date AS "endDate",
        missions.status,
        missions.currency
      FROM missions
      WHERE missions.id = $1
    `,
    [missionId],
  );

  const mission = missionResult.rows[0];

  if (!mission) {
    return null;
  }

  const itemResult = await pool.query(
    `
      SELECT
        funding.id,
        funding.mission_id AS "missionId",

        funding.participant_employee_id
          AS "participantEmployeeId",

        CASE
          WHEN employees.id IS NULL
            THEN NULL
          ELSE CONCAT(
            employees.first_name,
            ' ',
            employees.last_name
          )
        END AS "participantName",

        employees.staff_number
          AS "staffNumber",

        funding.cost_category
          AS "costCategory",

        funding.funding_source
          AS "fundingSource",

        funding.funding_organization
          AS "fundingOrganization",

        funding.estimated_amount
          AS "estimatedAmount",

        funding.approved_amount
          AS "approvedAmount",

        funding.currency,

        funding.requires_reconciliation
          AS "requiresReconciliation",

        funding.notes,

        funding.created_by_user_id
          AS "createdByUserId",

        creator.full_name AS "createdBy",

        funding.updated_by_user_id
          AS "updatedByUserId",

        updater.full_name AS "updatedBy",

        funding.created_at AS "createdAt",
        funding.updated_at AS "updatedAt"

      FROM mission_funding_items AS funding

      LEFT JOIN employees
        ON employees.id =
          funding.participant_employee_id

      JOIN app_users AS creator
        ON creator.id =
          funding.created_by_user_id

      LEFT JOIN app_users AS updater
        ON updater.id =
          funding.updated_by_user_id

      WHERE funding.mission_id = $1

      ORDER BY
        funding.id
    `,
    [missionId],
  );

  const totalsResult = await pool.query(
    `
      SELECT
        currency,

        COALESCE(
          SUM(estimated_amount),
          0
        ) AS "totalEstimatedAmount",

        COALESCE(
          SUM(approved_amount),
          0
        ) AS "totalApprovedAmount",

        COALESCE(
          SUM(approved_amount)
            FILTER (
              WHERE funding_source = 'PSF'
            ),
          0
        ) AS "totalPsfFunded",

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
        ) AS "totalExternallyFunded",

        COALESCE(
          SUM(approved_amount)
            FILTER (
              WHERE funding_source =
                'EMPLOYEE_REIMBURSEMENT'
            ),
          0
        ) AS "totalReimbursable"

      FROM mission_funding_items

      WHERE mission_id = $1

      GROUP BY currency

      ORDER BY currency
    `,
    [missionId],
  );

  return {
    ...mission,
    fundingItems: itemResult.rows,
    totalsByCurrency: totalsResult.rows,
  };
}
export async function updateMissionFundingItem({
  missionId,
  fundingItemId,
  participantEmployeeId,
  costCategory,
  fundingSource,
  fundingOrganization,
  estimatedAmount,
  approvedAmount,
  currency,
  requiresReconciliation,
  notes,
  updatedByUserId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const itemResult = await client.query(
      `
        SELECT
          funding.id,
          funding.mission_id AS "missionId",

          funding.participant_employee_id
            AS "participantEmployeeId",

          funding.cost_category
            AS "costCategory",

          funding.funding_source
            AS "fundingSource",

          funding.funding_organization
            AS "fundingOrganization",

          funding.estimated_amount
            AS "estimatedAmount",

          funding.approved_amount
            AS "approvedAmount",

          funding.currency,

          funding.requires_reconciliation
            AS "requiresReconciliation",

          funding.notes,
          missions.status AS "missionStatus"

        FROM mission_funding_items AS funding

        JOIN missions
          ON missions.id = funding.mission_id

        WHERE
          funding.id = $1
          AND funding.mission_id = $2

        FOR UPDATE OF funding, missions
      `,
      [
        fundingItemId,
        missionId,
      ],
    );

    const currentItem = itemResult.rows[0];

    if (!currentItem) {
      throw createServiceError(
        "Mission funding item not found",
        404,
      );
    }

    if (currentItem.missionStatus !== "APPROVED") {
      throw createServiceError(
        "Funding items can only be updated while the mission is approved",
        409,
      );
    }

    const paidResult = await client.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM mission_disbursements
          WHERE
            mission_id = $1
            AND funding_item_id = $2
            AND status = 'PAID'
        ) AS "hasPaidDisbursement"
      `,
      [
        missionId,
        fundingItemId,
      ],
    );

    const hasPaidDisbursement =
      paidResult.rows[0].hasPaidDisbursement;

    const financialFieldsWereProvided = [
      participantEmployeeId,
      costCategory,
      fundingSource,
      fundingOrganization,
      estimatedAmount,
      approvedAmount,
      currency,
      requiresReconciliation,
    ].some((value) => value !== undefined);

    if (
      hasPaidDisbursement &&
      financialFieldsWereProvided
    ) {
      throw createServiceError(
        "Financial details cannot be changed after a related disbursement has been paid",
        409,
      );
    }

    let normalizedParticipantId =
      currentItem.participantEmployeeId;

    if (participantEmployeeId !== undefined) {
      if (
        participantEmployeeId === null ||
        participantEmployeeId === ""
      ) {
        normalizedParticipantId = null;
      } else {
        normalizedParticipantId =
          Number(participantEmployeeId);

        if (
          !Number.isInteger(
            normalizedParticipantId,
          ) ||
          normalizedParticipantId <= 0
        ) {
          throw createServiceError(
            "Participant employee ID must be a positive integer or null",
            400,
          );
        }

        const participantResult =
          await client.query(
            `
              SELECT 1
              FROM mission_participants
              WHERE
                mission_id = $1
                AND employee_id = $2
            `,
            [
              missionId,
              normalizedParticipantId,
            ],
          );

        if (!participantResult.rows[0]) {
          throw createServiceError(
            "The selected employee is not a participant in this mission",
            400,
          );
        }
      }
    }

    const normalizedCategory =
      costCategory === undefined
        ? currentItem.costCategory
        : String(costCategory)
            .trim()
            .toUpperCase();

    if (!allowedCategories.has(normalizedCategory)) {
      throw createServiceError(
        "Invalid mission cost category",
        400,
      );
    }

    const normalizedFundingSource =
      fundingSource === undefined
        ? currentItem.fundingSource
        : String(fundingSource)
            .trim()
            .toUpperCase();

    if (
      !allowedFundingSources.has(
        normalizedFundingSource,
      )
    ) {
      throw createServiceError(
        "Invalid mission funding source",
        400,
      );
    }

    const normalizedEstimatedAmount =
      estimatedAmount === undefined
        ? Number(currentItem.estimatedAmount)
        : parseMoney(
            estimatedAmount,
            "Estimated amount",
          );

    const normalizedApprovedAmount =
      approvedAmount === undefined
        ? Number(currentItem.approvedAmount)
        : parseMoney(
            approvedAmount,
            "Approved amount",
          );

    const normalizedCurrency =
      currency === undefined
        ? currentItem.currency
        : String(currency)
            .trim()
            .toUpperCase();

    if (
      normalizedCurrency.length < 3 ||
      normalizedCurrency.length > 10
    ) {
      throw createServiceError(
        "Currency must contain between 3 and 10 characters",
        400,
      );
    }

    let normalizedReconciliation =
      currentItem.requiresReconciliation;

    if (requiresReconciliation !== undefined) {
      if (
        typeof requiresReconciliation !==
        "boolean"
      ) {
        throw createServiceError(
          "requiresReconciliation must be true or false",
          400,
        );
      }

      normalizedReconciliation =
        requiresReconciliation;
    }

    const externalFundingSources = new Set([
      "HOST_INSTITUTION",
      "PARTNER",
      "OTHER",
    ]);

    let normalizedOrganization;

    if (
      fundingOrganization !== undefined
    ) {
      normalizedOrganization =
        fundingOrganization?.trim() || null;
    } else {
      normalizedOrganization =
        currentItem.fundingOrganization;
    }

    if (
      !externalFundingSources.has(
        normalizedFundingSource,
      )
    ) {
      normalizedOrganization = null;
    }

    if (
      externalFundingSources.has(
        normalizedFundingSource,
      ) &&
      !normalizedOrganization
    ) {
      throw createServiceError(
        "Funding organization is required for external funding",
        400,
      );
    }

    if (
      externalFundingSources.has(
        normalizedFundingSource,
      ) &&
      normalizedReconciliation
    ) {
      throw createServiceError(
        "Externally funded costs cannot require PSF financial reconciliation",
        400,
      );
    }

    const normalizedNotes =
      notes === undefined
        ? currentItem.notes
        : notes?.trim() || null;

    const updateResult = await client.query(
      `
        UPDATE mission_funding_items
        SET
          participant_employee_id = $3,
          cost_category = $4,
          funding_source = $5,
          funding_organization = $6,
          estimated_amount = $7,
          approved_amount = $8,
          currency = $9,
          requires_reconciliation = $10,
          notes = $11,
          updated_by_user_id = $12,
          updated_at = CURRENT_TIMESTAMP

        WHERE
          id = $1
          AND mission_id = $2

        RETURNING
          id,
          mission_id AS "missionId",

          participant_employee_id
            AS "participantEmployeeId",

          cost_category AS "costCategory",
          funding_source AS "fundingSource",

          funding_organization
            AS "fundingOrganization",

          estimated_amount
            AS "estimatedAmount",

          approved_amount
            AS "approvedAmount",

          currency,

          requires_reconciliation
            AS "requiresReconciliation",

          notes,

          created_by_user_id
            AS "createdByUserId",

          updated_by_user_id
            AS "updatedByUserId",

          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        fundingItemId,
        missionId,
        normalizedParticipantId,
        normalizedCategory,
        normalizedFundingSource,
        normalizedOrganization,
        normalizedEstimatedAmount,
        normalizedApprovedAmount,
        normalizedCurrency,
        normalizedReconciliation,
        normalizedNotes,
        updatedByUserId,
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

export async function deleteMissionFundingItem({
  missionId,
  fundingItemId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const itemResult = await client.query(
      `
        SELECT
          funding.id,
          funding.mission_id AS "missionId",
          funding.cost_category
            AS "costCategory",
          funding.funding_source
            AS "fundingSource",
          funding.approved_amount
            AS "approvedAmount",
          funding.currency,
          missions.status AS "missionStatus"

        FROM mission_funding_items AS funding

        JOIN missions
          ON missions.id = funding.mission_id

        WHERE
          funding.id = $1
          AND funding.mission_id = $2

        FOR UPDATE OF funding, missions
      `,
      [
        fundingItemId,
        missionId,
      ],
    );

    const fundingItem = itemResult.rows[0];

    if (!fundingItem) {
      throw createServiceError(
        "Mission funding item not found",
        404,
      );
    }

    if (fundingItem.missionStatus !== "APPROVED") {
      throw createServiceError(
        "Funding items can only be deleted while the mission is approved",
        409,
      );
    }

    const disbursementResult =
      await client.query(
        `
          SELECT COUNT(*)::integer
            AS "disbursementCount"
          FROM mission_disbursements
          WHERE
            mission_id = $1
            AND funding_item_id = $2
        `,
        [
          missionId,
          fundingItemId,
        ],
      );

    if (
      disbursementResult.rows[0]
        .disbursementCount > 0
    ) {
      throw createServiceError(
        "This funding item cannot be deleted because it has related disbursement records",
        409,
      );
    }

    const deleteResult = await client.query(
      `
        DELETE FROM mission_funding_items
        WHERE
          id = $1
          AND mission_id = $2
        RETURNING
          id,
          mission_id AS "missionId",
          cost_category AS "costCategory",
          funding_source AS "fundingSource",
          approved_amount AS "approvedAmount",
          currency
      `,
      [
        fundingItemId,
        missionId,
      ],
    );

    await client.query("COMMIT");

    return deleteResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function createMissionDisbursement({
  missionId,
  fundingItemId,
  participantEmployeeId,
  paymentType,
  amount,
  paymentReference,
  notes,
  createdByUserId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const fundingResult = await client.query(
      `
        SELECT
          funding.id,
          funding.mission_id AS "missionId",

          funding.participant_employee_id
            AS "participantEmployeeId",

          funding.cost_category
            AS "costCategory",

          funding.funding_source
            AS "fundingSource",

          funding.approved_amount
            AS "approvedAmount",

          funding.currency,
          missions.status AS "missionStatus"

        FROM mission_funding_items AS funding

        JOIN missions
          ON missions.id = funding.mission_id

        WHERE
          funding.id = $1
          AND funding.mission_id = $2

        FOR UPDATE OF funding, missions
      `,
      [
        fundingItemId,
        missionId,
      ],
    );

    const fundingItem = fundingResult.rows[0];

    if (!fundingItem) {
      throw createServiceError(
        "Mission funding item not found",
        404,
      );
    }

    if (fundingItem.missionStatus !== "APPROVED") {
      throw createServiceError(
        "Disbursements can only be created for an approved mission",
        409,
      );
    }

    if (
      ![
        "PSF",
        "EMPLOYEE_REIMBURSEMENT",
      ].includes(fundingItem.fundingSource)
    ) {
      throw createServiceError(
        "PSF cannot create a disbursement for an externally funded item",
        409,
      );
    }

    const normalizedPaymentType =
      String(paymentType || "")
        .trim()
        .toUpperCase();

    if (
      !allowedDisbursementTypes.has(
        normalizedPaymentType,
      )
    ) {
      throw createServiceError(
        "Invalid disbursement payment type",
        400,
      );
    }

    if (
      fundingItem.fundingSource ===
        "EMPLOYEE_REIMBURSEMENT" &&
      normalizedPaymentType !== "REIMBURSEMENT"
    ) {
      throw createServiceError(
        "Employee reimbursement funding must use the REIMBURSEMENT payment type",
        400,
      );
    }

    if (
      fundingItem.fundingSource === "PSF" &&
      normalizedPaymentType === "REIMBURSEMENT"
    ) {
      throw createServiceError(
        "REIMBURSEMENT requires an EMPLOYEE_REIMBURSEMENT funding item",
        400,
      );
    }

    const normalizedAmount =
      Number(amount);

    if (
      !Number.isFinite(normalizedAmount) ||
      normalizedAmount <= 0
    ) {
      throw createServiceError(
        "Disbursement amount must be greater than zero",
        400,
      );
    }

    let normalizedParticipantId =
      fundingItem.participantEmployeeId;

    if (participantEmployeeId !== undefined) {
      if (
        participantEmployeeId === null ||
        participantEmployeeId === ""
      ) {
        normalizedParticipantId = null;
      } else {
        normalizedParticipantId =
          Number(participantEmployeeId);

        if (
          !Number.isInteger(
            normalizedParticipantId,
          ) ||
          normalizedParticipantId <= 0
        ) {
          throw createServiceError(
            "Participant employee ID must be a positive integer",
            400,
          );
        }
      }
    }

    if (
      fundingItem.participantEmployeeId !== null &&
      normalizedParticipantId !==
        fundingItem.participantEmployeeId
    ) {
      throw createServiceError(
        "The disbursement participant must match the funding item participant",
        400,
      );
    }

    if (normalizedParticipantId !== null) {
      const participantResult =
        await client.query(
          `
            SELECT 1
            FROM mission_participants
            WHERE
              mission_id = $1
              AND employee_id = $2
          `,
          [
            missionId,
            normalizedParticipantId,
          ],
        );

      if (!participantResult.rows[0]) {
        throw createServiceError(
          "The selected employee is not a participant in this mission",
          400,
        );
      }
    }

    if (
      [
        "ADVANCE",
        "PER_DIEM",
        "REIMBURSEMENT",
      ].includes(normalizedPaymentType) &&
      normalizedParticipantId === null
    ) {
      throw createServiceError(
        `${normalizedPaymentType} must be assigned to a mission participant`,
        400,
      );
    }

    const existingTotalResult =
      await client.query(
        `
          SELECT
            COALESCE(
              SUM(amount),
              0
            ) AS "committedAmount"

          FROM mission_disbursements

          WHERE
            mission_id = $1
            AND funding_item_id = $2
            AND status IN (
              'PENDING',
              'PAID'
            )
        `,
        [
          missionId,
          fundingItemId,
        ],
      );

    const committedAmount = Number(
      existingTotalResult.rows[0]
        .committedAmount,
    );

    const approvedAmount = Number(
      fundingItem.approvedAmount,
    );

    if (
      committedAmount + normalizedAmount >
      approvedAmount
    ) {
      throw createServiceError(
        `Disbursement exceeds the approved funding amount. Available amount: ${
          approvedAmount - committedAmount
        } ${fundingItem.currency}`,
        409,
      );
    }

    const insertResult = await client.query(
      `
        INSERT INTO mission_disbursements (
          mission_id,
          funding_item_id,
          participant_employee_id,
          payment_type,
          amount,
          currency,
          payment_reference,
          status,
          notes,
          created_by_user_id
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7,
          'PENDING',
          $8,
          $9
        )
        RETURNING
          id,
          mission_id AS "missionId",
          funding_item_id AS "fundingItemId",

          participant_employee_id
            AS "participantEmployeeId",

          payment_type AS "paymentType",
          amount,
          currency,

          payment_reference
            AS "paymentReference",

          paid_at AS "paidAt",

          paid_by_user_id
            AS "paidByUserId",

          status,
          notes,

          created_by_user_id
            AS "createdByUserId",

          updated_by_user_id
            AS "updatedByUserId",

          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        missionId,
        fundingItemId,
        normalizedParticipantId,
        normalizedPaymentType,
        normalizedAmount,
        fundingItem.currency,
        paymentReference?.trim() || null,
        notes?.trim() || null,
        createdByUserId,
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

export async function findMissionDisbursements(
  missionId,
) {
  const missionResult = await pool.query(
    `
      SELECT
        id,
        mission_number AS "missionNumber",
        title,
        destination,
        start_date AS "startDate",
        end_date AS "endDate",
        status
      FROM missions
      WHERE id = $1
    `,
    [missionId],
  );

  const mission = missionResult.rows[0];

  if (!mission) {
    return null;
  }

  const disbursementResult =
    await pool.query(
      `
        SELECT
          disbursements.id,

          disbursements.mission_id
            AS "missionId",

          disbursements.funding_item_id
            AS "fundingItemId",

          funding.cost_category
            AS "costCategory",

          funding.funding_source
            AS "fundingSource",

          funding.approved_amount
            AS "fundingApprovedAmount",

          disbursements.participant_employee_id
            AS "participantEmployeeId",

          CASE
            WHEN employees.id IS NULL
              THEN NULL
            ELSE CONCAT(
              employees.first_name,
              ' ',
              employees.last_name
            )
          END AS "participantName",

          employees.staff_number
            AS "staffNumber",

          disbursements.payment_type
            AS "paymentType",

          disbursements.amount,
          disbursements.currency,

          disbursements.payment_reference
            AS "paymentReference",

          disbursements.status,

          disbursements.paid_at
            AS "paidAt",

          disbursements.paid_by_user_id
            AS "paidByUserId",

          payer.full_name AS "paidBy",

          disbursements.notes,

          disbursements.created_by_user_id
            AS "createdByUserId",

          creator.full_name AS "createdBy",

          disbursements.updated_by_user_id
            AS "updatedByUserId",

          updater.full_name AS "updatedBy",

          disbursements.created_at
            AS "createdAt",

          disbursements.updated_at
            AS "updatedAt"

        FROM mission_disbursements
          AS disbursements

        JOIN mission_funding_items AS funding
          ON funding.id =
            disbursements.funding_item_id
          AND funding.mission_id =
            disbursements.mission_id

        LEFT JOIN employees
          ON employees.id =
            disbursements.participant_employee_id

        JOIN app_users AS creator
          ON creator.id =
            disbursements.created_by_user_id

        LEFT JOIN app_users AS payer
          ON payer.id =
            disbursements.paid_by_user_id

        LEFT JOIN app_users AS updater
          ON updater.id =
            disbursements.updated_by_user_id

        WHERE disbursements.mission_id = $1

        ORDER BY
          disbursements.created_at,
          disbursements.id
      `,
      [missionId],
    );

  const totalsResult = await pool.query(
    `
      SELECT
        currency,

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

      WHERE mission_id = $1

      GROUP BY currency

      ORDER BY currency
    `,
    [missionId],
  );

  return {
    ...mission,
    disbursements:
      disbursementResult.rows,
    totalsByCurrency:
      totalsResult.rows,
  };
}

export async function markMissionDisbursementPaid({
  missionId,
  disbursementId,
  paymentReference,
  paidAt,
  paidByUserId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT
          disbursements.id,
          disbursements.status,
          disbursements.amount,
          disbursements.currency,
          missions.status AS "missionStatus"

        FROM mission_disbursements
          AS disbursements

        JOIN missions
          ON missions.id =
            disbursements.mission_id

        WHERE
          disbursements.id = $1
          AND disbursements.mission_id = $2

        FOR UPDATE OF disbursements, missions
      `,
      [
        disbursementId,
        missionId,
      ],
    );

    const disbursement = result.rows[0];

    if (!disbursement) {
      throw createServiceError(
        "Mission disbursement not found",
        404,
      );
    }

    if (disbursement.missionStatus !== "APPROVED") {
      throw createServiceError(
        "Payments can only be confirmed while the mission is approved",
        409,
      );
    }

    if (disbursement.status === "PAID") {
      throw createServiceError(
        "Mission disbursement has already been paid",
        409,
      );
    }

    if (disbursement.status === "CANCELLED") {
      throw createServiceError(
        "A cancelled disbursement cannot be paid",
        409,
      );
    }

    const normalizedReference =
      paymentReference?.trim();

    if (!normalizedReference) {
      throw createServiceError(
        "Payment reference is required",
        400,
      );
    }

    let normalizedPaidAt = null;

    if (paidAt !== undefined && paidAt !== null) {
      const parsedDate = new Date(paidAt);

      if (
        Number.isNaN(parsedDate.getTime())
      ) {
        throw createServiceError(
          "Paid date is invalid",
          400,
        );
      }

      normalizedPaidAt =
        parsedDate.toISOString();
    }

    const updateResult = await client.query(
      `
        UPDATE mission_disbursements
        SET
          status = 'PAID',
          payment_reference = $3,
          paid_at = COALESCE(
            $4::timestamptz,
            CURRENT_TIMESTAMP
          ),
          paid_by_user_id = $5,
          updated_by_user_id = $5,
          updated_at = CURRENT_TIMESTAMP

        WHERE
          id = $1
          AND mission_id = $2

        RETURNING
          id,
          mission_id AS "missionId",
          funding_item_id AS "fundingItemId",

          participant_employee_id
            AS "participantEmployeeId",

          payment_type AS "paymentType",
          amount,
          currency,

          payment_reference
            AS "paymentReference",

          status,
          paid_at AS "paidAt",

          paid_by_user_id
            AS "paidByUserId",

          updated_by_user_id
            AS "updatedByUserId",

          updated_at AS "updatedAt"
      `,
      [
        disbursementId,
        missionId,
        normalizedReference,
        normalizedPaidAt,
        paidByUserId,
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

export async function cancelMissionDisbursement({
  missionId,
  disbursementId,
  cancellationReason,
  cancelledByUserId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT
          disbursements.id,
          disbursements.status,
          missions.status AS "missionStatus"

        FROM mission_disbursements
          AS disbursements

        JOIN missions
          ON missions.id =
            disbursements.mission_id

        WHERE
          disbursements.id = $1
          AND disbursements.mission_id = $2

        FOR UPDATE OF disbursements, missions
      `,
      [
        disbursementId,
        missionId,
      ],
    );

    const disbursement = result.rows[0];

    if (!disbursement) {
      throw createServiceError(
        "Mission disbursement not found",
        404,
      );
    }

    if (disbursement.missionStatus !== "APPROVED") {
      throw createServiceError(
        "Disbursements can only be cancelled while the mission is approved",
        409,
      );
    }

    if (disbursement.status === "PAID") {
      throw createServiceError(
        "A paid disbursement cannot be cancelled; use the financial correction process",
        409,
      );
    }

    if (disbursement.status === "CANCELLED") {
      throw createServiceError(
        "Mission disbursement has already been cancelled",
        409,
      );
    }

    const normalizedReason =
      cancellationReason?.trim();

    if (!normalizedReason) {
      throw createServiceError(
        "Cancellation reason is required",
        400,
      );
    }

    const updateResult = await client.query(
      `
        UPDATE mission_disbursements
        SET
          status = 'CANCELLED',

          cancelled_by_user_id = $3,
          cancelled_at = CURRENT_TIMESTAMP,
          cancellation_reason = $4,

          updated_by_user_id = $3,
          updated_at = CURRENT_TIMESTAMP

        WHERE
          id = $1
          AND mission_id = $2

        RETURNING
          id,
          mission_id AS "missionId",
          funding_item_id AS "fundingItemId",
          status,

          cancelled_by_user_id
            AS "cancelledByUserId",

          cancelled_at AS "cancelledAt",

          cancellation_reason
            AS "cancellationReason",

          updated_at AS "updatedAt"
      `,
      [
        disbursementId,
        missionId,
        cancelledByUserId,
        normalizedReason,
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
