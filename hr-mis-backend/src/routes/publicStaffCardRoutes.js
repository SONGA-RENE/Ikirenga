import express from "express";

import {
  showStaffCardVerificationPage,
} from "../controllers/publicStaffCardController.js";

const router = express.Router();

router.get(
  "/verify/:verificationToken",
  showStaffCardVerificationPage,
);

export default router;