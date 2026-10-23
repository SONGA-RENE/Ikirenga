import pool from "../config/database.js";

import {
  encryptIdentifier,
  maskIdentifier,
} from "../utils/employeeDataEncryption.js";

function createServiceError(
  message,
  statusCode,
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function resolveIdentifier(
  submittedValue,
  existingProfile,
  prefix,
) {
  const encryptedField =
    `${prefix}Encrypted`;

  const ivField = `${prefix}Iv`;

  const authTagField =
    `${prefix}AuthTag`;

  const hashField = `${prefix}Hash`;

  const lastFourField =
    `${prefix}LastFour`;

  if (submittedValue === undefined) {
    return {
      encrypted:
        existingProfile?.[encryptedField] ??
        null,
      initializationVector:
        existingProfile?.[ivField] ?? null,
      authenticationTag:
        existingProfile?.[authTagField] ??
        null,
      hash:
        existingProfile?.[hashField] ?? null,
      lastFour:
        existingProfile?.[lastFourField] ??
        null,
    };
  }

  if (
    submittedValue === null ||
    submittedValue === ""
  ) {
    return {
      encrypted: null,
      initializationVector: null,
      authenticationTag: null,
      hash: null,
      lastFour: null,
    };
  }

  return encryptIdentifier(
    submittedValue,
  );
}

function toPublicProfile(row) {
  if (!row) {
    return null;
  }

  return {
    employeeId: row.employeeId,
    staffNumber: row.staffNumber,
    firstName: row.firstName,
    lastName: row.lastName,
    fullName:
      `${row.firstName} ${row.lastName}`.trim(),

    dateOfBirth: row.dateOfBirth,
    gender: row.gender,
    nationality: row.nationality,
    maritalStatus: row.maritalStatus,

    primaryPhone: row.primaryPhone,
    alternativePhone:
      row.alternativePhone,
    personalEmail: row.personalEmail,
    residentialAddress:
      row.residentialAddress,
    district: row.district,
    sector: row.sector,

    nationalIdMasked:
      maskIdentifier(
        row.nationalIdLastFour,
      ),

    hasNationalId:
      Boolean(row.nationalIdEncrypted),

    passportMasked:
      maskIdentifier(
        row.passportLastFour,
      ),

    hasPassport:
      Boolean(row.passportEncrypted),

    createdByUserId:
      row.createdByUserId,
    updatedByUserId:
      row.updatedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findEmployeeProfile(
  employeeId,
) {
  const result = await pool.query(
    `
      SELECT
        employees.id AS "employeeId",
        employees.staff_number
          AS "staffNumber",
        employees.first_name
          AS "firstName",
        employees.last_name
          AS "lastName",

        profiles.date_of_birth
          AS "dateOfBirth",
        profiles.gender,
        profiles.nationality,
        profiles.marital_status
          AS "maritalStatus",

        profiles.primary_phone
          AS "primaryPhone",
        profiles.alternative_phone
          AS "alternativePhone",
        profiles.personal_email
          AS "personalEmail",
        profiles.residential_address
          AS "residentialAddress",
        profiles.district,
        profiles.sector,

        profiles.national_id_encrypted
          AS "nationalIdEncrypted",
        profiles.national_id_last_four
          AS "nationalIdLastFour",

        profiles.passport_encrypted
          AS "passportEncrypted",
        profiles.passport_last_four
          AS "passportLastFour",

        profiles.created_by_user_id
          AS "createdByUserId",
        profiles.updated_by_user_id
          AS "updatedByUserId",
        profiles.created_at
          AS "createdAt",
        profiles.updated_at
          AS "updatedAt"

      FROM employees

      LEFT JOIN employee_profiles
        AS profiles
        ON profiles.employee_id =
          employees.id

      WHERE employees.id = $1
    `,
    [employeeId],
  );

  return toPublicProfile(
    result.rows[0],
  );
}

export async function saveEmployeeProfile(
  employeeId,
  submittedData,
  userId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const employeeResult =
      await client.query(
        `
          SELECT
            id,
            staff_number AS "staffNumber",
            first_name AS "firstName",
            last_name AS "lastName"
          FROM employees
          WHERE id = $1
          FOR UPDATE
        `,
        [employeeId],
      );

    if (!employeeResult.rows[0]) {
      throw createServiceError(
        "Employee not found",
        404,
      );
    }

    const profileResult =
      await client.query(
        `
          SELECT
            employee_id AS "employeeId",
            date_of_birth AS "dateOfBirth",
            gender,
            nationality,
            marital_status
              AS "maritalStatus",
            primary_phone
              AS "primaryPhone",
            alternative_phone
              AS "alternativePhone",
            personal_email
              AS "personalEmail",
            residential_address
              AS "residentialAddress",
            district,
            sector,

            national_id_encrypted
              AS "nationalIdEncrypted",
            national_id_iv
              AS "nationalIdIv",
            national_id_auth_tag
              AS "nationalIdAuthTag",
            national_id_hash
              AS "nationalIdHash",
            national_id_last_four
              AS "nationalIdLastFour",

            passport_encrypted
              AS "passportEncrypted",
            passport_iv AS "passportIv",
            passport_auth_tag
              AS "passportAuthTag",
            passport_hash
              AS "passportHash",
            passport_last_four
              AS "passportLastFour",

            created_by_user_id
              AS "createdByUserId"

          FROM employee_profiles
          WHERE employee_id = $1
          FOR UPDATE
        `,
        [employeeId],
      );

    const existingProfile =
      profileResult.rows[0] || null;

    const nationalId =
      resolveIdentifier(
        submittedData.nationalId,
        existingProfile,
        "nationalId",
      );

    const passport =
      resolveIdentifier(
        submittedData.passportNumber,
        existingProfile,
        "passport",
      );

    const value = (
      fieldName,
      fallback = null,
    ) =>
      submittedData[fieldName] !==
      undefined
        ? submittedData[fieldName]
        : existingProfile?.[fieldName] ??
          fallback;

    const result = await client.query(
      `
        INSERT INTO employee_profiles (
          employee_id,
          date_of_birth,
          gender,
          nationality,
          marital_status,
          primary_phone,
          alternative_phone,
          personal_email,
          residential_address,
          district,
          sector,

          national_id_encrypted,
          national_id_iv,
          national_id_auth_tag,
          national_id_hash,
          national_id_last_four,

          passport_encrypted,
          passport_iv,
          passport_auth_tag,
          passport_hash,
          passport_last_four,

          created_by_user_id,
          updated_by_user_id
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20,
          $21, $22, $23
        )

        ON CONFLICT (employee_id)
        DO UPDATE SET
          date_of_birth =
            EXCLUDED.date_of_birth,
          gender = EXCLUDED.gender,
          nationality =
            EXCLUDED.nationality,
          marital_status =
            EXCLUDED.marital_status,
          primary_phone =
            EXCLUDED.primary_phone,
          alternative_phone =
            EXCLUDED.alternative_phone,
          personal_email =
            EXCLUDED.personal_email,
          residential_address =
            EXCLUDED.residential_address,
          district = EXCLUDED.district,
          sector = EXCLUDED.sector,

          national_id_encrypted =
            EXCLUDED.national_id_encrypted,
          national_id_iv =
            EXCLUDED.national_id_iv,
          national_id_auth_tag =
            EXCLUDED.national_id_auth_tag,
          national_id_hash =
            EXCLUDED.national_id_hash,
          national_id_last_four =
            EXCLUDED.national_id_last_four,

          passport_encrypted =
            EXCLUDED.passport_encrypted,
          passport_iv =
            EXCLUDED.passport_iv,
          passport_auth_tag =
            EXCLUDED.passport_auth_tag,
          passport_hash =
            EXCLUDED.passport_hash,
          passport_last_four =
            EXCLUDED.passport_last_four,

          updated_by_user_id =
            EXCLUDED.updated_by_user_id,
          updated_at =
            CURRENT_TIMESTAMP

        RETURNING
          employee_id AS "employeeId",
          date_of_birth AS "dateOfBirth",
          gender,
          nationality,
          marital_status
            AS "maritalStatus",
          primary_phone AS "primaryPhone",
          alternative_phone
            AS "alternativePhone",
          personal_email
            AS "personalEmail",
          residential_address
            AS "residentialAddress",
          district,
          sector,

          national_id_encrypted
            AS "nationalIdEncrypted",
          national_id_last_four
            AS "nationalIdLastFour",

          passport_encrypted
            AS "passportEncrypted",
          passport_last_four
            AS "passportLastFour",

          created_by_user_id
            AS "createdByUserId",
          updated_by_user_id
            AS "updatedByUserId",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        employeeId,
        value("dateOfBirth"),
        value("gender"),
        value("nationality", "Rwandan"),
        value("maritalStatus"),
        value("primaryPhone"),
        value("alternativePhone"),
        value("personalEmail"),
        value("residentialAddress"),
        value("district"),
        value("sector"),

        nationalId.encrypted,
        nationalId.initializationVector,
        nationalId.authenticationTag,
        nationalId.hash,
        nationalId.lastFour,

        passport.encrypted,
        passport.initializationVector,
        passport.authenticationTag,
        passport.hash,
        passport.lastFour,

        existingProfile?.createdByUserId ??
          userId,
        userId,
      ],
    );

    await client.query("COMMIT");

    const employee =
      employeeResult.rows[0];

    return toPublicProfile({
      ...result.rows[0],
      ...employee,
      employeeId,
    });
  } catch (error) {
    await client.query("ROLLBACK");

    if (
      error.code === "23505" &&
      error.constraint ===
        "employee_profiles_national_id_unique"
    ) {
      throw createServiceError(
        "This National ID is already assigned to another employee",
        409,
      );
    }

    if (
      error.code === "23505" &&
      error.constraint ===
        "employee_profiles_passport_unique"
    ) {
      throw createServiceError(
        "This passport number is already assigned to another employee",
        409,
      );
    }

    throw error;
  } finally {
    client.release();
  }
}