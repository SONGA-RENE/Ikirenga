import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  Eye,
  RefreshCw,
  Search,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, Navigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext.jsx";

import { getAllLeaveRequests } from "../../api/leaveApi.js";

import LeaveStatusBadge from "./LeaveStatusBadge.jsx";

import { formatLeaveDate, formatLeaveStatus } from "./leaveUtils.js";

import "./leave.css";

const statusOptions = ["", "PENDING", "APPROVED", "REJECTED", "CANCELLED"];

function AllLeaveRequestsPage() {
  const { user } = useAuth();

  const mayViewAllRequests = ["ADMIN", "HR"].includes(user?.role);

  const [requests, setRequests] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] = useState("");

  const [leaveTypeFilter, setLeaveTypeFilter] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const loadRequests = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getAllLeaveRequests({
        signal,
      });

      setRequests(Array.isArray(result.data) ? result.data : []);
    } catch (requestError) {
      if (
        requestError.name === "CanceledError" ||
        requestError.code === "ERR_CANCELED"
      ) {
        return;
      }

      setError(
        requestError.response?.data?.message || "Unable to load leave requests",
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadRequests(controller.signal);

    return () => controller.abort();
  }, [loadRequests]);

  const leaveTypes = useMemo(() => {
    const types = new Map();

    requests.forEach((request) => {
      if (request.leaveTypeCode) {
        types.set(request.leaveTypeCode, request.leaveTypeName);
      }
    });

    return Array.from(types.entries())
      .map(([code, name]) => ({
        code,
        name,
      }))
      .sort((first, second) => first.name.localeCompare(second.name));
  }, [requests]);

  const filteredRequests = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return requests.filter((request) => {
      const employeeName = [request.firstName, request.lastName]
        .filter(Boolean)
        .join(" ");

      const matchesSearch =
        !normalizedSearch ||
        employeeName.toLowerCase().includes(normalizedSearch) ||
        String(request.staffNumber || "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        String(request.leaveTypeName || "")
          .toLowerCase()
          .includes(normalizedSearch) ||
        String(request.reason || "")
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesStatus = !statusFilter || request.status === statusFilter;

      const matchesLeaveType =
        !leaveTypeFilter || request.leaveTypeCode === leaveTypeFilter;

      return matchesSearch && matchesStatus && matchesLeaveType;
    });
  }, [requests, searchTerm, statusFilter, leaveTypeFilter]);

  const summary = useMemo(
    () => ({
      total: requests.length,

      pending: requests.filter((request) => request.status === "PENDING")
        .length,

      approved: requests.filter((request) => request.status === "APPROVED")
        .length,

      closed: requests.filter((request) =>
        ["REJECTED", "CANCELLED"].includes(request.status),
      ).length,
    }),
    [requests],
  );

  if (!mayViewAllRequests) {
    return <Navigate to="/leave" replace />;
  }

  return (
    <div className="leave-page">
      <div className="details-page-navigation">
        <Link to="/leave" className="back-link">
          <ArrowLeft size={18} />
          Leave dashboard
        </Link>
      </div>

      <header className="leave-list-header">
        <div>
          <p className="eyebrow">HR leave administration</p>

          <h1>All leave requests</h1>

          <p>Review leave requests submitted across the organization.</p>
        </div>
      </header>

      <section className="all-leave-summary-grid">
        <article className="all-leave-summary-card">
          <span>Total requests</span>
          <strong>{summary.total}</strong>
        </article>

        <article className="all-leave-summary-card pending">
          <span>Pending</span>
          <strong>{summary.pending}</strong>
        </article>

        <article className="all-leave-summary-card approved">
          <span>Approved</span>
          <strong>{summary.approved}</strong>
        </article>

        <article className="all-leave-summary-card closed">
          <span>Rejected or cancelled</span>
          <strong>{summary.closed}</strong>
        </article>
      </section>

      <section className="all-leave-filters">
        <label className="all-leave-search">
          <span>Search requests</span>

          <div>
            <Search size={19} />

            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Employee, staff number, leave type or reason"
            />
          </div>
        </label>

        <label>
          <span>Status</span>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            {statusOptions.map((option) => (
              <option key={option || "ALL"} value={option}>
                {option ? formatLeaveStatus(option) : "All statuses"}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Leave type</span>

          <select
            value={leaveTypeFilter}
            onChange={(event) => setLeaveTypeFilter(event.target.value)}
          >
            <option value="">All leave types</option>

            {leaveTypes.map((leaveType) => (
              <option key={leaveType.code} value={leaveType.code}>
                {leaveType.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {error && (
        <div className="leave-error-state">
          <AlertCircle size={28} />

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

      {!error && !isLoading && filteredRequests.length === 0 && (
        <div className="leave-empty-state">
          <CalendarDays size={30} />

          <h2>No leave requests found</h2>

          <p>No records match the selected filters.</p>
        </div>
      )}

      {!error && !isLoading && filteredRequests.length > 0 && (
        <section className="all-leave-request-list">
          <div className="all-leave-result-count">
            <strong>{filteredRequests.length}</strong>

            <span>
              result
              {filteredRequests.length === 1 ? "" : "s"}
            </span>
          </div>

          {filteredRequests.map((request) => {
            const employeeName = [request.firstName, request.lastName]
              .filter(Boolean)
              .join(" ");

            return (
              <article className="all-leave-request-card" key={request.id}>
                <div className="all-leave-request-header">
                  <div>
                    <span className="leave-type-code">
                      {request.leaveTypeCode}
                    </span>

                    <h2>{employeeName}</h2>

                    <p>
                      {request.staffNumber} · {request.leaveTypeName}
                    </p>
                  </div>

                  <LeaveStatusBadge status={request.status} />
                </div>

                <div className="all-leave-request-grid">
                  <div>
                    <span>Start date</span>

                    <strong>{formatLeaveDate(request.startDate)}</strong>
                  </div>

                  <div>
                    <span>End date</span>

                    <strong>{formatLeaveDate(request.endDate)}</strong>
                  </div>

                  <div>
                    <span>Working days</span>

                    <strong>{request.requestedDays}</strong>
                  </div>

                  <div>
                    <span>Submitted</span>

                    <strong>{formatLeaveDate(request.createdAt)}</strong>
                  </div>
                </div>

                <div className="all-leave-request-reason">
                  <span>Reason</span>

                  <p>{request.reason}</p>
                </div>

                {request.decisionNote && (
                  <div className="all-leave-decision-note">
                    <span>Decision note</span>

                    <p>{request.decisionNote}</p>
                  </div>
                )}

                <footer className="all-leave-request-footer">
                  <span>Request #{request.id}</span>

                  <Link
                    to={`/leave/requests/${request.id}`}
                    className="leave-view-link"
                  >
                    <Eye size={17} />
                    View details
                  </Link>
                </footer>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

export default AllLeaveRequestsPage;
