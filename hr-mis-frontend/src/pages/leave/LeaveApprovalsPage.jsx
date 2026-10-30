import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  UserRound,
  X,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import { Link, useNavigate } from "react-router-dom";

import {
  decideLeaveRequirement,
  getMyPendingLeaveApprovals,
} from "../../api/leaveApi.js";

import LeaveStatusBadge from "./LeaveStatusBadge.jsx";

import { formatLeaveDate } from "./leaveUtils.js";

function LeaveApprovalsPage() {
  const navigate = useNavigate();

  const [approvals, setApprovals] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const [selectedApproval, setSelectedApproval] = useState(null);

  const [decision, setDecision] = useState("");

  const [comment, setComment] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [successMessage, setSuccessMessage] = useState("");

  const loadApprovals = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const result = await getMyPendingLeaveApprovals();

      setApprovals(result.data || []);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Unable to load pending leave approvals.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  function openDecisionModal(approval, selectedDecision) {
    setSelectedApproval(approval);
    setDecision(selectedDecision);
    setComment("");
    setErrorMessage("");
    setSuccessMessage("");
  }

  function closeDecisionModal() {
    if (isSubmitting) {
      return;
    }

    setSelectedApproval(null);
    setDecision("");
    setComment("");
  }

  async function handleDecisionSubmit(event) {
    event.preventDefault();

    if (!selectedApproval) {
      return;
    }

    const normalizedComment = comment.trim();

    if (decision === "REJECTED" && normalizedComment.length < 5) {
      setErrorMessage(
        "A rejection comment of at least 5 characters is required.",
      );

      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const result = await decideLeaveRequirement(
        selectedApproval.leaveRequestId,
        selectedApproval.requirementId,
        decision,
        normalizedComment || null,
      );

      setSuccessMessage(result.message);

      setApprovals((current) =>
        current.filter(
          (item) => item.requirementId !== selectedApproval.requirementId,
        ),
      );

      closeDecisionModal();
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "The leave decision could not be completed.",
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

          <p className="eyebrow">Approval workflow</p>

          <h1>Pending leave approvals</h1>

          <p>
            Review requests assigned to your account and complete the current
            workflow stage.
          </p>
        </div>

        <div className="leave-heading-summary">
          <Clock3 size={22} />

          <div>
            <strong>{approvals.length}</strong>
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
          <p>Loading pending approvals...</p>
        </div>
      ) : approvals.length === 0 ? (
        <div className="leave-empty-state">
          <CheckCircle2 size={42} />

          <h2>Your approval queue is clear</h2>

          <p>There are currently no leave requests awaiting your decision.</p>
        </div>
      ) : (
        <div className="leave-request-list">
          {approvals.map((approval) => (
            <article
              className="leave-request-card"
              key={approval.requirementId}
            >
              <div className="leave-request-card-header">
                <div className="leave-employee-summary">
                  {approval.photoFilename ? (
                    <img
                      src={`${import.meta.env.VITE_API_BASE_URL}/uploads/employees/${approval.photoFilename}`}
                      alt=""
                      className="leave-employee-photo"
                    />
                  ) : (
                    <div className="leave-employee-placeholder">
                      <UserRound size={22} />
                    </div>
                  )}

                  <div>
                    <h2>{approval.employeeName}</h2>

                    <p>
                      {approval.staffNumber}
                      {approval.position ? ` · ${approval.position}` : ""}
                    </p>
                  </div>
                </div>

                <LeaveStatusBadge status={approval.requirementStatus} />
              </div>

              <div className="leave-request-information-grid">
                <div>
                  <span>Leave type</span>
                  <strong>{approval.leaveTypeName}</strong>
                </div>

                <div>
                  <span>Current stage</span>
                  <strong>{approval.stage}</strong>
                </div>

                <div>
                  <span>Start date</span>
                  <strong>{formatLeaveDate(approval.startDate)}</strong>
                </div>

                <div>
                  <span>End date</span>
                  <strong>{formatLeaveDate(approval.endDate)}</strong>
                </div>

                <div>
                  <span>Working days</span>
                  <strong>{approval.requestedDays}</strong>
                </div>

                <div>
                  <span>Department</span>
                  <strong>{approval.department || "—"}</strong>
                </div>
              </div>

              <div className="leave-request-reason">
                <span>Reason</span>
                <p>{approval.reason}</p>
              </div>

              <div className="leave-request-card-footer">
                <button
                  type="button"
                  className="leave-details-button"
                  onClick={() =>
                    navigate(`/leave/requests/${approval.leaveRequestId}`)
                  }
                >
                  <CalendarDays size={17} />
                  View workflow
                </button>

                <div className="leave-decision-actions">
                  <button
                    type="button"
                    className="leave-reject-button"
                    onClick={() => openDecisionModal(approval, "REJECTED")}
                  >
                    <X size={17} />
                    Reject
                  </button>

                  <button
                    type="button"
                    className="leave-approve-button"
                    onClick={() => openDecisionModal(approval, "APPROVED")}
                  >
                    <Check size={17} />
                    Approve
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {selectedApproval && (
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
            aria-labelledby="decision-modal-title"
          >
            <div className="leave-modal-header">
              <div>
                <p className="eyebrow">{selectedApproval.stage} decision</p>

                <h2 id="decision-modal-title">
                  {decision === "APPROVED"
                    ? "Approve leave request"
                    : "Reject leave request"}
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
              <strong>{selectedApproval.employeeName}</strong>

              <span>
                {selectedApproval.leaveTypeName} ·{" "}
                {selectedApproval.requestedDays} working day(s)
              </span>

              <span>
                {formatLeaveDate(selectedApproval.startDate)} –{" "}
                {formatLeaveDate(selectedApproval.endDate)}
              </span>
            </div>

            <form onSubmit={handleDecisionSubmit}>
              <label className="form-field">
                <span>
                  {decision === "REJECTED"
                    ? "Rejection reason"
                    : "Decision comment"}
                </span>

                <textarea
                  rows="4"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder={
                    decision === "REJECTED"
                      ? "Explain why this request is being rejected"
                      : "Add an optional approval comment"
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
                  Cancel
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
                      ? "Confirm approval"
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

export default LeaveApprovalsPage;
