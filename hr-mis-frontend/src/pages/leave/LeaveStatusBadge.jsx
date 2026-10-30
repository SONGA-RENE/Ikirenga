import { formatLeaveStatus, getLeaveStatusClass } from "./leaveUtils.js";

function LeaveStatusBadge({ status }) {
  return (
    <span
      className={`leave-status-badge leave-status-${getLeaveStatusClass(
        status,
      )}`}
    >
      {formatLeaveStatus(status)}
    </span>
  );
}

export default LeaveStatusBadge;
