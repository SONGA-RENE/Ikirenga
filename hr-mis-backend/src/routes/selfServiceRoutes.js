import express from "express";

import {
  getMyContracts,
  getMyLeaveBalances,
  getMyLeaveRequests,
  getMyProfile,
} from "../controllers/selfServiceController.js";

import {
  authenticate,
} from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(authenticate);

router.get("/profile", getMyProfile);
router.get("/contracts", getMyContracts);
router.get("/leave-requests", getMyLeaveRequests);
router.get("/leave-balances", getMyLeaveBalances);

export default router;