import express from "express";

import {
  correctEmployeeLeaveReturn,
  createLeaveRequest,
  decideLeaveCancellation,
  decideLeaveRequirement,
  getAllLeaveRequests,
  getLeaveRequestById,
  getLeaveWorkflowDetails,
  getMyLeaveRequests,
  getMyPendingLeaveApprovals,
  getMyPendingLeaveCancellations,
  getPendingLeaveReturns,
  rejectEmployeeLeaveReturn,
  reportEmployeeLeaveReturn,
  requestLeaveCancellation,
  verifyEmployeeLeaveReturn,
  getEmployeesCurrentlyOnLeave,
} from "../controllers/leaveRequestController.js";

import { authenticate } from "../middleware/authMiddleware.js";

import { authorizeRoles } from "../middleware/roleMiddleware.js";

import { uploadLeaveAttachment } from "../middleware/leaveAttachmentUpload.js";

const router = express.Router();

/*
 * Collection routes
 */

router.post(
  "/",
  authenticate,
  uploadLeaveAttachment.single("attachment"),
  createLeaveRequest,
);

router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  getAllLeaveRequests,
);

/*
 * Current-user queues and history
 */

router.get("/my", authenticate, getMyLeaveRequests);

router.get("/approvals/my-pending", authenticate, getMyPendingLeaveApprovals);

router.get(
  "/cancellations/my-pending",
  authenticate,
  getMyPendingLeaveCancellations,
);

router.get(
  "/returns/pending",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  getPendingLeaveReturns,
);

router.get(
  "/currently-on-leave",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  getEmployeesCurrentlyOnLeave,
);
/*
 * Approval workflow
 */

router.patch(
  "/:requestId/requirements/:requirementId/decision",
  authenticate,
  authorizeRoles("HR", "DIRECTOR", "DEPUTY_CEO", "CEO", "CHAIRMAN"),
  decideLeaveRequirement,
);

/*
 * Cancellation workflow
 */

router.post(
  "/:requestId/cancellation-requests",
  authenticate,
  requestLeaveCancellation,
);

router.patch(
  "/:requestId/cancellation-requests/:cancellationId/decision",
  authenticate,
  authorizeRoles("HR", "CEO", "CHAIRMAN"),
  decideLeaveCancellation,
);

/*
 * Return-from-leave workflow
 */

router.post(
  "/:requestId/return-records",
  authenticate,
  reportEmployeeLeaveReturn,
);

router.patch(
  "/:requestId/return-records/:returnRecordId/verify",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  verifyEmployeeLeaveReturn,
);

router.patch(
  "/:requestId/return-records/:returnRecordId/reject",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  rejectEmployeeLeaveReturn,
);

router.patch(
  "/:requestId/return-records/:returnRecordId/correct",
  authenticate,
  correctEmployeeLeaveReturn,
);

/*
 * Request details
 */

router.get("/:requestId/workflow", authenticate, getLeaveWorkflowDetails);

/*
 * Legacy/general details endpoint — keep last
 */

router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  getLeaveRequestById,
);

export default router;
