import {
  findUserById,
} from "../services/authService.js";

import {
  verifyAccessToken,
} from "../services/tokenService.js";

export async function authenticate(
  request,
  response,
  next,
) {
  try {
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      return response.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      return response.status(401).json({
        success: false,
        message: "Authentication token is required",
      });
    }

    const payload = verifyAccessToken(token);

    const user = await findUserById(
      Number(payload.sub),
    );

    if (!user || !user.isActive) {
      return response.status(401).json({
        success: false,
        message: "Invalid or inactive user account",
      });
    }

    if (payload.version !== user.authVersion) {
      return response.status(401).json({
        success: false,
        message:
          "Your session is no longer valid. Please log in again.",
      });
    }

    request.user = user;

    return next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return response.status(401).json({
        success: false,
        message:
          "Invalid or expired authentication token",
      });
    }

    return next(error);
  }
}