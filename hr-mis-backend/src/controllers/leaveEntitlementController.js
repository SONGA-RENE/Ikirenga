import {
  findEmployeeLeaveBalances,
  grantLeaveEntitlement,
  generateAnnualEntitlements,
} from "../services/leaveEntitlementService.js";

function isValidISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
export async function createLeaveEntitlement(request, response, next) {
  try {
    const employeeId = Number(request.body.employeeId);

    const leaveTypeId = Number(request.body.leaveTypeId);

    const leaveYear = Number(request.body.leaveYear);

    const entitledDays = Number(request.body.entitledDays);

    const grantNote = request.body.grantNote?.trim();

    const availableFrom = request.body.availableFrom;

    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0 ||
      !Number.isInteger(leaveTypeId) ||
      leaveTypeId <= 0
    ) {
      return response.status(400).json({
        success: false,
        message: "Employee ID and leave type ID must be positive integers",
      });
    }

    if (!Number.isInteger(leaveYear) || leaveYear < 2000 || leaveYear > 2100) {
      return response.status(400).json({
        success: false,
        message: "Leave year must be between 2000 and 2100",
      });
    }

    if (!isValidISODate(availableFrom)) {
      return response.status(400).json({
        success: false,
        message: "Available-from date must use YYYY-MM-DD format",
      });
    }

    if (Number(availableFrom.slice(0, 4)) !== leaveYear) {
      return response.status(400).json({
        success: false,
        message: "Available-from date must fall within the entitlement year",
      });
    }

    if (!Number.isInteger(entitledDays) || entitledDays <= 0) {
      return response.status(400).json({
        success: false,
        message: "Entitled days must be a positive integer",
      });
    }

    if (!grantNote || grantNote.length < 5) {
      return response.status(400).json({
        success: false,
        message: "A grant note of at least 5 characters is required",
      });
    }

    const entitlement = await grantLeaveEntitlement(
      {
        employeeId,
        leaveTypeId,
        leaveYear,
        entitledDays,
        availableFrom,
        grantNote,
      },
      request.user.id,
    );

    return response.status(201).json({
      success: true,
      message: "Leave entitlement granted successfully",
      data: entitlement,
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
export async function getEmployeeLeaveBalances(request, response, next) {
  try {
    const employeeId = Number(request.params.employeeId);

    const year = Number(request.query.year);

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return response.status(400).json({
        success: false,
        message: "Employee ID must be a positive integer",
      });
    }

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return response.status(400).json({
        success: false,
        message: "A valid year between 2000 and 2100 is required",
      });
    }

    const result = await findEmployeeLeaveBalances(employeeId, year);

    return response.status(200).json({
      success: true,
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
export async function generateEmployeeAnnualEntitlements(
  request,
  response,
  next,
) {
  try {
    const asOfDate = request.body?.asOfDate || null;

    if (asOfDate && !isValidISODate(asOfDate)) {
      return response.status(400).json({
        success: false,
        message: "asOfDate must use YYYY-MM-DD format",
      });
    }

    const result = await generateAnnualEntitlements(asOfDate, request.user.id);

    return response.status(200).json({
      success: true,
      message: `${result.generatedCount} annual leave entitlement(s) generated`,
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
