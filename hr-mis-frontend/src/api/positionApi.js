import apiClient from "./apiClient.js";

function readPositionCollection(
  response,
  fallbackMessage,
) {
  const payload = response.data;

  if (!payload?.success) {
    throw new Error(
      payload?.message || fallbackMessage,
    );
  }

  return Array.isArray(payload.data)
    ? payload.data
    : [];
}

export async function getPositions({
  signal,
} = {}) {
  const response = await apiClient.get(
    "/api/positions",
    { signal },
  );

  return readPositionCollection(
    response,
    "Failed to retrieve positions",
  );
}

export async function getAvailablePositions({
  signal,
} = {}) {
  const response = await apiClient.get(
    "/api/positions/available",
    { signal },
  );

  return readPositionCollection(
    response,
    "Failed to retrieve available positions",
  );
}

export async function getActingEligiblePositions({
  signal,
} = {}) {
  const response = await apiClient.get(
    "/api/positions/acting-eligible",
    { signal },
  );

  return readPositionCollection(
    response,
    "Failed to retrieve acting-eligible positions",
  );
}