import { CalendarCheck, CheckCircle2, RotateCcw, X } from "lucide-react";

import { useState } from "react";

import { useAuth } from "../../auth/AuthContext.jsx";

import {
  correctLeaveReturn,
  reportLeaveReturn,
  requestLeaveCancellation,
} from "../../api/leaveApi.js";

import { formatLeaveDate, getTodayISODate } from "./leaveUtils.js";

const returnTypes = [
  {
    value: "SCHEDULED_RETURN",
    label: "Scheduled return",
  },
  {
    value: "EMPLOYER_RECALL",
    label: "Employer recall",
  },
  {
    value: "VOLUNTARY_EARLY_RETURN",
    label: "Voluntary early return",
  },
];

function LeaveRequestActions({ leaveRequest, returnRecord, onChanged }) {
  const { user } = useAuth();

  const [action, setAction] = useState(null);

  const [cancellationReason, setCancellationReason] = useState("");

  const [returnType, setReturnType] = useState("SCHEDULED_RETURN");

  const [actualReturnDate, setActualReturnDate] = useState("");

  const [returnReason, setReturnReason] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  const today = getTodayISODate();

  const isOwner = Number(user?.employeeId) === Number(leaveRequest.employeeId);

  const canManage = ["ADMIN", "HR"].includes(user?.role);

  const mayAct = isOwner || canManage;

  const returnRecordStatus =
    returnRecord?.status || returnRecord?.returnRecordStatus;

  const hasPendingCancellation = leaveRequest.cancellationStatus === "PENDING";

  const hasApprovedCancellation =
    leaveRequest.cancellationStatus === "APPROVED";

  const canRequestCancellation =
    mayAct &&
    leaveRequest.status === "APPROVED" &&
    leaveRequest.startDate > today &&
    !hasPendingCancellation &&
    !hasApprovedCancellation;

  const canReportReturn =
    mayAct &&
    leaveRequest.status === "APPROVED" &&
    leaveRequest.startDate <= today &&
    leaveRequest.returnStatus === "AWAITING_RETURN" &&
    !returnRecord &&
    !hasPendingCancellation &&
    !hasApprovedCancellation;

  const canCorrectReturn =
    mayAct &&
    leaveRequest.status === "APPROVED" &&
    leaveRequest.returnStatus === "AWAITING_RETURN" &&
    returnRecordStatus === "REJECTED";

  const hasAvailableAction =
    canRequestCancellation || canReportReturn || canCorrectReturn;

  function resetForm() {
    setAction(null);
    setCancellationReason("");
    setReturnType("SCHEDULED_RETURN");
    setActualReturnDate("");
    setReturnReason("");
    setErrorMessage("");
  }

  function openReturnAction(selectedAction) {
    setAction(selectedAction);
    setErrorMessage("");
    setSuccessMessage("");

    if (selectedAction === "CORRECT_RETURN" && returnRecord) {
      setReturnType(returnRecord.returnType || "SCHEDULED_RETURN");

      setActualReturnDate(returnRecord.actualReturnDate || "");

      setReturnReason(returnRecord.returnReason || "");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const normalizedCancellationReason = cancellationReason.trim();

    const normalizedReturnReason = returnReason.trim();

    if (action === "CANCEL" && normalizedCancellationReason.length < 5) {
      setErrorMessage(
        "Cancellation reason must contain at least 5 characters.",
      );

      return;
    }

    if (
      ["REPORT_RETURN", "CORRECT_RETURN"].includes(action) &&
      !actualReturnDate
    ) {
      setErrorMessage("Actual return date is required.");

      return;
    }

    if (
      ["REPORT_RETURN", "CORRECT_RETURN"].includes(action) &&
      returnType !== "SCHEDULED_RETURN" &&
      normalizedReturnReason.length < 5
    ) {
      setErrorMessage("A return reason of at least 5 characters is required.");

      return;
    }

    setIsSubmitting(true);

    try {
      let result;

      if (action === "CANCEL") {
        result = await requestLeaveCancellation(
          leaveRequest.id,
          normalizedCancellationReason,
        );
      } else {
        const returnData = {
          returnType,
          actualReturnDate,

          returnReason:
            returnType === "SCHEDULED_RETURN" ? null : normalizedReturnReason,
        };

        if (action === "REPORT_RETURN") {
          result = await reportLeaveReturn(leaveRequest.id, returnData);
        } else {
          result = await correctLeaveReturn(
            leaveRequest.id,
            returnRecord.id || returnRecord.returnRecordId,
            returnData,
          );
        }
      }

      setSuccessMessage(result.message);

      resetForm();

      if (onChanged) {
        await onChanged();
      }
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "The requested action could not be completed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!hasAvailableAction && !successMessage) {
    return null;
  }

  return (
    <>
      {successMessage && (
        <div className="leave-feedback success" role="status">
          <CheckCircle2 size={19} />
          <span>{successMessage}</span>
        </div>
      )}

      {hasAvailableAction && (
        <section className="leave-request-actions-panel">
          <div>
            <p className="eyebrow">Available actions</p>

            <h2>Manage this leave request</h2>

            <p>
              Available actions depend on the request status and approved dates.
            </p>
          </div>

          <div className="leave-request-actions-buttons">
            {canRequestCancellation && (
              <button
                type="button"
                className="leave-cancellation-action"
                onClick={() => {
                  setAction("CANCEL");
                  setErrorMessage("");
                  setSuccessMessage("");
                }}
              >
                <RotateCcw size={18} />
                Request cancellation
              </button>
            )}

            {canReportReturn && (
              <button
                type="button"
                className="leave-return-action"
                onClick={() => openReturnAction("REPORT_RETURN")}
              >
                <CalendarCheck size={18} />
                Report return
              </button>
            )}

            {canCorrectReturn && (
              <button
                type="button"
                className="leave-return-action"
                onClick={() => openReturnAction("CORRECT_RETURN")}
              >
                <CalendarCheck size={18} />
                Correct return report
              </button>
            )}
          </div>
        </section>
      )}

      {action && (
        <div
          className="leave-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) {
              resetForm();
            }
          }}
        >
          <section
            className="leave-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-action-title"
          >
            <div className="leave-modal-header">
              <div>
                <p className="eyebrow">Employee self-service</p>

                <h2 id="leave-action-title">
                  {action === "CANCEL"
                    ? "Request leave cancellation"
                    : action === "CORRECT_RETURN"
                      ? "Correct return report"
                      : "Report return from leave"}
                </h2>
              </div>

              <button
                type="button"
                className="leave-modal-close"
                onClick={resetForm}
                disabled={isSubmitting}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="leave-decision-summary">
              <strong>{leaveRequest.leaveTypeName}</strong>

              <span>
                {formatLeaveDate(leaveRequest.startDate)} –{" "}
                {formatLeaveDate(leaveRequest.endDate)}
              </span>

              <span>{leaveRequest.requestedDays} working day(s)</span>
            </div>

            {errorMessage && (
              <div className="leave-feedback error" role="alert">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {action === "CANCEL" ? (
                <label className="form-field">
                  <span>Cancellation reason</span>

                  <textarea
                    rows="4"
                    value={cancellationReason}
                    onChange={(event) =>
                      setCancellationReason(event.target.value)
                    }
                    placeholder="Explain why this approved leave is no longer required"
                    required
                  />
                </label>
              ) : (
                <>
                  <label className="form-field">
                    <span>Return type</span>

                    <select
                      value={returnType}
                      onChange={(event) => setReturnType(event.target.value)}
                    >
                      {returnTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="form-field">
                    <span>Actual return date</span>

                    <input
                      type="date"
                      value={actualReturnDate}
                      min={leaveRequest.startDate}
                      max={today}
                      onChange={(event) =>
                        setActualReturnDate(event.target.value)
                      }
                      required
                    />
                  </label>

                  {returnType !== "SCHEDULED_RETURN" && (
                    <label className="form-field">
                      <span>Return reason</span>

                      <textarea
                        rows="4"
                        value={returnReason}
                        onChange={(event) =>
                          setReturnReason(event.target.value)
                        }
                        placeholder="Explain the early return or employer recall"
                        required
                      />
                    </label>
                  )}
                </>
              )}

              <div className="leave-modal-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={resetForm}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className={
                    action === "CANCEL"
                      ? "leave-cancellation-action"
                      : "leave-return-action"
                  }
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Submitting..."
                    : action === "CANCEL"
                      ? "Submit cancellation"
                      : action === "CORRECT_RETURN"
                        ? "Resubmit report"
                        : "Submit return report"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

export default LeaveRequestActions;
