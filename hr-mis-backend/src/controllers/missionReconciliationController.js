import {
  addReconciliationItem,
  createReconciliationDraft,
  decideReconciliation,
  deleteReconciliationItem,
  findPendingReconciliations,
  findReconciliationById,
  submitReconciliation,
  updateReconciliationItem,
} from "../services/missionReconciliationService.js";

function positiveInteger(value) {
  const result = Number(value);

  return Number.isInteger(result) &&
    result > 0
    ? result
    : null;
}

export async function createMissionReconciliation(
  request,
  response,
  next,
) {
  try {
    const missionId = positiveInteger(
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
      await createReconciliationDraft({
        missionId,
        currency: request.body.currency,
        declarationNote:
          request.body.declarationNote,
        userId: request.user.id,
      });

    return response.status(201).json({
      success: true,
      message:
        "Mission reconciliation draft created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function createReconciliationItem(
  request,
  response,
  next,
) {
  try {
    const missionId = positiveInteger(
      request.params.missionId,
    );

    const reconciliationId =
      positiveInteger(
        request.params.reconciliationId,
      );

    if (!missionId || !reconciliationId) {
      return response.status(400).json({
        success: false,
        message:
          "Mission ID and reconciliation ID must be positive integers",
      });
    }

    const result =
      await addReconciliationItem({
        missionId,
        reconciliationId,
        costCategory:
          request.body.costCategory,
        description:
          request.body.description,
        receiptExceptionReason:
          request.body.receiptExceptionReason,
        expenseDate:
          request.body.expenseDate,
        amount:
          request.body.amount,
        notes:
          request.body.notes,
        userId:
          request.user.id,
      });

    return response.status(201).json({
      success: true,
      message:
        "Reconciliation expense item created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getReconciliation(
  request,
  response,
  next,
) {
  try {
    const missionId = positiveInteger(
      request.params.missionId,
    );

    const reconciliationId =
      positiveInteger(
        request.params.reconciliationId,
      );

    if (!missionId || !reconciliationId) {
      return response.status(400).json({
        success: false,
        message:
          "Mission ID and reconciliation ID must be positive integers",
      });
    }

    const result =
      await findReconciliationById({
        missionId,
        reconciliationId,
        userId: request.user.id,
        userRole: request.user.role,
      });

    if (!result) {
      return response.status(404).json({
        success: false,
        message: "Reconciliation not found",
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

export async function submitMissionReconciliation(
  request,
  response,
  next,
) {
  try {
    const missionId = positiveInteger(
      request.params.missionId,
    );

    const reconciliationId =
      positiveInteger(
        request.params.reconciliationId,
      );

    if (!missionId || !reconciliationId) {
      return response.status(400).json({
        success: false,
        message:
          "Mission ID and reconciliation ID must be positive integers",
      });
    }

    const result =
      await submitReconciliation({
        missionId,
        reconciliationId,
        amountReturned:
          request.body.amountReturned,
        declarationNote:
          request.body.declarationNote,
        userId:
          request.user.id,
      });

    return response.status(200).json({
      success: true,
      message:
        "Mission reconciliation submitted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getPendingReconciliations(
  request,
  response,
  next,
) {
  try {
    const requestedPage =
      Number(request.query.page ?? 1);

    const requestedLimit =
      Number(request.query.limit ?? 10);

    const page =
      Number.isInteger(requestedPage) &&
      requestedPage > 0
        ? requestedPage
        : 1;

    const limit =
      Number.isInteger(requestedLimit) &&
      requestedLimit > 0 &&
      requestedLimit <= 100
        ? requestedLimit
        : 10;

    const result =
      await findPendingReconciliations({
        page,
        limit,
      });

    return response.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

export async function decideMissionReconciliation(
  request,
  response,
  next,
) {
  try {
    const missionId = positiveInteger(
      request.params.missionId,
    );

    const reconciliationId =
      positiveInteger(
        request.params.reconciliationId,
      );

    if (!missionId || !reconciliationId) {
      return response.status(400).json({
        success: false,
        message:
          "Mission ID and reconciliation ID must be positive integers",
      });
    }

    const result =
      await decideReconciliation({
        missionId,
        reconciliationId,
        decision:
          request.body.decision,
        comment:
          request.body.comment,
        actionByUserId:
          request.user.id,
      });

    const action =
      result.status === "VERIFIED"
        ? "verified"
        : "rejected";

    return response.status(200).json({
      success: true,
      message:
        `Mission reconciliation ${action} successfully`,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}
export async function editReconciliationItem(
  request,
  response,
  next,
) {
  try {
    const missionId = positiveInteger(
      request.params.missionId,
    );

    const reconciliationId =
      positiveInteger(
        request.params.reconciliationId,
      );

    const itemId = positiveInteger(
      request.params.itemId,
    );

    if (
      !missionId ||
      !reconciliationId ||
      !itemId
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Mission, reconciliation and item IDs must be positive integers",
      });
    }

    const result =
      await updateReconciliationItem({
        missionId,
        reconciliationId,
        itemId,
        costCategory:
          request.body.costCategory,
        description:
          request.body.description,
        expenseDate:
          request.body.expenseDate,
        receiptExceptionReason:
          request.body.receiptExceptionReason,
        amount:
          request.body.amount,
        notes:
          request.body.notes,
        userId:
          request.user.id,
      });

    return response.status(200).json({
      success: true,
      message:
        "Reconciliation expense item updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeReconciliationItem(
  request,
  response,
  next,
) {
  try {
    const missionId = positiveInteger(
      request.params.missionId,
    );

    const reconciliationId =
      positiveInteger(
        request.params.reconciliationId,
      );

    const itemId = positiveInteger(
      request.params.itemId,
    );

    if (
      !missionId ||
      !reconciliationId ||
      !itemId
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Mission, reconciliation and item IDs must be positive integers",
      });
    }

    const result =
      await deleteReconciliationItem({
        missionId,
        reconciliationId,
        itemId,
        userId:
          request.user.id,
      });

    return response.status(200).json({
      success: true,
      message:
        "Reconciliation expense item deleted successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
}