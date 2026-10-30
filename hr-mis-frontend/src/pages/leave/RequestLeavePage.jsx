import {
  AlertCircle,
  ArrowLeft,
  CalendarOff,
  CalendarPlus,
  CheckCircle2,
  FileText,
  Info,
  UploadCloud,
  X,
} from "lucide-react";

import { useEffect, useMemo, useState } from "react";

import { Link, useNavigate } from "react-router-dom";

import {
  createLeaveRequest,
  getLeaveTypes,
  getPublicHolidays,
} from "../../api/leaveApi.js";

import { useAuth } from "../../auth/AuthContext.jsx";

import { formatLeaveDate, getTodayISODate } from "./leaveUtils.js";

import "./leave.css";

const maximumAttachmentSize = 5 * 1024 * 1024;

const allowedAttachmentTypes = ["application/pdf", "image/jpeg", "image/png"];

function getUTCWeekday(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function RequestLeavePage() {
  const { user } = useAuth();

  const navigate = useNavigate();

  const [leaveTypes, setLeaveTypes] = useState([]);

  const [publicHolidays, setPublicHolidays] = useState([]);

  const [loadedHolidayYear, setLoadedHolidayYear] = useState(null);

  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);

  const [holidayLoadError, setHolidayLoadError] = useState("");

  const [attachment, setAttachment] = useState(null);

  const [attachmentInputKey, setAttachmentInputKey] = useState(0);

  const [form, setForm] = useState({
    leaveTypeId: "",
    startDate: "",
    endDate: "",
    reason: "",
  });

  const [isLoading, setIsLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState("");

  const [success, setSuccess] = useState("");

  const today = getTodayISODate();

  const selectedType = useMemo(
    () =>
      leaveTypes.find(
        (leaveType) => leaveType.id === Number(form.leaveTypeId),
      ) || null,
    [leaveTypes, form.leaveTypeId],
  );

  const isFixedDuration = selectedType?.entitlementMode === "FIXED_DURATION";

  const isSickLeave = selectedType?.code === "SICK";

  const requiresAttachment = Boolean(selectedType?.requiresAttachment);

  const startDateYear = form.startDate
    ? Number(form.startDate.slice(0, 4))
    : null;

  const startDateIssue = useMemo(() => {
    if (!form.startDate) {
      return null;
    }

    const weekday = getUTCWeekday(form.startDate);

    if (weekday === 0 || weekday === 6) {
      return {
        type: "WEEKEND",
        message:
          "Leave must start on a working day. The selected date falls on a weekend.",
      };
    }

    if (loadedHolidayYear !== startDateYear) {
      return null;
    }

    const holiday = publicHolidays.find(
      (item) => item.holidayDate === form.startDate,
    );

    if (holiday) {
      return {
        type: "PUBLIC_HOLIDAY",

        holiday,

        message: `Leave cannot start on ${holiday.name}. Select the next available working day.`,
      };
    }

    return null;
  }, [form.startDate, loadedHolidayYear, publicHolidays, startDateYear]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLeaveTypes() {
      setIsLoading(true);
      setError("");

      try {
        const result = await getLeaveTypes({
          signal: controller.signal,
        });

        setLeaveTypes(
          Array.isArray(result.data)
            ? result.data.filter((type) => type.isActive !== false)
            : [],
        );
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
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadLeaveTypes();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!startDateYear) {
      setPublicHolidays([]);
      setLoadedHolidayYear(null);
      setHolidayLoadError("");
      setIsLoadingHolidays(false);

      return undefined;
    }

    const controller = new AbortController();

    async function loadHolidays() {
      setIsLoadingHolidays(true);
      setHolidayLoadError("");
      setLoadedHolidayYear(null);

      try {
        const result = await getPublicHolidays(startDateYear, {
          signal: controller.signal,
        });

        setPublicHolidays(Array.isArray(result.data) ? result.data : []);

        setLoadedHolidayYear(startDateYear);
      } catch (requestError) {
        if (
          requestError.name === "CanceledError" ||
          requestError.code === "ERR_CANCELED"
        ) {
          return;
        }

        setPublicHolidays([]);
        setLoadedHolidayYear(null);

        setHolidayLoadError(
          requestError.response?.data?.message ||
            "Unable to verify the selected date against the public holiday calendar",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingHolidays(false);
        }
      }
    }

    loadHolidays();

    return () => controller.abort();
  }, [startDateYear]);

  function clearAttachment() {
    setAttachment(null);

    setAttachmentInputKey((current) => current + 1);
  }

  function updateField(event) {
    const { name, value } = event.target;

    if (name === "leaveTypeId") {
      setForm((current) => ({
        ...current,

        leaveTypeId: value,

        startDate: "",

        endDate: "",
      }));

      clearAttachment();
    } else {
      setForm((current) => ({
        ...current,

        [name]: value,

        ...(name === "startDate"
          ? {
              endDate: isFixedDuration
                ? ""
                : current.endDate && current.endDate < value
                  ? ""
                  : current.endDate,
            }
          : {}),
      }));
    }

    setError("");
    setSuccess("");
  }

  function selectAttachment(event) {
    const file = event.target.files?.[0] || null;

    setError("");
    setSuccess("");

    if (!file) {
      setAttachment(null);
      return;
    }

    if (!allowedAttachmentTypes.includes(file.type)) {
      clearAttachment();

      setError("Attachment must be a PDF, JPG, JPEG or PNG file.");

      return;
    }

    if (file.size > maximumAttachmentSize) {
      clearAttachment();

      setError("Attachment must not exceed 5 MB.");

      return;
    }

    if (file.size <= 0) {
      clearAttachment();

      setError("The selected attachment is empty.");

      return;
    }

    setAttachment(file);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (!user?.employeeId) {
      setError("Your account is not linked to an employee record.");

      return;
    }

    if (!form.leaveTypeId) {
      setError("Please select a leave type.");

      return;
    }

    if (!form.startDate) {
      setError("Please select the leave start date.");

      return;
    }

    if (isSickLeave && form.startDate !== today) {
      setError("Sick Leave must start on the current date.");

      return;
    }

    if (isLoadingHolidays) {
      setError("Please wait while the selected date is verified.");

      return;
    }

    if (holidayLoadError) {
      setError(holidayLoadError);

      return;
    }

    if (loadedHolidayYear !== startDateYear) {
      setError(
        "The selected date has not yet been verified against the public holiday calendar.",
      );

      return;
    }

    if (startDateIssue) {
      setError(startDateIssue.message);

      return;
    }

    if (!isFixedDuration && !form.endDate) {
      setError("Please select the leave end date.");

      return;
    }

    if (form.endDate && form.endDate < form.startDate) {
      setError("The end date cannot be before the start date.");

      return;
    }

    if (form.reason.trim().length < 5) {
      setError("The leave reason must contain at least 5 characters.");

      return;
    }

    if (requiresAttachment && !attachment) {
      setError(`${selectedType.name} requires a supporting attachment.`);

      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createLeaveRequest({
        leaveTypeId: Number(form.leaveTypeId),

        startDate: form.startDate,

        endDate: isFixedDuration ? null : form.endDate,

        reason: form.reason.trim(),

        attachment: requiresAttachment ? attachment : null,
      });

      setSuccess(result.message || "Leave request submitted successfully");

      const requestId = result.data?.id;

      window.setTimeout(() => {
        if (requestId) {
          navigate(`/leave/requests/${requestId}`);
        } else {
          navigate("/leave/my-requests");
        }
      }, 1000);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to submit the leave request",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="page-loading-state">
        <div className="loading-spinner" />

        <p>Loading leave types...</p>
      </div>
    );
  }

  return (
    <div className="leave-page">
      <div className="details-page-navigation">
        <Link to="/leave" className="back-link">
          <ArrowLeft size={18} />
          Leave management
        </Link>
      </div>

      <header className="leave-page-header">
        <div>
          <p className="eyebrow">Employee self-service</p>

          <h1>Request leave</h1>

          <p>
            Submit a leave request for review through the appropriate approval
            workflow.
          </p>
        </div>

        <CalendarPlus size={38} />
      </header>

      <section className="leave-form-card">
        {error && (
          <div className="leave-message leave-message-error">
            <AlertCircle size={19} />

            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="leave-message leave-message-success">
            <CheckCircle2 size={19} />

            <span>{success}</span>
          </div>
        )}

        <form className="leave-request-form" onSubmit={handleSubmit}>
          <label className="leave-form-field">
            <span>Leave type</span>

            <select
              name="leaveTypeId"
              value={form.leaveTypeId}
              onChange={updateField}
              required
            >
              <option value="">Select leave type</option>

              {leaveTypes.map((leaveType) => (
                <option key={leaveType.id} value={leaveType.id}>
                  {leaveType.name}
                </option>
              ))}
            </select>
          </label>

          {selectedType && (
            <div className="leave-type-summary">
              <Info size={19} />

              <div>
                <strong>{selectedType.name}</strong>

                <p>
                  {selectedType.entitlementMode === "ANNUAL_BUCKET"
                    ? `${selectedType.annualEntitlement ?? 0} working days per entitlement year.`
                    : selectedType.entitlementMode === "FIXED_DURATION"
                      ? `${selectedType.durationValue} ${
                          selectedType.durationUnit === "CALENDAR_MONTHS"
                            ? "calendar month(s)"
                            : "working day(s)"
                        }. The end date is calculated automatically.`
                      : "The requested period will be reviewed under the applicable leave policy."}
                </p>

                {isSickLeave && <small>Sick Leave must start today.</small>}

                {requiresAttachment && (
                  <small>Supporting documentation is required.</small>
                )}
              </div>
            </div>
          )}

          <div className="leave-form-grid">
            <label className="leave-form-field">
              <span>Start date</span>

              <input
                type="date"
                name="startDate"
                min={today}
                max={isSickLeave ? today : undefined}
                value={form.startDate}
                onChange={updateField}
                aria-invalid={Boolean(startDateIssue)}
                required
              />

              {isLoadingHolidays && <small>Checking public holidays...</small>}

              {startDateIssue && (
                <small className="leave-date-error">
                  <CalendarOff size={15} />

                  {startDateIssue.message}
                </small>
              )}

              {!startDateIssue &&
                form.startDate &&
                loadedHolidayYear === startDateYear &&
                !isLoadingHolidays && (
                  <small className="leave-date-valid">
                    <CheckCircle2 size={15} />
                    Available working day
                  </small>
                )}
            </label>

            <label className="leave-form-field">
              <span>
                End date
                {isFixedDuration && " — calculated automatically"}
              </span>

              <input
                type="date"
                name="endDate"
                min={form.startDate || today}
                value={form.endDate}
                onChange={updateField}
                disabled={isFixedDuration}
                required={!isFixedDuration}
              />
            </label>
          </div>

          {requiresAttachment && (
            <div className="leave-form-field">
              <span>Supporting attachment</span>

              <label className="leave-attachment-upload">
                <UploadCloud size={26} />

                <div>
                  <strong>Upload supporting document</strong>

                  <small>PDF, JPG, JPEG or PNG — maximum 5 MB</small>
                </div>

                <input
                  key={attachmentInputKey}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={selectAttachment}
                  required
                />
              </label>

              {attachment && (
                <div className="selected-leave-attachment">
                  <FileText size={20} />

                  <div>
                    <strong>{attachment.name}</strong>

                    <span>{(attachment.size / 1024).toFixed(1)} KB</span>
                  </div>

                  <button
                    type="button"
                    onClick={clearAttachment}
                    aria-label="Remove attachment"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>
          )}

          <label className="leave-form-field">
            <span>Reason</span>

            <textarea
              name="reason"
              rows="5"
              value={form.reason}
              onChange={updateField}
              placeholder="Explain the reason for this leave request"
              maxLength="1000"
              required
            />

            <small>
              {form.reason.length}
              /1000 characters
            </small>
          </label>

          <div className="leave-form-actions">
            <Link to="/leave" className="secondary-action">
              Cancel
            </Link>

            <button
              type="submit"
              className="page-primary-action"
              disabled={
                isSubmitting ||
                isLoadingHolidays ||
                Boolean(startDateIssue) ||
                Boolean(holidayLoadError)
              }
            >
              <CalendarPlus size={18} />

              {isSubmitting ? "Submitting..." : "Submit request"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default RequestLeavePage;
