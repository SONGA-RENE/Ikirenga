import bcrypt from "bcryptjs";

import pool from "../config/database.js";

import {
  decryptIdentifier,
} from "../utils/employeeDataEncryption.js";

function createServiceError(
  message,
  statusCode,
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function recordAccessAttempt(
  client,
  {
    employeeId,
    userId,
    identifierType,
    outcome,
    reason,
    denialReason,
    ipAddress,
    userAgent,
  },
) {
  await client.query(
    `
      INSERT INTO sensitive_data_access_logs (
        employee_id,
        accessed_by_user_id,
        identifier_type,
        access_outcome,
        access_reason,
        denial_reason,
        ip_address,
        user_agent
      )
      VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8
      )
    `,
    [
      employeeId,
      userId,
      identifierType,
      outcome,
      reason,
      denialReason,
      ipAddress,
      userAgent,
    ],
  );
}

export async function revealEmployeeIdentifier({
  employeeId,
  requestingUserId,
  identifierType,
  password,
  reason,
  ipAddress,
  userAgent,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const employeeResult =
      await client.query(
        `
          SELECT id
          FROM employees
          WHERE id = $1
        `,
        [employeeId],
      );

    if (!employeeResult.rows[0]) {
      throw createServiceError(
        "Employee not found",
        404,
      );
    }

    const userResult =
      await client.query(
        `
          SELECT
            id,
            password_hash AS "passwordHash",
            role,
            is_active AS "isActive"
          FROM app_users
          WHERE id = $1
          FOR UPDATE
        `,
        [requestingUserId],
      );

    const user = userResult.rows[0];

    if (
      !user ||
      !user.isActive ||
      !["ADMIN", "HR"].includes(
        user.role,
      )
    ) {
      throw createServiceError(
        "You are not authorized to reveal sensitive employee information",
        403,
      );
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.passwordHash,
      );

    if (!passwordMatches) {
      await recordAccessAttempt(
        client,
        {
          employeeId,
          userId: requestingUserId,
          identifierType,
          outcome: "DENIED",
          reason,
          denialReason:
            "Password verification failed",
          ipAddress,
          userAgent,
        },
      );

      await client.query("COMMIT");

      throw createServiceError(
        "Password verification failed",
        401,
      );
    }

    const profileResult =
      await client.query(
        `
          SELECT
            national_id_encrypted
              AS "nationalIdEncrypted",
            national_id_iv
              AS "nationalIdIv",
            national_id_auth_tag
              AS "nationalIdAuthTag",

            passport_encrypted
              AS "passportEncrypted",
            passport_iv
              AS "passportIv",
            passport_auth_tag
              AS "passportAuthTag"

          FROM employee_profiles
          WHERE employee_id = $1
        `,
        [employeeId],
      );

    const profile =
      profileResult.rows[0];

    if (!profile) {
      await recordAccessAttempt(
        client,
        {
          employeeId,
          userId: requestingUserId,
          identifierType,
          outcome: "DENIED",
          reason,
          denialReason:
            "Employee profile does not exist",
          ipAddress,
          userAgent,
        },
      );

      await client.query("COMMIT");

      throw createServiceError(
        "Employee profile does not contain the requested identifier",
        404,
      );
    }

    const encryptedData =
      identifierType === "NATIONAL_ID"
        ? {
            encrypted:
              profile
                .nationalIdEncrypted,
            initializationVector:
              profile.nationalIdIv,
            authenticationTag:
              profile
                .nationalIdAuthTag,
          }
        : {
            encrypted:
              profile.passportEncrypted,
            initializationVector:
              profile.passportIv,
            authenticationTag:
              profile.passportAuthTag,
          };

    if (
      !encryptedData.encrypted ||
      !encryptedData.initializationVector ||
      !encryptedData.authenticationTag
    ) {
      await recordAccessAttempt(
        client,
        {
          employeeId,
          userId: requestingUserId,
          identifierType,
          outcome: "DENIED",
          reason,
          denialReason:
            "Requested identifier is not stored",
          ipAddress,
          userAgent,
        },
      );

      await client.query("COMMIT");

      throw createServiceError(
        "Employee profile does not contain the requested identifier",
        404,
      );
    }

    const value =
      decryptIdentifier(
        encryptedData,
      );

    await recordAccessAttempt(
      client,
      {
        employeeId,
        userId: requestingUserId,
        identifierType,
        outcome: "GRANTED",
        reason,
        denialReason: null,
        ipAddress,
        userAgent,
      },
    );

    await client.query("COMMIT");

    return {
      identifierType,
      value,
    };
  } catch (error) {
    if (!error.statusCode) {
      await client.query("ROLLBACK");
    } else {
      try {
        await client.query("ROLLBACK");
      } catch (error) {
        if (!transactionFinished) {
            await client.query("ROLLBACK");
        }
        throw error;
        }
    }

    throw error;
  } finally {
    client.release();
  }
}