export function authorizeRoles(...allowedRoles) {
  return function roleAuthorization(
    request,
    response,
    next,
  ) {
    if (!request.user) {
      return response.status(401).json({
        success: false,
        message: "Authentication is required",
      });
    }

    if (!allowedRoles.includes(request.user.role)) {
      return response.status(403).json({
        success: false,
        message:
          "You do not have permission to perform this action",
      });
    }

    next();
  };
}

export function authorizeEmployeeAccess(
  request,
  response,
  next,
) {
  if (!request.user) {
    return response.status(401).json({
      success: false,
      message: "Authentication is required",
    });
  }

  if (
    request.user.role === "ADMIN" ||
    request.user.role === "HR"
  ) {
    return next();
  }

  const employeeId = Number(request.params.employeeId);

  if (
    request.user.role === "EMPLOYEE" &&
    request.user.employeeId === employeeId
  ) {
    return next();
  }

  return response.status(403).json({
    success: false,
    message:
      "You may only access your own employee information",
  });
}