import pool from "../config/database.js";

export async function findAllPublicHolidays(year = null) {
  const result = await pool.query(
    `
      SELECT
        id,
        name,
        holiday_date AS "holidayDate",
        description,
        created_at AS "createdAt"
      FROM public_holidays
      WHERE (
        $1::integer IS NULL
        OR EXTRACT(YEAR FROM holiday_date) = $1::integer
      )
      ORDER BY holiday_date ASC
    `,
    [year],
  );

  return result.rows;
}

export async function findPublicHolidayById(id) {
  const result = await pool.query(
    `
      SELECT
        id,
        name,
        holiday_date AS "holidayDate",
        description,
        created_at AS "createdAt"
      FROM public_holidays
      WHERE id = $1
    `,
    [id],
  );

  return result.rows[0];
}

export async function insertPublicHoliday(holiday) {
  const { name, holidayDate, description } = holiday;

  const result = await pool.query(
    `
      INSERT INTO public_holidays (
        name,
        holiday_date,
        description
      )
      VALUES ($1, $2, $3)
      RETURNING
        id,
        name,
        holiday_date AS "holidayDate",
        description,
        created_at AS "createdAt"
    `,
    [name, holidayDate, description],
  );

  return result.rows[0];
}