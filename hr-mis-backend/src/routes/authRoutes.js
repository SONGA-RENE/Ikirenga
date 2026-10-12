import express from "express";

import {
  changePassword,
  getCurrentUser,
  login,
  logoutAll,
  registerUser,
} from "../controllers/authController.js";

import {
  authenticate,
} from "../middleware/authMiddleware.js";

import {
  authorizeRoles,
} from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/login", login);
router.get("/me", authenticate, getCurrentUser);
router.post(
  "/users",
  authenticate,
  authorizeRoles("ADMIN"),
  registerUser,
);
router.patch(
  "/change-password",
  authenticate,
  changePassword,
);

router.post(
  "/logout-all",
  authenticate,
  logoutAll,
);

export default router;