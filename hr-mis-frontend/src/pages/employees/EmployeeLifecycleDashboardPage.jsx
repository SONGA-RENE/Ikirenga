import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileWarning,
  LogOut,
  RefreshCw,
  UserRoundCheck,
  Users,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { getEmployeeLifecycleDashboard } from "../../api/employeeApi.js";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

const separationLabels = {
  RESIGNATION: "Resignation",
  CONTRACT_END: "Contract end",
  TERMINATION: "Termination",
  RETIREMENT: "Retirement",
  REDUNDANCY: "Redundancy",
  DEATH: "Death",
  OTHER: "Other",
};

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const normalizedValue = String(value).slice(0, 10);

  const date = new Date(`${normalizedValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getPhotoUrl(photoFilename) {
  if (!photoFilename) {
    return null;
  }

  return `${apiBaseUrl}/uploads/employees/${encodeURIComponent(photoFilename)}`;
}

function getInitials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function EmployeeAvatar({ name, photoFilename }) {
  const photoUrl = getPhotoUrl(photoFilename);

  return (
    <div className="lifecycle-employee-avatar">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = "none";

            event.currentTarget.nextElementSibling?.removeAttribute("hidden");
          }}
        />
      ) : null}

      <span hidden={Boolean(photoUrl)}>{getInitials(name)}</span>
    </div>
  );
}

function EmployeeLifecycleDashboardPage() {
  const [dashboard, setDashboard] = useState(null);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getEmployeeLifecycleDashboard({
        signal,
      });

      setDashboard(result);
    } catch (requestError) {
      if (
        requestError.name === "CanceledError" ||
        requestError.code === "ERR_CANCELED"
      ) {
        return;
      }

      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to retrieve employee lifecycle dashboard",
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadDashboard(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadDashboard]);

  if (isLoading) {
    return (
      <div className="page-loading-state">
        <div className="loading-spinner" />

        <p>Loading employee lifecycle dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="details-error-state">
        <div className="error-state-icon">
          <AlertCircle size={26} />
        </div>

        <h1>Lifecycle dashboard could not be loaded</h1>

        <p>{error}</p>

        <button
          type="button"
          className="retry-button"
          onClick={() => loadDashboard()}
        >
          <RefreshCw size={17} />
          Try again
        </button>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const {
    overview,
    employeesOnNotice,
    pendingSeparations,
    dueSeparations,
    contractAttention,
    recentExits,
  } = dashboard;

  const summaryCards = [
    {
      label: "Active employees",
      value: overview.activeEmployees,
      icon: UserRoundCheck,
      tone: "success",
    },
    {
      label: "On notice",
      value: overview.employeesOnNotice,
      icon: CalendarClock,
      tone: "warning",
    },
    {
      label: "Pending confirmation",
      value: overview.pendingSeparationConfirmations,
      icon: Clock3,
      tone: "info",
    },
    {
      label: "Ready for completion",
      value: overview.separationsReadyForCompletion,
      icon: CheckCircle2,
      tone: "success",
    },
    {
      label: "Blocked separations",
      value: overview.separationsBlocked,
      icon: AlertCircle,
      tone: "danger",
    },
    {
      label: "Contract attention",
      value: overview.contractAttentionRequired,
      icon: FileWarning,
      tone: "warning",
    },
  ];

  return (
    <>
      <div className="details-page-navigation">
        <Link to="/employees" className="back-link">
          <ArrowLeft size={18} />
          Back to employees
        </Link>
      </div>

      <header className="page-header lifecycle-page-header">
        <div>
          <p className="eyebrow">Employee management</p>

          <h1>Employee lifecycle</h1>

          <p>Monitor notices, separations, exits and contract compliance.</p>
        </div>

        <div className="page-header-icon">
          <Users size={25} />
        </div>
      </header>

      <section className="lifecycle-summary-grid">
        {summaryCards.map((card) => {
          const Icon = card.icon;

          return (
            <article
              className={`lifecycle-summary-card lifecycle-summary-${card.tone}`}
              key={card.label}
            >
              <div className="lifecycle-summary-icon">
                <Icon size={21} />
              </div>

              <div>
                <strong>{card.value}</strong>

                <span>{card.label}</span>
              </div>
            </article>
          );
        })}
      </section>

      <section className="lifecycle-dashboard-grid">
        <article className="lifecycle-panel lifecycle-panel-wide">
          <div className="lifecycle-panel-header">
            <div>
              <h2>Employees on notice</h2>

              <p>Confirmed separations awaiting their final working date.</p>
            </div>

            <span className="panel-count">{employeesOnNotice.length}</span>
          </div>

          {employeesOnNotice.length === 0 ? (
            <div className="lifecycle-empty-state">
              <CalendarClock size={24} />
              <p>No employees are currently serving notice.</p>
            </div>
          ) : (
            <div className="lifecycle-record-list">
              {employeesOnNotice.map((record) => (
                <Link
                  to={`/employees/${record.employeeId}`}
                  className="lifecycle-employee-record"
                  key={record.employeeId}
                >
                  <EmployeeAvatar
                    name={record.employeeName}
                    photoFilename={record.photoFilename}
                  />

                  <div className="lifecycle-record-identity">
                    <strong>{record.employeeName}</strong>

                    <span>
                      {record.staffNumber}
                      {" · "}
                      {record.position || "Position not assigned"}
                    </span>
                  </div>

                  <div className="lifecycle-record-meta">
                    <span>Last working date</span>

                    <strong>{formatDate(record.lastWorkingDate)}</strong>

                    <small>
                      {record.completionDue
                        ? "Completion is due"
                        : `${record.daysRemaining} days remaining`}
                    </small>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="lifecycle-panel">
          <div className="lifecycle-panel-header">
            <div>
              <h2>Pending confirmations</h2>

              <p>Separation records awaiting HR confirmation.</p>
            </div>

            <span className="panel-count">{pendingSeparations.length}</span>
          </div>

          {pendingSeparations.length === 0 ? (
            <div className="lifecycle-empty-state">
              <CheckCircle2 size={24} />

              <p>No separation requests require confirmation.</p>
            </div>
          ) : (
            <div className="lifecycle-record-list compact">
              {pendingSeparations.map((record) => (
                <Link
                  to={`/employees/${record.employeeId}`}
                  className="lifecycle-compact-record"
                  key={record.separationId}
                >
                  <div>
                    <strong>{record.employeeName}</strong>

                    <span>
                      {separationLabels[record.separationType] ||
                        record.separationType}
                    </span>
                  </div>

                  <small>{formatDate(record.lastWorkingDate)}</small>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="lifecycle-panel">
          <div className="lifecycle-panel-header">
            <div>
              <h2>Due separations</h2>

              <p>Confirmed exits whose last working date has arrived.</p>
            </div>

            <span className="panel-count">{dueSeparations.length}</span>
          </div>

          {dueSeparations.length === 0 ? (
            <div className="lifecycle-empty-state">
              <Clock3 size={24} />

              <p>No employee exits are currently due.</p>
            </div>
          ) : (
            <div className="lifecycle-record-list compact">
              {dueSeparations.map((record) => (
                <Link
                  to={`/employees/${record.employeeId}`}
                  className="lifecycle-compact-record"
                  key={record.separationId}
                >
                  <div>
                    <strong>{record.employeeName}</strong>

                    <span>
                      {record.readyForCompletion
                        ? "Ready for completion"
                        : `${record.blockerCount} unresolved blocker${
                            record.blockerCount === 1 ? "" : "s"
                          }`}
                    </span>
                  </div>

                  <span
                    className={
                      record.readyForCompletion
                        ? "lifecycle-ready-badge"
                        : "lifecycle-blocked-badge"
                    }
                  >
                    {record.readyForCompletion ? "Ready" : "Blocked"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="lifecycle-panel lifecycle-panel-wide">
          <div className="lifecycle-panel-header">
            <div>
              <h2>Contract attention required</h2>

              <p>Active employees without a compliant active contract.</p>
            </div>

            <span className="panel-count panel-count-warning">
              {contractAttention.length}
            </span>
          </div>

          {contractAttention.length === 0 ? (
            <div className="lifecycle-empty-state">
              <CheckCircle2 size={24} />

              <p>All active employees have compliant contracts.</p>
            </div>
          ) : (
            <div className="lifecycle-contract-grid">
              {contractAttention.map((record) => (
                <Link
                  to={`/employees/${record.employeeId}`}
                  className="lifecycle-contract-record"
                  key={record.employeeId}
                >
                  <FileWarning size={18} />

                  <div>
                    <strong>{record.employeeName}</strong>

                    <span>
                      {record.staffNumber}
                      {" · "}
                      {record.department || "Unassigned"}
                    </span>
                  </div>

                  <small>No active contract</small>
                </Link>
              ))}
            </div>
          )}
        </article>

        <article className="lifecycle-panel lifecycle-panel-wide">
          <div className="lifecycle-panel-header">
            <div>
              <h2>Recent exits</h2>

              <p>The most recently completed or migrated employee exits.</p>
            </div>

            <LogOut size={20} />
          </div>

          {recentExits.length === 0 ? (
            <div className="lifecycle-empty-state">
              <LogOut size={24} />

              <p>No employee exits have been recorded.</p>
            </div>
          ) : (
            <div className="lifecycle-record-list">
              {recentExits.map((record) => (
                <Link
                  to={`/employees/${record.employeeId}`}
                  className="lifecycle-employee-record"
                  key={record.employeeId}
                >
                  <EmployeeAvatar
                    name={record.employeeName}
                    photoFilename={record.photoFilename}
                  />

                  <div className="lifecycle-record-identity">
                    <strong>{record.employeeName}</strong>

                    <span>
                      {record.staffNumber}
                      {" · "}
                      {record.position || "Position not assigned"}
                    </span>
                  </div>

                  <div className="lifecycle-record-meta">
                    <span>Last working date</span>

                    <strong>{formatDate(record.lastWorkingDate)}</strong>

                    <small>
                      {record.separationType
                        ? separationLabels[record.separationType] ||
                          record.separationType
                        : "Legacy record"}
                    </small>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </article>
      </section>
    </>
  );
}

export default EmployeeLifecycleDashboardPage;
