import crypto from "node:crypto";

const algorithm = "aes-256-gcm";
const initializationVectorLength = 12;

function getEncryptionKey() {
  const encodedKey =
    process.env
      .EMPLOYEE_DATA_ENCRYPTION_KEY;

  if (!encodedKey) {
    const error = new Error(
      "EMPLOYEE_DATA_ENCRYPTION_KEY is not configured",
    );

    error.statusCode = 500;
    throw error;
  }

  const key = Buffer.from(
    encodedKey,
    "base64",
  );

  if (key.length !== 32) {
    const error = new Error(
      "EMPLOYEE_DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key",
    );

    error.statusCode = 500;
    throw error;
  }

  return key;
}

export function normalizeIdentifier(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const normalized = String(value)
    .trim()
    .replace(/[\s-]+/g, "")
    .toUpperCase();

  return normalized || null;
}

export function hashIdentifier(value) {
  const normalized =
    normalizeIdentifier(value);

  if (!normalized) {
    return null;
  }

  return crypto
    .createHmac(
      "sha256",
      getEncryptionKey(),
    )
    .update(normalized)
    .digest("hex");
}

export function encryptIdentifier(value) {
  const normalized =
    normalizeIdentifier(value);

  if (!normalized) {
    return null;
  }

  const initializationVector =
    crypto.randomBytes(
      initializationVectorLength,
    );

  const cipher = crypto.createCipheriv(
    algorithm,
    getEncryptionKey(),
    initializationVector,
  );

  const encrypted = Buffer.concat([
    cipher.update(
      normalized,
      "utf8",
    ),
    cipher.final(),
  ]);

  const authenticationTag =
    cipher.getAuthTag();

  return {
    encrypted: encrypted.toString(
      "base64",
    ),

    initializationVector:
      initializationVector.toString(
        "base64",
      ),

    authenticationTag:
      authenticationTag.toString(
        "base64",
      ),

    hash: hashIdentifier(normalized),

    lastFour: normalized.slice(-4),
  };
}

export function decryptIdentifier({
  encrypted,
  initializationVector,
  authenticationTag,
}) {
  if (
    !encrypted ||
    !initializationVector ||
    !authenticationTag
  ) {
    return null;
  }

  const decipher =
    crypto.createDecipheriv(
      algorithm,
      getEncryptionKey(),
      Buffer.from(
        initializationVector,
        "base64",
      ),
    );

  decipher.setAuthTag(
    Buffer.from(
      authenticationTag,
      "base64",
    ),
  );

  const decrypted = Buffer.concat([
    decipher.update(
      Buffer.from(encrypted, "base64"),
    ),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function maskIdentifier(
  lastFour,
) {
  if (!lastFour) {
    return null;
  }

  return `************${lastFour}`;
}