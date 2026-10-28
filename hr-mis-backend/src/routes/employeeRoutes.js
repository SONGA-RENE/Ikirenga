import express from "express";

import {
  getEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  deactivateEmployee,
  uploadPhoto,
} from "../controllers/employeeController.js";

import {
  closeTemporaryAssignment,
  createPositionAssignment,
  getPositionAssignmentHistory,
} from "../controllers/employeePositionAssignmentController.js";

import {
  getEmployeeProfile,
  updateEmployeeProfile,
} from "../controllers/employeeProfileController.js";

import {
  addFamilyContact,
  editFamilyContact,
  getFamilyContacts,
  removeFamilyContact,
} from "../controllers/employeeFamilyContactController.js";

import {
  addEducationRecord,
  editEducationRecord,
  getEducationRecords,
  removeEducationRecord,
} from "../controllers/employeeEducationController.js";

import {
  cancelSeparation,
  completeSeparation,
  confirmSeparation,
  createSeparation,
  getEmployeeSeparations,
} from "../controllers/employeeSeparationController.js";

import { getLifecycleDashboard } from "../controllers/employeeLifecycleDashboardController.js";

import { downloadStaffCard } from "../controllers/staffCardController.js";

import { revealIdentifier } from "../controllers/employeeSensitiveDataController.js";

import { uploadEmployeePhoto } from "../middleware/employeePhotoMiddleware.js";

import { authenticate } from "../middleware/authMiddleware.js";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { updateEmployeeServiceStartDate } from "../controllers/employeeController.js";
const router = express.Router();

router.use(authenticate, authorizeRoles("ADMIN", "HR"));

// Employee collection
router.get("/dashboard/lifecycle", getLifecycleDashboard);
router.get("/", getEmployees);

router.post("/", createEmployee);

// Position assignments
router.post("/:employeeId/position-assignments", createPositionAssignment);

router.get("/:employeeId/position-assignments", getPositionAssignmentHistory);

router.patch(
  "/:employeeId/position-assignments/:assignmentId/end",
  closeTemporaryAssignment,
);

// Employee profile
router.get("/:employeeId/profile", getEmployeeProfile);

router.patch("/:employeeId/profile", updateEmployeeProfile);

router.post("/:employeeId/profile/reveal-identifier", revealIdentifier);

// Employee family contacts
router.get("/:employeeId/family-contacts", getFamilyContacts);

router.post("/:employeeId/family-contacts", addFamilyContact);

router.patch("/:employeeId/family-contacts/:contactId", editFamilyContact);

router.delete("/:employeeId/family-contacts/:contactId", removeFamilyContact);

// Employee education records
router.get("/:employeeId/education", getEducationRecords);

router.post("/:employeeId/education", addEducationRecord);

router.patch("/:employeeId/education/:educationId", editEducationRecord);

router.delete("/:employeeId/education/:educationId", removeEducationRecord);

// Employee photo
router.patch("/:id/photo", uploadEmployeePhoto, uploadPhoto);

// Staff card PDF
router.get("/:id/staff-card", downloadStaffCard);

// General employee record routes
router.get("/:id", getEmployee);

// Employee separation routes
router.post("/:employeeId/separations", createSeparation);

router.get("/:employeeId/separations", getEmployeeSeparations);

router.patch(
  "/:employeeId/separations/:separationId/confirm",
  confirmSeparation,
);

router.patch("/:employeeId/separations/:separationId/cancel", cancelSeparation);

router.patch(
  "/:employeeId/separations/:separationId/complete",
  completeSeparation,
);

router.patch("/:employeeId/service-start-date", updateEmployeeServiceStartDate);

router.patch("/:id", updateEmployee);

router.delete("/:id", deactivateEmployee);

export default router;
