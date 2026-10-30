import express from "express";

import {
  changeLeaveTypeStatus,
  createLeaveType,
  getAllLeaveTypes,
  getLeaveTypeById,
} from "../controllers/leaveTypeController.js";

import { authenticate } from "../middleware/authMiddleware.js";

import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", authenticate, getAllLeaveTypes);
router.post("/", authenticate, authorizeRoles("ADMIN", "HR"), createLeaveType);
router.patch(
  "/:id/status",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  changeLeaveTypeStatus,
);
router.get("/:id", authenticate, getLeaveTypeById);

export default router;
