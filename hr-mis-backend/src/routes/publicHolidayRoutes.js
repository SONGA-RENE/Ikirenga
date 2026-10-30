import express from "express";

import {
  createPublicHoliday,
  deletePublicHoliday,
  generateRwandaCalendar,
  getAllPublicHolidays,
  getPublicHolidayById,
  updatePublicHoliday,
} from "../controllers/publicHolidayController.js";

import { authenticate } from "../middleware/authMiddleware.js";

import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(authenticate);

/*
 * Read-only calendar access is available to
 * every authenticated employee because the
 * leave request form depends on these dates.
 */

router.get("/", getAllPublicHolidays);

router.post(
  "/generate-rwanda-calendar",
  authorizeRoles("ADMIN", "HR"),
  generateRwandaCalendar,
);

router.post("/", authorizeRoles("ADMIN", "HR"), createPublicHoliday);

router.get("/:id", getPublicHolidayById);

router.patch("/:id", authorizeRoles("ADMIN", "HR"), updatePublicHoliday);

router.delete("/:id", authorizeRoles("ADMIN", "HR"), deletePublicHoliday);

export default router;
