import {
  ArrowLeft,
  CalendarCheck,
  Check,
  CheckCircle2,
  Clock3,
  RotateCcw,
  UserRound,
  X,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import { Link, useNavigate } from "react-router-dom";

import {
  getPendingLeaveReturns,
  rejectLeaveReturn,
  verifyLeaveReturn,
} from "../../api/leaveApi.js";

import LeaveStatusBadge from "./LeaveStatusBadge.jsx";

import { formatLeaveDate, formatLeaveStatus } from "./leaveUtils.js";

function LeaveReturnsPage() {
  const navigate = useNavigate();

  const [returnRecords, setReturnRecords] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  const [selectedRecord, setSelectedRecord] = useState(null);

  const [decision, setDecision] = useState("");

  const [rejectionReason, setRejectionReason] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadReturnRecords = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const result = await getPendingLeaveReturns();

      setReturnRecords(result.data || []);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Unable to load pending leave returns.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReturnRecords();
  }, [loadReturnRecords]);

  function openDecisionModal(record, selectedDecision) {
    setSelectedRecord(record);
    setDecision(selectedDecision);
    setRejectionReason("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeDecisionModal() {
    if (isSubmitting) {
      return;
    }

    setSelectedRecord(null);
    setDecision("");
    setRejectionReason("");
  }

  async function handleDecisionSubmit(event) {
    event.preventDefault();

    if (!selectedRecord) {
      return;
    }

    const normalizedReason = rejectionReason.trim();

    if (decision === "REJECTED" && normalizedReason.length < 5) {
      setErrorMessage(
        "A rejection reason of at least 5 characters is required.",
      );

      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      let result;

      if (decision === "VERIFIED") {
        result = await verifyLeaveReturn(
          selectedRecord.leaveRequestId,
          selectedRecord.returnRecordId,
        );
      } else {
        result = await rejectLeaveReturn(
          selectedRecord.leaveRequestId,
          selectedRecord.returnRecordId,
          normalizedReason,
        );
      }

      setReturnRecords((current) =>
        current.filter(
          (item) => item.returnRecordId !== selectedRecord.returnRecordId,
        ),
      );

      setSuccessMessage(result.message);

      setSelectedRecord(null);
      setDecision("");
      setRejectionReason("");
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "The return decision could not be completed.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="leave-page">
      <div className="leave-page-heading">
        <div>
          <Link to="/leave" className="leave-back-link">
            <ArrowLeft size={17} />
            Leave dashboard
          </Link>

          <p className="eyebrow">Return reconciliation</p>

          <h1>Return verification</h1>

          <p>
            Verify employees returning from leave and reconcile reserved,
            consumed and unused leave days.
          </p>
        </div>

        <div className="leave-heading-summary">
          <Clock3 size={22} />

          <div>
            <strong>{returnRecords.length}</strong>

            <span>Awaiting verification</span>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="leave-feedback success" role="status">
          <CheckCircle2 size={19} />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="leave-feedback error" role="alert">
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div className="leave-loading-state">
          <div className="loading-spinner" />

          <p>Loading return reports...</p>
        </div>
      ) : errorMessage ? null : returnRecords.length === 0 ? (
        <div className="leave-empty-state">
          <CalendarCheck size={42} />

          <h2>The return verification queue is clear</h2>

          <p>
            There are currently no employee return reports awaiting HR
            verification.
          </p>
        </div>
      ) : (
        <div className="leave-request-list">
          {returnRecords.map((record) => (
            <article className="leave-request-card" key={record.returnRecordId}>
              <div className="leave-request-card-header">
                <div className="leave-employee-summary">
                  {record.photoFilename ? (
                    <img
                      src={`${import.meta.env.VITE_API_BASE_URL}/uploads/employees/${record.photoFilename}`}
                      alt=""
                      className="leave-employee-photo"
                    />
                  ) : (
                    <div className="leave-employee-placeholder">
                      <UserRound size={22} />
                    </div>
                  )}

                  <div>
                    <h2>{record.employeeName}</h2>

                    <p>
                      {record.staffNumber}

                      {record.position ? ` · ${record.position}` : ""}
                    </p>
                  </div>
                </div>

                <LeaveStatusBadge status={record.returnRecordStatus} />
              </div>

              <div className="leave-return-summary-grid">
                <div className="leave-return-metric">
                  <span>Approved days</span>
                  <strong>{record.approvedWorkingDays}</strong>
                </div>

                <div className="leave-return-metric consumed">
                  <span>Consumed days</span>
                  <strong>{record.consumedWorkingDays}</strong>
                </div>

                <div className="leave-return-metric restored">
                  <span>Unused days</span>
                  <strong>{record.unusedWorkingDays}</strong>
                </div>
              </div>

              <div className="leave-request-information-grid">
                <div>
                  <span>Leave type</span>

                  <strong>{record.leaveTypeName}</strong>
                </div>

                <div>
                  <span>Return type</span>

                  <strong>{formatLeaveStatus(record.returnType)}</strong>
                </div>

                <div>
                  <span>Actual return date</span>

                  <strong>{formatLeaveDate(record.actualReturnDate)}</strong>
                </div>

                <div>
                  <span>Leave start</span>

                  <strong>{formatLeaveDate(record.startDate)}</strong>
                </div>

                <div>
                  <span>Approved leave end</span>

                  <strong>{formatLeaveDate(record.endDate)}</strong>
                </div>

                <div>
                  <span>Last leave date</span>

                  <strong>{formatLeaveDate(record.actualLastLeaveDate)}</strong>
                </div>

                <div>
                  <span>Reported by</span>

                  <strong>
                    {record.reportedByUserName || "Not available"}
                  </strong>
                </div>

                <div>
                  <span>Reported on</span>

                  <strong>{formatLeaveDate(record.reportedAt)}</strong>
                </div>

                <div>
                  <span>Department</span>

                  <strong>{record.department || "—"}</strong>
                </div>
              </div>

              {record.returnReason && (
                <div className="leave-request-reason">
                  <span>Return reason</span>

                  <p>{record.returnReason}</p>
                </div>
              )}

              <div className="leave-return-warning">
                <RotateCcw size={19} />

                <p>
                  Verification will reconcile this leave allocation:{" "}
                  <strong>{record.consumedWorkingDays} day(s) consumed</strong>{" "}
                  and <strong>{record.unusedWorkingDays} unused day(s)</strong>{" "}
                  restored when still valid.
                </p>
              </div>

              <div className="leave-request-card-footer">
                <button
                  type="button"
                  className="leave-details-button"
                  onClick={() =>
                    navigate(`/leave/requests/${record.leaveRequestId}`)
                  }
                >
                  View leave details
                </button>

                <div className="leave-decision-actions">
                  <button
                    type="button"
                    className="leave-reject-button"
                    onClick={() => openDecisionModal(record, "REJECTED")}
                  >
                    <X size={17} />
                    Reject report
                  </button>

                  <button
                    type="button"
                    className="leave-approve-button"
                    onClick={() => openDecisionModal(record, "VERIFIED")}
                  >
                    <Check size={17} />
                    Verify return
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedRecord && (
        <div
          className="leave-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDecisionModal();
            }
          }}
        >
          <section
            className="leave-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="return-decision-title"
          >
            <div className="leave-modal-header">
              <div>
                <p className="eyebrow">Return reconciliation</p>

                <h2 id="return-decision-title">
                  {decision === "VERIFIED"
                    ? "Verify return report"
                    : "Reject return report"}
                </h2>
              </div>

              <button
                type="button"
                className="leave-modal-close"
                onClick={closeDecisionModal}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="leave-decision-summary">
              <strong>{selectedRecord.employeeName}</strong>

              <span>
                {selectedRecord.leaveTypeName} ·{" "}
                {selectedRecord.approvedWorkingDays} approved day(s)
              </span>

              <span>
                Returned on {formatLeaveDate(selectedRecord.actualReturnDate)}
              </span>
            </div>

            {decision === "VERIFIED" && (
              <div className="leave-reconciliation-preview">
                <div>
                  <span>Consume</span>
                  <strong>{selectedRecord.consumedWorkingDays} day(s)</strong>
                </div>

                <div>
                  <span>Unused</span>
                  <strong>{selectedRecord.unusedWorkingDays} day(s)</strong>
                </div>
              </div>
            )}

            <form onSubmit={handleDecisionSubmit}>
              {decision === "REJECTED" && (
                <label className="form-field">
                  <span>Rejection reason</span>

                  <textarea
                    rows="4"
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="Explain what the employee must correct"
                    required
                  />
                </label>
              )}

              <div className="leave-modal-actions">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={closeDecisionModal}
                  disabled={isSubmitting}
                >
                  Keep reviewing
                </button>

                <button
                  type="submit"
                  className={
                    decision === "VERIFIED"
                      ? "leave-approve-button"
                      : "leave-reject-button"
                  }
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Saving decision..."
                    : decision === "VERIFIED"
                      ? "Confirm verification"
                      : "Confirm rejection"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

export default LeaveReturnsPage;
