import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  Plus,
  RefreshCw,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { getMyLeaveRequests } from "../../api/leaveApi.js";

import LeaveStatusBadge from "./LeaveStatusBadge.jsx";

import { formatLeaveDate, formatLeaveStatus } from "./leaveUtils.js";

import "./leave.css";

const statusOptions = ["", "PENDING", "APPROVED", "REJECTED", "CANCELLED"];

function MyLeaveRequestsPage() {
  const [requests, setRequests] = useState([]);

  const [status, setStatus] = useState("");

  const [page, setPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const loadRequests = useCallback(
    async (signal) => {
      setIsLoading(true);
      setError("");

      try {
        const result = await getMyLeaveRequests(
          {
            status: status || null,
            page,
            limit: 10,
          },
          { signal },
        );

        setRequests(Array.isArray(result.data) ? result.data : []);

        setPagination({
          page: result.pagination?.page || page,

          totalPages: result.pagination?.totalPages || 1,

          total: result.total ?? result.count ?? 0,
        });
      } catch (requestError) {
        if (
          requestError.name === "CanceledError" ||
          requestError.code === "ERR_CANCELED"
        ) {
          return;
        }

        setError(
          requestError.response?.data?.message ||
            "Unable to load leave requests",
        );
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [page, status],
  );

  useEffect(() => {
    const controller = new AbortController();

    loadRequests(controller.signal);

    return () => controller.abort();
  }, [loadRequests]);

  function changeStatus(event) {
    setStatus(event.target.value);
    setPage(1);
  }

  return (
    <div className="leave-page">
      <div className="details-page-navigation">
        <Link to="/leave" className="back-link">
          <ArrowLeft size={18} />
          Leave management
        </Link>
      </div>

      <header className="leave-list-header">
        <div>
          <p className="eyebrow">Employee self-service</p>

          <h1>My leave requests</h1>

          <p>Review your submitted leave requests and their workflow status.</p>
        </div>

        <Link to="/leave/request" className="page-primary-action">
          <Plus size={18} />
          Request leave
        </Link>
      </header>

      <section className="leave-toolbar">
        <div>
          <strong>{pagination.total}</strong>

          <span>
            request
            {pagination.total === 1 ? "" : "s"}
          </span>
        </div>

        <label>
          <span>Status</span>

          <select value={status} onChange={changeStatus}>
            {statusOptions.map((option) => (
              <option key={option || "ALL"} value={option}>
                {option ? formatLeaveStatus(option) : "All statuses"}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && (
        <div className="leave-error-state">
          <AlertCircle size={26} />

          <h2>Leave requests could not be loaded</h2>

          <p>{error}</p>

          <button
            type="button"
            className="retry-button"
            onClick={() => loadRequests()}
          >
            <RefreshCw size={17} />
            Try again
          </button>
        </div>
      )}

      {!error && isLoading && (
        <div className="page-loading-state">
          <div className="loading-spinner" />

          <p>Loading leave requests...</p>
        </div>
      )}

      {!error && !isLoading && requests.length === 0 && (
        <div className="leave-empty-state">
          <CalendarDays size={30} />

          <h2>No leave requests found</h2>

          <p>No requests match the selected status.</p>

          <Link to="/leave/request" className="page-primary-action">
            <Plus size={18} />
            Request leave
          </Link>
        </div>
      )}

      {!error && !isLoading && requests.length > 0 && (
        <section className="my-leave-request-list">
          {requests.map((request) => (
            <article className="leave-request-item" key={request.id}>
              <div className="leave-request-item-main">
                <div>
                  <span className="leave-type-code">
                    {request.leaveTypeCode}
                  </span>

                  <h2>{request.leaveTypeName}</h2>
                </div>

                <LeaveStatusBadge status={request.status} />
              </div>

              <div className="leave-request-dates">
                <div>
                  <span>Start</span>

                  <strong>{formatLeaveDate(request.startDate)}</strong>
                </div>

                <div>
                  <span>End</span>

                  <strong>{formatLeaveDate(request.endDate)}</strong>
                </div>

                <div>
                  <span>Working days</span>

                  <strong>{request.requestedDays}</strong>
                </div>

                <div>
                  <span>Current stage</span>

                  <strong>{formatLeaveStatus(request.currentStage)}</strong>
                </div>
              </div>

              <p className="my-leave-request-reason">{request.reason}</p>

              <div className="leave-request-footer">
                <div className="leave-request-secondary-status">
                  <span>
                    Balance:{" "}
                    <strong>{formatLeaveStatus(request.balanceStatus)}</strong>
                  </span>

                  <span>
                    Return:{" "}
                    <strong>{formatLeaveStatus(request.returnStatus)}</strong>
                  </span>
                </div>

                <Link
                  to={`/leave/requests/${request.id}`}
                  className="leave-view-link"
                >
                  <Eye size={17} />
                  View details
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}

      {!error && pagination.totalPages > 1 && (
        <nav className="leave-pagination" aria-label="Leave request pages">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            <ChevronLeft size={18} />
            Previous
          </button>

          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>

          <button
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
            <ChevronRight size={18} />
          </button>
        </nav>
      )}
    </div>
  );
}

export default MyLeaveRequestsPage;
