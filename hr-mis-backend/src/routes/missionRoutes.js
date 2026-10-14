import express from "express";

import {
  createMissionRequest,
  getMissionById,
  submitMissionRequest,
  decideMissionApproval,
  getPendingMissionApprovals,
} from "../controllers/missionController.js";

import {
  authenticate,
} from "../middleware/authMiddleware.js";

import {
  authorizeRoles,
} from "../middleware/roleMiddleware.js";

const router = express.Router();


router.get(
  "/pending-approvals",
  authenticate,
  authorizeRoles(
    "DIRECTOR",
    "HR",
    "CEO",
    "CHAIRMAN",
    "DEPUTY_CEO",
  ),
  getPendingMissionApprovals,
);


router.post(
  "/",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "HR",
    "EMPLOYEE",
    "DIRECTOR",
    "DEPUTY_CEO",
    "CEO",
  ),
  createMissionRequest,
);

 
router.patch(
  "/:missionId/submit",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "HR",
    "EMPLOYEE",
    "DIRECTOR",
    "DEPUTY_CEO",
    "CEO",
  ),
  submitMissionRequest,
);

router.patch(
  "/:missionId/requirements/:requirementId/decision",
  authenticate,
  authorizeRoles(
    "DIRECTOR",
    "HR",
    "CEO",
    "CHAIRMAN",
    "DEPUTY_CEO",
  ),
  decideMissionApproval,
);

router.get(
  "/:missionId",
  authenticate,
  authorizeRoles(
    "ADMIN",
    "HR",
    "EMPLOYEE",
    "DIRECTOR",
    "DEPUTY_CEO",
    "CEO",
    "CHAIRMAN",
  ),
  getMissionById,
);

export default router;