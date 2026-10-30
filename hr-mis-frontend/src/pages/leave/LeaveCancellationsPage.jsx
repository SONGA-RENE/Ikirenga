import {
  ArrowLeft,
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
  decideLeaveCancellation,
  getMyPendingLeaveCancellations,
} from "../../api/leaveApi.js";

import LeaveStatusBadge from "./LeaveStatusBadge.jsx";

import { formatLeaveDate } from "./leaveUtils.js";

function LeaveCancellationsPage() {
  const navigate = useNavigate();

  const [cancellations, setCancellations] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  const [selectedCancellation, setSelectedCancellation] = useState(null);

  const [decision, setDecision] = useState("");

  const [decisionNote, setDecisionNote] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadCancellations = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const result = await getMyPendingLeaveCancellations();

      setCancellations(result.data || []);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Unable to load pending cancellation requests.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCancellations();
  }, [loadCancellations]);

  function openDecisionModal(cancellation, selectedDecision) {
    setSelectedCancellation(cancellation);
    setDecision(selectedDecision);
    setDecisionNote("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeDecisionModal() {
    if (isSubmitting) {
      return;
    }

    setSelectedCancellation(null);
    setDecision("");
    setDecisionNote("");
  }

  async function handleDecisionSubmit(event) {
    event.preventDefault();

    if (!selectedCancellation) {
      return;
    }

    const normalizedNote = decisionNote.trim();

    if (decision === "REJECTED" && normalizedNote.length < 5) {
      setErrorMessage("A rejection note of at least 5 characters is required.");

      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result = await decideLeaveCancellation(
        selectedCancellation.leaveRequestId,
        selectedCancellation.cancellationId,
        decision,
        normalizedNote || null,
      );

      setCancellations((current) =>
        current.filter(
          (item) => item.cancellationId !== selectedCancellation.cancellationId,
        ),
      );

      setSuccessMessage(result.message);

      setSelectedCancellation(null);
      setDecision("");
      setDecisionNote("");
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "The cancellation decision could not be completed.",
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

          <p className="eyebrow">Cancellation workflow</p>

          <h1>Pending cancellations</h1>

          <p>
            Review approved leave requests that employees have requested to
            cancel.
          </p>
        </div>

        <div className="leave-heading-summary">
          <Clock3 size={22} />

          <div>
            <strong>{cancellations.length}</strong>

            <span>Awaiting your decision</span>
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
          <p>Loading pending cancellations...</p>
        </div>
      ) : cancellations.length === 0 ? (
        <div className="leave-empty-state">
          <CheckCircle2 size={42} />

          <h2>Your cancellation queue is clear</h2>

          <p>
            There are currently no leave cancellation requests awaiting your
            decision.
          </p>
        </div>
      ) : (
        <div className="leave-request-list">
          {cancellations.map((cancellation) => (
            <article
              className="leave-request-card"
              key={cancellation.cancellationId}
            >
              <div className="leave-request-card-header">
                <div className="leave-employee-summary">
                  {cancellation.photoFilename ? (
                    <img
                      src={`${import.meta.env.VITE_API_BASE_URL}/uploads/employees/${cancellation.photoFilename}`}
                      alt=""
                      className="leave-employee-photo"
                    />
                  ) : (
                    <div className="leave-employee-placeholder">
                      <UserRound size={22} />
                    </div>
                  )}

                  <div>
                    <h2>{cancellation.employeeName}</h2>

                    <p>
                      {cancellation.staffNumber}

                      {cancellation.position
                        ? ` · ${cancellation.position}`
                        : ""}
                    </p>
                  </div>
                </div>

                <LeaveStatusBadge status={cancellation.cancellationStatus} />
              </div>

              <div className="leave-request-information-grid">
                <div>
                  <span>Leave type</span>

                  <strong>{cancellation.leaveTypeName}</strong>
                </div>

                <div>
                  <span>Requested days</span>

                  <strong>{cancellation.requestedDays}</strong>
                </div>

                <div>
                  <span>Reserved days</span>

                  <strong>{cancellation.reservedDays}</strong>
                </div>

                <div>
                  <span>Start date</span>

                  <strong>{formatLeaveDate(cancellation.startDate)}</strong>
                </div>

                <div>
                  <span>End date</span>

                  <strong>{formatLeaveDate(cancellation.endDate)}</strong>
                </div>

                <div>
                  <span>Requested by</span>

                  <strong>{cancellation.requestedByUserName}</strong>
                </div>

                <div>
                  <span>Requested on</span>

                  <strong>{formatLeaveDate(cancellation.requestedAt)}</strong>
                </div>

                <div>
                  <span>Department</span>

                  <strong>{cancellation.department || "—"}</strong>
                </div>

                <div>
                  <span>Approval route</span>

                  <strong>
                    {cancellation.approvalRoute?.replaceAll("_", " ") || "—"}
                  </strong>
                </div>
              </div>

              <div className="leave-request-reason cancellation">
                <span>Cancellation reason</span>

                <p>{cancellation.cancellationReason}</p>
              </div>

              <div className="leave-cancellation-warning">
                <RotateCcw size={19} />

                <p>
                  Approving this cancellation will cancel the leave request and
                  release{" "}
                  <strong>{cancellation.reservedDays} reserved day(s)</strong>.
                </p>
              </div>

              <div className="leave-request-card-footer">
                <button
                  type="button"
                  className="leave-details-button"
                  onClick={() =>
                    navigate(`/leave/requests/${cancellation.leaveRequestId}`)
                  }
                >
                  View leave details
                </button>

                <div className="leave-decision-actions">
                  <button
                    type="button"
                    className="leave-reject-button"
                    onClick={() => openDecisionModal(cancellation, "REJECTED")}
                  >
                    <X size={17} />
                    Reject cancellation
                  </button>

                  <button
                    type="button"
                    className="leave-approve-button"
                    onClick={() => openDecisionModal(cancellation, "APPROVED")}
                  >
                    <Check size={17} />
                    Approve cancellation
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedCancellation && (
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
            aria-labelledby="cancellation-modal-title"
          >
            <div className="leave-modal-header">
              <div>
                <p className="eyebrow">Cancellation decision</p>

                <h2 id="cancellation-modal-title">
                  {decision === "APPROVED"
                    ? "Approve cancellation"
                    : "Reject cancellation"}
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
              <strong>{selectedCancellation.employeeName}</strong>

              <span>
                {selectedCancellation.leaveTypeName} ·{" "}
                {selectedCancellation.requestedDays} working day(s)
              </span>

              <span>
                {formatLeaveDate(selectedCancellation.startDate)} –{" "}
                {formatLeaveDate(selectedCancellation.endDate)}
              </span>
            </div>

            {decision === "APPROVED" && (
              <div className="leave-modal-warning">
                <RotateCcw size={19} />

                <p>
                  This will cancel the approved leave and release{" "}
                  <strong>
                    {selectedCancellation.reservedDays} reserved day(s)
                  </strong>
                  .
                </p>
              </div>
            )}

            <form onSubmit={handleDecisionSubmit}>
              <label className="form-field">
                <span>
                  {decision === "REJECTED"
                    ? "Rejection reason"
                    : "Decision note"}
                </span>

                <textarea
                  rows="4"
                  value={decisionNote}
                  onChange={(event) => setDecisionNote(event.target.value)}
                  placeholder={
                    decision === "REJECTED"
                      ? "Explain why the cancellation is rejected"
                      : "Add a note confirming your review"
                  }
                  required={decision === "REJECTED"}
                />
              </label>

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
                    decision === "APPROVED"
                      ? "leave-approve-button"
                      : "leave-reject-button"
                  }
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Saving decision..."
                    : decision === "APPROVED"
                      ? "Confirm cancellation"
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

export default LeaveCancellationsPage;
