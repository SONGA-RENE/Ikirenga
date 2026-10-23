import pool from "../config/database.js";

function createServiceError(
  message,
  statusCode,
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const contactReturningFields = `
  id,
  employee_id AS "employeeId",
  contact_type AS "contactType",
  full_name AS "fullName",
  relationship,
  phone_number AS "phoneNumber",
  alternative_phone AS "alternativePhone",
  email,
  address,
  is_primary AS "isPrimary",
  is_active AS "isActive",
  created_by_user_id AS "createdByUserId",
  updated_by_user_id AS "updatedByUserId",
  archived_by_user_id AS "archivedByUserId",
  archived_at AS "archivedAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export async function findEmployeeFamilyContacts(
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

  const contactResult = await pool.query(
    `
      SELECT
        ${contactReturningFields}
      FROM employee_family_contacts
      WHERE employee_id = $1
        AND is_active = TRUE
      ORDER BY
        is_primary DESC,
        contact_type,
        full_name
    `,
    [employeeId],
  );

  return {
    ...employee,
    fullName:
      `${employee.firstName} ${employee.lastName}`,
    contacts: contactResult.rows,
  };
}

export async function createFamilyContact(
  employeeId,
  contactData,
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

    if (contactData.isPrimary) {
      await client.query(
        `
          UPDATE employee_family_contacts
          SET
            is_primary = FALSE,
            updated_by_user_id = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE employee_id = $1
            AND is_primary = TRUE
            AND is_active = TRUE
        `,
        [employeeId, userId],
      );
    }

    const result = await client.query(
      `
        INSERT INTO employee_family_contacts (
          employee_id,
          contact_type,
          full_name,
          relationship,
          phone_number,
          alternative_phone,
          email,
          address,
          is_primary,
          created_by_user_id,
          updated_by_user_id
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $10
        )
        RETURNING
          ${contactReturningFields}
      `,
      [
        employeeId,
        contactData.contactType,
        contactData.fullName,
        contactData.relationship,
        contactData.phoneNumber,
        contactData.alternativePhone,
        contactData.email,
        contactData.address,
        contactData.isPrimary,
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

export async function updateFamilyContact(
  employeeId,
  contactId,
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
            ${contactReturningFields}
          FROM employee_family_contacts
          WHERE id = $1
            AND employee_id = $2
          FOR UPDATE
        `,
        [contactId, employeeId],
      );

    const current = currentResult.rows[0];

    if (!current) {
      throw createServiceError(
        "Family contact not found",
        404,
      );
    }

    if (!current.isActive) {
      throw createServiceError(
        "Archived family contacts cannot be updated",
        409,
      );
    }

    const value = (field) =>
      changes[field] !== undefined
        ? changes[field]
        : current[field];

    const isPrimary =
      value("isPrimary");

    if (isPrimary) {
      await client.query(
        `
          UPDATE employee_family_contacts
          SET
            is_primary = FALSE,
            updated_by_user_id = $3,
            updated_at = CURRENT_TIMESTAMP
          WHERE employee_id = $1
            AND id <> $2
            AND is_primary = TRUE
            AND is_active = TRUE
        `,
        [
          employeeId,
          contactId,
          userId,
        ],
      );
    }

    const result = await client.query(
      `
        UPDATE employee_family_contacts
        SET
          contact_type = $3,
          full_name = $4,
          relationship = $5,
          phone_number = $6,
          alternative_phone = $7,
          email = $8,
          address = $9,
          is_primary = $10,
          updated_by_user_id = $11,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
          AND employee_id = $2
        RETURNING
          ${contactReturningFields}
      `,
      [
        contactId,
        employeeId,
        value("contactType"),
        value("fullName"),
        value("relationship"),
        value("phoneNumber"),
        value("alternativePhone"),
        value("email"),
        value("address"),
        isPrimary,
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

export async function archiveFamilyContact(
  employeeId,
  contactId,
  userId,
) {
  const result = await pool.query(
    `
      UPDATE employee_family_contacts
      SET
        is_active = FALSE,
        is_primary = FALSE,
        archived_at = CURRENT_TIMESTAMP,
        archived_by_user_id = $3,
        updated_by_user_id = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND employee_id = $2
        AND is_active = TRUE
      RETURNING
        ${contactReturningFields}
    `,
    [
      contactId,
      employeeId,
      userId,
    ],
  );

  return result.rows[0] || null;
}