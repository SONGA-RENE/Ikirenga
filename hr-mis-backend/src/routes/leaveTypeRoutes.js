import express from "express";

import {
  createLeaveType,
  getAllLeaveTypes,
  getLeaveTypeById,
} from "../controllers/leaveTypeController.js";

import { authenticate } from "../middleware/authMiddleware.js";

import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/", authenticate, getAllLeaveTypes);

router.get("/:id", authenticate, getLeaveTypeById);

router.post("/", authenticate, authorizeRoles("ADMIN", "HR"), createLeaveType);

export default router;
