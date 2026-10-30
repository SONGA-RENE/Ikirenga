import {
  findAllLeaveTypes,
  findLeaveTypeById,
  insertLeaveType,
  updateLeaveTypeActiveStatus,
} from "../services/leaveTypeService.js";

export async function getAllLeaveTypes(request, response, next) {
  try {
    const activeOnly = request.query.activeOnly === "true";

    const leaveTypes = await findAllLeaveTypes({
      activeOnly,
    });

    return response.status(200).json({
      success: true,
      count: leaveTypes.length,
      data: leaveTypes,
    });
  } catch (error) {
    next(error);
  }
}

export async function getLeaveTypeById(request, response, next) {
  try {
    const id = Number(request.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return response.status(400).json({
        success: false,
        message: "Leave type ID must be a positive integer",
      });
    }

    const leaveType = await findLeaveTypeById(id);

    if (!leaveType) {
      return response.status(404).json({
        success: false,
        message: "Leave type not found",
      });
    }

    response.status(200).json({
      success: true,
      data: leaveType,
    });
  } catch (error) {
    next(error);
  }
}

export async function createLeaveType(request, response, next) {
  try {
    const {
      code,
      name,
      annualEntitlement = null,
      isPaid = true,
      requiresAttachment = false,
      entitlementMode,
      durationValue = null,
      durationUnit = null,
      eligibleGender = "ANY",
      carryForwardYears = 0,
    } = request.body;

    if (!code?.trim() || !name?.trim()) {
      return response.status(400).json({
        success: false,
        message: "Leave type code and name are required",
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    const normalizedMode = entitlementMode?.trim().toUpperCase();

    const normalizedDurationUnit = durationUnit?.trim().toUpperCase() || null;

    const normalizedGender = eligibleGender?.trim().toUpperCase();

    if (!/^[A-Z][A-Z0-9_]*$/.test(normalizedCode)) {
      return response.status(400).json({
        success: false,
        message:
          "Code may contain only uppercase letters, numbers and underscores",
      });
    }

    const allowedModes = ["ANNUAL_BUCKET", "FIXED_DURATION", "NO_BALANCE"];

    if (!allowedModes.includes(normalizedMode)) {
      return response.status(400).json({
        success: false,
        message:
          "Entitlement mode must be ANNUAL_BUCKET, FIXED_DURATION or NO_BALANCE",
      });
    }

    const allowedDurationUnits = [
      "WORKING_DAYS",
      "CALENDAR_DAYS",
      "CALENDAR_MONTHS",
      "REQUESTED_PERIOD",
    ];

    if (
      normalizedDurationUnit &&
      !allowedDurationUnits.includes(normalizedDurationUnit)
    ) {
      return response.status(400).json({
        success: false,
        message: "Invalid duration unit",
      });
    }

    if (!["ANY", "MALE", "FEMALE"].includes(normalizedGender)) {
      return response.status(400).json({
        success: false,
        message: "Eligible gender must be ANY, MALE or FEMALE",
      });
    }

    if (
      typeof isPaid !== "boolean" ||
      typeof requiresAttachment !== "boolean"
    ) {
      return response.status(400).json({
        success: false,
        message: "isPaid and requiresAttachment must be boolean values",
      });
    }

    if (!Number.isInteger(carryForwardYears) || carryForwardYears < 0) {
      return response.status(400).json({
        success: false,
        message: "Carry-forward years must be a non-negative integer",
      });
    }

    if (normalizedMode === "ANNUAL_BUCKET") {
      if (!Number.isInteger(annualEntitlement) || annualEntitlement <= 0) {
        return response.status(400).json({
          success: false,
          message: "Annual bucket leave requires a positive annual entitlement",
        });
      }

      if (normalizedDurationUnit !== "WORKING_DAYS") {
        return response.status(400).json({
          success: false,
          message: "Annual bucket leave must use WORKING_DAYS",
        });
      }
    }

    if (normalizedMode === "FIXED_DURATION") {
      if (
        !Number.isInteger(durationValue) ||
        durationValue <= 0 ||
        !normalizedDurationUnit ||
        normalizedDurationUnit === "REQUESTED_PERIOD"
      ) {
        return response.status(400).json({
          success: false,
          message:
            "Fixed-duration leave requires a positive duration and a fixed duration unit",
        });
      }
    }

    if (
      normalizedMode === "NO_BALANCE" &&
      normalizedDurationUnit !== "REQUESTED_PERIOD"
    ) {
      return response.status(400).json({
        success: false,
        message: "No-balance leave must use REQUESTED_PERIOD",
      });
    }

    const leaveType = await insertLeaveType({
      code: normalizedCode,
      name: name.trim(),
      annualEntitlement:
        normalizedMode === "ANNUAL_BUCKET" ? annualEntitlement : null,
      isPaid,
      requiresAttachment,
      entitlementMode: normalizedMode,
      durationValue: normalizedMode === "FIXED_DURATION" ? durationValue : null,
      durationUnit: normalizedDurationUnit,
      eligibleGender: normalizedGender,
      carryForwardYears:
        normalizedMode === "ANNUAL_BUCKET" ? carryForwardYears : 0,
    });

    return response.status(201).json({
      success: true,
      message: "Leave type created successfully",
      data: leaveType,
    });
  } catch (error) {
    if (error.code === "23505") {
      return response.status(409).json({
        success: false,
        message: "A leave type with this code or name already exists",
      });
    }

    if (error.code === "23514") {
      return response.status(400).json({
        success: false,
        message: "The leave type policy violates a database rule",
      });
    }

    next(error);
  }
}
export async function changeLeaveTypeStatus(request, response, next) {
  try {
    const id = Number(request.params.id);

    const { isActive } = request.body;

    if (!Number.isInteger(id) || id <= 0) {
      return response.status(400).json({
        success: false,
        message: "Leave type ID must be a positive integer",
      });
    }

    if (typeof isActive !== "boolean") {
      return response.status(400).json({
        success: false,
        message: "isActive must be a boolean value",
      });
    }

    const currentLeaveType = await findLeaveTypeById(id);

    if (!currentLeaveType) {
      return response.status(404).json({
        success: false,
        message: "Leave type not found",
      });
    }

    if (currentLeaveType.isActive === isActive) {
      return response.status(409).json({
        success: false,
        message: isActive
          ? "This leave type is already active"
          : "This leave type is already inactive",
      });
    }

    const leaveType = await updateLeaveTypeActiveStatus(id, isActive);

    return response.status(200).json({
      success: true,
      message: isActive
        ? "Leave type reactivated successfully"
        : "Leave type deactivated successfully",
      data: leaveType,
    });
  } catch (error) {
    next(error);
  }
}
