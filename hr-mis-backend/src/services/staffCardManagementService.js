import crypto from "node:crypto";

import pool from "../config/database.js";

export async function issueStaffCard({
  employeeId,
  expiresAt,
  createdByUserId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const employeeResult = await client.query(
      `
        SELECT
          id,
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

    if (!employee.isActive) {
      const error = new Error(
        "A card cannot be issued to an inactive employee",
      );

      error.statusCode = 409;
      throw error;
    }

    const dateResult = await client.query(
      `
        SELECT $1::date > CURRENT_DATE
          AS "isFutureDate"
      `,
      [expiresAt],
    );

    if (!dateResult.rows[0].isFutureDate) {
      const error = new Error(
        "Card expiry date must be in the future",
      );

      error.statusCode = 400;
      throw error;
    }

    // Any existing active card becomes replaced.
    await client.query(
      `
        UPDATE staff_cards
        SET
          status = 'REPLACED',
          revoked_at = CURRENT_TIMESTAMP,
          revocation_type = 'OTHER',
          revocation_reason =
            'Replaced by a newly issued card',
          revoked_by_user_id = $2, 
          updated_at = CURRENT_TIMESTAMP
        WHERE employee_id = $1
          AND status = 'ACTIVE'
      `,
      [employeeId, createdByUserId],
    );

    const verificationToken = crypto.randomUUID();

    const insertResult = await client.query(
      `
        INSERT INTO staff_cards (
          employee_id,
          verification_token,
          expires_at,
          created_by_user_id
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          employee_id AS "employeeId",
          verification_token AS "verificationToken",
          issued_at AS "issuedAt",
          expires_at AS "expiresAt",
          status,
          created_at AS "createdAt"
      `,
      [
        employeeId,
        verificationToken,
        expiresAt,
        createdByUserId,
      ],
    );

    const insertedCard = insertResult.rows[0];

    const issueYear = new Date(
      `${insertedCard.issuedAt}T00:00:00Z`,
    ).getUTCFullYear();

    const cardNumber =
      `PSF-${issueYear}-${String(
        insertedCard.id,
      ).padStart(5, "0")}`;

    const finalResult = await client.query(
      `
        UPDATE staff_cards
        SET
          card_number = $2,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING
          id,
          employee_id AS "employeeId",
          card_number AS "cardNumber",
          verification_token AS "verificationToken",
          issued_at AS "issuedAt",
          expires_at AS "expiresAt",
          status,
          created_at AS "createdAt"
      `,
      [insertedCard.id, cardNumber],
    );

    await client.query("COMMIT");

    return finalResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function verifyStaffCard(
  verificationToken,
) {
  const result = await pool.query(
    `
      SELECT
        staff_cards.card_number AS "cardNumber",
        staff_cards.issued_at AS "issuedAt",
        staff_cards.expires_at AS "expiresAt",
        staff_cards.status,

        employees.staff_number AS "staffNumber",
        employees.first_name AS "firstName",
        employees.last_name AS "lastName",
        employees.photo_filename AS "photoFilename",
        employees.is_active AS "employeeIsActive",

        positions.title AS "position",
        departments.name AS "department"

      FROM staff_cards

      JOIN employees
        ON employees.id = staff_cards.employee_id

      LEFT JOIN positions
        ON positions.id = employees.position_id

      LEFT JOIN departments
        ON departments.id = positions.department_id

      WHERE staff_cards.verification_token = $1
    `,
    [verificationToken],
  );

  const card = result.rows[0];

  if (!card) {
    return null;
  }

  let verificationStatus = "VALID";

  if (card.status === "REVOKED") {
    verificationStatus = "REVOKED";
  } else if (card.status === "REPLACED") {
    verificationStatus = "REPLACED";
  } else if (!card.employeeIsActive) {
    verificationStatus = "INACTIVE_EMPLOYEE";
  } else {
    const expiryResult = await pool.query(
      `
        SELECT $1::date < CURRENT_DATE
          AS "isExpired"
      `,
      [card.expiresAt],
    );

    if (expiryResult.rows[0].isExpired) {
      verificationStatus = "EXPIRED";
    }
  }

  return {
    cardNumber: card.cardNumber,
    staffNumber: card.staffNumber,
    fullName:
      `${card.firstName} ${card.lastName}`.trim(),
    position: card.position,
    department: card.department,
    photoFilename: card.photoFilename,
    issuedAt: card.issuedAt,
    expiresAt: card.expiresAt,
    verificationStatus,
  };
}

export async function revokeStaffCard({
  cardId,
  revocationType,
  reason,
  revokedByUserId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const cardResult = await client.query(
      `
        SELECT
          id,
          employee_id AS "employeeId",
          card_number AS "cardNumber",
          status
        FROM staff_cards
        WHERE id = $1
        FOR UPDATE
      `,
      [cardId],
    );

    const card = cardResult.rows[0];

    if (!card) {
      const error = new Error(
        "Staff card not found",
      );

      error.statusCode = 404;
      throw error;
    }

    if (card.status !== "ACTIVE") {
      const error = new Error(
        `Only an active card can be revoked. Current status: ${card.status}`,
      );

      error.statusCode = 409;
      throw error;
    }

    const updateResult = await client.query(
      `
        UPDATE staff_cards
        SET
          status = 'REVOKED',
          revocation_type = $2,
          revocation_reason = $3,
          revoked_by_user_id = $4,
          revoked_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING
          id,
          employee_id AS "employeeId",
          card_number AS "cardNumber",
          issued_at AS "issuedAt",
          expires_at AS "expiresAt",
          status,
          revocation_type AS "revocationType",
          revocation_reason AS "revocationReason",
          revoked_by_user_id AS "revokedByUserId",
          revoked_at AS "revokedAt"
      `,
      [
        cardId,
        revocationType,
        reason,
        revokedByUserId,
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

export async function reactivateStaffCard(
  cardNumber,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // First identify the card's employee.
    const lookupResult = await client.query(
      `
        SELECT
          id,
          employee_id AS "employeeId"
        FROM staff_cards
        WHERE card_number = $1
      `,
      [cardNumber],
    );

    const existingCard = lookupResult.rows[0];

    if (!existingCard) {
      const error = new Error(
        "Staff card not found",
      );

      error.statusCode = 404;
      throw error;
    }

    // Lock the employee to prevent another card operation
    // from running for this employee simultaneously.
    const employeeResult = await client.query(
      `
        SELECT
          id,
          is_active AS "isActive"
        FROM employees
        WHERE id = $1
        FOR UPDATE
      `,
      [existingCard.employeeId],
    );

    const employee = employeeResult.rows[0];

    if (!employee) {
      const error = new Error(
        "Employee not found",
      );

      error.statusCode = 404;
      throw error;
    }

    if (!employee.isActive) {
      const error = new Error(
        "A card cannot be reactivated for an inactive employee",
      );

      error.statusCode = 409;
      throw error;
    }

    // Lock and reload the card after locking the employee.
    const cardResult = await client.query(
      `
        SELECT
          id,
          employee_id AS "employeeId",
          card_number AS "cardNumber",
          issued_at AS "issuedAt",
          expires_at AS "expiresAt",
          status
        FROM staff_cards
        WHERE card_number = $1
        FOR UPDATE
      `,
      [cardNumber],
    );

    const card = cardResult.rows[0];

    if (card.status === "ACTIVE") {
      const error = new Error(
        "Staff card is already active",
      );

      error.statusCode = 409;
      throw error;
    }

    if (card.status === "REPLACED") {
      const error = new Error(
        "A replaced staff card cannot be reactivated",
      );

      error.statusCode = 409;
      throw error;
    }

    if (card.status !== "REVOKED") {
      const error = new Error(
        `Staff card cannot be reactivated. Current status: ${card.status}`,
      );

      error.statusCode = 409;
      throw error;
    }

    const expiryResult = await client.query(
      `
        SELECT $1::date < CURRENT_DATE
          AS "isExpired"
      `,
      [card.expiresAt],
    );

    if (expiryResult.rows[0].isExpired) {
      const error = new Error(
        "An expired staff card cannot be reactivated",
      );

      error.statusCode = 409;
      throw error;
    }

    const activeCardResult = await client.query(
      `
        SELECT
          id,
          card_number AS "cardNumber"
        FROM staff_cards
        WHERE employee_id = $1
          AND status = 'ACTIVE'
          AND id <> $2
        LIMIT 1
      `,
      [card.employeeId, card.id],
    );

    if (activeCardResult.rows[0]) {
      const error = new Error(
        `Employee already has an active staff card: ${activeCardResult.rows[0].cardNumber}`,
      );

      error.statusCode = 409;
      throw error;
    }

    const updateResult = await client.query(
      `
        UPDATE staff_cards
        SET
          status = 'ACTIVE',
          revoked_at = NULL,
          revocation_reason = NULL,
          revocation_type = NULL,
          revoked_by_user_id = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING
          id,
          employee_id AS "employeeId",
          card_number AS "cardNumber",
          verification_token AS "verificationToken",
          issued_at AS "issuedAt",
          expires_at AS "expiresAt",
          status,
          updated_at AS "updatedAt"
      `,
      [card.id],
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

export async function findEmployeeCardHistory(
  employeeId,
) {
  const employeeResult = await pool.query(
    `
      SELECT
        id,
        staff_number AS "staffNumber",
        first_name AS "firstName",
        last_name AS "lastName"
      FROM employees
      WHERE id = $1
    `,
    [employeeId],
  );

  const employee = employeeResult.rows[0];

  if (!employee) {
    const error = new Error(
      "Employee not found",
    );

    error.statusCode = 404;
    throw error;
  }

  const cardResult = await pool.query(
    `
      SELECT
        staff_cards.id,
        staff_cards.card_number AS "cardNumber",
        staff_cards.verification_token AS "verificationToken",
        staff_cards.issued_at AS "issuedAt",
        staff_cards.expires_at AS "expiresAt",

        CASE
          WHEN staff_cards.status = 'ACTIVE'
            AND staff_cards.expires_at < CURRENT_DATE
          THEN 'EXPIRED'
          ELSE staff_cards.status
        END AS status,

        staff_cards.revocation_type
          AS "revocationType",

        staff_cards.revocation_reason
          AS "revocationReason",

        staff_cards.revoked_at
          AS "revokedAt",

        issuer.full_name AS "issuedBy",
        revoker.full_name AS "revokedBy",

        staff_cards.created_at AS "createdAt",
        staff_cards.updated_at AS "updatedAt"

      FROM staff_cards

      LEFT JOIN app_users AS issuer
        ON issuer.id =
          staff_cards.created_by_user_id

      LEFT JOIN app_users AS revoker
        ON revoker.id =
          staff_cards.revoked_by_user_id

      WHERE staff_cards.employee_id = $1

      ORDER BY
        staff_cards.issued_at DESC,
        staff_cards.id DESC
    `,
    [employeeId],
  );

  return {
    employee: {
      id: employee.id,
      staffNumber: employee.staffNumber,
      fullName:
        `${employee.firstName} ${employee.lastName}`.trim(),
    },

    cards: cardResult.rows,
  };
}