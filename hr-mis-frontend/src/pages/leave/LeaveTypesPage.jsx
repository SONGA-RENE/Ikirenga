import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CalendarRange,
  Check,
  FileCheck,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import { Link, Navigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext.jsx";

import {
  changeLeaveTypeStatus,
  createLeaveType,
  getLeaveTypes,
} from "../../api/leaveApi.js";

import { formatLeaveDate, formatLeaveStatus } from "./leaveUtils.js";

import "./leave.css";

const initialFormData = {
  code: "",
  name: "",
  entitlementMode: "ANNUAL_BUCKET",
  annualEntitlement: "18",
  durationValue: "",
  durationUnit: "WORKING_DAYS",
  eligibleGender: "ANY",
  carryForwardYears: "0",
  isPaid: true,
  requiresAttachment: false,
};

const modeDescriptions = {
  ANNUAL_BUCKET:
    "Employees receive a yearly balance that can be reserved, consumed and carried forward.",

  FIXED_DURATION:
    "Each approved request uses a predefined duration instead of an annual balance.",

  NO_BALANCE:
    "Employees request the required period without consuming a stored entitlement.",
};

function LeaveTypesPage() {
  const { user } = useAuth();

  const mayManageLeaveTypes = ["ADMIN", "HR"].includes(user?.role);

  const [leaveTypes, setLeaveTypes] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const [formData, setFormData] = useState(initialFormData);

  const [formError, setFormError] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [changingStatusId, setChangingStatusId] = useState(null);

  const [statusActionError, setStatusActionError] = useState("");

  const [pendingStatusChange, setPendingStatusChange] = useState(null);

  function requestLeaveTypeStatusChange(leaveType) {
    setStatusActionError("");

    setPendingStatusChange(leaveType);
  }

  function closeStatusConfirmation() {
    if (changingStatusId) {
      return;
    }

    setPendingStatusChange(null);
  }

  async function confirmLeaveTypeStatusChange() {
    if (!pendingStatusChange) {
      return;
    }

    const leaveType = pendingStatusChange;

    const nextIsActive = !leaveType.isActive;

    const action = nextIsActive ? "reactivate" : "deactivate";

    setChangingStatusId(leaveType.id);
    setStatusActionError("");

    try {
      await changeLeaveTypeStatus(leaveType.id, nextIsActive);

      setPendingStatusChange(null);

      await loadLeaveTypes();
    } catch (requestError) {
      setStatusActionError(
        requestError.response?.data?.message ||
          `Unable to ${action} leave type`,
      );
    } finally {
      setChangingStatusId(null);
    }
  }

  const loadLeaveTypes = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");

    try {
      const result = await getLeaveTypes({
        signal,
      });

      setLeaveTypes(Array.isArray(result.data) ? result.data : []);
    } catch (requestError) {
      if (
        requestError.name === "CanceledError" ||
        requestError.code === "ERR_CANCELED"
      ) {
        return;
      }

      setError(
        requestError.response?.data?.message || "Unable to load leave types",
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    loadLeaveTypes(controller.signal);

    return () => controller.abort();
  }, [loadLeaveTypes]);

  function openCreateModal() {
    setFormData(initialFormData);
    setFormError("");
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    if (isSubmitting) {
      return;
    }

    setIsCreateModalOpen(false);
    setFormError("");
  }

  function updateField(event) {
    const { name, value, type, checked } = event.target;

    setFormData((current) => ({
      ...current,

      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function changeEntitlementMode(event) {
    const entitlementMode = event.target.value;

    setFormData((current) => {
      if (entitlementMode === "ANNUAL_BUCKET") {
        return {
          ...current,
          entitlementMode,
          annualEntitlement: current.annualEntitlement || "18",
          durationValue: "",
          durationUnit: "WORKING_DAYS",
          carryForwardYears: current.carryForwardYears || "0",
        };
      }

      if (entitlementMode === "FIXED_DURATION") {
        return {
          ...current,
          entitlementMode,
          annualEntitlement: "",
          durationValue: current.durationValue || "1",
          durationUnit:
            current.durationUnit === "REQUESTED_PERIOD"
              ? "WORKING_DAYS"
              : current.durationUnit,
          carryForwardYears: "0",
        };
      }

      return {
        ...current,
        entitlementMode,
        annualEntitlement: "",
        durationValue: "",
        durationUnit: "REQUESTED_PERIOD",
        carryForwardYears: "0",
      };
    });
  }

  async function submitLeaveType(event) {
    event.preventDefault();

    setFormError("");

    const normalizedCode = formData.code.trim().toUpperCase();

    const normalizedName = formData.name.trim();

    if (!normalizedCode || !normalizedName) {
      setFormError("Leave type code and name are required");

      return;
    }

    if (!/^[A-Z][A-Z0-9_]*$/.test(normalizedCode)) {
      setFormError("Code may contain only letters, numbers and underscores");

      return;
    }

    const annualEntitlement =
      formData.entitlementMode === "ANNUAL_BUCKET"
        ? Number(formData.annualEntitlement)
        : null;

    const durationValue =
      formData.entitlementMode === "FIXED_DURATION"
        ? Number(formData.durationValue)
        : null;

    const carryForwardYears =
      formData.entitlementMode === "ANNUAL_BUCKET"
        ? Number(formData.carryForwardYears)
        : 0;

    if (
      formData.entitlementMode === "ANNUAL_BUCKET" &&
      (!Number.isInteger(annualEntitlement) || annualEntitlement <= 0)
    ) {
      setFormError("Annual entitlement must be a positive whole number");

      return;
    }

    if (
      formData.entitlementMode === "FIXED_DURATION" &&
      (!Number.isInteger(durationValue) || durationValue <= 0)
    ) {
      setFormError("Fixed duration must be a positive whole number");

      return;
    }

    if (!Number.isInteger(carryForwardYears) || carryForwardYears < 0) {
      setFormError(
        "Carry-forward years must be zero or a positive whole number",
      );

      return;
    }

    const payload = {
      code: normalizedCode,
      name: normalizedName,
      entitlementMode: formData.entitlementMode,
      annualEntitlement,
      durationValue,
      durationUnit: formData.durationUnit,
      eligibleGender: formData.eligibleGender,
      carryForwardYears,
      isPaid: formData.isPaid,
      requiresAttachment: formData.requiresAttachment,
    };

    setIsSubmitting(true);

    try {
      await createLeaveType(payload);

      setIsCreateModalOpen(false);
      setFormData(initialFormData);

      await loadLeaveTypes();
    } catch (requestError) {
      setFormError(
        requestError.response?.data?.message || "Unable to create leave type",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!mayManageLeaveTypes) {
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
          <p className="eyebrow">Leave policy configuration</p>

          <h1>Leave types</h1>

          <p>
            Configure entitlement rules, duration, eligibility and
            supporting-document requirements.
          </p>
        </div>

        <button
          type="button"
          className="page-primary-action"
          onClick={openCreateModal}
        >
          <Plus size={18} />
          Add leave type
        </button>
      </header>

      <section className="leave-type-summary">
        <CalendarRange size={25} />

        <div>
          <strong>{leaveTypes.length}</strong>

          <span>
            configured leave type
            {leaveTypes.length === 1 ? "" : "s"}
          </span>
        </div>
      </section>

      {error && (
        <div className="leave-error-state">
          <AlertCircle size={27} />

          <h2>Leave types could not be loaded</h2>

          <p>{error}</p>

          <button
            type="button"
            className="retry-button"
            onClick={() => loadLeaveTypes()}
          >
            <RefreshCw size={17} />
            Try again
          </button>
        </div>
      )}

      {!error && isLoading && (
        <div className="page-loading-state">
          <div className="loading-spinner" />

          <p>Loading leave types...</p>
        </div>
      )}

      {!error && !isLoading && leaveTypes.length === 0 && (
        <div className="leave-empty-state">
          <CalendarClock size={31} />

          <h2>No leave types configured</h2>

          <p>Create the first leave policy to begin accepting requests.</p>

          <button
            type="button"
            className="page-primary-action"
            onClick={openCreateModal}
          >
            <Plus size={18} />
            Add leave type
          </button>
        </div>
      )}
      {statusActionError && (
        <div className="leave-inline-error">
          <AlertCircle size={19} />

          <span>{statusActionError}</span>
        </div>
      )}
      {!error && !isLoading && leaveTypes.length > 0 && (
        <section className="leave-type-grid">
          {leaveTypes.map((leaveType) => (
            <article className="leave-type-card" key={leaveType.id}>
              <header className="leave-type-card-header">
                <div className="leave-type-card-icon">
                  <CalendarClock size={24} />
                </div>

                <div>
                  <span className="leave-type-code">{leaveType.code}</span>

                  <h2>{leaveType.name}</h2>
                </div>

                <span
                  className={`leave-type-active-state ${
                    leaveType.isActive ? "active" : "inactive"
                  }`}
                >
                  {leaveType.isActive ? "Active" : "Inactive"}
                </span>
              </header>

              <div className="leave-type-mode">
                <span>Entitlement model</span>

                <strong>{formatLeaveStatus(leaveType.entitlementMode)}</strong>

                <p>{modeDescriptions[leaveType.entitlementMode]}</p>
              </div>

              <div className="leave-type-policy-grid">
                <div>
                  <CalendarRange size={19} />

                  <span>Entitlement</span>

                  <strong>
                    {leaveType.entitlementMode === "ANNUAL_BUCKET"
                      ? `${leaveType.annualEntitlement} working days/year`
                      : leaveType.entitlementMode === "FIXED_DURATION"
                        ? `${leaveType.durationValue} ${formatLeaveStatus(
                            leaveType.durationUnit,
                          ).toLowerCase()}`
                        : "Requested period"}
                  </strong>
                </div>

                <div>
                  <Users size={19} />

                  <span>Eligibility</span>

                  <strong>{formatLeaveStatus(leaveType.eligibleGender)}</strong>
                </div>

                <div>
                  <ShieldCheck size={19} />

                  <span>Payment</span>

                  <strong>
                    {leaveType.isPaid ? "Paid leave" : "Unpaid leave"}
                  </strong>
                </div>

                <div>
                  <FileCheck size={19} />

                  <span>Attachment</span>

                  <strong>
                    {leaveType.requiresAttachment ? "Required" : "Not required"}
                  </strong>
                </div>
              </div>

              <footer className="leave-type-card-footer">
                <div>
                  <span>
                    Carry forward:{" "}
                    <strong>
                      {leaveType.entitlementMode === "ANNUAL_BUCKET"
                        ? `${leaveType.carryForwardYears} year(s)`
                        : "Not applicable"}
                    </strong>
                  </span>

                  <span>Created {formatLeaveDate(leaveType.createdAt)}</span>
                </div>

                <button
                  type="button"
                  className={
                    leaveType.isActive
                      ? "leave-type-deactivate-button"
                      : "leave-type-reactivate-button"
                  }
                  disabled={changingStatusId === leaveType.id}
                  onClick={() => requestLeaveTypeStatusChange(leaveType)}
                >
                  {leaveType.isActive ? (
                    <PowerOff size={17} />
                  ) : (
                    <Power size={17} />
                  )}

                  {changingStatusId === leaveType.id
                    ? "Updating..."
                    : leaveType.isActive
                      ? "Deactivate"
                      : "Reactivate"}
                </button>
              </footer>
            </article>
          ))}
        </section>
      )}

      {isCreateModalOpen && (
        <div
          className="leave-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCreateModal();
            }
          }}
        >
          <section
            className="leave-modal leave-type-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-leave-type-title"
          >
            <header className="leave-modal-header">
              <div>
                <p className="eyebrow">Policy configuration</p>

                <h2 id="create-leave-type-title">Add leave type</h2>

                <p>
                  Define how this leave policy calculates entitlement and
                  eligibility.
                </p>
              </div>

              <button
                type="button"
                className="leave-modal-close"
                onClick={closeCreateModal}
                aria-label="Close"
                disabled={isSubmitting}
              >
                <X size={21} />
              </button>
            </header>

            <form className="leave-type-form" onSubmit={submitLeaveType}>
              {formError && (
                <div className="leave-form-error">
                  <AlertCircle size={19} />

                  <span>{formError}</span>
                </div>
              )}

              <div className="leave-type-form-grid">
                <label>
                  <span>Code</span>

                  <input
                    type="text"
                    name="code"
                    value={formData.code}
                    onChange={updateField}
                    placeholder="e.g. COMPASSIONATE"
                    maxLength={40}
                    required
                  />
                </label>

                <label>
                  <span>Name</span>

                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={updateField}
                    placeholder="e.g. Compassionate Leave"
                    maxLength={100}
                    required
                  />
                </label>
              </div>

              <label>
                <span>Entitlement model</span>

                <select
                  name="entitlementMode"
                  value={formData.entitlementMode}
                  onChange={changeEntitlementMode}
                >
                  <option value="ANNUAL_BUCKET">Annual balance</option>

                  <option value="FIXED_DURATION">Fixed duration</option>

                  <option value="NO_BALANCE">Requested period</option>
                </select>

                <small>{modeDescriptions[formData.entitlementMode]}</small>
              </label>

              {formData.entitlementMode === "ANNUAL_BUCKET" && (
                <div className="leave-type-form-grid">
                  <label>
                    <span>Annual entitlement</span>

                    <input
                      type="number"
                      name="annualEntitlement"
                      value={formData.annualEntitlement}
                      onChange={updateField}
                      min="1"
                      step="1"
                      required
                    />
                  </label>

                  <label>
                    <span>Carry-forward years</span>

                    <input
                      type="number"
                      name="carryForwardYears"
                      value={formData.carryForwardYears}
                      onChange={updateField}
                      min="0"
                      step="1"
                      required
                    />
                  </label>
                </div>
              )}

              {formData.entitlementMode === "FIXED_DURATION" && (
                <div className="leave-type-form-grid">
                  <label>
                    <span>Duration value</span>

                    <input
                      type="number"
                      name="durationValue"
                      value={formData.durationValue}
                      onChange={updateField}
                      min="1"
                      step="1"
                      required
                    />
                  </label>

                  <label>
                    <span>Duration unit</span>

                    <select
                      name="durationUnit"
                      value={formData.durationUnit}
                      onChange={updateField}
                    >
                      <option value="WORKING_DAYS">Working days</option>

                      <option value="CALENDAR_DAYS">Calendar days</option>

                      <option value="CALENDAR_MONTHS">Calendar months</option>
                    </select>
                  </label>
                </div>
              )}

              <div className="leave-type-form-grid">
                <label>
                  <span>Eligible gender</span>

                  <select
                    name="eligibleGender"
                    value={formData.eligibleGender}
                    onChange={updateField}
                  >
                    <option value="ANY">Any gender</option>

                    <option value="FEMALE">Female</option>

                    <option value="MALE">Male</option>
                  </select>
                </label>

                <div className="leave-type-policy-switches">
                  <label>
                    <input
                      type="checkbox"
                      name="isPaid"
                      checked={formData.isPaid}
                      onChange={updateField}
                    />

                    <span>Paid leave</span>
                  </label>

                  <label>
                    <input
                      type="checkbox"
                      name="requiresAttachment"
                      checked={formData.requiresAttachment}
                      onChange={updateField}
                    />

                    <span>Attachment required</span>
                  </label>
                </div>
              </div>

              <footer className="leave-modal-actions">
                <button
                  type="button"
                  className="secondary-action-button"
                  onClick={closeCreateModal}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="page-primary-action"
                  disabled={isSubmitting}
                >
                  <Check size={18} />

                  {isSubmitting ? "Creating..." : "Create leave type"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {pendingStatusChange && (
        <div
          className="leave-confirmation-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeStatusConfirmation();
            }
          }}
        >
          <section
            className="leave-confirmation-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="leave-status-confirmation-title"
            aria-describedby="leave-status-confirmation-description"
          >
            <button
              type="button"
              className="leave-confirmation-close"
              onClick={closeStatusConfirmation}
              disabled={Boolean(changingStatusId)}
              aria-label="Close confirmation"
            >
              <X size={20} />
            </button>

            <div
              className={`leave-confirmation-icon ${
                pendingStatusChange.isActive ? "deactivate" : "reactivate"
              }`}
            >
              {pendingStatusChange.isActive ? (
                <PowerOff size={29} />
              ) : (
                <Power size={29} />
              )}
            </div>

            <div className="leave-confirmation-content">
              <p className="eyebrow">Leave policy status</p>

              <h2 id="leave-status-confirmation-title">
                {pendingStatusChange.isActive
                  ? "Deactivate leave type?"
                  : "Reactivate leave type?"}
              </h2>

              <p id="leave-status-confirmation-description">
                {pendingStatusChange.isActive
                  ? "Employees will no longer be able to select this policy for new leave requests. Existing requests and historical records will remain unchanged."
                  : "Employees will once again be able to select this policy when submitting new leave requests."}
              </p>
            </div>

            <div className="leave-confirmation-policy">
              <span>{pendingStatusChange.code}</span>

              <strong>{pendingStatusChange.name}</strong>

              <small>
                {formatLeaveStatus(pendingStatusChange.entitlementMode)}
              </small>
            </div>

            <footer className="leave-confirmation-actions">
              <button
                type="button"
                className="leave-confirmation-cancel"
                onClick={closeStatusConfirmation}
                disabled={Boolean(changingStatusId)}
              >
                Keep current status
              </button>

              <button
                type="button"
                className={
                  pendingStatusChange.isActive
                    ? "leave-confirmation-deactivate"
                    : "leave-confirmation-reactivate"
                }
                onClick={confirmLeaveTypeStatusChange}
                disabled={Boolean(changingStatusId)}
              >
                {pendingStatusChange.isActive ? (
                  <PowerOff size={18} />
                ) : (
                  <Power size={18} />
                )}

                {changingStatusId
                  ? "Updating..."
                  : pendingStatusChange.isActive
                    ? "Deactivate"
                    : "Reactivate"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

export default LeaveTypesPage;
