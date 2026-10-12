import express from "express";
const router = express.Router();
import {
  createContract,
  getAllContracts,
  getContractById,
  renewEmployeeContract,
  terminateEmployeeContract,
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
router.get("/:id", getContractById);
router.post("/", createContract);
router.post("/:id/renew", renewEmployeeContract);
router.patch("/:id/terminate", terminateEmployeeContract);

export default router;