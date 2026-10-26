import {
  AlertCircle,
  Ban,
  RefreshCw,
  Save,
  X,
} from "lucide-react";

import {
  useMemo,
  useState,
} from "react";

import {
  cancelContract,
  renewContract,
  terminateContract,
} from "../../api/contractApi.js";

function addOneDay(dateValue) {
  if (!dateValue) {
    return "";
  }

  const date = new Date(
    `${dateValue}T00:00:00Z`,
  );

  date.setUTCDate(
    date.getUTCDate() + 1,
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function kigaliToday() {
  const parts =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Africa/Kigali",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      },
    ).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map((part) => [
      part.type,
      part.value,
    ]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function ContractActionModal({
  action,
  contract,
  onClose,
  onSuccess,
}) {
  const renewalStartDate = useMemo(
    () => addOneDay(contract.endDate),
    [contract.endDate],
  );

  const [formData, setFormData] =
    useState({
      contractType:
        contract.contractType ||
        "FIXED_TERM",

      startDate:
        renewalStartDate,

      endDate: "",

      terminationDate:
        kigaliToday(),

      reason: "",
    });

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const requiresRenewalEndDate =
    formData.contractType !==
    "PERMANENT";

  const titles = {
    RENEW: "Renew contract",
    TERMINATE: "Terminate contract",
    CANCEL: "Cancel upcoming contract",
  };

  function handleChange(event) {
    const { name, value } =
      event.target;

    setFormData((current) => {
      const next = {
        ...current,
        [name]: value,
      };

      if (
        name === "contractType" &&
        value === "PERMANENT"
      ) {
        next.endDate = "";
      }

      return next;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");

    if (action === "RENEW") {
      if (
        requiresRenewalEndDate &&
        !formData.endDate
      ) {
        setError(
          "An end date is required for fixed-term and internship contracts.",
        );

        return;
      }

      if (
        formData.endDate &&
        formData.endDate <
          formData.startDate
      ) {
        setError(
          "End date cannot be earlier than the start date.",
        );

        return;
      }
    }

    if (
      action === "TERMINATE" &&
      !formData.terminationDate
    ) {
      setError(
        "Termination date is required.",
      );

      return;
    }

    if (
      ["TERMINATE", "CANCEL"].includes(
        action,
      ) &&
      formData.reason.trim().length < 5
    ) {
      setError(
        "Provide a reason containing at least 5 characters.",
      );

      return;
    }

    setIsSubmitting(true);

    try {
      let result;

      if (action === "RENEW") {
        result = await renewContract(
          contract.id,
          {
            contractType:
              formData.contractType,

            startDate:
              formData.startDate,

            endDate:
              requiresRenewalEndDate
                ? formData.endDate
                : null,
          },
        );
      }

      if (action === "TERMINATE") {
        result = await terminateContract(
          contract.id,
          {
            terminationDate:
              formData.terminationDate,

            terminationReason:
              formData.reason.trim(),
          },
        );
      }

      if (action === "CANCEL") {
        result = await cancelContract(
          contract.id,
          {
            cancellationReason:
              formData.reason.trim(),
          },
        );
      }

      await onSuccess(result);
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          requestError.message ||
          "Unable to complete contract action",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="contract-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget &&
          !isSubmitting
        ) {
          onClose();
        }
      }}
    >
      <section
        className="contract-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contract-action-title"
      >
        <header className="contract-modal-header">
          <div className="contract-modal-heading">
            <div
              className={`contract-modal-icon ${
                action !== "RENEW"
                  ? "contract-modal-icon-danger"
                  : ""
              }`}
            >
              {action === "RENEW" ? (
                <RefreshCw size={21} />
              ) : (
                <Ban size={21} />
              )}
            </div>

            <div>
              <h2 id="contract-action-title">
                {titles[action]}
              </h2>

              <p>
                Contract #{contract.id}
                {" · "}
                {contract.contractType
                  .replaceAll("_", " ")
                  .toLowerCase()}
              </p>
            </div>
          </div>

          <button
            type="button"
            className="contract-modal-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close contract action"
          >
            <X size={20} />
          </button>
        </header>

        <form
          className="contract-form"
          onSubmit={handleSubmit}
        >
          {error && (
            <div
              className="contract-form-error"
              role="alert"
            >
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {action === "RENEW" && (
            <div className="contract-form-grid">
              <label className="form-control contract-form-full">
                <span>
                  New contract type
                  <strong>*</strong>
                </span>

                <select
                  name="contractType"
                  value={
                    formData.contractType
                  }
                  onChange={handleChange}
                  disabled={isSubmitting}
                >
                  <option value="PERMANENT">
                    Permanent
                  </option>

                  <option value="FIXED_TERM">
                    Fixed-term
                  </option>

                  <option value="INTERNSHIP">
                    Internship
                  </option>
                </select>
              </label>

              <label className="form-control">
                <span>Start date</span>

                <input
                  name="startDate"
                  type="date"
                  value={formData.startDate}
                  disabled
                />

                <small>
                  Renewal starts immediately
                  after the current contract.
                </small>
              </label>

              <label className="form-control">
                <span>
                  End date
                  {requiresRenewalEndDate && (
                    <strong>*</strong>
                  )}
                </span>

                <input
                  name="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={handleChange}
                  min={
                    formData.startDate ||
                    undefined
                  }
                  required={
                    requiresRenewalEndDate
                  }
                  disabled={
                    isSubmitting ||
                    !requiresRenewalEndDate
                  }
                />

                {!requiresRenewalEndDate && (
                  <small>
                    Permanent contracts are
                    open-ended.
                  </small>
                )}
              </label>
            </div>
          )}

          {action === "TERMINATE" && (
            <div className="contract-form-grid">
              <label className="form-control contract-form-full">
                <span>
                  Termination date
                  <strong>*</strong>
                </span>

                <input
                  name="terminationDate"
                  type="date"
                  value={
                    formData.terminationDate
                  }
                  onChange={handleChange}
                  min={contract.startDate}
                  max={kigaliToday()}
                  required
                  disabled={isSubmitting}
                />
              </label>

              <label className="form-control contract-form-full">
                <span>
                  Termination reason
                  <strong>*</strong>
                </span>

                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  rows={4}
                  minLength={5}
                  required
                  disabled={isSubmitting}
                  placeholder="Provide the approved reason for terminating this contract"
                />
              </label>
            </div>
          )}

          {action === "CANCEL" && (
            <div className="contract-form-grid">
              <div className="contract-action-warning contract-form-full">
                <AlertCircle size={19} />

                <p>
                  This will cancel the upcoming
                  contract. The record will remain
                  in contract history.
                </p>
              </div>

              <label className="form-control contract-form-full">
                <span>
                  Cancellation reason
                  <strong>*</strong>
                </span>

                <textarea
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  rows={4}
                  minLength={5}
                  required
                  disabled={isSubmitting}
                  placeholder="Explain why this upcoming contract is being cancelled"
                />
              </label>
            </div>
          )}

          <footer className="contract-modal-actions">
            <button
              type="button"
              className="contract-secondary-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Close
            </button>

            <button
              type="submit"
              className={
                action === "RENEW"
                  ? "contract-primary-button"
                  : "contract-danger-button"
              }
              disabled={isSubmitting}
            >
              {action === "RENEW" ? (
                <Save size={17} />
              ) : (
                <Ban size={17} />
              )}

              {isSubmitting
                ? "Processing..."
                : titles[action]}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default ContractActionModal;