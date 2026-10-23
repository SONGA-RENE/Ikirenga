import {
  assignEmployeePosition,
  endTemporaryAssignment,
  findEmployeePositionHistory,
} from "../services/employeePositionAssignmentService.js";

function parsePositiveInteger(value) {
  const number = Number(value);

  return Number.isInteger(number) &&
    number > 0
    ? number
    : null;
}

function isValidDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00Z`,
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) ===
      value
  );
}

function currentDateString() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Africa/Kigali",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).format(new Date());
}

export async function createPositionAssignment(
  request,
  response,
  next,
) {
  try {
    const employeeId =
      parsePositiveInteger(
        request.params.employeeId,
      );

    const positionId =
      parsePositiveInteger(
        request.body.positionId,
      );

    const assignmentType =
      request.body.assignmentType
        ?.trim()
        .toUpperCase();

    const allowedTypes = [
      "SUBSTANTIVE",
      "ACTING",
      "INTERIM",
    ];

    if (!employeeId || !positionId) {
      return response.status(400).json({
        success: false,
        message:
          "Employee ID and positionId must be positive integers",
      });
    }

    if (
      !allowedTypes.includes(
        assignmentType,
      )
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Assignment type must be SUBSTANTIVE, ACTING or INTERIM",
      });
    }

    const startDate =
      request.body.startDate ||
      currentDateString();

    if (!isValidDate(startDate)) {
      return response.status(400).json({
        success: false,
        message:
          "startDate must use YYYY-MM-DD format",
      });
    }

    const today = currentDateString();

    if (startDate > today) {
      return response.status(400).json({
        success: false,
        message:
          "Future assignments are not supported yet",
      });
    }

    let expectedEndDate = null;

    if (
      request.body.expectedEndDate != null
    ) {
      if (
        !isValidDate(
          request.body.expectedEndDate,
        )
      ) {
        return response.status(400).json({
          success: false,
          message:
            "expectedEndDate must use YYYY-MM-DD format",
        });
      }

      if (
        request.body.expectedEndDate <
        startDate
      ) {
        return response.status(400).json({
          success: false,
          message:
            "expectedEndDate cannot be before startDate",
        });
      }

      expectedEndDate =
        request.body.expectedEndDate;
    }

    if (
      assignmentType === "SUBSTANTIVE" &&
      expectedEndDate
    ) {
      return response.status(400).json({
        success: false,
        message:
          "A substantive assignment cannot have an expected end date",
      });
    }

    const assignment =
      await assignEmployeePosition(
        employeeId,
        {
          positionId,
          assignmentType,
          startDate,
          expectedEndDate,
          assignmentNote:
            request.body.assignmentNote
              ?.trim() || null,
        },
        request.user.id,
      );

      return response.status(201).json({
      success: true,
      message:
        assignmentType === "SUBSTANTIVE"
          ? "Employee transferred successfully"
          : `${assignmentType.charAt(0)}${assignmentType
              .slice(1)
              .toLowerCase()} assignment created successfully`,
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
}

export async function closeTemporaryAssignment(
  request,
  response,
  next,
) {
  try {
    const employeeId =
      parsePositiveInteger(
        request.params.employeeId,
      );

    const assignmentId =
      parsePositiveInteger(
        request.params.assignmentId,
      );

    if (!employeeId || !assignmentId) {
      return response.status(400).json({
        success: false,
        message:
          "Employee ID and assignment ID must be positive integers",
      });
    }

    const endDate =
      request.body.endDate ||
      currentDateString();

    if (!isValidDate(endDate)) {
      return response.status(400).json({
        success: false,
        message:
          "endDate must use YYYY-MM-DD format",
      });
    }

    const assignment =
      await endTemporaryAssignment(
        employeeId,
        assignmentId,
        {
          endDate,
          endNote:
            request.body.endNote
              ?.trim() || null,
        },
        request.user.id,
      );

    return response.status(200).json({
      success: true,
      message:
        "Temporary assignment ended successfully",
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
}

export async function getPositionAssignmentHistory(
  request,
  response,
  next,
) {
  try {
    const employeeId =
      parsePositiveInteger(
        request.params.employeeId,
      );

    if (!employeeId) {
      return response.status(400).json({
        success: false,
        message:
          "Employee ID must be a positive integer",
      });
    }

    const history =
      await findEmployeePositionHistory(
        employeeId,
      );

    if (!history) {
      return response.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    return response.status(200).json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
}

