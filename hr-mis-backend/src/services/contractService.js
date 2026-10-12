import pool from "../config/database.js";

export async function findAllContracts() {
  await synchronizeContractStatuses();

  const result = await pool.query(`
    SELECT
      contracts.id,
      contracts.employee_id AS "employeeId",
      employees.staff_number AS "staffNumber",
      employees.first_name AS "firstName",
      employees.last_name AS "lastName",
      contracts.contract_type AS "contractType",
      contracts.start_date AS "startDate",
      contracts.end_date AS "endDate",
      contracts.status,
      contracts.created_at AS "createdAt"
    FROM contracts
    JOIN employees
      ON employees.id = contracts.employee_id
    ORDER BY contracts.id ASC
  `);

  return result.rows;
}

export async function findContractById(id) {
  await synchronizeContractStatuses();

  const result = await pool.query(
    `
      SELECT
        contracts.id,
        contracts.employee_id AS "employeeId",
        employees.staff_number AS "staffNumber",
        employees.first_name AS "firstName",
        employees.last_name AS "lastName",
        contracts.contract_type AS "contractType",
        contracts.start_date AS "startDate",
        contracts.end_date AS "endDate",
        contracts.status,
        contracts.created_at AS "createdAt"
      FROM contracts
      JOIN employees
        ON employees.id = contracts.employee_id
      WHERE contracts.id = $1
    `,
    [id],
  );

  return result.rows[0];
}

export async function insertContract(contract) {
  const { employeeId, contractType, startDate, endDate } = contract;

  const result = await pool.query(
    `
      INSERT INTO contracts (
        employee_id,
        contract_type,
        start_date,
        end_date,
        status
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        CASE
          WHEN $3::date > CURRENT_DATE THEN 'UPCOMING'
          WHEN $4::date IS NOT NULL
            AND $4::date < CURRENT_DATE THEN 'EXPIRED'
          ELSE 'ACTIVE'
        END
      )
      RETURNING
        id,
        employee_id AS "employeeId",
        contract_type AS "contractType",
        start_date AS "startDate",
        end_date AS "endDate",
        status,
        created_at AS "createdAt"
    `,
    [employeeId, contractType, startDate, endDate || null],
  );

  return result.rows[0];
}

export async function renewContract(
  contractId,
  { contractType, startDate, endDate },
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      `
        SELECT
          id,
          employee_id AS "employeeId",
          start_date AS "startDate",
          end_date AS "endDate",
          status,
          CASE
            WHEN end_date IS NOT NULL
            THEN (end_date + 1)::text
            ELSE NULL
          END AS "expectedRenewalStartDate"
        FROM contracts
        WHERE id = $1
        FOR UPDATE
      `,
      [contractId],
    );

    const existingContract = existingResult.rows[0];

    if (!existingContract) {
      const error = new Error("Contract not found");
      error.statusCode = 404;
      throw error;
    }

    if (existingContract.status !== "ACTIVE") {
      const error = new Error(
        "Only an active contract can be renewed",
      );
      error.statusCode = 409;
      throw error;
    }

    if (!existingContract.endDate) {
      const error = new Error(
        "A permanent contract cannot be renewed without an end date",
      );
      error.statusCode = 409;
      throw error;
    }

    if (
      startDate !== existingContract.expectedRenewalStartDate
    ) {
      const error = new Error(
        `The renewed contract must start on ${existingContract.expectedRenewalStartDate}`,
      );
      error.statusCode = 400;
      throw error;
    }

    const newContractResult = await client.query(
      `
        INSERT INTO contracts (
          employee_id,
          contract_type,
          start_date,
          end_date,
          status
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          CASE
            WHEN $3::date > CURRENT_DATE THEN 'UPCOMING'
            ELSE 'ACTIVE'
          END
        )
        RETURNING
          id,
          employee_id AS "employeeId",
          contract_type AS "contractType",
          start_date AS "startDate",
          end_date AS "endDate",
          status,
          created_at AS "createdAt"
      `,
      [
        existingContract.employeeId,
        contractType,
        startDate,
        endDate || null,
      ],
    );

    await client.query("COMMIT");

    return newContractResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function synchronizeContractStatuses(client = pool) {
  await client.query(`
    UPDATE contracts
    SET status =
      CASE
        WHEN start_date > CURRENT_DATE THEN 'UPCOMING'
        WHEN end_date IS NOT NULL
          AND end_date < CURRENT_DATE THEN 'EXPIRED'
        ELSE 'ACTIVE'
      END
   WHERE status NOT IN (
  'TERMINATED',
  'RENEWED',
  'CANCELLED'
)
  `);
}

export async function findOverlappingContract({
  employeeId,
  startDate,
  endDate,
}) {
  const result = await pool.query(
    `
      SELECT
        id,
        employee_id AS "employeeId",
        start_date AS "startDate",
        end_date AS "endDate",
        status
      FROM contracts
      WHERE employee_id = $1
        AND status IN ('UPCOMING', 'ACTIVE', 'EXPIRED')
        AND daterange(
          start_date,
          COALESCE(end_date, 'infinity'::date),
          '[]'
        ) && daterange(
          $2::date,
          COALESCE($3::date, 'infinity'::date),
          '[]'
        )
      LIMIT 1
    `,
    [employeeId, startDate, endDate || null],
  );

  return result.rows[0];
}
export async function terminateContract(
  contractId,
  terminationDate,
  terminationReason,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingResult = await client.query(
      `
        SELECT
          id,
          employee_id AS "employeeId",
          start_date AS "startDate",
          end_date AS "endDate",
          status,
          CURRENT_DATE::text AS "today"
        FROM contracts
        WHERE id = $1
        FOR UPDATE
      `,
      [contractId],
    );

    const contract = existingResult.rows[0];

    if (!contract) {
      const error = new Error("Contract not found");
      error.statusCode = 404;
      throw error;
    }

    if (contract.status !== "ACTIVE") {
      const error = new Error(
        "Only an active contract can be terminated",
      );
      error.statusCode = 409;
      throw error;
    }

    if (terminationDate < contract.startDate) {
      const error = new Error(
        "Termination date cannot be before the contract start date",
      );
      error.statusCode = 400;
      throw error;
    }

    if (
      contract.endDate &&
      terminationDate > contract.endDate
    ) {
      const error = new Error(
        "Termination date cannot be after the contract end date",
      );
      error.statusCode = 400;
      throw error;
    }

    if (terminationDate > contract.today) {
      const error = new Error(
        "Termination date cannot be in the future",
      );
      error.statusCode = 400;
      throw error;
    }

    const result = await client.query(
      `
        UPDATE contracts
        SET
          end_date = $2,
          termination_date = $2,
          termination_reason = $3,
          status = 'TERMINATED'
        WHERE id = $1
        RETURNING
          id,
          employee_id AS "employeeId",
          contract_type AS "contractType",
          start_date AS "startDate",
          end_date AS "endDate",
          status,
          termination_date AS "terminationDate",
          termination_reason AS "terminationReason",
          created_at AS "createdAt"
      `,
      [contractId, terminationDate, terminationReason],
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