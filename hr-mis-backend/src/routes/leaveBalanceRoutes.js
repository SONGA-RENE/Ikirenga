import express from "express";

import { getEmployeeLeaveBalances } from "../controllers/leaveEntitlementController.js";

import { authenticate } from "../middleware/authMiddleware.js";

import { authorizeEmployeeAccess } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get(
  "/:employeeId",
  authenticate,
  authorizeEmployeeAccess,
  getEmployeeLeaveBalances,
);

export default router;
