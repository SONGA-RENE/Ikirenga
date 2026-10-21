import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import process from "node:process";
import pool from "../src/config/database.js";

const migrationsDirectory = path.resolve(
  "database",
  "migrations",
);

function calculateChecksum(content) {
  return crypto
    .createHash("sha256")
    .update(content)
    .digest("hex");
}

function removePsqlCommands(content) {
  return content
    .split(/\r?\n/)
    .filter((line) => {
      const trimmedLine = line.trim();

      return !(
        trimmedLine.startsWith("\\restrict") ||
        trimmedLine.startsWith("\\unrestrict")
      );
    })
    .join("\n");
}

async function getMigrationFiles() {
  const entries = await fs.readdir(
    migrationsDirectory,
    {
      withFileTypes: true,
    },
  );

  return entries
    .filter(
      (entry) =>
        entry.isFile() &&
        /^\d+_.*\.sql$/.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort();
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      id integer GENERATED ALWAYS AS IDENTITY
        PRIMARY KEY,

      filename varchar(255) NOT NULL UNIQUE,
      checksum varchar(64) NOT NULL,

      applied_at timestamp with time zone
        NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function loadMigration(filename) {
  const filePath = path.join(
    migrationsDirectory,
    filename,
  );

  const originalSql = await fs.readFile(
    filePath,
    "utf8",
  );

  return {
    filename,
    checksum: calculateChecksum(originalSql),
    sql: removePsqlCommands(originalSql),
  };
}

async function markExistingMigration(
  client,
  filename,
) {
  const migration = await loadMigration(filename);

  const existingResult = await client.query(
    `
      SELECT filename, checksum
      FROM public.schema_migrations
      WHERE filename = $1
    `,
    [filename],
  );

  const existingMigration =
    existingResult.rows[0];

  if (existingMigration) {
    if (
      existingMigration.checksum !==
      migration.checksum
    ) {
      throw new Error(
        `Migration ${filename} was modified after being registered`,
      );
    }

    console.log(
      `Migration already registered: ${filename}`,
    );

    return;
  }

  await client.query(
    `
      INSERT INTO public.schema_migrations (
        filename,
        checksum
      )
      VALUES ($1, $2)
    `,
    [
      migration.filename,
      migration.checksum,
    ],
  );

  console.log(
    `Registered existing migration: ${filename}`,
  );
}

async function applyPendingMigrations(client) {
  const migrationFiles =
    await getMigrationFiles();

  const appliedResult = await client.query(
    `
      SELECT filename, checksum
      FROM public.schema_migrations
      ORDER BY filename
    `,
  );

  const appliedMigrations = new Map(
    appliedResult.rows.map((migration) => [
      migration.filename,
      migration.checksum,
    ]),
  );

  let appliedCount = 0;

  for (const filename of migrationFiles) {
    const migration =
      await loadMigration(filename);

    const recordedChecksum =
      appliedMigrations.get(filename);

    if (recordedChecksum) {
      if (
        recordedChecksum !== migration.checksum
      ) {
        throw new Error(
          `Migration ${filename} has changed after being applied`,
        );
      }

      console.log(`Already applied: ${filename}`);
      continue;
    }

    console.log(`Applying: ${filename}`);

    try {
      await client.query("BEGIN");

      await client.query(migration.sql);

      await client.query(
        `
          INSERT INTO  public.schema_migrations(
            filename,
            checksum
          )
          VALUES ($1, $2)
        `,
        [
          migration.filename,
          migration.checksum,
        ],
      );

      await client.query("COMMIT");

      appliedCount += 1;

      console.log(`Applied successfully: ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  if (appliedCount === 0) {
    console.log("No pending migrations.");
  }
}

async function run() {
  const client = await pool.connect();

  try {
    await ensureMigrationTable(client);

    const argumentsList = process.argv.slice(2);

    if (argumentsList[0] === "--mark-existing") {
      const filename = argumentsList[1];

      if (!filename) {
        throw new Error(
          "Provide the migration filename to register",
        );
      }

      await markExistingMigration(
        client,
        filename,
      );

      return;
    }

    await applyPendingMigrations(client);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Migration failed:");
  console.error(error.message);
  process.exitCode = 1;
});