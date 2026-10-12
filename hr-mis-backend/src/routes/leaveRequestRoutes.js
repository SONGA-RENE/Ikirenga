import express from "express";

import {
  approveEmployeeLeaveRequest,
  createLeaveRequest,
  getAllLeaveRequests,
  getLeaveRequestById,
  rejectEmployeeLeaveRequest,
} from "../controllers/leaveRequestController.js";

import {
  authenticate,
} from "../middleware/authMiddleware.js";

import {
  authorizeRoles,
} from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post(
  "/",
  authenticate,
  createLeaveRequest,
);

router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  getAllLeaveRequests,
);

router.get(
  "/:id",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  getLeaveRequestById,
);

router.patch(
  "/:id/approve",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  approveEmployeeLeaveRequest,
);

router.patch(
  "/:id/reject",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  rejectEmployeeLeaveRequest,
);

export default router;