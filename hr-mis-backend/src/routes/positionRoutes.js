import express from "express";

import {
  getPositions,
} from "../controllers/positionController.js";

import {
  authenticate,
} from "../middleware/authMiddleware.js";

import {
  authorizeRoles,
} from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  getPositions,
);

export default router;