import express from "express";

import {
  createPublicHoliday,
  getAllPublicHolidays,
  getPublicHolidayById,
} from "../controllers/publicHolidayController.js";

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

router.get("/", getAllPublicHolidays);
router.get("/:id", getPublicHolidayById);
router.post("/", createPublicHoliday);

export default router;