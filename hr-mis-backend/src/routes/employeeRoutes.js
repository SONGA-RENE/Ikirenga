import express from "express";
const router = express.Router();
import {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  uploadPhoto,
  
} from "../controllers/employeeController.js";
import {
  uploadEmployeePhoto,
} from "../middleware/employeePhotoMiddleware.js";

import {
  authenticate,
} from "../middleware/authMiddleware.js";

import {
  authorizeRoles,
} from "../middleware/roleMiddleware.js";

import {
  downloadStaffCard,
} from "../controllers/staffCardController.js";

router.use(
  authenticate,
  authorizeRoles("ADMIN", "HR"),
);



router.get("/", getEmployees);
router.get("/:id", getEmployee);
router.post("/", createEmployee);
router.patch("/:id", updateEmployee);
router.delete("/:id", deactivateEmployee);
router.patch(
  "/:id/photo",
  uploadEmployeePhoto,
  uploadPhoto,
);
router.get(
  "/:id/staff-card",
  downloadStaffCard,
);

export default router;
