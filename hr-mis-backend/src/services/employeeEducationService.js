import pool from "../config/database.js";

function createServiceError(
  message,
  statusCode,
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const returningFields = `
  id,
  employee_id AS "employeeId",
  education_level AS "educationLevel",
  institution_name AS "institutionName",
  qualification,
  field_of_study AS "fieldOfStudy",
  country,
  start_year AS "startYear",
  graduation_year AS "graduationYear",
  is_highest_qualification
    AS "isHighestQualification",
  notes,
  is_active AS "isActive",
  created_by_user_id AS "createdByUserId",
  updated_by_user_id AS "updatedByUserId",
  archived_by_user_id AS "archivedByUserId",
  archived_at AS "archivedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export async function findEmployeeEducation(
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
    return null;
  }

  const educationResult =
    await pool.query(
      `
        SELECT
          ${returningFields}
        FROM employee_education_records
        WHERE employee_id = $1
          AND is_active = TRUE
        ORDER BY
          is_highest_qualification DESC,
          graduation_year DESC NULLS LAST,
          id DESC
      `,
      [employeeId],
    );

  return {
    ...employee,
    fullName:
      `${employee.firstName} ${employee.lastName}`,
    educationRecords:
      educationResult.rows,
  };
}

export async function createEducationRecord(
  employeeId,
  educationData,
  userId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const employeeResult =
      await client.query(
        `
          SELECT id
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

    if (
      educationData
        .isHighestQualification
    ) {
      await client.query(
        `
          UPDATE employee_education_records
          SET
            is_highest_qualification =
              FALSE,
            updated_by_user_id = $2,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE employee_id = $1
            AND is_highest_qualification =
              TRUE
            AND is_active = TRUE
        `,
        [employeeId, userId],
      );
    }

    const result = await client.query(
      `
        INSERT INTO employee_education_records (
          employee_id,
          education_level,
          institution_name,
          qualification,
          field_of_study,
          country,
          start_year,
          graduation_year,
          is_highest_qualification,
          notes,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $11
        )
        RETURNING
          ${returningFields}
      `,
      [
        employeeId,
        educationData.educationLevel,
        educationData.institutionName,
        educationData.qualification,
        educationData.fieldOfStudy,
        educationData.country,
        educationData.startYear,
        educationData.graduationYear,
        educationData
          .isHighestQualification,
        educationData.notes,
        userId,
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

export async function updateEducationRecord(
  employeeId,
  educationId,
  changes,
  userId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult =
      await client.query(
        `
          SELECT
            ${returningFields}
          FROM employee_education_records
          WHERE id = $1
            AND employee_id = $2
          FOR UPDATE
        `,
        [
          educationId,
          employeeId,
        ],
      );

    const current =
      currentResult.rows[0];

    if (!current) {
      throw createServiceError(
        "Education record not found",
        404,
      );
    }

    if (!current.isActive) {
      throw createServiceError(
        "Archived education records cannot be updated",
        409,
      );
    }

    const value = (field) =>
      changes[field] !== undefined
        ? changes[field]
        : current[field];

    const isHighestQualification =
      value("isHighestQualification");

    if (isHighestQualification) {
      await client.query(
        `
          UPDATE employee_education_records
          SET
            is_highest_qualification =
              FALSE,
            updated_by_user_id = $3,
            updated_at =
              CURRENT_TIMESTAMP
          WHERE employee_id = $1
            AND id <> $2
            AND is_highest_qualification =
              TRUE
            AND is_active = TRUE
        `,
        [
          employeeId,
          educationId,
          userId,
        ],
      );
    }

    const result = await client.query(
      `
        UPDATE employee_education_records
        SET
          education_level = $3,
          institution_name = $4,
          qualification = $5,
          field_of_study = $6,
          country = $7,
          start_year = $8,
          graduation_year = $9,
          is_highest_qualification = $10,
          notes = $11,
          updated_by_user_id = $12,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND employee_id = $2
        RETURNING
          ${returningFields}
      `,
      [
        educationId,
        employeeId,
        value("educationLevel"),
        value("institutionName"),
        value("qualification"),
        value("fieldOfStudy"),
        value("country"),
        value("startYear"),
        value("graduationYear"),
        isHighestQualification,
        value("notes"),
        userId,
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

export async function archiveEducationRecord(
  employeeId,
  educationId,
  userId,
) {
  const result = await pool.query(
    `
      UPDATE employee_education_records
      SET
        is_active = FALSE,
        is_highest_qualification =
          FALSE,
        archived_at =
          CURRENT_TIMESTAMP,
        archived_by_user_id = $3,
        updated_by_user_id = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND employee_id = $2
        AND is_active = TRUE
      RETURNING
        ${returningFields}
    `,
    [
      educationId,
      employeeId,
      userId,
    ],
  );

  return result.rows[0] || null;
}