import {
  AlertCircle,
  BriefcaseBusiness,
  CheckCircle2,
  Plus,
  Save,
  X,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createEmployeePositionAssignment,
  endEmployeePositionAssignment,
} from "../../api/employeeApi.js";

import {
  getActingEligiblePositions,
  getAvailablePositions,
} from "../../api/positionApi.js";

function getCurrentDate() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Africa/Kigali",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).format(new Date());
}

const initialFormData = {
  assignmentType: "SUBSTANTIVE",
  positionId: "",
  startDate: getCurrentDate(),
  expectedEndDate: "",
  assignmentNote: "",
};

function PositionAssignmentManager({
  employeeId,
  assignments,
  onChanged,
}) {
  const [isFormOpen, setIsFormOpen] =
    useState(false);

  const [formData, setFormData] =
    useState(initialFormData);

  const [positions, setPositions] =
    useState([]);

  const [isLoadingPositions, setIsLoadingPositions] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [endingAssignmentId, setEndingAssignmentId] =
    useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] =
    useState("");

  const currentTemporary =
    assignments.find(
      (assignment) =>
        assignment.isCurrent &&
        ["ACTING", "INTERIM"].includes(
          assignment.assignmentType,
        ),
    );

  useEffect(() => {
    if (!isFormOpen) {
      return undefined;
    }

    const controller =
      new AbortController();

    async function loadPositions() {
      setIsLoadingPositions(true);
      setError("");

      try {
        const result =
          formData.assignmentType ===
          "ACTING"
            ? await getActingEligiblePositions({
                signal:
                  controller.signal,
              })
            : await getAvailablePositions({
                signal:
                  controller.signal,
              });

        const filteredResult =
          formData.assignmentType ===
          "ACTING"
            ? result.filter(
                (position) =>
                  position
                    .substantiveEmployeeId !==
                  Number(employeeId),
              )
            : result;

        setPositions(filteredResult);
      } catch (requestError) {
        if (
          requestError.code ===
            "ERR_CANCELED" ||
          requestError.name ===
            "CanceledError"
        ) {
          return;
        }

        setError(
          requestError.response?.data
            ?.message ||
            requestError.message ||
            "Unable to retrieve eligible positions",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingPositions(false);
        }
      }
    }

    loadPositions();

    return () => {
      controller.abort();
    };
  }, [
    employeeId,
    formData.assignmentType,
    isFormOpen,
  ]);

  const positionsByDepartment =
    useMemo(() => {
      return positions.reduce(
        (groups, position) => {
          const department =
            position.department ||
            "Unassigned";

          if (!groups[department]) {
            groups[department] = [];
          }

          groups[department].push(
            position,
          );

          return groups;
        },
        {},
      );
    }, [positions]);

  function handleChange(event) {
    const { name, value } =
      event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
      ...(name === "assignmentType"
        ? {
            positionId: "",
            expectedEndDate:
              value === "SUBSTANTIVE"
                ? ""
                : current
                    .expectedEndDate,
          }
        : {}),
    }));

    setError("");
    setSuccess("");
  }

  function openForm() {
    setFormData({
      ...initialFormData,
      startDate: getCurrentDate(),
    });

    setError("");
    setSuccess("");
    setIsFormOpen(true);
  }

  function closeForm() {
    if (isSubmitting) {
      return;
    }

    setIsFormOpen(false);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const positionId =
      Number(formData.positionId);

    if (
      !Number.isInteger(positionId) ||
      positionId <= 0
    ) {
      setError(
        "Select an eligible position.",
      );
      return;
    }

    if (
      formData.assignmentType !==
        "SUBSTANTIVE" &&
      formData.expectedEndDate &&
      formData.expectedEndDate <
        formData.startDate
    ) {
      setError(
        "Expected end date cannot be before the start date.",
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const result =
        await createEmployeePositionAssignment(
          employeeId,
          {
            positionId,
            assignmentType:
              formData.assignmentType,
            startDate:
              formData.startDate,
            expectedEndDate:
              formData.assignmentType ===
              "SUBSTANTIVE"
                ? null
                : formData
                    .expectedEndDate ||
                  null,
            assignmentNote:
              formData.assignmentNote
                .trim() || null,
          },
        );

      setSuccess(result.message);
      setIsFormOpen(false);

      await onChanged();
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          requestError.message ||
          "Unable to create appointment",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleEndTemporary() {
    if (!currentTemporary) {
      return;
    }

    const confirmed = window.confirm(
      `End the current ${currentTemporary.assignmentType.toLowerCase()} appointment as ${currentTemporary.position}?`,
    );

    if (!confirmed) {
      return;
    }

    setEndingAssignmentId(
      currentTemporary.id,
    );

    setError("");
    setSuccess("");

    try {
      const result =
        await endEmployeePositionAssignment(
          employeeId,
          currentTemporary.id,
          {
            endDate: getCurrentDate(),
            endNote:
              "Temporary appointment ended through employee management",
          },
        );

      setSuccess(result.message);
      await onChanged();
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          requestError.message ||
          "Unable to end temporary appointment",
      );
    } finally {
      setEndingAssignmentId(null);
    }
  }

  return (
    <section className="position-management-panel">
      <div className="position-management-header">
        <div className="position-management-heading">
          <div className="position-management-icon">
            <BriefcaseBusiness size={21} />
          </div>

          <div>
            <h2>Manage appointment</h2>

            <p>
              Transfer the employee or create
              an acting or interim appointment.
            </p>
          </div>
        </div>

        {!isFormOpen && (
          <button
            type="button"
            className="page-primary-action"
            onClick={openForm}
          >
            <Plus size={18} />
            New appointment
          </button>
        )}
      </div>

      {error && (
        <div
          className="alert alert-error assignment-alert"
          role="alert"
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          className="alert alert-success assignment-alert"
          role="status"
        >
          <CheckCircle2 size={18} />
          <span>{success}</span>
        </div>
      )}

      {currentTemporary && (
        <div className="current-temporary-summary">
          <div>
            <span>
              Active temporary appointment
            </span>

            <strong>
              {currentTemporary.position}
            </strong>

            <p>
              {currentTemporary.assignmentType}
              {currentTemporary
                .expectedEndDate
                ? ` · Expected to end ${currentTemporary.expectedEndDate}`
                : ""}
            </p>
          </div>

          <button
            type="button"
            className="danger-outline-button"
            onClick={handleEndTemporary}
            disabled={
              endingAssignmentId ===
              currentTemporary.id
            }
          >
            {endingAssignmentId ===
            currentTemporary.id
              ? "Ending..."
              : "End appointment"}
          </button>
        </div>
      )}

      {isFormOpen && (
        <form
          className="position-assignment-form"
          onSubmit={handleSubmit}
        >
          <div className="assignment-form-header">
            <div>
              <h3>Create appointment</h3>

              <p>
                Select the appointment type and
                its eligible position.
              </p>
            </div>

            <button
              type="button"
              className="assignment-form-close"
              onClick={closeForm}
              aria-label="Close form"
            >
              <X size={19} />
            </button>
          </div>

          <div className="form-grid">
            <label className="form-control">
              <span>
                Appointment type
                <strong>*</strong>
              </span>

              <select
                name="assignmentType"
                value={
                  formData.assignmentType
                }
                onChange={handleChange}
                required
              >
                <option value="SUBSTANTIVE">
                  Substantive transfer
                </option>

                <option value="ACTING">
                  Acting appointment
                </option>

                <option value="INTERIM">
                  Interim appointment
                </option>
              </select>
            </label>

            <label className="form-control">
              <span>
                Start date
                <strong>*</strong>
              </span>

              <input
                name="startDate"
                type="date"
                value={formData.startDate}
                max={getCurrentDate()}
                onChange={handleChange}
                required
              />
            </label>

            <label className="form-control form-control-full">
              <span>
                Eligible position
                <strong>*</strong>
              </span>

              <select
                name="positionId"
                value={formData.positionId}
                onChange={handleChange}
                disabled={
                  isLoadingPositions ||
                  positions.length === 0
                }
                required
              >
                <option value="">
                  {isLoadingPositions
                    ? "Loading eligible positions..."
                    : "Select position"}
                </option>

                {!isLoadingPositions &&
                  positions.length === 0 && (
                    <option
                      value=""
                      disabled
                    >
                      No eligible positions available
                    </option>
                  )}

                {Object.entries(
                  positionsByDepartment,
                ).map(
                  ([
                    department,
                    departmentPositions,
                  ]) => (
                    <optgroup
                      key={department}
                      label={department}
                    >
                      {departmentPositions.map(
                        (position) => (
                          <option
                            key={position.id}
                            value={position.id}
                          >
                            {position.title}
                            {position.locationName
                              ? ` — ${position.locationName}`
                              : ""}
                            {position
                              .positionCode
                              ? ` (${position.positionCode})`
                              : ""}
                            {formData
                              .assignmentType ===
                              "ACTING" &&
                            position
                              .substantiveEmployeeName
                              ? ` — held by ${position.substantiveEmployeeName}`
                              : ""}
                          </option>
                        ),
                      )}
                    </optgroup>
                  ),
                )}
              </select>
            </label>

            {formData.assignmentType !==
              "SUBSTANTIVE" && (
              <label className="form-control">
                <span>
                  Expected end date
                </span>

                <input
                  name="expectedEndDate"
                  type="date"
                  value={
                    formData.expectedEndDate
                  }
                  min={formData.startDate}
                  onChange={handleChange}
                />
              </label>
            )}

            <label className="form-control form-control-full">
              <span>Appointment note</span>

              <textarea
                name="assignmentNote"
                value={
                  formData.assignmentNote
                }
                onChange={handleChange}
                rows="4"
                placeholder="Reference the approval, reason or management decision"
              />
            </label>
          </div>

          <div className="employee-form-actions">
            <button
              type="button"
              className="form-cancel-button"
              onClick={closeForm}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="form-submit-button"
              disabled={
                isSubmitting ||
                isLoadingPositions ||
                positions.length === 0
              }
            >
              <Save size={18} />

              {isSubmitting
                ? "Saving appointment..."
                : "Save appointment"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default PositionAssignmentManager;