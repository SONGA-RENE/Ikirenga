import { Link } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  Plus,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../../auth/AuthContext.jsx";

import { getEmployees } from "../../api/employeeApi.js";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

function getEmployeeInitials(employee) {
  return [employee.firstName, employee.lastName]
    .filter(Boolean)
    .map((name) => name[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getEmployeePhotoUrl(employee) {
  if (!employee.photoFilename) {
    return null;
  }

  return `${apiBaseUrl}/uploads/employees/${encodeURIComponent(
    employee.photoFilename,
  )}`;
}

const employmentStatusLabels = {
  ACTIVE: "Active",
  ON_NOTICE: "On notice",
  SUSPENDED: "Suspended",
  EXITED: "Exited",
};

function EmployeeListPage() {
  const { user } = useAuth();

  const [employees, setEmployees] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const canManageEmployees = ["ADMIN", "HR"].includes(user.role);

  async function loadEmployees(signal) {
    setIsLoading(true);
    setError("");

    try {
      const result = await getEmployees({
        signal,
      });

      setEmployees(result.employees);
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
          "Unable to retrieve employees",
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller = new AbortController();

    loadEmployees(controller.signal);

    return () => {
      controller.abort();
    };
  }, []);

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return employees;
    }

    return employees.filter((employee) => {
      const searchableValues = [
        employee.staffNumber,
        employee.firstName,
        employee.lastName,
        employee.email,
        employee.position,
        employee.department,
      ];

      return searchableValues.some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(normalizedSearch),
      );
    });
  }, [employees, searchTerm]);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Employee management</p>

          <h1>Employees</h1>

          <p>
            View and manage PSF employee records and organizational assignments.
          </p>
        </div>

        {canManageEmployees && (
          <div className="page-header-actions">
            <Link
              to="/employees/lifecycle"
              className="lifecycle-dashboard-link"
            >
              <span className="lifecycle-link-icon">
                <Activity size={19} />
              </span>

              <span>
                <strong>Lifecycle dashboard</strong>

                <small>Notices, exits and compliance</small>
              </span>
            </Link>

            <Link to="/employees/new" className="page-primary-action">
              <Plus size={19} />
              Add employee
            </Link>
          </div>
        )}
      </header>

      <section className="data-panel">
        <div className="data-panel-toolbar">
          <div className="search-input">
            <Search size={18} />

            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, staff number, position or department"
              aria-label="Search employees"
            />
          </div>

          <div className="record-count">
            <Users size={17} />

            <span>
              {filteredEmployees.length}
              {searchTerm ? ` of ${employees.length}` : ""} employee
              {filteredEmployees.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {isLoading && (
          <div className="table-message">
            <div className="loading-spinner" />

            <p>Loading employees...</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="table-message error-state">
            <div className="error-state-icon">
              <AlertCircle size={26} />
            </div>

            <h2>Employees could not be loaded</h2>

            <p>{error}</p>

            <button
              type="button"
              className="retry-button"
              onClick={() => loadEmployees()}
            >
              <RefreshCw size={17} />
              Try again
            </button>
          </div>
        )}

        {!isLoading && !error && filteredEmployees.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Users size={28} />
            </div>

            <h2>
              {searchTerm ? "No matching employees" : "No employees found"}
            </h2>

            <p>
              {searchTerm
                ? "Try a different name, staff number, position or department."
                : "Employee records will appear here after they are created."}
            </p>
          </div>
        )}

        {!isLoading && !error && filteredEmployees.length > 0 && (
          <div className="table-container">
            <table className="employee-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Staff number</th>
                  <th>Position</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {filteredEmployees.map((employee) => {
                  const photoUrl = getEmployeePhotoUrl(employee);

                  const employmentStatus =
                    employee.employmentStatus ||
                    (employee.isActive ? "ACTIVE" : "EXITED");

                  const employmentStatusClass = employmentStatus
                    .toLowerCase()
                    .replaceAll("_", "-");

                  return (
                    <tr key={employee.id}>
                      <td>
                        <div className="employee-cell">
                          <div className="employee-photo">
                            {photoUrl ? (
                              <img
                                src={photoUrl}
                                alt=""
                                onError={(event) => {
                                  event.currentTarget.style.display = "none";

                                  event.currentTarget.nextElementSibling?.removeAttribute(
                                    "hidden",
                                  );
                                }}
                              />
                            ) : null}

                            <span hidden={Boolean(photoUrl)}>
                              {getEmployeeInitials(employee)}
                            </span>
                          </div>

                          <div className="employee-identity">
                            <strong>
                              {employee.firstName} {employee.lastName}
                            </strong>

                            <span>{employee.email}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="staff-number">
                          {employee.staffNumber}
                        </span>
                      </td>

                      <td>{employee.position || "Not assigned"}</td>

                      <td>{employee.department || "Not assigned"}</td>

                      <td>
                        <span
                          className={`status-badge status-${employmentStatusClass}`}
                        >
                          {employmentStatusLabels[employmentStatus] ||
                            employmentStatus}
                        </span>
                      </td>

                      <td className="table-actions">
                        <Link
                          to={`/employees/${employee.id}`}
                          className="table-action-button"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export default EmployeeListPage;
