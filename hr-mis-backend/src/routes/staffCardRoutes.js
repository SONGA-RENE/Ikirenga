import express from "express";

import {
  checkStaffCard,
  createStaffCard,
  getEmployeeCardHistory,
  revokeEmployeeStaffCard,
  reactivateEmployeeStaffCard,
} from "../controllers/staffCardManagementController.js";

import {
  authenticate,
} from "../middleware/authMiddleware.js";

import {
  authorizeRoles,
} from "../middleware/roleMiddleware.js";

const router = express.Router();

// Public QR verification
router.get(
  "/verify/:verificationToken",
  checkStaffCard,
);

// Protected card management
router.post(
  "/employee/:employeeId",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  createStaffCard,
);

router.get(
  "/employee/:employeeId/history",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  getEmployeeCardHistory,
);

router.patch(
  "/:cardId/revoke",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  revokeEmployeeStaffCard,
);

router.patch(
  "/:cardNumber/reactivate",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  reactivateEmployeeStaffCard,
);

export default router;