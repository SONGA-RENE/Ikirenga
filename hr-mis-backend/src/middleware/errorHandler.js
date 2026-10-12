export function errorHandler(error, request, response, next) {
  console.error(error);

  if (error.code === "23505") {
    return response.status(409).json({
      success: false,
      message: "Staff number or email already exists",
    });
  }

  if (error.code === "23503") {
  return response.status(400).json({
    success: false,
    message: "The selected position does not exist",
  });
}

if (error.code === "LIMIT_FILE_SIZE") {
  return response.status(413).json({
    success: false,
    message:
      "Employee photo must not exceed 5 MB",
  });
}

if (error.code === "LIMIT_FILE_COUNT") {
  return response.status(400).json({
    success: false,
    message: "Only one employee photo is allowed",
  });
}

  response.status(500).json({
    success: false,
    message: "An internal server error occurred",
  });
}