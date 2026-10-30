import apiClient from "./apiClient.js";

export async function getLeaveTypes(config = {}) {
  const response = await apiClient.get("/api/leave-types", config);

  return response.data;
}

export async function getLeaveTypeById(leaveTypeId, config = {}) {
  const response = await apiClient.get(
    `/api/leave-types/${leaveTypeId}`,
    config,
  );

  return response.data;
}

export async function createLeaveType(leaveType) {
  const response = await apiClient.post("/api/leave-types", leaveType);

  return response.data;
}

export async function getMyLeaveBalances(year, config = {}) {
  const response = await apiClient.get("/api/me/leave-balances", {
    ...config,
    params: {
      ...config.params,
      year,
    },
  });

  return response.data;
}

export async function getMyLeaveRequests(
  { status = null, page = 1, limit = 20 } = {},
  config = {},
) {
  const response = await apiClient.get("/api/leave-requests/my", {
    ...config,
    params: {
      ...config.params,
      page,
      limit,
      ...(status ? { status } : {}),
    },
  });

  return response.data;
}

export async function getAllLeaveRequests(config = {}) {
  const response = await apiClient.get("/api/leave-requests", config);

  return response.data;
}

export async function getLeaveRequestById(requestId, config = {}) {
  const response = await apiClient.get(
    `/api/leave-requests/${requestId}`,
    config,
  );

  return response.data;
}

export async function getLeaveWorkflow(requestId, config = {}) {
  const response = await apiClient.get(
    `/api/leave-requests/${requestId}/workflow`,
    config,
  );

  return response.data;
}

export async function getMyPendingLeaveApprovals(config = {}) {
  const response = await apiClient.get(
    "/api/leave-requests/approvals/my-pending",
    config,
  );

  return response.data;
}

export async function decideLeaveRequirement(
  requestId,
  requirementId,
  { decision, comment = null },
) {
  const response = await apiClient.patch(
    `/api/leave-requests/${requestId}/requirements/${requirementId}/decision`,
    {
      decision,
      comment,
    },
  );

  return response.data;
}

export async function requestLeaveCancellation(requestId, cancellationReason) {
  const response = await apiClient.post(
    `/api/leave-requests/${requestId}/cancellation-requests`,
    {
      cancellationReason,
    },
  );

  return response.data;
}

export async function getMyPendingLeaveCancellations(config = {}) {
  const response = await apiClient.get(
    "/api/leave-requests/cancellations/my-pending",
    config,
  );

  return response.data;
}

export async function decideLeaveCancellation(
  requestId,
  cancellationId,
  { decision, decisionNote = null },
) {
  const response = await apiClient.patch(
    `/api/leave-requests/${requestId}/cancellation-requests/${cancellationId}/decision`,
    {
      decision,
      decisionNote,
    },
  );

  return response.data;
}

export async function getPendingLeaveReturns(config = {}) {
  const response = await apiClient.get(
    "/api/leave-requests/returns/pending",
    config,
  );

  return response.data;
}

export async function reportLeaveReturn(
  requestId,
  { returnType, actualReturnDate, returnReason = null },
) {
  const response = await apiClient.post(
    `/api/leave-requests/${requestId}/return-records`,
    {
      returnType,
      actualReturnDate,
      returnReason,
    },
  );

  return response.data;
}

export async function verifyLeaveReturn(requestId, returnRecordId) {
  const response = await apiClient.patch(
    `/api/leave-requests/${requestId}/return-records/${returnRecordId}/verify`,
    {},
  );

  return response.data;
}

export async function rejectLeaveReturn(
  requestId,
  returnRecordId,
  rejectionReason,
) {
  const response = await apiClient.patch(
    `/api/leave-requests/${requestId}/return-records/${returnRecordId}/reject`,
    {
      rejectionReason,
    },
  );

  return response.data;
}

export async function correctLeaveReturn(
  requestId,
  returnRecordId,
  { returnType, actualReturnDate, returnReason = null },
) {
  const response = await apiClient.patch(
    `/api/leave-requests/${requestId}/return-records/${returnRecordId}/correct`,
    {
      returnType,
      actualReturnDate,
      returnReason,
    },
  );

  return response.data;
}

export async function grantLeaveEntitlement(entitlement) {
  const response = await apiClient.post("/api/leave-entitlements", entitlement);

  return response.data;
}

export async function generateAnnualEntitlements(asOfDate) {
  const response = await apiClient.post(
    "/api/leave-entitlements/generate-annual",
    {
      asOfDate,
    },
  );

  return response.data;
}

export async function getEmployeesCurrentlyOnLeave() {
  const response = await apiClient.get(
    "/api/leave-requests/currently-on-leave",
  );

  return response.data;
}
export async function getLeaveWorkflowDetails(requestId) {
  const response = await apiClient.get(
    `/api/leave-requests/${requestId}/workflow`,
  );

  return response.data;
}
export async function changeLeaveTypeStatus(leaveTypeId, isActive) {
  const response = await apiClient.patch(
    `/api/leave-types/${leaveTypeId}/status`,
    {
      isActive,
    },
  );

  return response.data;
}
export async function getEntitlementEmployees(config = {}) {
  const response = await apiClient.get("/api/employees", config);

  return response.data;
}

export async function getEmployeeLeaveBalances(employeeId, year, config = {}) {
  const response = await apiClient.get(`/api/leave-balances/${employeeId}`, {
    ...config,
    params: {
      ...config.params,
      year,
    },
  });

  return response.data;
}

export async function grantEmployeeLeaveEntitlement(entitlementData) {
  const response = await apiClient.post(
    "/api/leave-entitlements",
    entitlementData,
  );

  return response.data;
}

export async function generateAnnualLeaveEntitlements(asOfDate) {
  const response = await apiClient.post(
    "/api/leave-entitlements/generate-annual",
    {
      asOfDate,
    },
  );

  return response.data;
}
export async function getPublicHolidays(year, options = {}) {
  const response = await apiClient.get("/api/public-holidays", {
    params: year ? { year } : {},
    ...options,
  });

  return response.data;
}

export async function createPublicHoliday(holiday) {
  const response = await apiClient.post("/api/public-holidays", holiday);

  return response.data;
}

export async function updatePublicHoliday(holidayId, holiday) {
  const response = await apiClient.patch(
    `/api/public-holidays/${holidayId}`,
    holiday,
  );

  return response.data;
}

export async function deletePublicHoliday(holidayId) {
  const response = await apiClient.delete(`/api/public-holidays/${holidayId}`);

  return response.data;
}

export async function generateRwandaHolidayCalendar({ year, dryRun }) {
  const response = await apiClient.post(
    "/api/public-holidays/generate-rwanda-calendar",
    {
      year,
      dryRun,
    },
  );

  return response.data;
}
export async function createLeaveRequest({
  leaveTypeId,
  startDate,
  endDate = null,
  reason,
  attachment = null,
}) {
  const formData = new FormData();

  formData.append("leaveTypeId", String(leaveTypeId));

  formData.append("startDate", startDate);

  if (endDate) {
    formData.append("endDate", endDate);
  }

  formData.append("reason", reason);

  if (attachment) {
    formData.append("attachment", attachment);
  }

  const response = await apiClient.post("/api/leave-requests", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });

  return response.data;
}
