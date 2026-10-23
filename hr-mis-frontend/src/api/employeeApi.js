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

// =====================================================
// EMPLOYEES
// =====================================================

export async function getEmployees({
  signal,
} = {}) {
  const response = await apiClient.get(
    "/api/employees",
    { signal },
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to retrieve employees",
  );

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
    { signal },
  );

  return readSuccessfulPayload(
    response,
    "Failed to retrieve employee",
  ).data;
}

export async function createEmployee(
  employeeData,
) {
  const response = await apiClient.post(
    "/api/employees",
    employeeData,
  );

  return readSuccessfulPayload(
    response,
    "Failed to create employee",
  ).data;
}

export async function updateEmployee(
  employeeId,
  employeeData,
) {
  const response = await apiClient.patch(
    `/api/employees/${employeeId}`,
    employeeData,
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to update employee",
  );

  return {
    message: payload.message,
    employee: payload.data,
  };
}

export async function uploadEmployeePhoto(
  employeeId,
  photoFile,
) {
  const formData = new FormData();

  formData.append("photo", photoFile);

  const response = await apiClient.patch(
    `/api/employees/${employeeId}/photo`,
    formData,
    {
      headers: {
        "Content-Type": undefined,
      },
    },
  );

  return readSuccessfulPayload(
    response,
    "Failed to upload employee photo",
  ).data;
}

// =====================================================
// POSITION ASSIGNMENTS
// =====================================================

export async function getEmployeePositionAssignments(
  employeeId,
  { signal } = {},
) {
  const response = await apiClient.get(
    `/api/employees/${employeeId}/position-assignments`,
    { signal },
  );

  return readSuccessfulPayload(
    response,
    "Failed to retrieve position assignments",
  ).data;
}

export async function createEmployeePositionAssignment(
  employeeId,
  assignmentData,
) {
  const response = await apiClient.post(
    `/api/employees/${employeeId}/position-assignments`,
    assignmentData,
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to create position assignment",
  );

  return {
    message: payload.message,
    assignment: payload.data,
  };
}

export async function endEmployeePositionAssignment(
  employeeId,
  assignmentId,
  endData,
) {
  const response = await apiClient.patch(
    `/api/employees/${employeeId}/position-assignments/${assignmentId}/end`,
    endData,
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to end temporary assignment",
  );

  return {
    message: payload.message,
    assignment: payload.data,
  };
}

// =====================================================
// EMPLOYEE PROFILE
// =====================================================

export async function getEmployeeProfile(
  employeeId,
  { signal } = {},
) {
  const response = await apiClient.get(
    `/api/employees/${employeeId}/profile`,
    { signal },
  );

  return readSuccessfulPayload(
    response,
    "Failed to retrieve employee profile",
  ).data;
}

export async function updateEmployeeProfile(
  employeeId,
  profileData,
) {
  const response = await apiClient.patch(
    `/api/employees/${employeeId}/profile`,
    profileData,
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to update employee profile",
  );

  return {
    message: payload.message,
    profile: payload.data,
  };
}

/**
 * Sensitive values must only be kept in temporary
 * component state. Never store the returned value
 * in localStorage, sessionStorage, or application logs.
 */
export async function revealEmployeeIdentifier(
  employeeId,
  revealData,
) {
  const response = await apiClient.post(
    `/api/employees/${employeeId}/profile/reveal-identifier`,
    revealData,
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to reveal sensitive identifier",
  );

  return {
    message: payload.message,
    identifierType:
      payload.data?.identifierType,
    value: payload.data?.value,
  };
}

// =====================================================
// FAMILY AND EMERGENCY CONTACTS
// =====================================================

export async function getEmployeeFamilyContacts(
  employeeId,
  { signal } = {},
) {
  const response = await apiClient.get(
    `/api/employees/${employeeId}/family-contacts`,
    { signal },
  );

  return readSuccessfulPayload(
    response,
    "Failed to retrieve family contacts",
  ).data;
}

export async function createEmployeeFamilyContact(
  employeeId,
  contactData,
) {
  const response = await apiClient.post(
    `/api/employees/${employeeId}/family-contacts`,
    contactData,
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to create family contact",
  );

  return {
    message: payload.message,
    contact: payload.data,
  };
}

export async function updateEmployeeFamilyContact(
  employeeId,
  contactId,
  contactData,
) {
  const response = await apiClient.patch(
    `/api/employees/${employeeId}/family-contacts/${contactId}`,
    contactData,
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to update family contact",
  );

  return {
    message: payload.message,
    contact: payload.data,
  };
}

export async function archiveEmployeeFamilyContact(
  employeeId,
  contactId,
) {
  const response = await apiClient.delete(
    `/api/employees/${employeeId}/family-contacts/${contactId}`,
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to archive family contact",
  );

  return {
    message: payload.message,
    contact: payload.data,
  };
}

// =====================================================
// EDUCATION RECORDS
// =====================================================

export async function getEmployeeEducationRecords(
  employeeId,
  { signal } = {},
) {
  const response = await apiClient.get(
    `/api/employees/${employeeId}/education`,
    { signal },
  );

  return readSuccessfulPayload(
    response,
    "Failed to retrieve education records",
  ).data;
}

export async function createEmployeeEducationRecord(
  employeeId,
  educationData,
) {
  const response = await apiClient.post(
    `/api/employees/${employeeId}/education`,
    educationData,
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to create education record",
  );

  return {
    message: payload.message,
    educationRecord: payload.data,
  };
}

export async function updateEmployeeEducationRecord(
  employeeId,
  educationId,
  educationData,
) {
  const response = await apiClient.patch(
    `/api/employees/${employeeId}/education/${educationId}`,
    educationData,
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to update education record",
  );

  return {
    message: payload.message,
    educationRecord: payload.data,
  };
}

export async function archiveEmployeeEducationRecord(
  employeeId,
  educationId,
) {
  const response = await apiClient.delete(
    `/api/employees/${employeeId}/education/${educationId}`,
  );

  const payload = readSuccessfulPayload(
    response,
    "Failed to archive education record",
  );

  return {
    message: payload.message,
    educationRecord: payload.data,
  };
}

