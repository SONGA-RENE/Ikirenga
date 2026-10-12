import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

const employeePhotoDirectory = path.resolve(
  currentDirectory,
  "../../uploads/employees",
);

export async function deleteEmployeePhoto(
  photoFilename,
) {
  if (!photoFilename) {
    return;
  }

  // Prevent unexpected directory traversal
  const safeFilename = path.basename(photoFilename);

  if (safeFilename !== photoFilename) {
    throw new Error("Invalid employee photo filename");
  }

  const photoPath = path.join(
    employeePhotoDirectory,
    safeFilename,
  );

  try {
    await fs.unlink(photoPath);
  } catch (error) {
    // The desired result is already achieved
    if (error.code === "ENOENT") {
      return;
    }

    throw error;
  }
}