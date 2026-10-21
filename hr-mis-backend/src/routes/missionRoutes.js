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
  deleteMyMissionDocument,
  getMyMissionHistory,
  getMissionDashboardSummary,
  getOutstandingMissionReports,
  getMissionRegister,
  deleteReconciliationReceipt,
  downloadReconciliationReceipt,
  getReconciliationReceipts,
  uploadMyReconciliationReceipt,
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

import {
  addMissionDisbursement,
  addMissionFundingItem,
  cancelDisbursement,
  editMissionFundingItem,
  getMissionDisbursements,
  getMissionFundingPlan,
  payMissionDisbursement,
  removeMissionFundingItem,
} from "../controllers/missionFinanceController.js";

import {
  createMissionReconciliation,
  createReconciliationItem,
  decideMissionReconciliation,
  editReconciliationItem,
  getPendingReconciliations,
  getReconciliation,
  removeReconciliationItem,
  submitMissionReconciliation,
} from "../controllers/missionReconciliationController.js";

import {
  getClosureReadiness,
  getFinanceDashboardSummary,
} from "../controllers/missionMonitoringController.js";

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

router.get(
  "/finance/pending-reconciliations",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "FINANCE",
  ),
  getPendingReconciliations,
);

router.get(
  "/finance/dashboard",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "FINANCE",
  ),
  getFinanceDashboardSummary,
);

router.get(
  "/dashboard/closure-readiness",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "HR",
  ),
  getClosureReadiness,
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

router.delete(
  "/:missionId/reports/me/documents/:documentId",
  authenticate,
  deleteMyMissionDocument,
);

router.get(
  "/my-history",
  authenticate,
  getMyMissionHistory,
);

router.get(
  "/dashboard/summary",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  getMissionDashboardSummary,
);

router.get(
  "/dashboard/outstanding-reports",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  getOutstandingMissionReports,
);

router.get(
  "/register",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  getMissionRegister,
);

router.post(
  "/:missionId/funding-items",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "FINANCE",
  ),
  addMissionFundingItem,
);

router.get(
  "/:missionId/funding-items",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "HR",
    "FINANCE",
  ),
  getMissionFundingPlan,
);

router.patch(
  "/:missionId/funding-items/:fundingItemId",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "FINANCE",
  ),
  editMissionFundingItem,
);

router.delete(
  "/:missionId/funding-items/:fundingItemId",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "FINANCE",
  ),
  removeMissionFundingItem,
);

router.post(
  "/:missionId/disbursements",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "FINANCE",
  ),
  addMissionDisbursement,
);

router.get(
  "/:missionId/disbursements",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "HR",
    "FINANCE",
  ),
  getMissionDisbursements,
);

router.patch(
  "/:missionId/disbursements/:disbursementId/pay",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "FINANCE",
  ),
  payMissionDisbursement,
);

router.patch(
  "/:missionId/disbursements/:disbursementId/cancel",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "FINANCE",
  ),
  cancelDisbursement,
);

router.post(
  "/:missionId/reconciliations",
  authenticate,
  authorizeRoles(
    "EMPLOYEE",
    "DIRECTOR",
    "HR",
    "DEPUTY_CEO",
    "CEO",
  ),
  createMissionReconciliation,
);

router.post(
  "/:missionId/reconciliations/:reconciliationId/items",
  authenticate,
  authorizeRoles(
    "EMPLOYEE",
    "DIRECTOR",
    "HR",
    "DEPUTY_CEO",
    "CEO",
  ),
  createReconciliationItem,
);

router.get(
  "/:missionId/reconciliations/:reconciliationId",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "EMPLOYEE",
    "DIRECTOR",
    "HR",
    "FINANCE",
    "DEPUTY_CEO",
    "CEO",
  ),
  getReconciliation,
);

router.patch(
  "/:missionId/reconciliations/:reconciliationId/submit",
  authenticate,
  authorizeRoles(
    "EMPLOYEE",
    "DIRECTOR",
    "HR",
    "DEPUTY_CEO",
    "CEO",
  ),
  submitMissionReconciliation,
);



router.patch(
  "/:missionId/reconciliations/:reconciliationId/decision",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "FINANCE",
  ),
  decideMissionReconciliation,
);

router.patch(
  "/:missionId/reconciliations/:reconciliationId/items/:itemId",
  authenticate,
  authorizeRoles(
    "EMPLOYEE",
    "DIRECTOR",
    "HR",
    "DEPUTY_CEO",
    "CEO",
  ),
  editReconciliationItem,
);

router.delete(
  "/:missionId/reconciliations/:reconciliationId/items/:itemId",
  authenticate,
  authorizeRoles(
    "EMPLOYEE",
    "DIRECTOR",
    "HR",
    "DEPUTY_CEO",
    "CEO",
  ),
  removeReconciliationItem,
);

router.post(
  "/:missionId/reconciliations/:reconciliationId/items/:itemId/receipts",
  authenticate,
  uploadMissionDocument.single("document"),
  uploadMyReconciliationReceipt,
);

router.get(
  "/:missionId/reconciliations/:reconciliationId/items/:itemId/receipts",
  authenticate,
  getReconciliationReceipts,
);

router.get(
  "/:missionId/reconciliation-receipts/:documentId/download",
  authenticate,
  downloadReconciliationReceipt,
);

router.delete(
  "/:missionId/reconciliations/:reconciliationId/items/:itemId/receipts/:documentId",
  authenticate,
  deleteReconciliationReceipt,
);

router.get(
  "/:missionId",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "HR",
    "FINANCE",
    "EMPLOYEE",
    "DIRECTOR",
    "DEPUTY_CEO",
    "CEO",
    "CHAIRMAN",
  ),
  getMissionById,
);

export default router;