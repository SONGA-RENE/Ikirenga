export const leaveStatusLabels = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  WAITING: "Waiting",
  COMPLETE: "Complete",
  RESERVED: "Reserved",
  RECONCILED: "Reconciled",
  RELEASED: "Released",
  NOT_APPLICABLE: "Not applicable",
  AWAITING_RETURN: "Awaiting return",
  RETURN_REPORTED: "Return reported",
  RETURN_VERIFIED: "Return verified",
};

export function formatLeaveStatus(value) {
  if (!value) {
    return "Not available";
  }

  return (
    leaveStatusLabels[value] ||
    value
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export function getLeaveStatusClass(value) {
  return String(value || "unknown")
    .toLowerCase()
    .replaceAll("_", "-");
}

export function formatLeaveDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function getTodayISODate() {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(now.getMonth() + 1).padStart(2, "0");

  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
