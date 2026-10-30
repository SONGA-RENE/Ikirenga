import {
  findAllPublicHolidays,
  findPublicHolidayById,
  generateRwandaPublicHolidayCalendar,
  insertPublicHoliday,
  updateFuturePublicHoliday,
  deleteFuturePublicHoliday,
} from "../services/publicHolidayService.js";

function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export async function getAllPublicHolidays(request, response, next) {
  try {
    const { year } = request.query;
    let parsedYear = null;

    if (year !== undefined) {
      parsedYear = Number(year);

      if (
        !Number.isInteger(parsedYear) ||
        parsedYear < 2000 ||
        parsedYear > 2100
      ) {
        return response.status(400).json({
          success: false,
          message: "Year must be between 2000 and 2100",
        });
      }
    }

    const holidays = await findAllPublicHolidays(parsedYear);

    response.status(200).json({
      success: true,
      count: holidays.length,
      data: holidays,
    });
  } catch (error) {
    next(error);
  }
}

export async function getPublicHolidayById(request, response, next) {
  try {
    const id = Number(request.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return response.status(400).json({
        success: false,
        message: "Holiday ID must be a positive integer",
      });
    }

    const holiday = await findPublicHolidayById(id);

    if (!holiday) {
      return response.status(404).json({
        success: false,
        message: "Public holiday not found",
      });
    }

    response.status(200).json({
      success: true,
      data: holiday,
    });
  } catch (error) {
    next(error);
  }
}

export async function createPublicHoliday(request, response, next) {
  try {
    const { name, holidayDate, description = null } = request.body;

    if (!name?.trim() || !holidayDate) {
      return response.status(400).json({
        success: false,
        message: "Holiday name and date are required",
      });
    }

    if (!isValidISODate(holidayDate)) {
      return response.status(400).json({
        success: false,
        message: "Holiday date must be a valid date in YYYY-MM-DD format",
      });
    }

    const holiday = await insertPublicHoliday({
      name: name.trim(),
      holidayDate,
      description: description?.trim() || null,
    });

    response.status(201).json({
      success: true,
      message: "Public holiday created successfully",
      data: holiday,
    });
  } catch (error) {
    if (error.code === "23505") {
      return response.status(409).json({
        success: false,
        message: "A public holiday already exists on this date",
      });
    }

    next(error);
  }
}

export async function updatePublicHoliday(request, response, next) {
  try {
    const id = Number(request.params.id);

    const { name, holidayDate, description = null } = request.body;

    if (!Number.isInteger(id) || id <= 0) {
      return response.status(400).json({
        success: false,
        message: "Holiday ID must be a positive integer",
      });
    }

    if (!name?.trim() || !holidayDate) {
      return response.status(400).json({
        success: false,
        message: "Holiday name and date are required",
      });
    }

    if (!isValidISODate(holidayDate)) {
      return response.status(400).json({
        success: false,
        message: "Holiday date must be a valid date in YYYY-MM-DD format",
      });
    }

    const existingHoliday = await findPublicHolidayById(id);

    if (!existingHoliday) {
      return response.status(404).json({
        success: false,
        message: "Public holiday not found",
      });
    }

    const holiday = await updateFuturePublicHoliday(id, {
      name: name.trim(),
      holidayDate,
      description: description?.trim() || null,
    });

    if (!holiday) {
      return response.status(409).json({
        success: false,
        message:
          "Only future public holidays may be changed, and the new date must also be in the future",
      });
    }

    return response.status(200).json({
      success: true,
      message: "Public holiday updated successfully",
      data: holiday,
    });
  } catch (error) {
    if (error.code === "23505") {
      return response.status(409).json({
        success: false,
        message: "A public holiday already exists on this date",
      });
    }

    next(error);
  }
}

export async function deletePublicHoliday(request, response, next) {
  try {
    const id = Number(request.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return response.status(400).json({
        success: false,
        message: "Holiday ID must be a positive integer",
      });
    }

    const existingHoliday = await findPublicHolidayById(id);

    if (!existingHoliday) {
      return response.status(404).json({
        success: false,
        message: "Public holiday not found",
      });
    }

    const deletedHoliday = await deleteFuturePublicHoliday(id);

    if (!deletedHoliday) {
      return response.status(409).json({
        success: false,
        message: "Historical or current public holidays cannot be deleted",
      });
    }

    return response.status(200).json({
      success: true,
      message: "Public holiday deleted successfully",
      data: deletedHoliday,
    });
  } catch (error) {
    next(error);
  }
}

export async function generateRwandaCalendar(request, response, next) {
  try {
    const year = Number(request.body?.year);

    const dryRun = request.body?.dryRun ?? true;

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return response.status(400).json({
        success: false,
        message: "Year must be between 2000 and 2100",
      });
    }

    if (typeof dryRun !== "boolean") {
      return response.status(400).json({
        success: false,
        message: "dryRun must be a boolean value",
      });
    }

    const result = await generateRwandaPublicHolidayCalendar({
      year,
      dryRun,
      createdByUserId: request.user.id,
    });

    return response.status(200).json({
      success: true,
      message: dryRun
        ? `Rwanda public holiday calendar preview prepared for ${year}`
        : `${result.generatedCount} Rwanda public holiday(s) generated for ${year}`,
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return response.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
}
