import express from "express";

import {
  createLeaveType,
  getAllLeaveTypes,
  getLeaveTypeById,
} from "../controllers/leaveTypeController.js";
import {
  authenticate,
} from "../middleware/authMiddleware.js";

import {
  authorizeRoles,
} from "../middleware/roleMiddleware.js";
const router = express.Router();
router.use(
  authenticate,
  authorizeRoles("ADMIN", "HR"),
);

router.get("/", getAllLeaveTypes);
router.get("/:id", getLeaveTypeById);
router.post("/", createLeaveType);

export default router;