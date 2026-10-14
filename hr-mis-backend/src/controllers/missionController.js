import {
  createMission,
  findMissionById,
  submitMission,
  decideMissionRequirement,
  findPendingMissionApprovals,
} from "../services/missionService.js";

export async function createMissionRequest(
  request,
  response,
  next,
) {
  try {
    const {
      title,
      purpose,
      destination,
      missionType = "LOCAL",
      startDate,
      endDate,
      transportDetails,
      accommodationDetails,
      estimatedTransportCost = 0,
      estimatedAccommodationCost = 0,
      estimatedOtherCost = 0,
      currency = "RWF",
      participants,
    } = request.body;

    if (
      !title?.trim() ||
      !purpose?.trim() ||
      !destination?.trim() ||
      !startDate ||
      !endDate
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Title, purpose, destination, start date and end date are required",
      });
    }

    if (
      !["LOCAL", "INTERNATIONAL"].includes(
        missionType,
      )
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Mission type must be LOCAL or INTERNATIONAL",
      });
    }

    if (
      new Date(endDate) < new Date(startDate)
    ) {
      return response.status(400).json({
        success: false,
        message:
          "End date cannot be earlier than start date",
      });
    }

    if (
      !Array.isArray(participants) ||
      participants.length === 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "At least one mission participant is required",
      });
    }

    for (const participant of participants) {
      if (
        !Number.isInteger(
          Number(participant.employeeId),
        ) ||
        Number(participant.employeeId) <= 0
      ) {
        return response.status(400).json({
          success: false,
          message:
            "Every participant must have a valid employee ID",
        });
      }

      if (
        !Number.isFinite(
          Number(participant.perDiemRate || 0),
        ) ||
        Number(participant.perDiemRate || 0) < 0
      ) {
        return response.status(400).json({
          success: false,
          message:
            "Per diem rate must be a valid non-negative number",
        });
      }
    }

    const costValues = [
      estimatedTransportCost,
      estimatedAccommodationCost,
      estimatedOtherCost,
    ];

    if (
      costValues.some(
        (value) =>
          !Number.isFinite(Number(value)) ||
          Number(value) < 0,
      )
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Estimated mission costs must be valid non-negative numbers",
      });
    }

    const createdByUserId =
      request.user.id;

    const mission = await createMission({
      title: title.trim(),
      purpose: purpose.trim(),
      destination: destination.trim(),
      missionType,
      startDate,
      endDate,
      transportDetails:
        transportDetails?.trim() || null,
      accommodationDetails:
        accommodationDetails?.trim() || null,
      estimatedTransportCost:
        Number(estimatedTransportCost),
      estimatedAccommodationCost:
        Number(estimatedAccommodationCost),
      estimatedOtherCost:
        Number(estimatedOtherCost),
      currency: currency.trim().toUpperCase(),
      participants: participants.map(
        (participant) => ({
          employeeId:
            Number(participant.employeeId),
          participantRole:
            participant.participantRole?.trim() ||
            null,
          perDiemRate:
            Number(participant.perDiemRate || 0),
        }),
      ),
      createdByUserId,
    });

    return response.status(201).json({
      success: true,
      message:
        "Draft mission created successfully",
      data: mission,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMissionById(
  request,
  response,
  next,
) {
  try {
    const missionId = Number(
      request.params.missionId,
    );

    if (
      !Number.isInteger(missionId) ||
      missionId <= 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Mission ID must be a positive integer",
      });
    }

      const mission =
      await findMissionById(
        missionId,
        request.user.id,
      );

      if (!mission) {
        return response.status(404).json({
          success: false,
          message:
            "Mission not found or you do not have access",
        });
      }

    return response.status(200).json({
      success: true,
      data: mission,
    });
  } catch (error) {
    next(error);
  }
}

export async function submitMissionRequest(
  request,
  response,
  next,
) {
  try {
    const missionId = Number(
      request.params.missionId,
    );

    if (
      !Number.isInteger(missionId) ||
      missionId <= 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Mission ID must be a positive integer",
      });
    }

    const mission = await submitMission({
      missionId,
      submittedByUserId: request.user.id,
      submittedByRole: request.user.role,
    });

    return response.status(200).json({
      success: true,
      message:
        "Mission submitted successfully",
      data: mission,
    });
  } catch (error) {
    next(error);
  }
}

export async function decideMissionApproval(
  request,
  response,
  next,
) {
  try {
    const missionId = Number(
      request.params.missionId,
    );

    const requirementId = Number(
      request.params.requirementId,
    );

    if (
      !Number.isInteger(missionId) ||
      missionId <= 0 ||
      !Number.isInteger(requirementId) ||
      requirementId <= 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Mission ID and requirement ID must be positive integers",
      });
    }

    const decision =
      request.body.decision
        ?.trim()
        .toUpperCase();

    const result =
      await decideMissionRequirement({
        missionId,
        requirementId,
        decision,
        comment: request.body.comment,
        actionByUserId: request.user.id,
        actionByRole: request.user.role,
      });

    return response.status(200).json({
      success: true,
      message:
        decision === "REJECTED"
          ? "Mission rejected successfully"
          : "Approval requirement completed successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getPendingMissionApprovals(
  request,
  response,
  next,
) {
  try {
    const approvals =
      await findPendingMissionApprovals({
        userId: request.user.id,
      });

    return response.status(200).json({
      success: true,
      count: approvals.length,
      data: approvals,
    });
  } catch (error) {
    next(error);
  }
}
