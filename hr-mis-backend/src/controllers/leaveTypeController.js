import {
  findAllLeaveTypes,
  findLeaveTypeById,
  insertLeaveType,
} from "../services/leaveTypeService.js";

export async function getAllLeaveTypes(
  request,
  response,
  next,
) {
  try {
    const leaveTypes = await findAllLeaveTypes();

    response.status(200).json({
      success: true,
      count: leaveTypes.length,
      data: leaveTypes,
    });
  } catch (error) {
    next(error);
  }
}

export async function getLeaveTypeById(
  request,
  response,
  next,
) {
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

export async function createLeaveType(
  request,
  response,
  next,
) {
  try {
    const {
      code,
      name,
      annualEntitlement = null,
      isPaid = true,
      requiresAttachment = false,
    } = request.body;

    if (!code?.trim() || !name?.trim()) {
      return response.status(400).json({
        success: false,
        message: "Leave type code and name are required",
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    if (!/^[A-Z][A-Z0-9_]*$/.test(normalizedCode)) {
      return response.status(400).json({
        success: false,
        message:
          "Code may contain only uppercase letters, numbers and underscores",
      });
    }

    if (
      annualEntitlement !== null &&
      (!Number.isInteger(annualEntitlement) ||
        annualEntitlement < 0)
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Annual entitlement must be a non-negative integer or null",
      });
    }

    if (
      typeof isPaid !== "boolean" ||
      typeof requiresAttachment !== "boolean"
    ) {
      return response.status(400).json({
        success: false,
        message:
          "isPaid and requiresAttachment must be boolean values",
      });
    }

    const leaveType = await insertLeaveType({
      code: normalizedCode,
      name: name.trim(),
      annualEntitlement,
      isPaid,
      requiresAttachment,
    });

    response.status(201).json({
      success: true,
      message: "Leave type created successfully",
      data: leaveType,
    });
  } catch (error) {
    if (error.code === "23505") {
      return response.status(409).json({
        success: false,
        message:
          "A leave type with this code or name already exists",
      });
    }

    next(error);
  }
}