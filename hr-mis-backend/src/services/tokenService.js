import jwt from "jsonwebtoken";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "JWT_SECRET must contain at least 32 characters",
    );
  }

  return secret;
}

export function createAccessToken(user) {
  return jwt.sign(
    {
      role: user.role,
      email: user.email,
      version: user.authVersion,
    },
    getJwtSecret(),
    {
      subject: String(user.id),
      expiresIn: process.env.JWT_EXPIRES_IN || "8h",
      issuer: "hr-mis-api",
      audience: "hr-mis-client",
      algorithm: "HS256",
    },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret(), {
    issuer: "hr-mis-api",
    audience: "hr-mis-client",
    algorithms: ["HS256"],
  });
}