import express from "express";

import {
  createMissionRequest,
  getMissionById,
  submitMissionRequest,
  decideMissionApproval,
  getPendingMissionApprovals,
  completeMissionRequest,
  createMyMissionReport,
  updateMyMissionReport,
  submitMyMissionReport,
  getMyMissionReport,
  getMissionReportTracking,
  getMissionReportById,
  uploadMyMissionReportDocument,
  getMyMissionReportDocuments,
  downloadMissionDocument,
} from "../controllers/missionController.js";

import {
  authenticate,
} from "../middleware/authMiddleware.js";

import {
  authorizeRoles,
} from "../middleware/roleMiddleware.js";

import {
  uploadMissionDocument,
} from "../middleware/missionDocumentUpload.js";

const router = express.Router();


router.get(
  "/pending-approvals",
  authenticate,
  authorizeRoles(
    "DIRECTOR",
    "HR",
    "CEO",
    "CHAIRMAN",
    "DEPUTY_CEO",
  ),
  getPendingMissionApprovals,
);


router.post(
  "/",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "HR",
    "EMPLOYEE",
    "DIRECTOR",
    "DEPUTY_CEO",
    "CEO",
  ),
  createMissionRequest,
);

 
router.patch(
  "/:missionId/submit",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "HR",
    "EMPLOYEE",
    "DIRECTOR",
    "DEPUTY_CEO",
    "CEO",
  ),
  submitMissionRequest,
);

router.patch(
  "/:missionId/requirements/:requirementId/decision",
  authenticate,
  authorizeRoles(
    "DIRECTOR",
    "HR",
    "CEO",
    "CHAIRMAN",
    "DEPUTY_CEO",
  ),
  decideMissionApproval,
);

router.patch(
  "/:missionId/complete",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  completeMissionRequest,
);

router.post(
  "/:missionId/reports",
  authenticate,
  createMyMissionReport,
);

router.patch(
  "/:missionId/reports/draft",
  authenticate,
  updateMyMissionReport,
);

router.patch(
  "/:missionId/reports/submit",
  authenticate,
  submitMyMissionReport,
);

router.get(
  "/:missionId/reports/me",
  authenticate,
  getMyMissionReport,
);

router.get(
  "/:missionId/reports",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  getMissionReportTracking,
);

router.get(
  "/:missionId/reports/me",
  authenticate,
  getMyMissionReport,
);

router.get(
  "/:missionId/reports/:reportId",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  getMissionReportById,
);

router.post(
  "/:missionId/reports/me/documents",
  authenticate,
  uploadMissionDocument.single("document"),
  uploadMyMissionReportDocument,
);

router.get(
  "/:missionId/reports/me/documents",
  authenticate,
  getMyMissionReportDocuments,
);

router.get(
  "/documents/:documentId/download",
  authenticate,
  downloadMissionDocument,
);

router.get(
  "/:missionId",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "HR",
    "EMPLOYEE",
    "DIRECTOR",
    "DEPUTY_CEO",
    "CEO",
    "CHAIRMAN",
  ),
  getMissionById,
);

export default router;