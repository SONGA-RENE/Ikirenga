import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";

const uploadDirectory = path.resolve(
  "private-uploads",
  "mission-documents",
);

fs.mkdirSync(uploadDirectory, {
  recursive: true,
});

const allowedFiles = new Map([
  [".pdf", "application/pdf"],
  [
    ".docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
]);

const storage = multer.diskStorage({
  destination(request, file, callback) {
    callback(null, uploadDirectory);
  },

  filename(request, file, callback) {
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    const storedFilename =
      `${crypto.randomUUID()}${extension}`;

    callback(null, storedFilename);
  },
});

function fileFilter(
  request,
  file,
  callback,
) {
  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  const expectedMimeType =
    allowedFiles.get(extension);

  if (
    !expectedMimeType ||
    expectedMimeType !== file.mimetype
  ) {
    const error = new Error(
      "Only PDF, DOCX, JPG, JPEG and PNG files are allowed",
    );

    error.statusCode = 400;

    return callback(error);
  }

  callback(null, true);
}

export const uploadMissionDocument =
  multer({
    storage,
    fileFilter,
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
    },
  });