import apiClient from "./apiClient.js";

export async function getPositions({
  signal,
} = {}) {
  const response = await apiClient.get(
    "/api/positions",
    { signal },
  );

  const payload = response.data;

  if (!payload?.success) {
    throw new Error(
      payload?.message ||
        "Failed to retrieve positions",
    );
  }

  return Array.isArray(payload.data)
    ? payload.data
    : [];
}