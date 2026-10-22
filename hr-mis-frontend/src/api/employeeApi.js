import apiClient from "./apiClient.js";

export async function getEmployees({
  signal,
} = {}) {
  const response = await apiClient.get(
    "/api/employees",
    {
      signal,
    },
  );

  const payload = response.data;

  if (!payload?.success) {
    throw new Error(
      payload?.message ||
        "Failed to retrieve employees",
    );
  }

  return {
    employees: Array.isArray(payload.data)
      ? payload.data
      : [],
    count:
      typeof payload.count === "number"
        ? payload.count
        : payload.data?.length || 0,
  };
}

export async function getEmployeeById(
  employeeId,
  { signal } = {},
) {
  const response = await apiClient.get(
    `/api/employees/${employeeId}`,
    {
      signal,
    },
  );

  const payload = response.data;

  if (!payload?.success) {
    throw new Error(
      payload?.message ||
        "Failed to retrieve employee",
    );
  }

  return payload.data;
}

export async function createEmployee(
  employeeData,
) {
  const response = await apiClient.post(
    "/api/employees",
    employeeData,
  );

  const payload = response.data;

  if (!payload?.success) {
    throw new Error(
      payload?.message ||
        "Failed to create employee",
    );
  }

  return payload.data;
}