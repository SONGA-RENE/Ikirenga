import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  UserRound,
  Users,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Link } from "react-router-dom";

import { getEmployeesCurrentlyOnLeave } from "../../api/leaveApi.js";

import { formatLeaveDate } from "./leaveUtils.js";

function EmployeesOnLeavePage() {
  const [employees, setEmployees] = useState([]);

  const [summary, setSummary] = useState({
    currentlyOnLeave: 0,
    returningSoon: 0,
  });

  const [filter, setFilter] = useState("ALL");

  const [isLoading, setIsLoading] = useState(true);

  const [errorMessage, setErrorMessage] = useState("");

  const loadEmployees = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const result = await getEmployeesCurrentlyOnLeave();

      setEmployees(result.data || []);

      setSummary(
        result.summary || {
          currentlyOnLeave: result.data?.length || 0,
          returningSoon: 0,
        },
      );
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          "Unable to load employees currently on leave.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const visibleEmployees = useMemo(() => {
    if (filter === "RETURNING_SOON") {
      return employees.filter((employee) => employee.isReturningSoon);
    }

    return employees;
  }, [employees, filter]);

  return (
    <section className="leave-page">
      <div className="leave-page-heading">
        <div>
          <Link to="/leave" className="leave-back-link">
            <ArrowLeft size={17} />
            Leave dashboard
          </Link>

          <p className="eyebrow">Staff attendance</p>

          <h1>Employees currently on leave</h1>

          <p>
            Monitor employees who are away on approved leave and their expected
            return dates.
          </p>
        </div>
      </div>

      <div className="leave-attendance-summary">
        <button
          type="button"
          className={`leave-attendance-stat ${
            filter === "ALL" ? "active" : ""
          }`}
          onClick={() => setFilter("ALL")}
        >
          <span className="leave-attendance-stat-icon">
            <Users size={22} />
          </span>

          <div>
            <strong>{summary.currentlyOnLeave}</strong>

            <span>Currently on leave</span>
          </div>
        </button>

        <button
          type="button"
          className={`leave-attendance-stat returning ${
            filter === "RETURNING_SOON" ? "active" : ""
          }`}
          onClick={() => setFilter("RETURNING_SOON")}
        >
          <span className="leave-attendance-stat-icon">
            <CalendarClock size={22} />
          </span>

          <div>
            <strong>{summary.returningSoon}</strong>

            <span>Returning within 3 days</span>
          </div>
        </button>
      </div>

      {errorMessage && (
        <div className="leave-feedback error" role="alert">
          <span>{errorMessage}</span>
        </div>
      )}

      {isLoading ? (
        <div className="leave-loading-state">
          <div className="loading-spinner" />

          <p>Loading employee leave attendance...</p>
        </div>
      ) : errorMessage ? null : visibleEmployees.length === 0 ? (
        <div className="leave-empty-state">
          <CheckCircle2 size={42} />

          <h2>
            {filter === "RETURNING_SOON"
              ? "No employees are returning soon"
              : "No employees are currently on leave"}
          </h2>

          <p>
            {filter === "RETURNING_SOON"
              ? "No employee is expected to return within the next three working leave days."
              : "All employees are currently expected to be available at work."}
          </p>
        </div>
      ) : (
        <div className="leave-attendance-grid">
          {visibleEmployees.map((employee) => (
            <article
              className="leave-attendance-card"
              key={employee.leaveRequestId}
            >
              <div className="leave-attendance-card-header">
                <div className="leave-employee-summary">
                  {employee.photoFilename ? (
                    <img
                      src={`${import.meta.env.VITE_API_BASE_URL}/uploads/employees/${employee.photoFilename}`}
                      alt=""
                      className="leave-employee-photo"
                    />
                  ) : (
                    <div className="leave-employee-placeholder">
                      <UserRound size={22} />
                    </div>
                  )}

                  <div>
                    <h2>{employee.employeeName}</h2>

                    <p>
                      {employee.staffNumber}

                      {employee.position ? ` · ${employee.position}` : ""}
                    </p>
                  </div>
                </div>

                {employee.isReturningSoon && (
                  <span className="leave-returning-soon-badge">
                    Returning soon
                  </span>
                )}
              </div>

              <div className="leave-attendance-type">
                <CalendarClock size={18} />

                <div>
                  <span>Leave type</span>

                  <strong>{employee.leaveTypeName}</strong>
                </div>
              </div>

              <div className="leave-attendance-dates">
                <div>
                  <span>Leave started</span>

                  <strong>{formatLeaveDate(employee.startDate)}</strong>
                </div>

                <div>
                  <span>Leave ends</span>

                  <strong>{formatLeaveDate(employee.endDate)}</strong>
                </div>

                <div className="expected-return">
                  <span>Expected in office</span>

                  <strong>
                    {formatLeaveDate(employee.expectedReturnDate)}
                  </strong>
                </div>
              </div>

              <div className="leave-attendance-footer">
                <div className="leave-attendance-footer-information">
                  <div>
                    <Clock3 size={18} />

                    <span>
                      <strong>{employee.remainingWorkingDays}</strong> working
                      leave day(s) remaining
                    </span>
                  </div>

                  <span>
                    {employee.department || "Department not assigned"}
                  </span>
                </div>

                <Link
                  to={`/leave/requests/${employee.leaveRequestId}`}
                  className="leave-attendance-details-link"
                >
                  View leave details
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default EmployeesOnLeavePage;
