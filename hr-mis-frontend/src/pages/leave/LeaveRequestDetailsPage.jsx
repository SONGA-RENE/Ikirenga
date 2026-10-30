import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  GitBranch,
  RotateCcw,
  UserRound,
  WalletCards,
  XCircle,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import { useNavigate, useParams } from "react-router-dom";

import { getLeaveWorkflowDetails } from "../../api/leaveApi.js";

import LeaveStatusBadge from "./LeaveStatusBadge.jsx";

import { formatLeaveDate, formatLeaveStatus } from "./leaveUtils.js";

import LeaveRequestActions from "./LeaveRequestActions.jsx";

function LeaveRequestDetailsPage() {
  const { requestId } = useParams();

  const navigate = useNavigate();

  const [details, setDetails] = useState(null);

  const [isLoading, setIsLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const loadDetails = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const result = await getLeaveWorkflowDetails(requestId);

      setDetails(result.data);
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Unable to load leave request details.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  if (isLoading) {
    return (
      <div className="leave-loading-state">
        <div className="loading-spinner" />

        <p>Loading leave workflow...</p>
      </div>
    );
  }

  if (errorMessage || !details) {
    return (
      <section className="leave-page">
        <button
          type="button"
          className="leave-back-link"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={17} />
          Go back
        </button>

        <div className="leave-feedback error" role="alert">
          <span>
            {errorMessage || "Leave request details are unavailable."}
          </span>
        </div>
      </section>
    );
  }

  const {
    leaveRequest,
    approvalRequirements = [],
    approvalActions = [],
    allocations = [],
    balanceTransactions = [],
    cancellationHistory = [],
    returnRecord,
  } = details;

  return (
    <section className="leave-page">
      <button
        type="button"
        className="leave-back-link"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft size={17} />
        Go back
      </button>

      <div className="leave-details-header">
        <div className="leave-details-employee">
          {leaveRequest.photoFilename ? (
            <img
              src={`${import.meta.env.VITE_API_BASE_URL}/uploads/employees/${leaveRequest.photoFilename}`}
              alt=""
              className="leave-details-photo"
            />
          ) : (
            <div className="leave-details-photo-placeholder">
              <UserRound size={32} />
            </div>
          )}

          <div>
            <p className="eyebrow">Leave request #{leaveRequest.id}</p>

            <h1>{leaveRequest.employeeName}</h1>

            <p>
              {leaveRequest.staffNumber}

              {leaveRequest.position ? ` · ${leaveRequest.position}` : ""}

              {leaveRequest.department ? ` · ${leaveRequest.department}` : ""}
            </p>
          </div>
        </div>

        <LeaveStatusBadge status={leaveRequest.status} />
      </div>

      <div className="leave-details-summary">
        <div>
          <span>Leave type</span>
          <strong>{leaveRequest.leaveTypeName}</strong>
        </div>

        <div>
          <span>Start date</span>
          <strong>{formatLeaveDate(leaveRequest.startDate)}</strong>
        </div>

        <div>
          <span>End date</span>
          <strong>{formatLeaveDate(leaveRequest.endDate)}</strong>
        </div>

        <div>
          <span>Working days</span>
          <strong>{leaveRequest.requestedDays}</strong>
        </div>

        <div>
          <span>Approval route</span>
          <strong>{formatLeaveStatus(leaveRequest.approvalRoute)}</strong>
        </div>

        <div>
          <span>Current stage</span>
          <strong>{formatLeaveStatus(leaveRequest.currentStage)}</strong>
        </div>
      </div>

      <div className="leave-details-status-grid">
        <div>
          <span>Request status</span>
          <LeaveStatusBadge status={leaveRequest.status} />
        </div>

        <div>
          <span>Balance status</span>
          <LeaveStatusBadge status={leaveRequest.balanceStatus} />
        </div>

        <div>
          <span>Return status</span>
          <LeaveStatusBadge status={leaveRequest.returnStatus} />
        </div>

        <div>
          <span>Cancellation</span>
          <LeaveStatusBadge status={leaveRequest.cancellationStatus} />
        </div>
      </div>

      <LeaveRequestActions
        leaveRequest={leaveRequest}
        returnRecord={returnRecord}
        onChanged={loadDetails}
      />

      <section className="leave-details-section">
        <div className="leave-details-section-header">
          <CalendarDays size={21} />

          <div>
            <h2>Request information</h2>
            <p>Submission and final decision information.</p>
          </div>
        </div>

        <div className="leave-details-information">
          <div>
            <span>Reason</span>
            <strong>{leaveRequest.reason}</strong>
          </div>

          <div>
            <span>Submitted by</span>
            <strong>{leaveRequest.submittedBy || "Not available"}</strong>
          </div>

          <div>
            <span>Submitted on</span>
            <strong>{formatLeaveDate(leaveRequest.submittedAt)}</strong>
          </div>

          <div>
            <span>Final approval by</span>
            <strong>
              {leaveRequest.finalApprovedBy || "Not yet approved"}
            </strong>
          </div>

          <div>
            <span>Final decision date</span>
            <strong>{formatLeaveDate(leaveRequest.finalApprovedAt)}</strong>
          </div>

          <div>
            <span>Decision note</span>
            <strong>{leaveRequest.decisionNote || "No decision note"}</strong>
          </div>
        </div>
      </section>

      <section className="leave-details-section">
        <div className="leave-details-section-header">
          <GitBranch size={21} />

          <div>
            <h2>Approval workflow</h2>
            <p>Required stages and decisions completed for this request.</p>
          </div>
        </div>

        {approvalRequirements.length === 0 ? (
          <p className="leave-details-empty">
            No approval requirements recorded.
          </p>
        ) : (
          <div className="leave-workflow-timeline">
            {approvalRequirements.map((requirement) => (
              <article className="leave-workflow-step" key={requirement.id}>
                <div
                  className={`leave-workflow-marker ${String(
                    requirement.status,
                  ).toLowerCase()}`}
                >
                  {requirement.status === "APPROVED" ? (
                    <CheckCircle2 size={19} />
                  ) : requirement.status === "REJECTED" ? (
                    <XCircle size={19} />
                  ) : (
                    <Clock3 size={19} />
                  )}
                </div>

                <div className="leave-workflow-content">
                  <div>
                    <h3>{formatLeaveStatus(requirement.stage)}</h3>

                    <LeaveStatusBadge status={requirement.status} />
                  </div>

                  <p>
                    Assigned to <strong>{requirement.assignedUserName}</strong>
                    {requirement.assignedUserRole
                      ? ` (${requirement.assignedUserRole})`
                      : ""}
                  </p>

                  {requirement.completedByUserName && (
                    <p>
                      Completed by{" "}
                      <strong>{requirement.completedByUserName}</strong> on{" "}
                      {formatLeaveDate(requirement.completedAt)}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}

        {approvalActions.length > 0 && (
          <div className="leave-action-history">
            <h3>Decision history</h3>

            {approvalActions.map((action) => (
              <div className="leave-action-entry" key={action.id}>
                <div>
                  <strong>{formatLeaveStatus(action.decision)}</strong>

                  <span>{formatLeaveStatus(action.stage)}</span>
                </div>

                <p>{action.comment || "No comment recorded"}</p>

                <small>
                  {action.actionByUserName} · {formatLeaveDate(action.actedAt)}
                </small>
              </div>
            ))}
          </div>
        )}
      </section>

      {(allocations.length > 0 || balanceTransactions.length > 0) && (
        <section className="leave-details-section">
          <div className="leave-details-section-header">
            <WalletCards size={21} />

            <div>
              <h2>Leave balance</h2>
              <p>Entitlement allocations and balance transactions.</p>
            </div>
          </div>

          {allocations.length > 0 && (
            <div className="leave-allocation-grid">
              {allocations.map((allocation) => (
                <article key={allocation.id} className="leave-allocation-card">
                  <div>
                    <span>Entitlement year</span>
                    <strong>{allocation.entitlementYear}</strong>
                  </div>

                  <div>
                    <span>Allocated</span>
                    <strong>{allocation.allocatedDays}</strong>
                  </div>

                  <div>
                    <span>Consumed</span>
                    <strong>{allocation.consumedDays}</strong>
                  </div>

                  <div>
                    <span>Restored</span>
                    <strong>{allocation.restoredDays}</strong>
                  </div>

                  <LeaveStatusBadge status={allocation.status} />
                </article>
              ))}
            </div>
          )}

          {balanceTransactions.length > 0 && (
            <div className="leave-action-history">
              <h3>Balance transactions</h3>

              {balanceTransactions.map((transaction) => (
                <div className="leave-action-entry" key={transaction.id}>
                  <div>
                    <strong>
                      {formatLeaveStatus(transaction.transactionType)}
                    </strong>

                    <span>{transaction.days} day(s)</span>
                  </div>

                  <p>{transaction.transactionNote}</p>

                  <small>
                    {transaction.actionByUserName || "System"} ·{" "}
                    {formatLeaveDate(transaction.createdAt)}
                  </small>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {cancellationHistory.length > 0 && (
        <section className="leave-details-section">
          <div className="leave-details-section-header">
            <RotateCcw size={21} />

            <div>
              <h2>Cancellation history</h2>
              <p>Requests and decisions related to leave cancellation.</p>
            </div>
          </div>

          {cancellationHistory.map((cancellation) => (
            <article className="leave-history-card" key={cancellation.id}>
              <div className="leave-history-card-header">
                <strong>Cancellation #{cancellation.id}</strong>

                <LeaveStatusBadge status={cancellation.status} />
              </div>

              <p>{cancellation.cancellationReason}</p>

              <small>
                Requested by {cancellation.requestedByUserName} on{" "}
                {formatLeaveDate(cancellation.requestedAt)}
              </small>

              {cancellation.decisionNote && (
                <div className="leave-history-note">
                  <span>Decision note</span>
                  <p>{cancellation.decisionNote}</p>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {returnRecord && (
        <section className="leave-details-section">
          <div className="leave-details-section-header">
            <CalendarCheck size={21} />

            <div>
              <h2>Return from leave</h2>
              <p>Reported return and balance reconciliation details.</p>
            </div>
          </div>

          <div className="leave-details-information">
            <div>
              <span>Return type</span>
              <strong>{formatLeaveStatus(returnRecord.returnType)}</strong>
            </div>

            <div>
              <span>Actual return date</span>
              <strong>{formatLeaveDate(returnRecord.actualReturnDate)}</strong>
            </div>

            <div>
              <span>Consumed days</span>
              <strong>{returnRecord.consumedWorkingDays}</strong>
            </div>

            <div>
              <span>Unused days</span>
              <strong>{returnRecord.unusedWorkingDays}</strong>
            </div>

            <div>
              <span>Restored days</span>
              <strong>{returnRecord.balanceDaysRestored}</strong>
            </div>

            <div>
              <span>Status</span>
              <LeaveStatusBadge status={returnRecord.status} />
            </div>
          </div>
        </section>
      )}
    </section>
  );
}

export default LeaveRequestDetailsPage;
