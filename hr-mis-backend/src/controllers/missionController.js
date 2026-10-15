import fs from "node:fs/promises";
import path from "node:path";

import {
  createMission,
  findMissionById,
  submitMission,
  decideMissionRequirement,
  findPendingMissionApprovals,
  completeMission,
  createMissionReportDraft,
  updateMissionReportDraft,
  submitMissionReport,
  findMyMissionReport,
  findMissionReportTracking,
  findMissionReportById,
  saveMissionReportDocument,
  findMyMissionReportDocuments,
  findAccessibleMissionDocument,
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

export async function completeMissionRequest(
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

    const completedByUserId = request.user.id;

    const mission = await completeMission(
      missionId,
      completedByUserId,
    );

    return response.status(200).json({
      success: true,
      message:
        "Mission completed successfully",
      data: mission,
    });
  } catch (error) {
    next(error);
  }
}
export async function createMyMissionReport(
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

    const report =
      await createMissionReportDraft(
        missionId,
        request.user.id,
        request.body,
      );

    return response.status(201).json({
      success: true,
      message:
        "Mission report draft created successfully",
      data: report,
    });
  } catch (error) {
    next(error);
  }
}
export async function updateMyMissionReport(
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

    const report =
      await updateMissionReportDraft(
        missionId,
        request.user.id,
        request.body,
      );

    return response.status(200).json({
      success: true,
      message:
        "Mission report draft updated successfully",
      data: report,
    });
  } catch (error) {
    next(error);
  }
}
export async function submitMyMissionReport(
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

    const report = await submitMissionReport(
      missionId,
      request.user.id,
    );

    return response.status(200).json({
      success: true,
      message:
        "Mission report submitted successfully",
      data: report,
    });
  } catch (error) {
    next(error);
  }
}
export async function getMyMissionReport(
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

    const report = await findMyMissionReport(
      missionId,
      request.user.id,
    );

    if (!report) {
      return response.status(404).json({
        success: false,
        message:
          "Mission report not found for the current user",
      });
    }

    return response.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}
export async function getMissionReportTracking(
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

    const tracking =
      await findMissionReportTracking(
        missionId,
      );

    if (!tracking) {
      return response.status(404).json({
        success: false,
        message: "Mission not found",
      });
    }

    return response.status(200).json({
      success: true,
      data: tracking,
    });
  } catch (error) {
    next(error);
  }
}
export async function getMissionReportById(
  request,
  response,
  next,
) {
  try {
    const missionId = Number(
      request.params.missionId,
    );

    const reportId = Number(
      request.params.reportId,
    );

    if (
      !Number.isInteger(missionId) ||
      missionId <= 0 ||
      !Number.isInteger(reportId) ||
      reportId <= 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Mission ID and report ID must be positive integers",
      });
    }

    const report = await findMissionReportById(
      missionId,
      reportId,
    );

    if (!report) {
      return response.status(404).json({
        success: false,
        message: "Mission report not found",
      });
    }

    return response.status(200).json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
}
async function removeUploadedFile(file) {
  if (!file?.path) {
    return;
  }

  try {
    await fs.unlink(file.path);
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error(
        "Failed to remove uploaded file:",
        error,
      );
    }
  }
}

export async function uploadMyMissionReportDocument(
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
      await removeUploadedFile(request.file);

      return response.status(400).json({
        success: false,
        message:
          "Mission ID must be a positive integer",
      });
    }

    if (!request.file) {
      return response.status(400).json({
        success: false,
        message: "Select a document to upload",
      });
    }

    const documentType =
      request.body.documentType;

    const allowedDocumentTypes = [
      "TICKET",
      "RECEIPT",
      "REPORT_ATTACHMENT",
      "OTHER",
    ];

    if (
      !allowedDocumentTypes.includes(
        documentType,
      )
    ) {
      await removeUploadedFile(request.file);

      return response.status(400).json({
        success: false,
        message:
          "Document type must be TICKET, RECEIPT, REPORT_ATTACHMENT or OTHER",
      });
    }

    const document =
      await saveMissionReportDocument(
        missionId,
        request.user.id,
        documentType,
        request.file,
      );

    return response.status(201).json({
      success: true,
      message:
        "Mission report document uploaded successfully",
      data: document,
    });
  } catch (error) {
    await removeUploadedFile(request.file);
    next(error);
  }
}
export async function getMyMissionReportDocuments(
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

    const documents =
      await findMyMissionReportDocuments(
        missionId,
        request.user.id,
      );

    return response.status(200).json({
      success: true,
      count: documents.length,
      data: documents,
    });
  } catch (error) {
    next(error);
  }
}

export async function downloadMissionDocument(
  request,
  response,
  next,
) {
  try {
    const documentId = Number(
      request.params.documentId,
    );

    if (
      !Number.isInteger(documentId) ||
      documentId <= 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Document ID must be a positive integer",
      });
    }

    const document =
      await findAccessibleMissionDocument(
        documentId,
        request.user.id,
        request.user.role,
      );

    if (!document) {
      return response.status(404).json({
        success: false,
        message:
          "Document not found or access denied",
      });
    }

    const safeStoredFilename = path.basename(
      document.storedFilename,
    );

    const filePath = path.resolve(
      "private-uploads",
      "mission-documents",
      safeStoredFilename,
    );

    try {
      await fs.access(filePath);
    } catch {
      return response.status(404).json({
        success: false,
        message:
          "The document record exists, but the file is missing",
      });
    }

    response.type(
      document.mimeType ||
        "application/octet-stream",
    );

    return response.download(
      filePath,
      document.originalFilename,
    );
  } catch (error) {
    next(error);
  }
}