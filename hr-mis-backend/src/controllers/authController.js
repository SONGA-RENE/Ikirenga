import bcrypt from "bcryptjs";
import {
  authenticateUser,
  changeUserPassword,
  createUser,
  revokeAllUserTokens,
} from "../services/authService.js";

const allowedRoles = ["ADMIN", "HR", "EMPLOYEE"];

export async function login(request, response, next) {
  try {
    const { email, password } = request.body;

    if (!email?.trim() || !password) {
      return response.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const result = await authenticateUser(
      email.trim().toLowerCase(),
      password,
    );

    if (!result) {
      return response.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    response.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });
  } catch (error) {
    if (error.statusCode) {
      return response.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
}
export async function getCurrentUser(
  request,
  response,
) {
  const {
    id,
    employeeId,
    fullName,
    email,
    role,
    isActive,
    lastLoginAt,
    createdAt,
  } = request.user;

  response.status(200).json({
    success: true,
    data: {
      id,
      employeeId,
      fullName,
      email,
      role,
      isActive,
      lastLoginAt,
      createdAt,
    },
  });
}
export async function registerUser(
  request,
  response,
  next,
) {
  try {
    const {
      employeeId = null,
      fullName,
      email,
      password,
      role = "EMPLOYEE",
    } = request.body;

    if (!fullName?.trim() || !email?.trim() || !password) {
      return response.status(400).json({
        success: false,
        message:
          "Full name, email and password are required",
      });
    }

    if (!allowedRoles.includes(role)) {
      return response.status(400).json({
        success: false,
        message: `Role must be one of: ${allowedRoles.join(", ")}`,
      });
    }

    if (
      employeeId !== null &&
      (!Number.isInteger(employeeId) || employeeId <= 0)
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Employee ID must be a positive integer or null",
      });
    }

    if (role === "EMPLOYEE" && employeeId === null) {
      return response.status(400).json({
        success: false,
        message:
          "An employee account must be linked to an employee record",
      });
    }

    if (password.length < 12) {
      return response.status(400).json({
        success: false,
        message:
          "Password must contain at least 12 characters",
      });
    }

    if (bcrypt.truncates(password)) {
      return response.status(400).json({
        success: false,
        message:
          "Password exceeds bcrypt's 72-byte limit",
      });
    }

    const user = await createUser({
      employeeId,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
      role,
    });

    response.status(201).json({
      success: true,
      message: "User account created successfully",
      data: user,
    });
  } catch (error) {
    if (error.statusCode) {
      return response.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    if (error.code === "23505") {
      return response.status(409).json({
        success: false,
        message:
          "This email address or employee account is already registered",
      });
    }

    next(error);
  }
}

export async function changePassword(request, response, next) {
  try {
    const { currentPassword, newPassword } = request.body;

    if (!currentPassword || !newPassword) {
      return response.status(400).json({
        success: false,
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 8) {
      return response.status(400).json({
        success: false,
        message: "New password must contain at least 8 characters",
      });
    }

    await changeUserPassword(
      request.user.id,
      currentPassword,
      newPassword,
    );

    return response.status(200).json({
      success: true,
      message:
        "Password changed successfully. Please log in again.",
    });
  } catch (error) {
    return next(error);
  }
}

export async function logoutAll(
  request,
  response,
  next,
) {
  try {
    await revokeAllUserTokens(request.user.id);

    response.status(200).json({
      success: true,
      message:
        "All sessions have been logged out successfully",
    });
  } catch (error) {
    if (error.statusCode) {
      return response.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
}
