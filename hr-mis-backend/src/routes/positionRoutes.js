import express from "express";

import {
  addPosition,
  editPosition,
  getActingEligiblePositions,
  getAvailablePositions,
  getPositions,
  removePosition,
} from "../controllers/positionController.js";

import {
  authenticate,
} from "../middleware/authMiddleware.js";

import {
  authorizeRoles,
} from "../middleware/roleMiddleware.js";

const router = express.Router();
router.get(
  "/available",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  getAvailablePositions,
);
router.get(
  "/acting-eligible",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  getActingEligiblePositions,
);

router.get(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  getPositions,
);

router.post(
  "/",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  addPosition,
);



router.patch(
  "/:positionId",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  editPosition,
);

router.delete(
  "/:positionId",
  authenticate,
  authorizeRoles("ADMIN", "HR"),
  removePosition,
);

export default router;