import pool from "../config/database.js";

export async function findAllPublicHolidays(year = null) {
  const result = await pool.query(
    `
      SELECT
        id,
        name,

        holiday_date
          AS "holidayDate",

        description,

        source,

        source_reference
          AS "sourceReference",

        base_holiday_date
          AS "baseHolidayDate",

        is_observed
          AS "isObserved",

        created_by_user_id
          AS "createdByUserId",

        created_at
          AS "createdAt"

      FROM public_holidays

      WHERE (
        $1::integer IS NULL
        OR EXTRACT(
          YEAR FROM holiday_date
        ) = $1::integer
      )

      ORDER BY
        holiday_date ASC,
        id ASC
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

        holiday_date
          AS "holidayDate",

        description,

        source,

        source_reference
          AS "sourceReference",

        base_holiday_date
          AS "baseHolidayDate",

        is_observed
          AS "isObserved",

        created_by_user_id
          AS "createdByUserId",

        created_at
          AS "createdAt"

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

export async function updateFuturePublicHoliday(id, holiday) {
  const { name, holidayDate, description } = holiday;

  const result = await pool.query(
    `
      UPDATE public_holidays
      SET
        name = $2,
        holiday_date = $3,
        description = $4
      WHERE id = $1

        -- The existing holiday must
        -- still be in the future.
        AND holiday_date >
          CURRENT_DATE

        -- It must not be moved into
        -- today or the past.
        AND $3::date >
          CURRENT_DATE

      RETURNING
        id,
        name,
        holiday_date
          AS "holidayDate",
        description,
        created_at
          AS "createdAt"
    `,
    [id, name, holidayDate, description],
  );

  return result.rows[0];
}

export async function deleteFuturePublicHoliday(id) {
  const result = await pool.query(
    `
      DELETE FROM public_holidays
      WHERE id = $1
        AND holiday_date >
          CURRENT_DATE
      RETURNING
        id,
        name,
        holiday_date
          AS "holidayDate",
        description,
        created_at
          AS "createdAt"
    `,
    [id],
  );

  return result.rows[0];
}

function createUTCDate(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day));
}

function addUTCDateDays(date, numberOfDays) {
  const result = new Date(date);

  result.setUTCDate(result.getUTCDate() + numberOfDays);

  return result;
}

function formatUTCDate(date) {
  return date.toISOString().slice(0, 10);
}

function isWeekend(date) {
  const day = date.getUTCDay();

  return day === 0 || day === 6;
}

function findGregorianEasterSunday(year) {
  // Gregorian computus algorithm.
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);

  const month = Math.floor((h + l - 7 * m + 114) / 31);

  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return createUTCDate(year, month, day);
}

function findFirstFridayOfAugust(year) {
  let date = createUTCDate(year, 8, 1);

  while (date.getUTCDay() !== 5) {
    date = addUTCDateDays(date, 1);
  }

  return date;
}

function buildRwandaStatutoryHolidays(year) {
  const easterSunday = findGregorianEasterSunday(year);

  const goodFriday = addUTCDateDays(easterSunday, -2);

  const easterMonday = addUTCDateDays(easterSunday, 1);

  return [
    {
      name: "New Year's Day",
      date: createUTCDate(year, 1, 1),
      description: "Rwanda statutory public holiday",
      mayBeObserved: true,
    },
    {
      name: "Day after New Year's Day",
      date: createUTCDate(year, 1, 2),
      description: "Rwanda statutory public holiday",
      mayBeObserved: true,
    },
    {
      name: "National Heroes Day",
      date: createUTCDate(year, 2, 1),
      description: "Rwanda statutory public holiday",
      mayBeObserved: true,
    },
    {
      name: "Good Friday",
      date: goodFriday,
      description: "Rwanda statutory public holiday",
      mayBeObserved: true,
    },
    {
      name: "Easter Monday",
      date: easterMonday,
      description: "Rwanda statutory public holiday",
      mayBeObserved: true,
    },
    {
      name: "Genocide Memorial Day",
      date: createUTCDate(year, 4, 7),
      description:
        "Rwanda statutory public holiday commemorating the 1994 Genocide against the Tutsi",
      mayBeObserved: false,
    },
    {
      name: "Labour Day",
      date: createUTCDate(year, 5, 1),
      description: "Rwanda statutory public holiday",
      mayBeObserved: true,
    },
    {
      name: "Independence Day",
      date: createUTCDate(year, 7, 1),
      description: "Rwanda statutory public holiday",
      mayBeObserved: true,
    },
    {
      name: "Liberation Day",
      date: createUTCDate(year, 7, 4),
      description: "Rwanda statutory public holiday",
      mayBeObserved: true,
    },
    {
      name: "Umuganura Day",
      date: findFirstFridayOfAugust(year),
      description:
        "Rwanda statutory public holiday observed on the first Friday of August",
      mayBeObserved: true,
    },
    {
      name: "Assumption Day",
      date: createUTCDate(year, 8, 15),
      description: "Rwanda statutory public holiday",
      mayBeObserved: true,
    },
    {
      name: "Christmas Day",
      date: createUTCDate(year, 12, 25),
      description: "Rwanda statutory public holiday",
      mayBeObserved: true,
    },
    {
      name: "Boxing Day",
      date: createUTCDate(year, 12, 26),
      description: "Rwanda statutory public holiday",
      mayBeObserved: true,
    },
  ];
}

function buildObservedHolidays(statutoryHolidays) {
  const observedHolidays = [];

  const occupiedDates = new Set(
    statutoryHolidays.map((holiday) => formatUTCDate(holiday.date)),
  );

  const processedWeekendDates = new Set();

  for (const holiday of statutoryHolidays) {
    const holidayDate = formatUTCDate(holiday.date);

    if (
      !holiday.mayBeObserved ||
      !isWeekend(holiday.date) ||
      processedWeekendDates.has(holidayDate)
    ) {
      continue;
    }

    const weekendGroup = [holiday];

    processedWeekendDates.add(holidayDate);

    /*
     * Consecutive statutory holidays falling on the same weekend,
     * such as Christmas and Boxing Day, receive one consolidated
     * observed working day.
     */
    let nextDate = addUTCDateDays(holiday.date, 1);

    while (isWeekend(nextDate)) {
      const matchingHoliday = statutoryHolidays.find(
        (candidate) =>
          formatUTCDate(candidate.date) === formatUTCDate(nextDate),
      );

      if (matchingHoliday?.mayBeObserved) {
        weekendGroup.push(matchingHoliday);

        processedWeekendDates.add(formatUTCDate(matchingHoliday.date));
      }

      nextDate = addUTCDateDays(nextDate, 1);
    }

    let observedDate = nextDate;

    while (
      isWeekend(observedDate) ||
      occupiedDates.has(formatUTCDate(observedDate))
    ) {
      observedDate = addUTCDateDays(observedDate, 1);
    }

    const observedName =
      weekendGroup.length === 1
        ? `${weekendGroup[0].name} — Observed`
        : `${weekendGroup.map((item) => item.name).join(" and ")} — Observed`;

    const baseHolidayDate =
      weekendGroup.length === 1
        ? formatUTCDate(weekendGroup[0].date)
        : formatUTCDate(weekendGroup[weekendGroup.length - 1].date);

    occupiedDates.add(formatUTCDate(observedDate));

    observedHolidays.push({
      name: observedName,
      holidayDate: formatUTCDate(observedDate),
      description:
        weekendGroup.length === 1
          ? `Observed working-day holiday for ${weekendGroup[0].name}`
          : `Consolidated observed working-day holiday for ${weekendGroup
              .map((item) => item.name)
              .join(" and ")}`,
      baseHolidayDate,
      isObserved: true,
    });
  }

  return observedHolidays;
}

function generateRwandaCalendarEntries(year) {
  const statutoryHolidays = buildRwandaStatutoryHolidays(year);

  const baseEntries = statutoryHolidays.map((holiday) => ({
    name: holiday.name,
    holidayDate: formatUTCDate(holiday.date),
    description: holiday.description,
    baseHolidayDate: null,
    isObserved: false,
  }));

  const observedEntries = buildObservedHolidays(statutoryHolidays);

  return [...baseEntries, ...observedEntries].sort((first, second) =>
    first.holidayDate.localeCompare(second.holidayDate),
  );
}

export async function generateRwandaPublicHolidayCalendar({
  year,
  dryRun,
  createdByUserId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    /*
     * This transaction-level lock prevents two administrators from
     * generating the same year simultaneously.
     */
    await client.query(
      `
        SELECT pg_advisory_xact_lock(
          $1::integer
        )
      `,
      [700000 + year],
    );

    const entries = generateRwandaCalendarEntries(year);

    const existingResult = await client.query(
      `
        SELECT
          id,
          name,
          holiday_date
            AS "holidayDate",
          description,
          source,
          source_reference
            AS "sourceReference",
          base_holiday_date
            AS "baseHolidayDate",
          is_observed
            AS "isObserved",
          created_at
            AS "createdAt"
        FROM public_holidays
        WHERE EXTRACT(
          YEAR FROM holiday_date
        ) = $1::integer
        ORDER BY holiday_date ASC
      `,
      [year],
    );

    const existingByDate = new Map(
      existingResult.rows.map((holiday) => [holiday.holidayDate, holiday]),
    );

    const pendingEntries = [];

    const skipped = [];

    for (const entry of entries) {
      const existingHoliday = existingByDate.get(entry.holidayDate);

      if (existingHoliday) {
        skipped.push({
          proposed: entry,
          existing: existingHoliday,
          reason: "DATE_ALREADY_EXISTS",
        });

        continue;
      }

      pendingEntries.push(entry);
    }

    const requiresAnnouncement = [
      {
        name: "Eid al-Fitr",
        reason: "DATE_REQUIRES_OFFICIAL_ANNUAL_ANNOUNCEMENT",
      },
      {
        name: "Eid al-Adha",
        reason: "DATE_REQUIRES_OFFICIAL_ANNUAL_ANNOUNCEMENT",
      },
    ];

    if (dryRun) {
      await client.query("ROLLBACK");

      return {
        year,
        dryRun: true,
        proposedCount: entries.length,
        readyToGenerateCount: pendingEntries.length,
        skippedCount: skipped.length,
        generatedCount: 0,
        generated: [],
        proposed: pendingEntries,
        skipped,
        requiresAnnouncement,
      };
    }

    const generated = [];

    for (const entry of pendingEntries) {
      const insertResult = await client.query(
        `
          INSERT INTO public_holidays (
            name,
            holiday_date,
            description,
            source,
            source_reference,
            base_holiday_date,
            is_observed,
            created_by_user_id
          )
          VALUES (
            $1,
            $2,
            $3,
            'STATUTORY_GENERATION',
            $4,
            $5,
            $6,
            $7
          )
          ON CONFLICT (holiday_date)
          DO NOTHING
          RETURNING
            id,
            name,
            holiday_date
              AS "holidayDate",
            description,
            source,
            source_reference
              AS "sourceReference",
            base_holiday_date
              AS "baseHolidayDate",
            is_observed
              AS "isObserved",
            created_by_user_id
              AS "createdByUserId",
            created_at
              AS "createdAt"
        `,
        [
          entry.name,
          entry.holidayDate,
          entry.description,
          "Presidential Order No. 062/01 of 19 October 2022",
          entry.baseHolidayDate,
          entry.isObserved,
          createdByUserId,
        ],
      );

      if (insertResult.rows[0]) {
        generated.push(insertResult.rows[0]);
      } else {
        skipped.push({
          proposed: entry,
          existing: null,
          reason: "DATE_INSERTED_CONCURRENTLY",
        });
      }
    }

    await client.query("COMMIT");

    return {
      year,
      dryRun: false,
      proposedCount: entries.length,
      readyToGenerateCount: pendingEntries.length,
      generatedCount: generated.length,
      skippedCount: skipped.length,
      generated,
      proposed: [],
      skipped,
      requiresAnnouncement,
    };
  } catch (error) {
    await client.query("ROLLBACK");

    throw error;
  } finally {
    client.release();
  }
}
