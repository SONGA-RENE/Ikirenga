import {
  AlertCircle,
  Award,
  BookOpen,
  CalendarDays,
  Edit3,
  GraduationCap,
  MapPin,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  archiveEmployeeEducationRecord,
  createEmployeeEducationRecord,
  getEmployeeEducationRecords,
  updateEmployeeEducationRecord,
} from "../../api/employeeApi.js";

import { useAuth } from
  "../../auth/AuthContext.jsx";

const educationLevels = [
  {
    value: "PRIMARY",
    label: "Primary education",
  },
  {
    value: "SECONDARY",
    label: "Secondary education",
  },
  {
    value: "CERTIFICATE",
    label: "Certificate",
  },
  {
    value: "DIPLOMA",
    label: "Diploma",
  },
  {
    value: "BACHELOR",
    label: "Bachelor's degree",
  },
  {
    value: "POSTGRADUATE_DIPLOMA",
    label: "Postgraduate diploma",
  },
  {
    value: "MASTER",
    label: "Master's degree",
  },
  {
    value: "DOCTORATE",
    label: "Doctorate",
  },
  {
    value: "PROFESSIONAL",
    label: "Professional qualification",
  },
  {
    value: "OTHER",
    label: "Other",
  },
];

const emptyForm = {
  educationLevel: "",
  institutionName: "",
  qualification: "",
  fieldOfStudy: "",
  country: "Rwanda",
  startYear: "",
  graduationYear: "",
  isHighestQualification: false,
  notes: "",
};

function educationLevelLabel(value) {
  return (
    educationLevels.find(
      (level) => level.value === value,
    )?.label ||
    value
      ?.toLowerCase()
      .replaceAll("_", " ")
      .replace(/\b\w/g, (letter) =>
        letter.toUpperCase(),
      ) ||
    "Education"
  );
}

function EducationRecordsPanel({
  employeeId,
}) {
  const { user } = useAuth();

  const [employee, setEmployee] =
    useState(null);

  const [records, setRecords] =
    useState([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [editingRecord, setEditingRecord] =
    useState(null);

  const [showForm, setShowForm] =
    useState(false);

  const canManageEducation = [
    "ADMIN",
    "HR",
  ].includes(user?.role);

  async function loadEducation(signal) {
    setIsLoading(true);
    setError("");

    try {
      const result =
        await getEmployeeEducationRecords(
          employeeId,
          { signal },
        );

      setEmployee({
        id: result.id,
        staffNumber: result.staffNumber,
        fullName: result.fullName,
      });

      setRecords(
        Array.isArray(
          result.educationRecords,
        )
          ? result.educationRecords
          : [],
      );
    } catch (requestError) {
      if (
        requestError.name ===
          "CanceledError" ||
        requestError.code ===
          "ERR_CANCELED"
      ) {
        return;
      }

      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to retrieve education records",
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    const controller =
      new AbortController();

    loadEducation(controller.signal);

    return () => {
      controller.abort();
    };
  }, [employeeId]);

  function openCreateForm() {
    setEditingRecord(null);
    setError("");
    setSuccessMessage("");
    setShowForm(true);
  }

  function openEditForm(record) {
    setEditingRecord(record);
    setError("");
    setSuccessMessage("");
    setShowForm(true);
  }

  function closeForm() {
    setEditingRecord(null);
    setShowForm(false);
  }

  function handleSavedRecord(
    savedRecord,
    message,
  ) {
    setRecords((current) => {
      const exists = current.some(
        (record) =>
          record.id === savedRecord.id,
      );

      let updatedRecords = exists
        ? current.map((record) =>
            record.id === savedRecord.id
              ? savedRecord
              : record,
          )
        : [savedRecord, ...current];

      if (
        savedRecord.isHighestQualification
      ) {
        updatedRecords =
          updatedRecords.map(
            (record) => ({
              ...record,

              isHighestQualification:
                record.id ===
                savedRecord.id,
            }),
          );
      }

      return updatedRecords;
    });

    setSuccessMessage(message);
    closeForm();
  }

  async function handleArchive(record) {
    const confirmed = window.confirm(
      `Archive ${record.qualification} from this employee's education history?`,
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccessMessage("");

    try {
      const result =
        await archiveEmployeeEducationRecord(
          employeeId,
          record.id,
        );

      setRecords((current) =>
        current.filter(
          (item) =>
            item.id !== record.id,
        ),
      );

      setSuccessMessage(
        result.message ||
          "Education record archived successfully",
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to archive education record",
      );
    }
  }

  return (
    <>
      <section className="education-panel">
        <header className="education-panel-header">
          <div className="education-panel-heading">
            <div className="education-panel-icon">
              <GraduationCap size={22} />
            </div>

            <div>
              <h2>Education history</h2>

              <p>
                Academic qualifications and
                professional education.
              </p>
            </div>
          </div>

          {canManageEducation && (
            <button
              type="button"
              className="education-add-button"
              onClick={openCreateForm}
            >
              <Plus size={17} />
              Add education
            </button>
          )}
        </header>

        {error && (
          <div
            className="alert alert-error education-message"
            role="alert"
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div
            className="alert alert-success education-message"
            role="status"
          >
            <ShieldCheck size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {isLoading ? (
          <div className="education-loading">
            <div className="loading-spinner" />
            <p>Loading education history...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="education-empty-state">
            <GraduationCap size={30} />

            <h3>
              No education records
            </h3>

            <p>
              Add the employee’s academic
              and professional qualifications.
            </p>

            {canManageEducation && (
              <button
                type="button"
                onClick={openCreateForm}
              >
                <Plus size={16} />
                Add first qualification
              </button>
            )}
          </div>
        ) : (
          <div className="education-records-list">
            {records.map((record) => (
              <article
                className={`education-record-card ${
                  record.isHighestQualification
                    ? "education-record-highest"
                    : ""
                }`}
                key={record.id}
              >
                <div className="education-record-main">
                  <div className="education-record-icon">
                    <BookOpen size={20} />
                  </div>

                  <div className="education-record-content">
                    <div className="education-record-title">
                      <div>
                        <h3>
                          {record.qualification}
                        </h3>

                        <p>
                          {
                            record.institutionName
                          }
                        </p>
                      </div>

                      <div className="education-badges">
                        <span className="education-level-badge">
                          {educationLevelLabel(
                            record.educationLevel,
                          )}
                        </span>

                        {record.isHighestQualification && (
                          <span className="highest-qualification-badge">
                            <Award size={13} />
                            Highest qualification
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="education-record-details">
                      <div>
                        <span>
                          Field of study
                        </span>

                        <strong>
                          {record.fieldOfStudy ||
                            "Not provided"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          <MapPin size={14} />
                          Country
                        </span>

                        <strong>
                          {record.country ||
                            "Not provided"}
                        </strong>
                      </div>

                      <div>
                        <span>
                          <CalendarDays
                            size={14}
                          />
                          Study period
                        </span>

                        <strong>
                          {record.startYear ||
                            "Unknown"}
                          {" — "}
                          {record.graduationYear ||
                            "Ongoing"}
                        </strong>
                      </div>
                    </div>

                    {record.notes && (
                      <p className="education-record-notes">
                        {record.notes}
                      </p>
                    )}
                  </div>
                </div>

                {canManageEducation && (
                  <div className="education-record-actions">
                    <button
                      type="button"
                      className="education-edit-button"
                      onClick={() =>
                        openEditForm(record)
                      }
                    >
                      <Edit3 size={15} />
                      Edit
                    </button>

                    <button
                      type="button"
                      className="education-archive-button"
                      onClick={() =>
                        handleArchive(record)
                      }
                    >
                      <Trash2 size={15} />
                      Archive
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {showForm && (
        <EducationRecordDialog
          employeeId={employeeId}
          employee={employee}
          record={editingRecord}
          onClose={closeForm}
          onSaved={handleSavedRecord}
        />
      )}
    </>
  );
}

function EducationRecordDialog({
  employeeId,
  employee,
  record,
  onClose,
  onSaved,
}) {
  const [formData, setFormData] =
    useState(() => ({
      ...emptyForm,

      ...(record
        ? {
            educationLevel:
              record.educationLevel || "",

            institutionName:
              record.institutionName || "",

            qualification:
              record.qualification || "",

            fieldOfStudy:
              record.fieldOfStudy || "",

            country:
              record.country || "",

            startYear:
              record.startYear ?? "",

            graduationYear:
              record.graduationYear ?? "",

            isHighestQualification:
              Boolean(
                record.isHighestQualification,
              ),

            notes:
              record.notes || "",
          }
        : {}),
    }));

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const isEditing = Boolean(record);

  function handleChange(event) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setFormData((current) => ({
      ...current,

      [name]:
        type === "checkbox"
          ? checked
          : value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    const startYear =
      formData.startYear === ""
        ? null
        : Number(formData.startYear);

    const graduationYear =
      formData.graduationYear === ""
        ? null
        : Number(formData.graduationYear);

    if (
      !formData.educationLevel ||
      !formData.institutionName.trim() ||
      !formData.qualification.trim()
    ) {
      setError(
        "Education level, institution and qualification are required.",
      );

      return;
    }

    if (
      startYear !== null &&
      (!Number.isInteger(startYear) ||
        startYear < 1900 ||
        startYear > 2200)
    ) {
      setError(
        "Start year must be between 1900 and 2200.",
      );

      return;
    }

    if (
      graduationYear !== null &&
      (!Number.isInteger(
        graduationYear,
      ) ||
        graduationYear < 1900 ||
        graduationYear > 2200)
    ) {
      setError(
        "Graduation year must be between 1900 and 2200.",
      );

      return;
    }

    if (
      startYear !== null &&
      graduationYear !== null &&
      graduationYear < startYear
    ) {
      setError(
        "Graduation year cannot be before the start year.",
      );

      return;
    }

    const submittedData = {
      educationLevel:
        formData.educationLevel,

      institutionName:
        formData.institutionName.trim(),

      qualification:
        formData.qualification.trim(),

      fieldOfStudy:
        formData.fieldOfStudy.trim() ||
        null,

      country:
        formData.country.trim() || null,

      startYear,
      graduationYear,

      isHighestQualification:
        formData.isHighestQualification,

      notes:
        formData.notes.trim() || null,
    };

    setIsSubmitting(true);

    try {
      const result = isEditing
        ? await updateEmployeeEducationRecord(
            employeeId,
            record.id,
            submittedData,
          )
        : await createEmployeeEducationRecord(
            employeeId,
            submittedData,
          );

      onSaved(
        result.educationRecord,
        result.message ||
          (isEditing
            ? "Education record updated successfully"
            : "Education record created successfully"),
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to save education record",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        className="education-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="education-dialog-title"
      >
        <header className="education-dialog-header">
          <div>
            <p className="eyebrow">
              {isEditing
                ? "UPDATE EDUCATION"
                : "NEW EDUCATION"}
            </p>

            <h2 id="education-dialog-title">
              {isEditing
                ? "Edit education record"
                : "Add education record"}
            </h2>

            {employee?.fullName && (
              <span>
                {employee.fullName} ·{" "}
                {employee.staffNumber}
              </span>
            )}
          </div>

          <button
            type="button"
            className="dialog-close-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </header>

        <form
          className="education-form"
          onSubmit={handleSubmit}
        >
          {error && (
            <div
              className="alert alert-error education-dialog-message"
              role="alert"
            >
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          <div className="education-form-grid">
            <label className="form-control">
              <span>
                Education level
                <strong>*</strong>
              </span>

              <select
                name="educationLevel"
                value={
                  formData.educationLevel
                }
                onChange={handleChange}
                required
              >
                <option value="">
                  Select education level
                </option>

                {educationLevels.map(
                  (level) => (
                    <option
                      key={level.value}
                      value={level.value}
                    >
                      {level.label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="form-control">
              <span>
                Institution
                <strong>*</strong>
              </span>

              <input
                type="text"
                name="institutionName"
                value={
                  formData.institutionName
                }
                onChange={handleChange}
                placeholder="University or institution"
                required
              />
            </label>

            <label className="form-control form-control-full">
              <span>
                Qualification
                <strong>*</strong>
              </span>

              <input
                type="text"
                name="qualification"
                value={
                  formData.qualification
                }
                onChange={handleChange}
                placeholder="Bachelor of Science"
                required
              />
            </label>

            <label className="form-control">
              <span>Field of study</span>

              <input
                type="text"
                name="fieldOfStudy"
                value={
                  formData.fieldOfStudy
                }
                onChange={handleChange}
                placeholder="Information Technology"
              />
            </label>

            <label className="form-control">
              <span>Country</span>

              <input
                type="text"
                name="country"
                value={formData.country}
                onChange={handleChange}
                placeholder="Rwanda"
              />
            </label>

            <label className="form-control">
              <span>Start year</span>

              <input
                type="number"
                name="startYear"
                value={formData.startYear}
                onChange={handleChange}
                min="1900"
                max="2200"
                placeholder="2013"
              />
            </label>

            <label className="form-control">
              <span>Graduation year</span>

              <input
                type="number"
                name="graduationYear"
                value={
                  formData.graduationYear
                }
                onChange={handleChange}
                min="1900"
                max="2200"
                placeholder="2017"
              />
            </label>

            <label className="form-control form-control-full">
              <span>Notes</span>

              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Optional information about this qualification"
              />
            </label>
          </div>

          <label className="highest-qualification-option">
            <input
              type="checkbox"
              name="isHighestQualification"
              checked={
                formData.isHighestQualification
              }
              onChange={handleChange}
            />

            <span>
              <Award size={18} />

              <span>
                <strong>
                  Highest qualification
                </strong>

                <small>
                  Mark this as the employee’s
                  highest completed
                  qualification.
                </small>
              </span>
            </span>
          </label>

          <div className="profile-form-actions">
            <button
              type="button"
              className="form-cancel-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="form-submit-button"
              disabled={isSubmitting}
            >
              <GraduationCap size={17} />

              {isSubmitting
                ? "Saving..."
                : isEditing
                  ? "Save changes"
                  : "Add education"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default EducationRecordsPanel;