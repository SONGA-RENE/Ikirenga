import {
  cancelMissionDisbursement,
  createMissionDisbursement,
  createMissionFundingItem,
  deleteMissionFundingItem,
  findMissionDisbursements,
  findMissionFundingPlan,
  markMissionDisbursementPaid,
  updateMissionFundingItem,
} from "../services/missionFinanceService.js";;

export async function addMissionFundingItem(
  request,
  response,
  next,
) {
  try {
    const missionId =
      Number(request.params.missionId);

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

    const fundingItem =
      await createMissionFundingItem({
        missionId,
        participantEmployeeId:
          request.body.participantEmployeeId,
        costCategory:
          request.body.costCategory,
        fundingSource:
          request.body.fundingSource,
        fundingOrganization:
          request.body.fundingOrganization,
        estimatedAmount:
          request.body.estimatedAmount,
        approvedAmount:
          request.body.approvedAmount,
        currency:
          request.body.currency,
        requiresReconciliation:
          request.body.requiresReconciliation,
        notes:
          request.body.notes,
        createdByUserId:
          request.user.id,
      });

    return response.status(201).json({
      success: true,
      message:
        "Mission funding item created successfully",
      data: fundingItem,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMissionFundingPlan(
  request,
  response,
  next,
) {
  try {
    const missionId =
      Number(request.params.missionId);

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

    const fundingPlan =
      await findMissionFundingPlan(missionId);

    if (!fundingPlan) {
      return response.status(404).json({
        success: false,
        message: "Mission not found",
      });
    }

    return response.status(200).json({
      success: true,
      data: fundingPlan,
    });
  } catch (error) {
    next(error);
  }
}

function readPositiveInteger(value) {
  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    return null;
  }

  return parsedValue;
}

export async function editMissionFundingItem(
  request,
  response,
  next,
) {
  try {
    const missionId = readPositiveInteger(
      request.params.missionId,
    );

    const fundingItemId =
      readPositiveInteger(
        request.params.fundingItemId,
      );

    if (!missionId || !fundingItemId) {
      return response.status(400).json({
        success: false,
        message:
          "Mission ID and funding item ID must be positive integers",
      });
    }

    const updatedItem =
      await updateMissionFundingItem({
        missionId,
        fundingItemId,

        participantEmployeeId:
          request.body.participantEmployeeId,

        costCategory:
          request.body.costCategory,

        fundingSource:
          request.body.fundingSource,

        fundingOrganization:
          request.body.fundingOrganization,

        estimatedAmount:
          request.body.estimatedAmount,

        approvedAmount:
          request.body.approvedAmount,

        currency:
          request.body.currency,

        requiresReconciliation:
          request.body.requiresReconciliation,

        notes:
          request.body.notes,

        updatedByUserId:
          request.user.id,
      });

    return response.status(200).json({
      success: true,
      message:
        "Mission funding item updated successfully",
      data: updatedItem,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeMissionFundingItem(
  request,
  response,
  next,
) {
  try {
    const missionId = readPositiveInteger(
      request.params.missionId,
    );

    const fundingItemId =
      readPositiveInteger(
        request.params.fundingItemId,
      );

    if (!missionId || !fundingItemId) {
      return response.status(400).json({
        success: false,
        message:
          "Mission ID and funding item ID must be positive integers",
      });
    }

    const deletedItem =
      await deleteMissionFundingItem({
        missionId,
        fundingItemId,
      });

    return response.status(200).json({
      success: true,
      message:
        "Mission funding item deleted successfully",
      data: deletedItem,
    });
  } catch (error) {
    next(error);
  }
}

export async function addMissionDisbursement(
  request,
  response,
  next,
) {
  try {
    const missionId = readPositiveInteger(
      request.params.missionId,
    );

    if (!missionId) {
      return response.status(400).json({
        success: false,
        message:
          "Mission ID must be a positive integer",
      });
    }

    const fundingItemId =
      readPositiveInteger(
        request.body.fundingItemId,
      );

    if (!fundingItemId) {
      return response.status(400).json({
        success: false,
        message:
          "Funding item ID must be a positive integer",
      });
    }

    const disbursement =
      await createMissionDisbursement({
        missionId,
        fundingItemId,

        participantEmployeeId:
          request.body.participantEmployeeId,

        paymentType:
          request.body.paymentType,

        amount:
          request.body.amount,

        paymentReference:
          request.body.paymentReference,

        notes:
          request.body.notes,

        createdByUserId:
          request.user.id,
      });

    return response.status(201).json({
      success: true,
      message:
        "Mission disbursement created successfully",
      data: disbursement,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMissionDisbursements(
  request,
  response,
  next,
) {
  try {
    const missionId = readPositiveInteger(
      request.params.missionId,
    );

    if (!missionId) {
      return response.status(400).json({
        success: false,
        message:
          "Mission ID must be a positive integer",
      });
    }

    const result =
      await findMissionDisbursements(
        missionId,
      );

    if (!result) {
      return response.status(404).json({
        success: false,
        message: "Mission not found",
      });
    }

    return response.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
export async function payMissionDisbursement(
  request,
  response,
  next,
) {
  try {
    const missionId = readPositiveInteger(
      request.params.missionId,
    );

    const disbursementId =
      readPositiveInteger(
        request.params.disbursementId,
      );

    if (!missionId || !disbursementId) {
      return response.status(400).json({
        success: false,
        message:
          "Mission ID and disbursement ID must be positive integers",
      });
    }

    const result =
      await markMissionDisbursementPaid({
        missionId,
        disbursementId,

        paymentReference:
          request.body.paymentReference,

        paidAt:
          request.body.paidAt,

        paidByUserId:
          request.user.id,
      });

    return response.status(200).json({
      success: true,
      message:
        "Mission disbursement marked as paid successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelDisbursement(
  request,
  response,
  next,
) {
  try {
    const missionId = readPositiveInteger(
      request.params.missionId,
    );

    const disbursementId =
      readPositiveInteger(
        request.params.disbursementId,
      );

    if (!missionId || !disbursementId) {
      return response.status(400).json({
        success: false,
        message:
          "Mission ID and disbursement ID must be positive integers",
      });
    }

    const result =
      await cancelMissionDisbursement({
        missionId,
        disbursementId,

        cancellationReason:
          request.body.cancellationReason,

        cancelledByUserId:
          request.user.id,
      });

    return response.status(200).json({
      success: true,
      message:
        "Mission disbursement cancelled successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}