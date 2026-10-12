import bcrypt from "bcryptjs";

import pool from "../src/config/database.js";

async function createAdmin() {
  const fullName = process.env.ADMIN_NAME;
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!fullName || !email || !password) {
    throw new Error(
      "ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD are required",
    );
  }

  if (password.length < 12) {
    throw new Error(
      "Administrator password must contain at least 12 characters",
    );
  }

  if (bcrypt.truncates(password)) {
    throw new Error(
      "Administrator password exceeds bcrypt's 72-byte limit",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await pool.query(
    `
      INSERT INTO app_users (
        full_name,
        email,
        password_hash,
        role
      )
      VALUES ($1, $2, $3, 'ADMIN')
      RETURNING
        id,
        full_name AS "fullName",
        email,
        role
    `,
    [fullName, email, passwordHash],
  );

  console.log("Administrator created:", result.rows[0]);
}

try {
  await createAdmin();
} catch (error) {
  if (error.code === "23505") {
    console.error(
      "A user with this email address already exists",
    );
  } else {
    console.error(error.message);
  }

  process.exitCode = 1;
} finally {
  await pool.end();
}