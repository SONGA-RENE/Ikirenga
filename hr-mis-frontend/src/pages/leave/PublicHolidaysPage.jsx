import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  Check,
  Edit3,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import { Link } from "react-router-dom";

import {
  createPublicHoliday,
  deletePublicHoliday,
  generateRwandaHolidayCalendar,
  getPublicHolidays,
  updatePublicHoliday,
} from "../../api/leaveApi.js";

import { formatLeaveDate, getTodayISODate } from "./leaveUtils.js";

import "./leave.css";

const currentYear = new Date().getFullYear();

const yearOptions = Array.from(
  { length: 7 },
  (_, index) => currentYear - 1 + index,
);

const emptyHolidayForm = {
  name: "",
  holidayDate: "",
  description: "",
};

function PublicHolidaysPage() {
  const [year, setYear] = useState(currentYear);

  const [holidays, setHolidays] = useState([]);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const [successMessage, setSuccessMessage] = useState("");

  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);

  const [editingHoliday, setEditingHoliday] = useState(null);

  const [holidayForm, setHolidayForm] = useState(emptyHolidayForm);

  const [isSaving, setIsSaving] = useState(false);

  const [deletingHoliday, setDeletingHoliday] = useState(null);

  const [isDeleting, setIsDeleting] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [importYear, setImportYear] = useState(currentYear + 1);

  const [calendarPreview, setCalendarPreview] = useState(null);

  const [isPreparingPreview, setIsPreparingPreview] = useState(false);

  const [isImporting, setIsImporting] = useState(false);

  const loadHolidays = useCallback(
    async (signal) => {
      setIsLoading(true);
      setError("");

      try {
        const result = await getPublicHolidays(year, {
          signal,
        });

        setHolidays(Array.isArray(result.data) ? result.data : []);
      } catch (requestError) {
        if (
          requestError.name === "CanceledError" ||
          requestError.code === "ERR_CANCELED"
        ) {
          return;
        }

        setError(
          requestError.response?.data?.message ||
            "Unable to load public holidays",
        );
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [year],
  );

  useEffect(() => {
    const controller = new AbortController();

    loadHolidays(controller.signal);

    return () => controller.abort();
  }, [loadHolidays]);

  function openCreateModal() {
    setEditingHoliday(null);

    setHolidayForm({
      ...emptyHolidayForm,
      holidayDate: `${year}-01-01`,
    });

    setError("");
    setSuccessMessage("");
    setIsHolidayModalOpen(true);
  }

  function openEditModal(holiday) {
    setEditingHoliday(holiday);

    setHolidayForm({
      name: holiday.name || "",
      holidayDate: holiday.holidayDate || "",
      description: holiday.description || "",
    });

    setError("");
    setSuccessMessage("");
    setIsHolidayModalOpen(true);
  }

  function closeHolidayModal() {
    if (isSaving) {
      return;
    }

    setIsHolidayModalOpen(false);
    setEditingHoliday(null);
    setHolidayForm(emptyHolidayForm);
  }

  function updateHolidayForm(event) {
    const { name, value } = event.target;

    setHolidayForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function submitHoliday(event) {
    event.preventDefault();

    setIsSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const payload = {
        name: holidayForm.name.trim(),
        holidayDate: holidayForm.holidayDate,
        description: holidayForm.description.trim() || null,
      };

      if (editingHoliday) {
        await updatePublicHoliday(editingHoliday.id, payload);

        setSuccessMessage("Public holiday updated successfully");
      } else {
        await createPublicHoliday(payload);

        setSuccessMessage("Public holiday created successfully");
      }

      closeHolidayModal();

      await loadHolidays();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message || "Unable to save public holiday",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDeleteHoliday() {
    if (!deletingHoliday) {
      return;
    }

    setIsDeleting(true);
    setError("");
    setSuccessMessage("");

    try {
      await deletePublicHoliday(deletingHoliday.id);

      setDeletingHoliday(null);

      setSuccessMessage("Public holiday deleted successfully");

      await loadHolidays();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to delete public holiday",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function openImportModal() {
    setImportYear(Math.max(year, currentYear + 1));

    setCalendarPreview(null);
    setError("");
    setSuccessMessage("");
    setIsImportModalOpen(true);
  }

  function closeImportModal() {
    if (isPreparingPreview || isImporting) {
      return;
    }

    setIsImportModalOpen(false);
    setCalendarPreview(null);
  }

  async function prepareCalendarPreview() {
    setIsPreparingPreview(true);
    setCalendarPreview(null);
    setError("");

    try {
      const result = await generateRwandaHolidayCalendar({
        year: Number(importYear),
        dryRun: true,
      });

      setCalendarPreview(result.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to prepare calendar preview",
      );
    } finally {
      setIsPreparingPreview(false);
    }
  }

  async function importCalendar() {
    setIsImporting(true);
    setError("");
    setSuccessMessage("");

    try {
      const result = await generateRwandaHolidayCalendar({
        year: Number(importYear),
        dryRun: false,
      });

      setSuccessMessage(
        `${result.data.generatedCount} Rwanda public holiday(s) imported for ${importYear}`,
      );

      setYear(Number(importYear));
      setCalendarPreview(null);
      setIsImportModalOpen(false);

      /*
       * If the selected page year was already
       * the imported year, reload immediately.
       * Otherwise changing `year` triggers the
       * page effect.
       */
      if (Number(importYear) === year) {
        await loadHolidays();
      }
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to import Rwanda public holiday calendar",
      );
    } finally {
      setIsImporting(false);
    }
  }

  const today = getTodayISODate();

  return (
    <div className="leave-page">
      <div className="details-page-navigation">
        <Link to="/leave" className="back-link">
          <ArrowLeft size={18} />
          Leave dashboard
        </Link>
      </div>

      <header className="leave-list-header public-holiday-header">
        <div>
          <p className="eyebrow">Working calendar</p>

          <h1>Public holidays</h1>

          <p>
            Maintain Rwanda public holidays used when calculating working leave
            days.
          </p>
        </div>

        <div className="holiday-header-actions">
          <button
            type="button"
            className="secondary-action-button"
            onClick={openImportModal}
          >
            <Sparkles size={18} />
            Import Rwanda calendar
          </button>

          <button
            type="button"
            className="page-primary-action"
            onClick={openCreateModal}
          >
            <CalendarPlus size={18} />
            Add special holiday
          </button>
        </div>
      </header>

      {successMessage && (
        <div className="leave-success-banner">
          <Check size={20} />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="leave-inline-error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <section className="holiday-year-toolbar">
        <div>
          <CalendarDays size={22} />

          <div>
            <span>Calendar year</span>

            <strong>
              {holidays.length} holiday
              {holidays.length === 1 ? "" : "s"}
            </strong>
          </div>
        </div>

        <label>
          <span>Year</span>

          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {yearOptions.map((optionYear) => (
              <option key={optionYear} value={optionYear}>
                {optionYear}
              </option>
            ))}
          </select>
        </label>
      </section>

      {isLoading && (
        <div className="page-loading-state">
          <div className="loading-spinner" />
          <p>Loading public holidays...</p>
        </div>
      )}

      {!isLoading && holidays.length === 0 && (
        <div className="leave-empty-state">
          <CalendarCheck size={30} />

          <h2>No public holidays configured</h2>

          <p>
            Import Rwanda&apos;s statutory calendar or add a special officially
            announced holiday.
          </p>
        </div>
      )}

      {!isLoading && holidays.length > 0 && (
        <section className="public-holiday-list">
          {holidays.map((holiday) => {
            const isHistorical = holiday.holidayDate <= today;

            return (
              <article className="public-holiday-card" key={holiday.id}>
                <div className="holiday-date-block">
                  <span>
                    {new Intl.DateTimeFormat("en-GB", {
                      month: "short",
                    }).format(new Date(`${holiday.holidayDate}T00:00:00`))}
                  </span>

                  <strong>{holiday.holidayDate.slice(8, 10)}</strong>

                  <small>{holiday.holidayDate.slice(0, 4)}</small>
                </div>

                <div className="holiday-card-content">
                  <div className="holiday-title-row">
                    <div>
                      <h2>{holiday.name}</h2>

                      <p>{holiday.description || "No description provided"}</p>
                    </div>

                    <div className="holiday-badges">
                      {holiday.isObserved && (
                        <span className="holiday-badge observed">Observed</span>
                      )}

                      <span className="holiday-badge source">
                        {holiday.source === "STATUTORY_GENERATION"
                          ? "Statutory"
                          : holiday.source === "OFFICIAL_ANNOUNCEMENT"
                            ? "Official announcement"
                            : "Manual"}
                      </span>
                    </div>
                  </div>

                  <div className="holiday-card-footer">
                    <span>{formatLeaveDate(holiday.holidayDate)}</span>

                    {holiday.baseHolidayDate && (
                      <span>
                        Base date: {formatLeaveDate(holiday.baseHolidayDate)}
                      </span>
                    )}

                    {!isHistorical &&
                      holiday.source !== "STATUTORY_GENERATION" && (
                        <div className="holiday-actions">
                          <button
                            type="button"
                            onClick={() => openEditModal(holiday)}
                            aria-label={`Edit ${holiday.name}`}
                          >
                            <Edit3 size={17} />
                            Edit
                          </button>

                          <button
                            type="button"
                            className="danger"
                            onClick={() => setDeletingHoliday(holiday)}
                            aria-label={`Delete ${holiday.name}`}
                          >
                            <Trash2 size={17} />
                            Delete
                          </button>
                        </div>
                      )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {isHolidayModalOpen && (
        <div className="leave-modal-backdrop" role="presentation">
          <section
            className="leave-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="holiday-modal-title"
          >
            <div className="leave-modal-header">
              <div>
                <p className="eyebrow">Calendar administration</p>

                <h2 id="holiday-modal-title">
                  {editingHoliday
                    ? "Update public holiday"
                    : "Add special holiday"}
                </h2>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeHolidayModal}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <form className="leave-modal-form" onSubmit={submitHoliday}>
              <label>
                <span>Holiday name</span>

                <input
                  name="name"
                  value={holidayForm.name}
                  onChange={updateHolidayForm}
                  maxLength={150}
                  required
                />
              </label>

              <label>
                <span>Holiday date</span>

                <input
                  type="date"
                  name="holidayDate"
                  value={holidayForm.holidayDate}
                  onChange={updateHolidayForm}
                  required
                />
              </label>

              <label>
                <span>Description</span>

                <textarea
                  name="description"
                  value={holidayForm.description}
                  onChange={updateHolidayForm}
                  rows={4}
                />
              </label>

              <div className="leave-modal-actions">
                <button
                  type="button"
                  className="secondary-action-button"
                  onClick={closeHolidayModal}
                  disabled={isSaving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="page-primary-action"
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Saving..."
                    : editingHoliday
                      ? "Save changes"
                      : "Add holiday"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isImportModalOpen && (
        <div className="leave-modal-backdrop" role="presentation">
          <section
            className="leave-modal holiday-import-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-import-title"
          >
            <div className="leave-modal-header">
              <div>
                <p className="eyebrow">Rwanda statutory calendar</p>

                <h2 id="calendar-import-title">Import public holidays</h2>
              </div>

              <button
                type="button"
                className="modal-close-button"
                onClick={closeImportModal}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {!calendarPreview && (
              <div className="calendar-import-setup">
                <label>
                  <span>Calendar year</span>

                  <select
                    value={importYear}
                    onChange={(event) =>
                      setImportYear(Number(event.target.value))
                    }
                  >
                    {yearOptions.map((optionYear) => (
                      <option key={optionYear} value={optionYear}>
                        {optionYear}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="calendar-import-information">
                  <CalendarCheck size={24} />

                  <div>
                    <strong>Preview before importing</strong>

                    <p>
                      The calendar will include statutory and calculated
                      observed holidays. Existing dates will be skipped.
                    </p>
                  </div>
                </div>

                <div className="leave-modal-actions">
                  <button
                    type="button"
                    className="secondary-action-button"
                    onClick={closeImportModal}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="page-primary-action"
                    onClick={prepareCalendarPreview}
                    disabled={isPreparingPreview}
                  >
                    {isPreparingPreview ? (
                      <>
                        <RefreshCw size={17} className="spin-icon" />
                        Preparing...
                      </>
                    ) : (
                      <>
                        <Sparkles size={17} />
                        Preview calendar
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {calendarPreview && (
              <div className="calendar-preview">
                <div className="calendar-preview-summary">
                  <div>
                    <strong>{calendarPreview.readyToGenerateCount}</strong>
                    <span>Ready to import</span>
                  </div>

                  <div>
                    <strong>{calendarPreview.skippedCount}</strong>
                    <span>Already configured</span>
                  </div>
                </div>

                <div className="eid-warning">
                  <AlertCircle size={22} />

                  <div>
                    <strong>Eid dates are not generated</strong>

                    <p>
                      Eid al-Fitr and Eid al-Adha must be added after their
                      official annual announcements.
                    </p>
                  </div>
                </div>

                <div className="calendar-preview-list">
                  {calendarPreview.proposed.map((holiday) => (
                    <div key={`${holiday.holidayDate}-${holiday.name}`}>
                      <CalendarDays size={18} />

                      <div>
                        <strong>{holiday.name}</strong>

                        <span>{formatLeaveDate(holiday.holidayDate)}</span>
                      </div>

                      {holiday.isObserved && <small>Observed</small>}
                    </div>
                  ))}
                </div>

                {calendarPreview.skippedCount > 0 && (
                  <p className="calendar-skipped-note">
                    {calendarPreview.skippedCount} existing date(s) will be
                    skipped.
                  </p>
                )}

                <div className="leave-modal-actions">
                  <button
                    type="button"
                    className="secondary-action-button"
                    onClick={() => setCalendarPreview(null)}
                    disabled={isImporting}
                  >
                    Change year
                  </button>

                  <button
                    type="button"
                    className="page-primary-action"
                    onClick={importCalendar}
                    disabled={
                      isImporting || calendarPreview.readyToGenerateCount === 0
                    }
                  >
                    {isImporting
                      ? "Importing..."
                      : `Import ${calendarPreview.readyToGenerateCount} holidays`}
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {deletingHoliday && (
        <div className="leave-modal-backdrop" role="presentation">
          <section
            className="confirmation-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-holiday-title"
          >
            <div className="confirmation-icon danger">
              <Trash2 size={24} />
            </div>

            <h2 id="delete-holiday-title">Delete public holiday?</h2>

            <p>
              Delete <strong>{deletingHoliday.name}</strong> on{" "}
              {formatLeaveDate(deletingHoliday.holidayDate)}? This date will
              immediately become a working day in leave calculations.
            </p>

            <div className="leave-modal-actions">
              <button
                type="button"
                className="secondary-action-button"
                onClick={() => setDeletingHoliday(null)}
                disabled={isDeleting}
              >
                Keep holiday
              </button>

              <button
                type="button"
                className="danger-action-button"
                onClick={confirmDeleteHoliday}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete holiday"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default PublicHolidaysPage;
