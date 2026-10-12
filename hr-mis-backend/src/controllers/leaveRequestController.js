import {
  approveLeaveRequest,
  findAllLeaveRequests,
  findEmployeeLeaveBalances,
  findLeaveRequestById,
  insertLeaveRequest,
  rejectLeaveRequest,
} from "../services/leaveRequestService.js";

function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export async function getAllLeaveRequests(
  request,
  response,
  next,
) {
  try {
    const leaveRequests = await findAllLeaveRequests();

    response.status(200).json({
      success: true,
      count: leaveRequests.length,
      data: leaveRequests,
    });
  } catch (error) {
    next(error);
  }
}

export async function getLeaveRequestById(
  request,
  response,
  next,
) {
  try {
    const id = Number(request.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return response.status(400).json({
        success: false,
        message:
          "Leave request ID must be a positive integer",
      });
    }

    const leaveRequest = await findLeaveRequestById(id);

    if (!leaveRequest) {
      return response.status(404).json({
        success: false,
        message: "Leave request not found",
      });
    }

    response.status(200).json({
      success: true,
      data: leaveRequest,
    });
  } catch (error) {
    next(error);
  }
}

export async function createLeaveRequest(
  request,
  response,
  next,
) {
  try {
    const {
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      reason,
    } = request.body;

    let resolvedEmployeeId = employeeId;

      if (request.user.role === "EMPLOYEE") {
        if (!request.user.employeeId) {
          return response.status(403).json({
            success: false,
            message:
              "Your account is not linked to an employee record",
          });
        }

        resolvedEmployeeId = request.user.employeeId;
      }

    if (
        !Number.isInteger(resolvedEmployeeId) ||
        resolvedEmployeeId <= 0 ||
        !Number.isInteger(leaveTypeId) ||
        leaveTypeId <= 0
      ) {
        return response.status(400).json({
          success: false,
          message:
            "Employee ID and leave type ID must be positive integers",
        });
      }

    if (
      !isValidISODate(startDate) ||
      !isValidISODate(endDate)
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Start and end dates must be valid YYYY-MM-DD dates",
      });
    }
    if (
    startDate.slice(0, 4) !== endDate.slice(0, 4)
    ) {
    return response.status(400).json({
        success: false,
        message:
        "A leave request cannot cross calendar years. Submit separate requests for each year.",
    });
    }

    if (endDate < startDate) {
      return response.status(400).json({
        success: false,
        message:
          "Leave end date cannot be before the start date",
      });
    }

    if (!reason?.trim() || reason.trim().length < 5) {
      return response.status(400).json({
        success: false,
        message:
          "Leave reason must contain at least 5 characters",
      });
    }

    const leaveRequest = await insertLeaveRequest({
      employeeId: resolvedEmployeeId,
      leaveTypeId,
      startDate,
      endDate,
      reason: reason.trim(),
    });

    response.status(201).json({
      success: true,
      message: "Leave request submitted successfully",
      data: leaveRequest,
    });
  } catch (error) {
    if (error.statusCode) {
      return response.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "23P01") {
      return response.status(409).json({
        success: false,
        message:
          "The employee already has an overlapping leave request",
      });
    }

    next(error);
  }
}

export async function approveEmployeeLeaveRequest(
  request,
  response,
  next,
) {
  try {
    const requestId = Number(request.params.id);
    const { decisionNote = null } = request.body;

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return response.status(400).json({
        success: false,
        message:
          "Leave request ID must be a positive integer",
      });
    }

    const leaveRequest = await rejectLeaveRequest(
      requestId,
      request.user.id,
      decisionNote.trim(),
    );

    response.status(200).json({
      success: true,
      message: "Leave request approved successfully",
      data: result.leaveRequest,
      balance: result.balance,
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

export async function rejectEmployeeLeaveRequest(
  request,
  response,
  next,
) {
  try {
    const requestId = Number(request.params.id);
    const { decisionNote } = request.body;

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return response.status(400).json({
        success: false,
        message:
          "Leave request ID must be a positive integer",
      });
    }

    if (
      !decisionNote?.trim() ||
      decisionNote.trim().length < 5
    ) {
      return response.status(400).json({
        success: false,
        message:
          "A rejection note of at least 5 characters is required",
      });
    }

    const leaveRequest = await rejectLeaveRequest(
      requestId,
      decisionNote.trim(),
    );

    response.status(200).json({
      success: true,
      message: "Leave request rejected successfully",
      data: leaveRequest,
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

export async function getEmployeeLeaveBalances(
  request,
  response,
  next,
) {
  try {
    const employeeId = Number(request.params.employeeId);
    const year = Number(request.query.year);

    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      return response.status(400).json({
        success: false,
        message: "Employee ID must be a positive integer",
      });
    }

    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100
    ) {
      return response.status(400).json({
        success: false,
        message:
          "A valid year between 2000 and 2100 is required",
      });
    }

    const balances = await findEmployeeLeaveBalances(
      employeeId,
      year,
    );

    response.status(200).json({
      success: true,
      employeeId,
      year,
      data: balances,
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