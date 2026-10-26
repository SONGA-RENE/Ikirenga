import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  CircleX,
  LogOut,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  cancelEmployeeSeparation,
  completeEmployeeSeparation,
  confirmEmployeeSeparation,
  createEmployeeSeparation,
  getEmployeeSeparations,
} from "../../api/employeeApi.js";

const separationTypeOptions = [
  {
    value: "RESIGNATION",
    label: "Resignation",
  },
  {
    value: "CONTRACT_END",
    label: "Contract end",
  },
  {
    value: "TERMINATION",
    label: "Termination",
  },
  {
    value: "RETIREMENT",
    label: "Retirement",
  },
  {
    value: "REDUNDANCY",
    label: "Redundancy",
  },
  {
    value: "DEATH",
    label: "Death",
  },
  {
    value: "OTHER",
    label: "Other",
  },
];

const statusLabels = {
  PENDING: "Pending confirmation",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const typeLabels = Object.fromEntries(
  separationTypeOptions.map(({ value, label }) => [value, label]),
);

const initialFormData = {
  separationType: "RESIGNATION",
  noticeReceivedDate: "",
  noticeStartDate: "",
  lastWorkingDate: "",
  reason: "",
};

function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function currentDateString() {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function readRequestError(error, fallbackMessage) {
  return error.response?.data?.message || error.message || fallbackMessage;
}

function EmployeeSeparationManager({ employeeId, employee, onChanged }) {
  const [separations, setSeparations] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);

  const [formData, setFormData] = useState(initialFormData);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [actionId, setActionId] = useState(null);

  const [error, setError] = useState("");

  const [loadError, setLoadError] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  const [blockers, setBlockers] = useState([]);

  const [cancellationTarget, setCancellationTarget] = useState(null);

  const [cancellationReason, setCancellationReason] = useState("");

  const loadSeparations = useCallback(
    async (signal) => {
      setIsLoading(true);
      setLoadError("");

      try {
        const result = await getEmployeeSeparations(employeeId, { signal });

        setSeparations(result);
      } catch (requestError) {
        if (
          requestError.name === "CanceledError" ||
          requestError.code === "ERR_CANCELED"
        ) {
          return;
        }

        setLoadError(
          readRequestError(
            requestError,
            "Unable to retrieve separation history",
          ),
        );
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [employeeId],
  );

  useEffect(() => {
    const controller = new AbortController();

    loadSeparations(controller.signal);

    return () => {
      controller.abort();
    };
  }, [loadSeparations]);

  const openSeparation = useMemo(
    () =>
      separations.find((separation) =>
        ["PENDING", "CONFIRMED"].includes(separation.status),
      ) || null,
    [separations],
  );

  const canCreateSeparation =
    employee.employmentStatus === "ACTIVE" &&
    employee.isActive &&
    !openSeparation;

  function handleFormChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetMessages() {
    setError("");
    setSuccessMessage("");
    setBlockers([]);
  }

  async function refreshData() {
    await loadSeparations();

    if (onChanged) {
      await onChanged();
    }
  }

  async function handleCreate(event) {
    event.preventDefault();

    resetMessages();

    const submittedData = {
      separationType: formData.separationType,

      noticeReceivedDate: formData.noticeReceivedDate || null,

      noticeStartDate: formData.noticeStartDate || null,

      lastWorkingDate: formData.lastWorkingDate,

      reason: formData.reason.trim(),
    };

    if (
      submittedData.separationType === "RESIGNATION" &&
      !submittedData.noticeReceivedDate
    ) {
      setError("Notice received date is required for a resignation.");

      return;
    }

    if (!submittedData.lastWorkingDate) {
      setError("Last working date is required.");

      return;
    }

    if (
      submittedData.noticeStartDate &&
      submittedData.lastWorkingDate < submittedData.noticeStartDate
    ) {
      setError("Last working date cannot be before the notice start date.");

      return;
    }

    if (submittedData.reason.length < 5) {
      setError("Separation reason must contain at least 5 characters.");

      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createEmployeeSeparation(employeeId, submittedData);

      setSuccessMessage(result.message);

      setFormData(initialFormData);
      setIsFormOpen(false);

      await refreshData();
    } catch (requestError) {
      setError(
        readRequestError(requestError, "Unable to record employee separation"),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirm(separation) {
    const accepted = window.confirm(
      `Confirm the ${
        typeLabels[separation.separationType]?.toLowerCase() || "employee"
      } separation?\n\n` +
        `The employee will be placed on notice until ${formatDate(
          separation.lastWorkingDate,
        )}.`,
    );

    if (!accepted) {
      return;
    }

    resetMessages();
    setActionId(separation.id);

    try {
      const result = await confirmEmployeeSeparation(employeeId, separation.id);

      setSuccessMessage(result.message);

      await refreshData();
    } catch (requestError) {
      setError(
        readRequestError(requestError, "Unable to confirm employee separation"),
      );
    } finally {
      setActionId(null);
    }
  }

  function openCancellation(separation) {
    resetMessages();
    setCancellationReason("");
    setCancellationTarget(separation);
  }

  async function handleCancel(event) {
    event.preventDefault();

    resetMessages();

    const reason = cancellationReason.trim();

    if (reason.length < 5) {
      setError("Cancellation reason must contain at least 5 characters.");

      return;
    }

    setActionId(cancellationTarget.id);

    try {
      const result = await cancelEmployeeSeparation(
        employeeId,
        cancellationTarget.id,
        reason,
      );

      setSuccessMessage(result.message);

      setCancellationTarget(null);
      setCancellationReason("");

      await refreshData();
    } catch (requestError) {
      setError(
        readRequestError(requestError, "Unable to cancel employee separation"),
      );
    } finally {
      setActionId(null);
    }
  }

  async function handleComplete(separation) {
    const accepted = window.confirm(
      "Complete this employee separation?\n\n" +
        "This will end current contracts and position assignments, mark the employee as exited, and disable their system account.",
    );

    if (!accepted) {
      return;
    }

    resetMessages();
    setActionId(separation.id);

    try {
      const result = await completeEmployeeSeparation(
        employeeId,
        separation.id,
      );

      setSuccessMessage(result.message);

      await refreshData();
    } catch (requestError) {
      const responseBlockers = requestError.response?.data?.blockers;

      if (Array.isArray(responseBlockers)) {
        setBlockers(responseBlockers);
      }

      setError(
        readRequestError(
          requestError,
          "Unable to complete employee separation",
        ),
      );
    } finally {
      setActionId(null);
    }
  }

  return (
    <section className="separation-management-panel">
      <div className="separation-management-header">
        <div className="separation-management-heading">
          <div className="separation-management-icon">
            <LogOut size={21} />
          </div>

          <div>
            <h2>Employee separation</h2>

            <p>
              Manage resignation, retirement, termination and other employee
              exit processes.
            </p>
          </div>
        </div>

        {canCreateSeparation && (
          <button
            type="button"
            className="page-primary-action"
            onClick={() => {
              resetMessages();

              setIsFormOpen((current) => !current);
            }}
          >
            {isFormOpen ? <X size={18} /> : <Plus size={18} />}

            {isFormOpen ? "Close form" : "Start separation"}
          </button>
        )}
      </div>

      {successMessage && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {blockers.length > 0 && (
        <div className="separation-blockers">
          <div className="separation-blockers-heading">
            <AlertCircle size={19} />

            <div>
              <strong>Separation cannot be completed</strong>

              <span>Resolve the following responsibilities first.</span>
            </div>
          </div>

          <ul>
            {blockers.map((blocker, index) => (
              <li key={`${blocker.type}-${blocker.referenceId}-${index}`}>
                <strong>{blocker.type.replaceAll("_", " ")}</strong>

                <span>{blocker.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isFormOpen && (
        <form className="separation-form" onSubmit={handleCreate}>
          <div className="form-section-header">
            <h3>Record employee separation</h3>

            <p>
              This creates a pending record. The employee is not placed on
              notice until HR confirms it.
            </p>
          </div>

          <div className="form-grid">
            <label className="form-control">
              <span>
                Separation type
                <strong>*</strong>
              </span>

              <select
                name="separationType"
                value={formData.separationType}
                onChange={handleFormChange}
                required
              >
                {separationTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-control">
              <span>
                Last working date
                <strong>*</strong>
              </span>

              <input
                name="lastWorkingDate"
                type="date"
                value={formData.lastWorkingDate}
                onChange={handleFormChange}
                required
              />
            </label>

            <label className="form-control">
              <span>
                Notice received date
                {formData.separationType === "RESIGNATION" && (
                  <strong>*</strong>
                )}
              </span>

              <input
                name="noticeReceivedDate"
                type="date"
                value={formData.noticeReceivedDate}
                onChange={handleFormChange}
                required={formData.separationType === "RESIGNATION"}
              />
            </label>

            <label className="form-control">
              <span>Notice start date</span>

              <input
                name="noticeStartDate"
                type="date"
                value={formData.noticeStartDate}
                onChange={handleFormChange}
              />
            </label>

            <label className="form-control form-control-full">
              <span>
                Reason
                <strong>*</strong>
              </span>

              <textarea
                name="reason"
                value={formData.reason}
                onChange={handleFormChange}
                rows={4}
                minLength={5}
                placeholder="Provide the approved reason or reference the employee’s notice."
                required
              />
            </label>
          </div>

          <div className="employee-form-actions">
            <button
              type="button"
              className="form-cancel-button"
              onClick={() => setIsFormOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="form-submit-button"
              disabled={isSubmitting}
            >
              <CalendarClock size={18} />

              {isSubmitting ? "Recording..." : "Record separation"}
            </button>
          </div>
        </form>
      )}

      {cancellationTarget && (
        <form className="separation-cancellation-form" onSubmit={handleCancel}>
          <div>
            <h3>Cancel separation</h3>

            <p>Explain why this separation process is being cancelled.</p>
          </div>

          <label className="form-control">
            <span>
              Cancellation reason
              <strong>*</strong>
            </span>

            <textarea
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value)}
              rows={3}
              minLength={5}
              required
            />
          </label>

          <div className="employee-form-actions">
            <button
              type="button"
              className="form-cancel-button"
              onClick={() => setCancellationTarget(null)}
              disabled={actionId === cancellationTarget.id}
            >
              Keep separation
            </button>

            <button
              type="submit"
              className="danger-action-button"
              disabled={actionId === cancellationTarget.id}
            >
              <CircleX size={18} />
              Confirm cancellation
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="section-loading-state">
          <div className="loading-spinner" />
          <p>Loading separation history...</p>
        </div>
      ) : separations.length === 0 ? (
        <div className="separation-empty-state">
          <LogOut size={25} />

          <div>
            <strong>No separation history</strong>

            <p>This employee has no recorded separation process.</p>
          </div>
        </div>
      ) : (
        <div className="separation-history">
          {separations.map((separation) => {
            const isProcessing = actionId === separation.id;

            const canComplete =
              separation.status === "CONFIRMED" &&
              separation.lastWorkingDate <= currentDateString();

            return (
              <article className="separation-record" key={separation.id}>
                <div className="separation-record-main">
                  <div>
                    <div className="separation-record-title">
                      <h3>
                        {typeLabels[separation.separationType] ||
                          separation.separationType}
                      </h3>

                      <span
                        className={`status-badge status-${separation.status.toLowerCase()}`}
                      >
                        {statusLabels[separation.status] || separation.status}
                      </span>
                    </div>

                    <p>{separation.reason}</p>
                  </div>

                  <dl className="separation-dates">
                    <div>
                      <dt>Last working date</dt>

                      <dd>{formatDate(separation.lastWorkingDate)}</dd>
                    </div>

                    <div>
                      <dt>Notice received</dt>

                      <dd>{formatDate(separation.noticeReceivedDate)}</dd>
                    </div>

                    <div>
                      <dt>Notice started</dt>

                      <dd>{formatDate(separation.noticeStartDate)}</dd>
                    </div>
                  </dl>
                </div>

                {["PENDING", "CONFIRMED"].includes(separation.status) && (
                  <div className="separation-record-actions">
                    {separation.status === "PENDING" && (
                      <button
                        type="button"
                        className="form-submit-button"
                        onClick={() => handleConfirm(separation)}
                        disabled={isProcessing}
                      >
                        <CheckCircle2 size={17} />

                        {isProcessing ? "Confirming..." : "Confirm"}
                      </button>
                    )}

                    {separation.status === "CONFIRMED" && (
                      <button
                        type="button"
                        className="form-submit-button"
                        onClick={() => handleComplete(separation)}
                        disabled={isProcessing || !canComplete}
                        title={
                          canComplete
                            ? "Complete employee separation"
                            : `Available on ${formatDate(
                                separation.lastWorkingDate,
                              )}`
                        }
                      >
                        <LogOut size={17} />

                        {isProcessing
                          ? "Completing..."
                          : canComplete
                            ? "Complete exit"
                            : "Awaiting final date"}
                      </button>
                    )}

                    <button
                      type="button"
                      className="danger-outline-button"
                      onClick={() => openCancellation(separation)}
                      disabled={isProcessing}
                    >
                      <CircleX size={17} />
                      Cancel process
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {!isLoading && loadError && (
        <button
          type="button"
          className="retry-button"
          onClick={() => loadSeparations()}
        >
          <RefreshCw size={17} />
          Refresh
        </button>
      )}
    </section>
  );
}

export default EmployeeSeparationManager;
