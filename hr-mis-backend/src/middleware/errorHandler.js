export function errorHandler(
  error,
  request,
  response,
  next,
) {
  const statusCode =
    Number.isInteger(error.statusCode)
      ? error.statusCode
      : 500;

  if (statusCode >= 500) {
    console.error(error);
  } else {
    console.warn(
      `${request.method} ${request.originalUrl}:`,
      error.message,
    );
  }

  const message =
    statusCode >= 500
      ? "Internal server error"
      : error.message;

  return response.status(statusCode).json({
    success: false,
    message,
  });
}