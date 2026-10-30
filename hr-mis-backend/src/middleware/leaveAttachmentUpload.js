import crypto from "crypto";

import fs from "fs";

import path from "path";

import multer from "multer";

const attachmentDirectory = path.resolve("uploads", "leave-attachments");

fs.mkdirSync(attachmentDirectory, {
  recursive: true,
});

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

const storage = multer.diskStorage({
  destination(request, file, callback) {
    callback(null, attachmentDirectory);
  },

  filename(request, file, callback) {
    const originalExtension = path.extname(file.originalname).toLowerCase();

    const safeExtension = allowedExtensions.has(originalExtension)
      ? originalExtension
      : "";

    callback(null, `${crypto.randomUUID()}${safeExtension}`);
  },
});

function fileFilter(request, file, callback) {
  const extension = path.extname(file.originalname).toLowerCase();

  if (
    !allowedMimeTypes.has(file.mimetype) ||
    !allowedExtensions.has(extension)
  ) {
    const error = new Error("Attachment must be a PDF, JPG, JPEG or PNG file");

    error.statusCode = 400;

    callback(error);

    return;
  }

  callback(null, true);
}

export const uploadLeaveAttachment = multer({
  storage,

  fileFilter,

  limits: {
    files: 1,
    fileSize: 5 * 1024 * 1024,
  },
});

export function deleteUploadedLeaveAttachment(file) {
  if (!file?.path) {
    return;
  }

  fs.unlink(file.path, (error) => {
    if (error && error.code !== "ENOENT") {
      console.error("Unable to remove leave attachment:", error);
    }
  });
}
