import bcrypt from "bcryptjs";

import pool from "../config/database.js";
import { createAccessToken } from "./tokenService.js";

export async function authenticateUser(email, password) {
  const result = await pool.query(
  `
    SELECT
      id,
      employee_id AS "employeeId",
      full_name AS "fullName",
      email,
      password_hash AS "passwordHash",
      role,
      is_active AS "isActive",
      auth_version AS "authVersion"
    FROM app_users
    WHERE email = LOWER($1)
  `,
  [email],
);

  const user = result.rows[0];

  if (!user) {
    return null;
  }

  const passwordMatches = await bcrypt.compare(
    password,
    user.passwordHash,
  );

  if (!passwordMatches) {
    return null;
  }

  if (!user.isActive) {
    const error = new Error("This account is inactive");
    error.statusCode = 403;
    throw error;
  }

  await pool.query(
    `
      UPDATE app_users
      SET last_login_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `,
    [user.id],
  );

  const accessToken = createAccessToken(user);

  return {
    accessToken,
    user: {
      id: user.id,
      employeeId: user.employeeId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
    },
  };
}

export async function findUserById(id) {
  const result = await pool.query(
    `
      SELECT
        id,
        employee_id AS "employeeId",
        full_name AS "fullName",
        email,
        role,
        is_active AS "isActive",
        auth_version AS "authVersion",
        last_login_at AS "lastLoginAt",
        created_at AS "createdAt"
      FROM app_users
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0];
}

export async function createUser(userData) {
  const {
    employeeId,
    fullName,
    email,
    password,
    role,
  } = userData;

  if (employeeId !== null) {
    const employeeResult = await pool.query(
      `
        SELECT id
        FROM employees
        WHERE id = $1
      `,
      [employeeId],
    );

    if (!employeeResult.rows[0]) {
      const error = new Error("Employee not found");
      error.statusCode = 404;
      throw error;
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await pool.query(
    `
      INSERT INTO app_users (
        employee_id,
        full_name,
        email,
        password_hash,
        role
      )
      VALUES ($1, $2, LOWER($3), $4, $5)
      RETURNING
        id,
        employee_id AS "employeeId",
        full_name AS "fullName",
        email,
        role,
        is_active AS "isActive",
        created_at AS "createdAt"
    `,
    [
      employeeId,
      fullName,
      email,
      passwordHash,
      role,
    ],
  );

  return result.rows[0];
}

export async function changeUserPassword(
  userId,
  currentPassword,
  newPassword,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT
          id,
          password_hash AS "passwordHash"
        FROM app_users
        WHERE id = $1
          AND is_active = TRUE
        FOR UPDATE
      `,
      [userId],
    );

    const user = result.rows[0];

    if (!user) {
      const error = new Error(
        "Active user account not found",
      );
      error.statusCode = 404;
      throw error;
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

    if (!passwordMatches) {
      const error = new Error(
        "Current password is incorrect",
      );
      error.statusCode = 401;
      throw error;
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      user.passwordHash,
    );

    if (samePassword) {
      const error = new Error(
        "New password must be different from the current password",
      );
      error.statusCode = 400;
      throw error;
    }

    const newPasswordHash = await bcrypt.hash(
      newPassword,
      12,
    );

    await client.query(
      `
        UPDATE app_users
        SET
          password_hash = $2,
          auth_version = auth_version + 1,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [userId, newPasswordHash],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function revokeAllUserTokens(userId) {
  const result = await pool.query(
    `
      UPDATE app_users
      SET
        auth_version = auth_version + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND is_active = TRUE
      RETURNING id
    `,
    [userId],
  );

  if (!result.rows[0]) {
    const error = new Error(
      "Active user account not found",
    );
    error.statusCode = 404;
    throw error;
  }
}

