import apiClient from "./apiClient.js";

function readSuccessfulPayload(
  response,
  fallbackMessage,
) {
  const payload = response.data;

  if (!payload?.success) {
    throw new Error(
      payload?.message || fallbackMessage,
    );
  }

  return payload;
}

export async function getEmployeeContracts(
  employeeId,
  { signal } = {},
) {
  const response = await apiClient.get(
    `/api/contracts/employee/${employeeId}`,
    { signal },
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to retrieve employee contracts",
  );

  return {
    contracts: Array.isArray(payload.data)
      ? payload.data
      : [],
    count:
      typeof payload.count === "number"
        ? payload.count
        : payload.data?.length || 0,
  };
}

export async function getExpiringContracts(
  days = 90,
  { signal } = {},
) {
  const response = await apiClient.get(
    "/api/contracts/expiring",
    {
      params: { days },
      signal,
    },
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to retrieve expiring contracts",
  );

  return {
    filters: payload.filters || {
      days,
    },

    summary: payload.summary || {
      critical: 0,
      warning: 0,
      notice: 0,
    },

    count:
      typeof payload.count === "number"
        ? payload.count
        : 0,

    contracts: Array.isArray(payload.data)
      ? payload.data
      : [],
  };
}

export async function createContract(
  contractData,
) {
  const response = await apiClient.post(
    "/api/contracts",
    contractData,
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to create contract",
  );

  return {
    message: payload.message,
    contract: payload.data,
  };
}

export async function renewContract(
  contractId,
  contractData,
) {
  const response = await apiClient.post(
    `/api/contracts/${contractId}/renew`,
    contractData,
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to renew contract",
  );

  return {
    message: payload.message,
    contract: payload.data,
  };
}

export async function terminateContract(
  contractId,
  terminationData,
) {
  const response = await apiClient.patch(
    `/api/contracts/${contractId}/terminate`,
    terminationData,
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to terminate contract",
  );

  return {
    message: payload.message,
    contract: payload.data,
  };
}

export async function cancelContract(
  contractId,
  cancellationData,
) {
  const response = await apiClient.patch(
    `/api/contracts/${contractId}/cancel`,
    cancellationData,
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to cancel contract",
  );

  return {
    message: payload.message,
    contract: payload.data,
  };
}
export async function getContracts({
  signal,
} = {}) {
  const response = await apiClient.get(
    "/api/contracts",
    { signal },
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to retrieve contracts",
  );

  return {
    contracts: Array.isArray(payload.data)
      ? payload.data
      : [],

    count:
      typeof payload.count === "number"
        ? payload.count
        : payload.data?.length || 0,
  };
}