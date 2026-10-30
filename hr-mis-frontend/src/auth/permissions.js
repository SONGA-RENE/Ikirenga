export const permissions = {
  VIEW_EMPLOYEES: ["ADMIN", "HR"],
  VIEW_CONTRACTS: ["ADMIN", "HR"],
  VIEW_LEAVE: [
    "ADMIN",
    "HR",
    "EMPLOYEE",
    "DIRECTOR",
    "DEPUTY_CEO",
    "CEO",
    "CHAIRMAN",
    "FINANCE",
  ],
};

export function hasPermission(user, permission) {
  if (!user) {
    return false;
  }

  const allowedRoles = permissions[permission] || [];

  return allowedRoles.includes(user.role);
}
