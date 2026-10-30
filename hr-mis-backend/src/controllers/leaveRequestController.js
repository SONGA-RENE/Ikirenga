import {
  approveLeaveRequest,
  decideLeaveApprovalRequirement,
  findAllLeaveRequests,
  findLeaveRequestById,
  findLeaveWorkflowDetails,
  findPendingLeaveApprovalsForUser,
  insertLeaveRequest,
  rejectLeaveRequest,
  createLeaveCancellationRequest,
  decideLeaveCancellationRequest,
  findPendingLeaveCancellationsForUser,
  findEmployeeLeaveRequests,
  reportLeaveReturn,
  verifyLeaveReturn,
  correctLeaveReturn,
  rejectLeaveReturn,
  findPendingLeaveReturns,
  findEmployeesCurrentlyOnLeave,
} from "../services/leaveRequestService.js";

import { deleteUploadedLeaveAttachment } from "../middleware/leaveAttachmentUpload.js";

function isValidISODate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

const allowedReturnTypes = [
  "SCHEDULED_RETURN",
  "EMPLOYER_RECALL",
  "VOLUNTARY_EARLY_RETURN",
];

export async function getAllLeaveRequests(request, response, next) {
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

export async function getLeaveRequestById(request, response, next) {
  try {
    const id = Number(request.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return response.status(400).json({
        success: false,
        message: "Leave request ID must be a positive integer",
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

export async function createLeaveRequest(request, response, next) {
  let attachmentPersisted = false;

  function rejectRequest(statusCode, message) {
    deleteUploadedLeaveAttachment(request.file);

    return response.status(statusCode).json({
      success: false,
      message,
    });
  }

  try {
    const { leaveTypeId, startDate, endDate = null, reason } = request.body;

    /*
     * This is strictly a self-service
     * endpoint. Employee identity must come
     * from the authenticated account.
     */
    const authenticatedEmployeeId = Number(request.user.employeeId);

    const resolvedLeaveTypeId = Number(leaveTypeId);

    if (
      !Number.isInteger(authenticatedEmployeeId) ||
      authenticatedEmployeeId <= 0
    ) {
      return rejectRequest(
        403,
        "Your user account is not linked to an employee record",
      );
    }

    /*
     * Older clients may still submit their
     * own employeeId. Reject it only when it
     * attempts to identify another employee.
     */
    if (
      request.body.employeeId !== undefined &&
      Number(request.body.employeeId) !== authenticatedEmployeeId
    ) {
      return rejectRequest(
        403,
        "You cannot submit a leave request for another employee",
      );
    }

    if (!Number.isInteger(resolvedLeaveTypeId) || resolvedLeaveTypeId <= 0) {
      return rejectRequest(400, "Leave type ID must be a positive integer");
    }

    if (!isValidISODate(startDate)) {
      return rejectRequest(400, "Start date must use YYYY-MM-DD format");
    }

    if (endDate && !isValidISODate(endDate)) {
      return rejectRequest(400, "End date must use YYYY-MM-DD format");
    }

    if (endDate && endDate < startDate) {
      return rejectRequest(
        400,
        "Leave end date cannot be before the start date",
      );
    }

    const normalizedReason = reason?.trim();

    if (!normalizedReason || normalizedReason.length < 5) {
      return rejectRequest(
        400,
        "Leave reason must contain at least 5 characters",
      );
    }

    const attachment = request.file
      ? {
          originalFilename: request.file.originalname,

          storedFilename: request.file.filename,

          mimeType: request.file.mimetype,

          fileSize: request.file.size,
        }
      : null;

    const result = await insertLeaveRequest(
      {
        employeeId: authenticatedEmployeeId,

        leaveTypeId: resolvedLeaveTypeId,

        startDate,

        endDate,

        reason: normalizedReason,

        attachment,
      },
      request.user.id,
    );

    /*
     * The service must return attachment
     * metadata after inserting it in the
     * database. If it does not, do not leave
     * the uploaded file orphaned.
     */
    if (request.file && !result.attachment) {
      const persistenceError = new Error(
        "The leave request attachment could not be recorded",
      );

      persistenceError.statusCode = 500;

      throw persistenceError;
    }

    attachmentPersisted = Boolean(result.attachment);

    return response.status(201).json({
      success: true,

      message: "Leave request submitted successfully",

      data: result.leaveRequest,

      attachment: result.attachment || null,

      workflow: {
        approvalRoute: result.leaveRequest.approvalRoute,

        currentStage: result.leaveRequest.currentStage,

        requirements: result.requirements,
      },
    });
  } catch (error) {
    /*
     * Delete the physical file only when it
     * has not been successfully recorded by
     * the service transaction.
     */
    if (!attachmentPersisted) {
      deleteUploadedLeaveAttachment(request.file);
    }

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
          "The employee already has an overlapping pending or approved leave request",
      });
    }

    next(error);
  }
}

export async function approveEmployeeLeaveRequest(request, response, next) {
  try {
    const requestId = Number(request.params.id);

    const decisionNote = request.body.decisionNote?.trim() || null;

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return response.status(400).json({
        success: false,
        message: "Leave request ID must be a positive integer",
      });
    }

    const result = await approveLeaveRequest(
      requestId,
      request.user.id,
      decisionNote,
    );

    return response.status(200).json({
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

export async function rejectEmployeeLeaveRequest(request, response, next) {
  try {
    const requestId = Number(request.params.id);

    const decisionNote = request.body.decisionNote?.trim();

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return response.status(400).json({
        success: false,
        message: "Leave request ID must be a positive integer",
      });
    }

    if (!decisionNote || decisionNote.length < 5) {
      return response.status(400).json({
        success: false,
        message: "A rejection note of at least 5 characters is required",
      });
    }

    const leaveRequest = await rejectLeaveRequest(
      requestId,
      request.user.id,
      decisionNote,
    );

    return response.status(200).json({
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
export async function decideLeaveRequirement(request, response, next) {
  try {
    const requestId = Number(request.params.requestId);

    const requirementId = Number(request.params.requirementId);

    const decision = request.body.decision?.trim().toUpperCase();

    const comment = request.body.comment?.trim() || null;

    if (
      !Number.isInteger(requestId) ||
      requestId <= 0 ||
      !Number.isInteger(requirementId) ||
      requirementId <= 0
    ) {
      return response.status(400).json({
        success: false,
        message: "Request ID and requirement ID must be positive integers",
      });
    }

    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return response.status(400).json({
        success: false,
        message: "Decision must be APPROVED or REJECTED",
      });
    }

    if (decision === "REJECTED" && (!comment || comment.length < 5)) {
      return response.status(400).json({
        success: false,
        message: "A rejection comment of at least 5 characters is required",
      });
    }

    const result = await decideLeaveApprovalRequirement({
      requestId,
      requirementId,
      decision,
      comment,
      actionByUserId: request.user.id,
    });

    return response.status(200).json({
      success: true,
      message:
        decision === "APPROVED"
          ? result.isFinalApproval
            ? "Leave request approved successfully"
            : "Leave approval stage completed successfully"
          : "Leave request rejected successfully",
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
export async function getMyPendingLeaveApprovals(request, response, next) {
  try {
    const userId = Number(request.user.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return response.status(401).json({
        success: false,
        message: "Authenticated user information is invalid",
      });
    }

    const approvals = await findPendingLeaveApprovalsForUser(userId);

    return response.status(200).json({
      success: true,
      count: approvals.length,
      data: approvals,
    });
  } catch (error) {
    next(error);
  }
}
export async function getLeaveWorkflowDetails(request, response, next) {
  try {
    const requestId = Number(request.params.requestId);

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return response.status(400).json({
        success: false,
        message: "Leave request ID must be a positive integer",
      });
    }

    const details = await findLeaveWorkflowDetails(requestId, {
      userId: request.user.id,
      employeeId: request.user.employeeId,
      role: request.user.role,
    });

    return response.status(200).json({
      success: true,
      data: details,
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
export async function requestLeaveCancellation(request, response, next) {
  try {
    const leaveRequestId = Number(request.params.requestId);

    const cancellationReason = request.body.cancellationReason?.trim();

    if (!Number.isInteger(leaveRequestId) || leaveRequestId <= 0) {
      return response.status(400).json({
        success: false,
        message: "Leave request ID must be a positive integer",
      });
    }

    if (!cancellationReason || cancellationReason.length < 5) {
      return response.status(400).json({
        success: false,
        message: "Cancellation reason must contain at least 5 characters",
      });
    }

    const result = await createLeaveCancellationRequest({
      leaveRequestId,

      cancellationReason,

      requestedByUserId: request.user.id,

      requesterEmployeeId: request.user.employeeId,

      requesterRole: request.user.role,
    });

    return response.status(201).json({
      success: true,
      message: "Leave cancellation request submitted successfully",
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

export async function decideLeaveCancellation(request, response, next) {
  try {
    const leaveRequestId = Number(request.params.requestId);

    const cancellationId = Number(request.params.cancellationId);

    const decision = request.body.decision?.trim().toUpperCase();

    const decisionNote = request.body.decisionNote?.trim() || null;

    if (
      !Number.isInteger(leaveRequestId) ||
      leaveRequestId <= 0 ||
      !Number.isInteger(cancellationId) ||
      cancellationId <= 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Leave request ID and cancellation ID must be positive integers",
      });
    }

    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return response.status(400).json({
        success: false,
        message: "Decision must be APPROVED or REJECTED",
      });
    }

    if (decision === "REJECTED" && (!decisionNote || decisionNote.length < 5)) {
      return response.status(400).json({
        success: false,
        message: "A rejection note of at least 5 characters is required",
      });
    }

    const result = await decideLeaveCancellationRequest({
      leaveRequestId,
      cancellationId,
      decision,
      decisionNote,
      decidedByUserId: request.user.id,
    });

    return response.status(200).json({
      success: true,
      message:
        decision === "APPROVED"
          ? "Leave cancellation approved successfully"
          : "Leave cancellation rejected",
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
export async function getMyPendingLeaveCancellations(request, response, next) {
  try {
    const userId = Number(request.user.id);

    if (!Number.isInteger(userId) || userId <= 0) {
      return response.status(401).json({
        success: false,
        message: "Authenticated user information is invalid",
      });
    }

    const cancellations = await findPendingLeaveCancellationsForUser(userId);

    return response.status(200).json({
      success: true,
      count: cancellations.length,
      data: cancellations,
    });
  } catch (error) {
    next(error);
  }
}
export async function getMyLeaveRequests(request, response, next) {
  try {
    const employeeId = Number(request.user.employeeId);

    if (!Number.isInteger(employeeId) || employeeId <= 0) {
      return response.status(403).json({
        success: false,
        message: "Your account is not linked to an employee record",
      });
    }

    const status = request.query.status?.trim().toUpperCase() || null;

    const allowedStatuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"];

    if (status && !allowedStatuses.includes(status)) {
      return response.status(400).json({
        success: false,
        message: "Status must be PENDING, APPROVED, REJECTED or CANCELLED",
      });
    }

    const page = Number(request.query.page || 1);

    const requestedLimit = Number(request.query.limit || 20);

    if (
      !Number.isInteger(page) ||
      page <= 0 ||
      !Number.isInteger(requestedLimit) ||
      requestedLimit <= 0
    ) {
      return response.status(400).json({
        success: false,
        message: "Page and limit must be positive integers",
      });
    }

    const limit = Math.min(requestedLimit, 100);

    const offset = (page - 1) * limit;

    const result = await findEmployeeLeaveRequests({
      employeeId,
      status,
      limit,
      offset,
    });

    return response.status(200).json({
      success: true,
      count: result.requests.length,
      total: result.total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
      data: result.requests,
    });
  } catch (error) {
    next(error);
  }
}
export async function reportEmployeeLeaveReturn(request, response, next) {
  try {
    const requestId = Number(request.params.requestId);

    const returnType = request.body.returnType?.trim().toUpperCase();

    const actualReturnDate = request.body.actualReturnDate;

    const returnReason = request.body.returnReason?.trim() || null;

    if (!Number.isInteger(requestId) || requestId <= 0) {
      return response.status(400).json({
        success: false,
        message: "Leave request ID must be a positive integer",
      });
    }

    if (!allowedReturnTypes.includes(returnType)) {
      return response.status(400).json({
        success: false,
        message:
          "Return type must be SCHEDULED_RETURN, EMPLOYER_RECALL or VOLUNTARY_EARLY_RETURN",
      });
    }

    if (!isValidISODate(actualReturnDate)) {
      return response.status(400).json({
        success: false,
        message: "Actual return date must use YYYY-MM-DD format",
      });
    }

    if (
      returnType !== "SCHEDULED_RETURN" &&
      (!returnReason || returnReason.length < 5)
    ) {
      return response.status(400).json({
        success: false,
        message:
          "A return reason of at least 5 characters is required for an early return or recall",
      });
    }

    const returnRecord = await reportLeaveReturn(
      requestId,
      {
        returnType,
        actualReturnDate,
        returnReason,
      },
      request.user,
    );

    return response.status(201).json({
      success: true,
      message:
        "Return from leave reported successfully and is awaiting HR verification",
      data: returnRecord,
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
export async function verifyEmployeeLeaveReturn(request, response, next) {
  try {
    const requestId = Number(request.params.requestId);

    const returnRecordId = Number(request.params.returnRecordId);

    if (
      !Number.isInteger(requestId) ||
      requestId <= 0 ||
      !Number.isInteger(returnRecordId) ||
      returnRecordId <= 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Leave request ID and return record ID must be positive integers",
      });
    }

    const returnRecord = await verifyLeaveReturn(
      requestId,
      returnRecordId,
      request.user.id,
    );

    return response.status(200).json({
      success: true,
      message:
        "Return from leave verified and leave balance reconciled successfully",
      data: returnRecord,
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
export async function rejectEmployeeLeaveReturn(request, response, next) {
  try {
    const requestId = Number(request.params.requestId);

    const returnRecordId = Number(request.params.returnRecordId);

    const rejectionReason = request.body.rejectionReason?.trim();

    if (
      !Number.isInteger(requestId) ||
      requestId <= 0 ||
      !Number.isInteger(returnRecordId) ||
      returnRecordId <= 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Leave request ID and return record ID must be positive integers",
      });
    }

    if (!rejectionReason || rejectionReason.length < 5) {
      return response.status(400).json({
        success: false,
        message: "A rejection reason of at least 5 characters is required",
      });
    }

    const record = await rejectLeaveReturn(
      requestId,
      returnRecordId,
      rejectionReason,
      request.user.id,
    );

    return response.status(200).json({
      success: true,
      message: "Return report rejected and returned for correction",
      data: record,
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
export async function correctEmployeeLeaveReturn(request, response, next) {
  try {
    const requestId = Number(request.params.requestId);

    const returnRecordId = Number(request.params.returnRecordId);

    const returnType = request.body.returnType?.trim().toUpperCase();

    const actualReturnDate = request.body.actualReturnDate;

    const returnReason = request.body.returnReason?.trim() || null;

    if (
      !Number.isInteger(requestId) ||
      requestId <= 0 ||
      !Number.isInteger(returnRecordId) ||
      returnRecordId <= 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Leave request ID and return record ID must be positive integers",
      });
    }

    if (!allowedReturnTypes.includes(returnType)) {
      return response.status(400).json({
        success: false,
        message: "Invalid return type",
      });
    }

    if (!isValidISODate(actualReturnDate)) {
      return response.status(400).json({
        success: false,
        message: "Actual return date must use YYYY-MM-DD format",
      });
    }

    if (
      returnType !== "SCHEDULED_RETURN" &&
      (!returnReason || returnReason.length < 5)
    ) {
      return response.status(400).json({
        success: false,
        message: "A return reason of at least 5 characters is required",
      });
    }

    const result = await correctLeaveReturn(
      requestId,
      returnRecordId,
      {
        returnType,
        actualReturnDate,
        returnReason,
      },
      request.user,
    );

    return response.status(200).json({
      success: true,
      message: "Return report corrected and resubmitted for HR verification",
      data: {
        returnRecord: result.returnRecord,
        leaveRequest: result.leaveRequest,
      },
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
export async function getPendingLeaveReturns(request, response, next) {
  try {
    const returns = await findPendingLeaveReturns();

    return response.status(200).json({
      success: true,
      count: returns.length,
      data: returns,
    });
  } catch (error) {
    next(error);
  }
}
export async function getEmployeesCurrentlyOnLeave(request, response, next) {
  try {
    const employees = await findEmployeesCurrentlyOnLeave();

    const returningSoonCount = employees.filter(
      (employee) => employee.isReturningSoon,
    ).length;

    return response.status(200).json({
      success: true,

      count: employees.length,

      summary: {
        currentlyOnLeave: employees.length,
        returningSoon: returningSoonCount,
      },

      data: employees,
    });
  } catch (error) {
    next(error);
  }
}
