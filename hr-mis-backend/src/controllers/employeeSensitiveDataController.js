import {
  revealEmployeeIdentifier,
} from "../services/employeeSensitiveDataService.js";

function parsePositiveInteger(value) {
  const number = Number(value);

  return Number.isInteger(number) &&
    number > 0
    ? number
    : null;
}

export async function revealIdentifier(
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

    const identifierType =
      request.body.identifierType
        ?.trim()
        .toUpperCase();

    if (
      ![
        "NATIONAL_ID",
        "PASSPORT",
      ].includes(identifierType)
    ) {
      return response.status(400).json({
        success: false,
        message:
          "identifierType must be NATIONAL_ID or PASSPORT",
      });
    }

    if (
      typeof request.body.password !==
        "string" ||
      request.body.password.length === 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Your current password is required",
      });
    }

    const reason =
      request.body.reason?.trim();

    if (!reason || reason.length < 10) {
      return response.status(400).json({
        success: false,
        message:
          "Provide a clear access reason of at least 10 characters",
      });
    }

    if (reason.length > 500) {
      return response.status(400).json({
        success: false,
        message:
          "Access reason cannot exceed 500 characters",
      });
    }

    const result =
      await revealEmployeeIdentifier({
        employeeId,
        requestingUserId:
          request.user.id,
        identifierType,
        password:
          request.body.password,
        reason,
        ipAddress: request.ip || null,
        userAgent:
          request.get("user-agent") ||
          null,
      });

    response.set({
      "Cache-Control":
        "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
    });

    return response.status(200).json({
      success: true,
      message:
        "Sensitive identifier revealed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}