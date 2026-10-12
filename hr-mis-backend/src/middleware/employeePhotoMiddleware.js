import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import multer from "multer";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

const employeePhotoDirectory = path.resolve(
  currentDirectory,
  "../../uploads/employees",
);

const allowedMimeTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

const storage = multer.diskStorage({
  destination(request, file, callback) {
    callback(null, employeePhotoDirectory);
  },

  filename(request, file, callback) {
    const extension = allowedMimeTypes.get(file.mimetype);
    const uniqueName = crypto.randomUUID();

    callback(null, `${uniqueName}${extension}`);
  },
});

function fileFilter(request, file, callback) {
  if (!allowedMimeTypes.has(file.mimetype)) {
    const error = new Error(
      "Only JPEG, PNG and WebP employee photos are allowed",
    );

    error.statusCode = 400;

    return callback(error);
  }

  callback(null, true);
}

export const uploadEmployeePhoto = multer({
  storage,
  fileFilter,
  limits: {
    files: 1,
    fileSize: 5 * 1024 * 1024,
  },
}).single("photo");