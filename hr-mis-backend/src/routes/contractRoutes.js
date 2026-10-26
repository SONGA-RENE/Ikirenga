import express from "express";
const router = express.Router();
import {
  createContract,
  getAllContracts,
  getContractById,
  getEmployeeContracts,
  renewEmployeeContract,
  terminateEmployeeContract,
  cancelEmployeeContract,
  getExpiringContracts,
} from "../controllers/contractController.js";

import {
  authenticate,
} from "../middleware/authMiddleware.js";

import {
  authorizeRoles,
} from "../middleware/roleMiddleware.js";

router.use(
  authenticate,
  authorizeRoles("ADMIN", "HR"),
);

router.get("/", getAllContracts);

router.get(
  "/expiring",
  getExpiringContracts,
);

router.get(
  "/employee/:employeeId",
  getEmployeeContracts,
);

router.get("/:id", getContractById);

router.post("/", createContract);

router.post(
  "/:id/renew",
  renewEmployeeContract,
);

router.patch(
  "/:id/terminate",
  terminateEmployeeContract,
);

router.patch(
  "/:id/cancel",
  cancelEmployeeContract,
);


export default router;