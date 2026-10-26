import {
  cancelEmployeeSeparation,
  completeEmployeeSeparation,
  confirmEmployeeSeparation,
  createEmployeeSeparation,
  findEmployeeSeparations,
} from "../services/employeeSeparationService.js";

const separationTypes = [
  "RESIGNATION",
  "CONTRACT_END",
  "TERMINATION",
  "RETIREMENT",
  "REDUNDANCY",
  "DEATH",
  "OTHER",
];

function positiveInteger(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0 ? number : null;
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsedDate = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === value
  );
}

export async function createSeparation(request, response, next) {
  try {
    const employeeId = positiveInteger(request.params.employeeId);

    const separationType = request.body.separationType?.trim().toUpperCase();

    const noticeReceivedDate = request.body.noticeReceivedDate || null;

    const noticeStartDate = request.body.noticeStartDate || null;

    const lastWorkingDate = request.body.lastWorkingDate;

    const reason = request.body.reason?.trim();

    if (!employeeId) {
      return response.status(400).json({
        success: false,
        message: "Employee ID must be a positive integer",
      });
    }

    if (!separationTypes.includes(separationType)) {
      return response.status(400).json({
        success: false,
        message:
          "Separation type must be one of: " + separationTypes.join(", "),
      });
    }

    if (
      !validDate(lastWorkingDate) ||
      (noticeReceivedDate && !validDate(noticeReceivedDate)) ||
      (noticeStartDate && !validDate(noticeStartDate))
    ) {
      return response.status(400).json({
        success: false,
        message: "Separation dates must use a valid YYYY-MM-DD format",
      });
    }

    if (separationType === "RESIGNATION" && !noticeReceivedDate) {
      return response.status(400).json({
        success: false,
        message: "Notice received date is required for a resignation",
      });
    }

    if (noticeStartDate && lastWorkingDate < noticeStartDate) {
      return response.status(400).json({
        success: false,
        message: "Last working date cannot be before the notice start date",
      });
    }

    if (
      noticeReceivedDate &&
      noticeStartDate &&
      noticeStartDate < noticeReceivedDate
    ) {
      return response.status(400).json({
        success: false,
        message: "Notice start date cannot be before the notice received date",
      });
    }

    if (!reason || reason.length < 5) {
      return response.status(400).json({
        success: false,
        message: "Separation reason must contain at least 5 characters",
      });
    }

    const separation = await createEmployeeSeparation(
      employeeId,
      {
        separationType,
        noticeReceivedDate,
        noticeStartDate,
        lastWorkingDate,
        reason,
      },
      request.user.id,
    );

    return response.status(201).json({
      success: true,
      message: "Employee separation recorded successfully",
      data: separation,
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

export async function confirmSeparation(request, response, next) {
  try {
    const employeeId = positiveInteger(request.params.employeeId);

    const separationId = positiveInteger(request.params.separationId);

    if (!employeeId || !separationId) {
      return response.status(400).json({
        success: false,
        message: "Employee ID and separation ID must be positive integers",
      });
    }

    const separation = await confirmEmployeeSeparation(
      employeeId,
      separationId,
      request.user.id,
    );

    return response.status(200).json({
      success: true,
      message: "Employee separation confirmed successfully",
      data: separation,
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

export async function cancelSeparation(request, response, next) {
  try {
    const employeeId = positiveInteger(request.params.employeeId);

    const separationId = positiveInteger(request.params.separationId);

    const cancellationReason = request.body.cancellationReason?.trim();

    if (!employeeId || !separationId) {
      return response.status(400).json({
        success: false,
        message: "Employee ID and separation ID must be positive integers",
      });
    }

    if (!cancellationReason || cancellationReason.length < 5) {
      return response.status(400).json({
        success: false,
        message: "Cancellation reason must contain at least 5 characters",
      });
    }

    const separation = await cancelEmployeeSeparation(
      employeeId,
      separationId,
      cancellationReason,
      request.user.id,
    );

    return response.status(200).json({
      success: true,
      message: "Employee separation cancelled successfully",
      data: separation,
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

export async function getEmployeeSeparations(request, response, next) {
  try {
    const employeeId = positiveInteger(request.params.employeeId);

    if (!employeeId) {
      return response.status(400).json({
        success: false,
        message: "Employee ID must be a positive integer",
      });
    }

    const separations = await findEmployeeSeparations(employeeId);

    return response.status(200).json({
      success: true,
      count: separations.length,
      data: separations,
    });
  } catch (error) {
    next(error);
  }
}

export async function completeSeparation(request, response, next) {
  try {
    const employeeId = positiveInteger(request.params.employeeId);

    const separationId = positiveInteger(request.params.separationId);

    if (!employeeId || !separationId) {
      return response.status(400).json({
        success: false,
        message: "Employee ID and separation ID must be positive integers",
      });
    }

    const result = await completeEmployeeSeparation(
      employeeId,
      separationId,
      request.user.id,
    );

    return response.status(200).json({
      success: true,
      message: "Employee separation completed successfully",
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return response.status(error.statusCode).json({
        success: false,
        message: error.message,

        ...(error.blockers
          ? {
              blockers: error.blockers,
            }
          : {}),
      });
    }

    next(error);
  }
}
