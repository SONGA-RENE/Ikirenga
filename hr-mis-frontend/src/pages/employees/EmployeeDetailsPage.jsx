import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Edit3,
  Mail,
  RefreshCw,
  UserRound,
} from "lucide-react";

import { useEffect, useState } from "react";

import { Link, useParams } from "react-router-dom";

import {
  getEmployeeById,
  getEmployeePositionAssignments,
} from "../../api/employeeApi.js";

import { useAuth } from "../../auth/AuthContext.jsx";

import PositionAssignmentManager from "../../pages/employees/PositionAssignmentManager.jsx";

import EmployeeProfilePanel from "../../pages/employees/EmployeeProfilePanel.jsx";

import FamilyContactsPanel from "../../pages/employees/FamilyContactsPanel.jsx";

import EducationRecordsPanel from "../../pages/employees/EducationRecordsPanel.jsx";

import EmployeeContractSection from "../contracts/EmployeeContractSection.jsx";

import EmployeeSeparationManager from "./EmployeeSeparationManager.jsx";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

function getEmployeeInitials(employee) {
  return [employee?.firstName, employee?.lastName]
    .filter(Boolean)
    .map((name) => name[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getEmployeePhotoUrl(employee) {
  if (!employee?.photoFilename) {
    return null;
  }

  return `${apiBaseUrl}/uploads/employees/${encodeURIComponent(
    employee.photoFilename,
  )}`;
}

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

const employmentStatusLabels = {
  ACTIVE: "Active",
  ON_NOTICE: "On notice",
  SUSPENDED: "Suspended",
  EXITED: "Exited",
};

function EmployeeDetailsPage() {
  const { employeeId } = useParams();
  const { user } = useAuth();

  const [employee, setEmployee] = useState(null);

  const [positionHistory, setPositionHistory] = useState(null);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const canManageEmployees = ["ADMIN", "HR"].includes(user.role);

  async function loadEmployee(signal) {
    setIsLoading(true);
    setError("");

    try {
      const [employeeResult, positionHistoryResult] = await Promise.all([
        getEmployeeById(employeeId, { signal }),
        getEmployeePositionAssignments(employeeId, { signal }),
      ]);

      setEmployee(employeeResult);
      setPositionHistory(positionHistoryResult);
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
          "Unable to retrieve employee",
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }
  async function refreshEmployee() {
    await loadEmployee();
  }
  const assignments = positionHistory?.assignments || [];

  const currentSubstantive = assignments.find(
    (assignment) =>
      assignment.isCurrent && assignment.assignmentType === "SUBSTANTIVE",
  );

  const currentTemporary = assignments.find(
    (assignment) =>
      assignment.isCurrent &&
      ["ACTING", "INTERIM"].includes(assignment.assignmentType),
  );

  useEffect(() => {
    const controller = new AbortController();

    loadEmployee(controller.signal);

    return () => {
      controller.abort();
    };
  }, [employeeId]);

  if (isLoading) {
    return (
      <div className="page-loading-state">
        <div className="loading-spinner" />
        <p>Loading employee details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="details-error-state">
        <div className="error-state-icon">
          <AlertCircle size={26} />
        </div>

        <h1>Employee could not be loaded</h1>

        <p>{error}</p>

        <div className="error-actions">
          <Link to="/employees" className="secondary-action">
            <ArrowLeft size={17} />
            Employees
          </Link>

          <button
            type="button"
            className="retry-button"
            onClick={() => loadEmployee()}
          >
            <RefreshCw size={17} />
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!employee) {
    return null;
  }

  const employmentStatus =
    employee.employmentStatus || (employee.isActive ? "ACTIVE" : "EXITED");

  const employmentStatusClass = employmentStatus
    .toLowerCase()
    .replaceAll("_", "-");

  const photoUrl = getEmployeePhotoUrl(employee);

  const fullName = [employee.firstName, employee.lastName]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className="details-page-navigation">
        <Link to="/employees" className="back-link">
          <ArrowLeft size={18} />
          Back to employees
        </Link>
      </div>

      <header className="employee-profile-header">
        <div className="employee-profile-main">
          <div className="employee-profile-photo">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`${fullName} profile`}
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

          <div className="employee-profile-title">
            <div className="profile-heading-row">
              <h1>{fullName}</h1>

              <span className={`status-badge status-${employmentStatusClass}`}>
                {employmentStatusLabels[employmentStatus] || employmentStatus}
              </span>
            </div>

            <p>{employee.position || "Position not assigned"}</p>

            <span className="profile-staff-number">{employee.staffNumber}</span>
          </div>
        </div>

        {canManageEmployees && (
          <Link
            to={`/employees/${employee.id}/edit`}
            className="page-primary-action"
          >
            <Edit3 size={18} />
            Edit employee
          </Link>
        )}
      </header>

      <section className="employee-details-grid">
        <article className="details-card">
          <div className="details-card-header">
            <UserRound size={20} />

            <div>
              <h2>Personal information</h2>

              <p>Basic employee identity and contact details.</p>
            </div>
          </div>

          <dl className="details-list">
            <div>
              <dt>First name</dt>
              <dd>{employee.firstName || "Not available"}</dd>
            </div>

            <div>
              <dt>Last name</dt>
              <dd>{employee.lastName || "Not available"}</dd>
            </div>

            <div>
              <dt>
                <Mail size={15} />
                Email address
              </dt>

              <dd>
                {employee.email ? (
                  <a href={`mailto:${employee.email}`}>{employee.email}</a>
                ) : (
                  "Not available"
                )}
              </dd>
            </div>
          </dl>
        </article>

        <article className="details-card">
          <div className="details-card-header">
            <BriefcaseBusiness size={20} />

            <div>
              <h2>Employment information</h2>

              <p>Organizational placement and employment status.</p>
            </div>
          </div>

          <dl className="details-list">
            <div>
              <dt>Staff number</dt>

              <dd>{employee.staffNumber || "Not available"}</dd>
            </div>

            <div>
              <dt>Substantive position</dt>

              <dd>
                {currentSubstantive?.position ||
                  employee.position ||
                  "Not assigned"}
              </dd>
            </div>

            <div>
              <dt>
                <Building2 size={15} />
                Department
              </dt>

              <dd>{employee.department || "Not assigned"}</dd>
            </div>

            <div>
              <dt>Temporary appointment</dt>

              <dd>
                {currentTemporary ? (
                  <>
                    <strong>{currentTemporary.assignmentType}</strong>
                    {" — "}
                    {currentTemporary.position}
                  </>
                ) : (
                  "None"
                )}
              </dd>
            </div>

            <div>
              <dt>Employment status</dt>

              <dd>
                {employmentStatusLabels[employmentStatus] || employmentStatus}
              </dd>
            </div>

            {employee.statusEffectiveDate && (
              <div>
                <dt>Status effective date</dt>

                <dd>{formatDate(employee.statusEffectiveDate)}</dd>
              </div>
            )}

            {employmentStatus === "ON_NOTICE" && employee.lastWorkingDate && (
              <div>
                <dt>Last working date</dt>

                <dd>{formatDate(employee.lastWorkingDate)}</dd>
              </div>
            )}

            {employee.employmentStatusReason && (
              <div>
                <dt>Status reason</dt>

                <dd>{employee.employmentStatusReason}</dd>
              </div>
            )}
          </dl>
        </article>

        <article className="details-card">
          <div className="details-card-header">
            <CalendarDays size={20} />

            <div>
              <h2>Record information</h2>

              <p>Employee record creation and update dates.</p>
            </div>
          </div>

          <dl className="details-list">
            <div>
              <dt>Created</dt>

              <dd>{formatDate(employee.createdAt)}</dd>
            </div>

            <div>
              <dt>Last updated</dt>

              <dd>{formatDate(employee.updatedAt)}</dd>
            </div>

            <div>
              <dt>Employee ID</dt>
              <dd>{employee.id}</dd>
            </div>
          </dl>
        </article>
      </section>

      {/* Employee Contract */}

      <EmployeeContractSection employeeId={employee.id} />

      {/* Employee Separation Manager */}
      {/* Employee Separation Manager */}
      {canManageEmployees && (
        <EmployeeSeparationManager
          employeeId={employee.id}
          employee={employee}
          onChanged={() => loadEmployee()}
        />
      )}

      {/* Employee Profile Panel */}
      <EmployeeProfilePanel employeeId={employee.id} />

      {/* Education Records Panel */}
      <EducationRecordsPanel employeeId={employee.id} />

      {/* Family Contacts Panel */}
      <FamilyContactsPanel employeeId={employee.id} />

      {/* Position Assignment Manager */}
      {canManageEmployees && (
        <PositionAssignmentManager
          employeeId={employee.id}
          assignments={assignments}
          onChanged={() => loadEmployee()}
        />
      )}

      <section className="assignment-history-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Position management</p>

            <h2>Appointment history</h2>

            <p>
              Substantive positions and temporary acting or interim
              appointments.
            </p>
          </div>
        </div>

        {assignments.length === 0 ? (
          <div className="empty-history-state">
            <BriefcaseBusiness size={22} />

            <p>
              No position-assignment history is available for this employee.
            </p>
          </div>
        ) : (
          <div className="assignment-history-list">
            {assignments.map((assignment) => (
              <article className="assignment-history-item" key={assignment.id}>
                <div className="assignment-history-main">
                  <div className="assignment-title-row">
                    <h3>{assignment.position}</h3>

                    <span
                      className={`assignment-type-badge assignment-type-${assignment.assignmentType.toLowerCase()}`}
                    >
                      {assignment.assignmentType}
                    </span>

                    {assignment.isCurrent && (
                      <span className="assignment-current-badge">
                        {assignment.assignmentType === "SUBSTANTIVE"
                          ? "Active substantive position"
                          : "Temporary assignment"}
                      </span>
                    )}
                  </div>

                  <p>
                    {assignment.department}

                    {assignment.locationName
                      ? ` — ${assignment.locationName}`
                      : ""}
                  </p>

                  <span className="assignment-code">
                    {assignment.positionCode}
                  </span>
                </div>

                <dl className="assignment-history-details">
                  <div>
                    <dt>Started</dt>
                    <dd>{formatDate(assignment.startDate)}</dd>
                  </div>

                  <div>
                    <dt>Expected end</dt>
                    <dd>{formatDate(assignment.expectedEndDate)}</dd>
                  </div>

                  <div>
                    <dt>Actual end</dt>
                    <dd>
                      {assignment.endDate
                        ? formatDate(assignment.endDate)
                        : "Current"}
                    </dd>
                  </div>

                  <div>
                    <dt>Assigned by</dt>
                    <dd>{assignment.assignedBy || "System migration"}</dd>
                  </div>

                  {assignment.endedBy && (
                    <div>
                      <dt>Ended by</dt>
                      <dd>{assignment.endedBy}</dd>
                    </div>
                  )}
                </dl>

                {assignment.assignmentNote && (
                  <p className="assignment-note">{assignment.assignmentNote}</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default EmployeeDetailsPage;
