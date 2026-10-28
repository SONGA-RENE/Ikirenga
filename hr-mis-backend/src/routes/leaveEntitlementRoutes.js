import express from "express";

import {
  createLeaveEntitlement,
  generateEmployeeAnnualEntitlements,
} from "../controllers/leaveEntitlementController.js";

import { authenticate } from "../middleware/authMiddleware.js";

import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post(
  "/generate-annual",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  generateEmployeeAnnualEntitlements,
);

router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  createLeaveEntitlement,
);

export default router;
