import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import pool from "../src/config/database.js";

const leaders = [
  {
    firstName: "Mugabo",
    lastName: "Charles",
    staffNumber: "TEMP-ADV-DIR-001",
    email: "mugabo.charles@temporary.ikirenga.local",
    position: "Director of Advocacy",
    department: "Advocacy",
    role: "DIRECTOR",
  },
  {
    firstName: "Karangwa",
    lastName: "Ephrem",
    staffNumber: "TEMP-OPS-DIR-001",
    email: "karangwa.ephrem@temporary.ikirenga.local",
    position: "Director of Operations",
    department: "Operations",
    role: "DIRECTOR",
  },
  {
    firstName: "Murekatete",
    lastName: "Clemence",
    staffNumber: "TEMP-IBI-DIR-001",
    email:
      "murekatete.clemence@temporary.ikirenga.local",
    position:
      "Director of Imanzi Business Institute",
    department: "Imanzi Business Institute",
    role: "DIRECTOR",
  },
  {
    firstName: "Uwacu",
    lastName: "Florent",
    staffNumber: "TEMP-BRC-DIR-001",
    email: "uwacu.florent@temporary.ikirenga.local",
    position:
      "Director of Business Research Center",
    department: "Business Research Center",
    role: "DIRECTOR",
  },
  {
    firstName: "Kaneza",
    lastName: "Natacha",
    staffNumber: "TEMP-ED-DIR-001",
    email: "kaneza.natacha@temporary.ikirenga.local",
    position: "Director of Entrepreneurs Desk",
    department: "Entrepreneurs Desk",
    role: "DIRECTOR",
  },
  {
    firstName: "Mutagoma",
    lastName: "Felix",
    staffNumber: "TEMP-HR-DIR-001",
    email: "mutagoma.felix@temporary.ikirenga.local",
    position: "Director of Human Resources",
    department: "Human Resources",
    role: "DIRECTOR",
  },
  {
    firstName: "Murebwayire",
    lastName: "Divine",
    staffNumber: "TEMP-FIN-DIR-001",
    email:
      "murebwayire.divine@temporary.ikirenga.local",
    position: "Director of Finance",
    department: "Finance",
    role: "DIRECTOR",
  },
  {
    firstName: "Gashugi",
    lastName: "Andre",
    staffNumber: "TEMP-DCEO-001",
    email: "gashugi.andre@temporary.ikirenga.local",
    position: "Deputy Chief Executive Officer",
    department: "CEO's Office",
    role: "DEPUTY_CEO",
  },
  {
    firstName: "Uwajeneza",
    lastName: "Clement",
    staffNumber: "TEMP-CEO-001",
    email:
      "uwajeneza.clement@temporary.ikirenga.local",
    position: "Chief Executive Officer",
    department: "CEO's Office",
    role: "CEO",
  },
];

function generateTemporaryPassword() {
  return `Tmp-${crypto
    .randomBytes(9)
    .toString("base64url")}!`;
}

const client = await pool.connect();

try {
  await client.query("BEGIN");

  const credentials = [];

  for (const leader of leaders) {
    const departmentResult = await client.query(
      `
        SELECT id
        FROM departments
        WHERE name = $1
          AND is_active = TRUE
      `,
      [leader.department],
    );

    const department =
      departmentResult.rows[0];

    if (!department) {
      throw new Error(
        `Organizational unit not found: ${leader.department}`,
      );
    }

    const positionResult = await client.query(
      `
        INSERT INTO positions (
          department_id,
          title,
          description
        )
        VALUES ($1, $2, $3)

        ON CONFLICT (
          department_id,
          title
        )
        DO UPDATE SET
          is_active = TRUE,
          updated_at = CURRENT_TIMESTAMP

        RETURNING id
      `,
      [
        department.id,
        leader.position,
        "Temporary leadership position setup",
      ],
    );

    const positionId =
      positionResult.rows[0].id;

    const employeeResult = await client.query(
      `
        INSERT INTO employees (
          staff_number,
          first_name,
          last_name,
          email,
          position_id
        )
        VALUES ($1, $2, $3, $4, $5)

        ON CONFLICT (staff_number)
        DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          email = EXCLUDED.email,
          position_id = EXCLUDED.position_id,
          is_active = TRUE,
          updated_at = CURRENT_TIMESTAMP

        RETURNING id
      `,
      [
        leader.staffNumber,
        leader.firstName,
        leader.lastName,
        leader.email,
        positionId,
      ],
    );

    const employeeId =
      employeeResult.rows[0].id;

    const temporaryPassword =
      generateTemporaryPassword();

    const passwordHash = await bcrypt.hash(
      temporaryPassword,
      12,
    );

    const userResult = await client.query(
      `
        INSERT INTO app_users (
          employee_id,
          full_name,
          email,
          password_hash,
          role,
          must_change_password
        )
        VALUES ($1, $2, $3, $4, $5, TRUE)

        ON CONFLICT (email)
        DO UPDATE SET
          employee_id = EXCLUDED.employee_id,
          full_name = EXCLUDED.full_name,
          password_hash = EXCLUDED.password_hash,
          role = EXCLUDED.role,
          is_active = TRUE,
          must_change_password = TRUE,
          auth_version =
            app_users.auth_version + 1,
          updated_at = CURRENT_TIMESTAMP

        RETURNING id
      `,
      [
        employeeId,
        `${leader.firstName} ${leader.lastName}`,
        leader.email,
        passwordHash,
        leader.role,
      ],
    );

    credentials.push({
      userId: userResult.rows[0].id,
      employeeId,
      name:
        `${leader.firstName} ${leader.lastName}`,
      email: leader.email,
      role: leader.role,
      temporaryPassword,
      department: leader.department,
    });
  }

  const chairmanPassword =
    generateTemporaryPassword();

  const chairmanPasswordHash =
    await bcrypt.hash(chairmanPassword, 12);

  const chairmanResult = await client.query(
    `
      INSERT INTO app_users (
        employee_id,
        full_name,
        email,
        password_hash,
        role,
        must_change_password
      )
      VALUES (
        NULL,
        'Twagirumukiza Francois',
        'twagirumukiza.francois@temporary.ikirenga.local',
        $1,
        'CHAIRMAN',
        TRUE
      )

      ON CONFLICT (email)
      DO UPDATE SET
        full_name = EXCLUDED.full_name,
        password_hash = EXCLUDED.password_hash,
        role = 'CHAIRMAN',
        is_active = TRUE,
        must_change_password = TRUE,
        auth_version =
          app_users.auth_version + 1,
        updated_at = CURRENT_TIMESTAMP

      RETURNING id
    `,
    [chairmanPasswordHash],
  );

  credentials.push({
    userId: chairmanResult.rows[0].id,
    employeeId: null,
    name: "Twagirumukiza Francois",
    email:
      "twagirumukiza.francois@temporary.ikirenga.local",
    role: "CHAIRMAN",
    temporaryPassword: chairmanPassword,
    department: null,
  });

  const directorAssignments = [
    {
      directorEmail:
        "mugabo.charles@temporary.ikirenga.local",
      departments: ["Advocacy"],
    },
    {
      directorEmail:
        "karangwa.ephrem@temporary.ikirenga.local",
      departments: [
        "Operations",
        "Information Technology",
      ],
    },
    {
      directorEmail:
        "murekatete.clemence@temporary.ikirenga.local",
      departments: ["Imanzi Business Institute"],
    },
    {
      directorEmail:
        "uwacu.florent@temporary.ikirenga.local",
      departments: ["Business Research Center"],
    },
    {
      directorEmail:
        "kaneza.natacha@temporary.ikirenga.local",
      departments: ["Entrepreneurs Desk"],
    },
    {
      directorEmail:
        "mutagoma.felix@temporary.ikirenga.local",
      departments: ["Human Resources"],
    },
    {
      directorEmail:
        "murebwayire.divine@temporary.ikirenga.local",
      departments: ["Finance"],
    },
  ];

  for (const assignment of directorAssignments) {
    const directorResult = await client.query(
      `
        SELECT id
        FROM app_users
        WHERE email = $1
          AND role = 'DIRECTOR'
          AND is_active = TRUE
      `,
      [assignment.directorEmail],
    );

    const directorUserId =
      directorResult.rows[0].id;

    for (
      const departmentName
      of assignment.departments
    ) {
      const departmentResult =
        await client.query(
          `
            SELECT id
            FROM departments
            WHERE name = $1
          `,
          [departmentName],
        );

      const departmentId =
        departmentResult.rows[0].id;

      await client.query(
        `
          UPDATE department_directors
          SET
            is_active = FALSE,
            ended_at = CURRENT_TIMESTAMP
          WHERE department_id = $1
            AND is_active = TRUE
        `,
        [departmentId],
      );

      await client.query(
        `
          INSERT INTO department_directors (
            department_id,
            director_user_id
          )
          VALUES ($1, $2)
        `,
        [
          departmentId,
          directorUserId,
        ],
      );
    }
  }

  await client.query("COMMIT");

  console.table(credentials);

  console.log(
    "Temporary leadership setup completed.",
  );

  console.log(
    "Save these credentials securely. They will not be displayed again.",
  );
} catch (error) {
  await client.query("ROLLBACK");
  console.error(error);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}