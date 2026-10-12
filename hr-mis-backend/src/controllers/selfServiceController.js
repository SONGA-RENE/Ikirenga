import {
  findEmployeeLeaveBalances,
} from "../services/leaveRequestService.js";

import {
  findMyContracts,
  findMyEmployeeProfile,
  findMyLeaveRequests,
} from "../services/selfServiceService.js";

function getLinkedEmployeeId(request, response) {
  const employeeId = request.user.employeeId;

  if (!employeeId) {
    response.status(403).json({
      success: false,
      message:
        "Your user account is not linked to an employee record",
    });

    return null;
  }

  return employeeId;
}

export async function getMyProfile(
  request,
  response,
  next,
) {
  try {
    const employeeId = getLinkedEmployeeId(
      request,
      response,
    );

    if (!employeeId) {
      return;
    }

    const profile =
      await findMyEmployeeProfile(employeeId);

    if (!profile) {
      return response.status(404).json({
        success: false,
        message: "Employee profile not found",
      });
    }

   response.status(200).json({
      success: true,
      data: {
        ...profile,
        photoUrl: profile.photoFilename
          ? `/uploads/employees/${profile.photoFilename}`
          : null,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyContracts(
  request,
  response,
  next,
) {
  try {
    const employeeId = getLinkedEmployeeId(
      request,
      response,
    );

    if (!employeeId) {
      return;
    }

    const contracts = await findMyContracts(employeeId);

    response.status(200).json({
      success: true,
      count: contracts.length,
      data: contracts,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyLeaveRequests(
  request,
  response,
  next,
) {
  try {
    const employeeId = getLinkedEmployeeId(
      request,
      response,
    );

    if (!employeeId) {
      return;
    }

    const leaveRequests =
      await findMyLeaveRequests(employeeId);

    response.status(200).json({
      success: true,
      count: leaveRequests.length,
      data: leaveRequests,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyLeaveBalances(
  request,
  response,
  next,
) {
  try {
    const employeeId = getLinkedEmployeeId(
      request,
      response,
    );

    if (!employeeId) {
      return;
    }

    const year = Number(request.query.year);

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