import {
  issueStaffCard,
  verifyStaffCard,
  revokeStaffCard,
  findEmployeeCardHistory,
  reactivateStaffCard,
} from "../services/staffCardManagementService.js";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function createStaffCard(
  request,
  response,
  next,
) {
  try {
    const employeeId = Number(request.params.employeeId);
    const { expiresAt } = request.body;

    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Employee ID must be a positive integer",
      });
    }

    if (
      typeof expiresAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(expiresAt)
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Expiry date is required in YYYY-MM-DD format",
      });
    }

    const card = await issueStaffCard({
      employeeId,
      expiresAt,
      createdByUserId: request.user.id,
    });

    return response.status(201).json({
      success: true,
      message: "Staff card issued successfully",
      data: card,
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

export async function checkStaffCard(
  request,
  response,
  next,
) {
  try {
    const { verificationToken } = request.params;

    if (!uuidPattern.test(verificationToken)) {
      return response.status(400).json({
        success: false,
        message: "Invalid verification token",
      });
    }

    const card = await verifyStaffCard(
      verificationToken,
    );

    if (!card) {
      return response.status(404).json({
        success: false,
        message: "Staff card not found",
      });
    }

    return response.status(200).json({
      success: true,
      data: card,
    });
  } catch (error) {
    next(error);
  }
}

const allowedRevocationTypes = [
  "LOST",
  "STOLEN",
  "DAMAGED",
  "TERMINATED",
  "OTHER",
];

export async function revokeEmployeeStaffCard(
  request,
  response,
  next,
) {
  try {
    const cardId = Number(
      request.params.cardId,
    );

    const {
      revocationType,
      reason,
    } = request.body;

    if (
      !Number.isInteger(cardId) ||
      cardId <= 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Card ID must be a positive integer",
      });
    }

    if (
      !allowedRevocationTypes.includes(
        revocationType,
      )
    ) {
      return response.status(400).json({
        success: false,
        message:
          `Revocation type must be one of: ${allowedRevocationTypes.join(", ")}`,
      });
    }

    if (
      typeof reason !== "string" ||
      reason.trim().length < 3
    ) {
      return response.status(400).json({
        success: false,
        message:
          "A meaningful revocation reason is required",
      });
    }

    if (reason.trim().length > 500) {
      return response.status(400).json({
        success: false,
        message:
          "Revocation reason must not exceed 500 characters",
      });
    }

    const card = await revokeStaffCard({
      cardId,
      revocationType,
      reason: reason.trim(),
      revokedByUserId: request.user.id,
    });

    return response.status(200).json({
      success: true,
      message:
        "Staff card revoked successfully",
      data: card,
    });
  } catch (error) {
    if (error.statusCode) {
      return response
        .status(error.statusCode)
        .json({
          success: false,
          message: error.message,
        });
    }

    next(error);
  }
}

export async function getEmployeeCardHistory(
  request,
  response,
  next,
) {
  try {
    const employeeId = Number(
      request.params.employeeId,
    );

    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Employee ID must be a positive integer",
      });
    }

    const result =
      await findEmployeeCardHistory(
        employeeId,
      );

    return response.status(200).json({
      success: true,
      employee: result.employee,
      count: result.cards.length,
      data: result.cards,
    });
  } catch (error) {
    if (error.statusCode) {
      return response
        .status(error.statusCode)
        .json({
          success: false,
          message: error.message,
        });
    }

    next(error);
  }
}

export async function reactivateEmployeeStaffCard(
  request,
  response,
  next,
) {
  try {
    const cardNumber =
      request.params.cardNumber?.trim();

    if (!cardNumber) {
      return response.status(400).json({
        success: false,
        message: "Card number is required",
      });
    }

    const card = await reactivateStaffCard(
      cardNumber,
    );

    return response.status(200).json({
      success: true,
      message:
        "Staff card reactivated successfully",
      data: card,
    });
  } catch (error) {
    next(error);
  }
}