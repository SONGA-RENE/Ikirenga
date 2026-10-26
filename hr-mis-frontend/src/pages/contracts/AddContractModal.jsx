import {
  AlertCircle,
  FilePlus2,
  Save,
  X,
} from "lucide-react";

import { useState } from "react";

import {
  createContract,
} from "../../api/contractApi.js";

const initialFormData = {
  contractType: "FIXED_TERM",
  startDate: "",
  endDate: "",
};

function AddContractModal({
  employeeId,
  onClose,
  onSuccess,
}) {
  const [formData, setFormData] =
    useState(initialFormData);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  const requiresEndDate =
    formData.contractType !== "PERMANENT";

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

    if (!formData.startDate) {
      setError(
        "Contract start date is required.",
      );

      return;
    }

    if (
      requiresEndDate &&
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

    setIsSubmitting(true);

    try {
      const result =
        await createContract({
          employeeId:
            Number(employeeId),

          contractType:
            formData.contractType,

          startDate:
            formData.startDate,

          endDate:
            requiresEndDate
              ? formData.endDate
              : null,
        });

      await onSuccess(result);
    } catch (requestError) {
      const conflict =
        requestError.response?.data
          ?.conflict;

      let message =
        requestError.response?.data
          ?.message ||
        requestError.message ||
        "Unable to create contract";

      if (conflict) {
        message +=
          ` Conflicting contract: ` +
          `${conflict.startDate} to ` +
          `${conflict.endDate || "open-ended"}.`;
      }

      setError(message);
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
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        className="contract-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-contract-title"
      >
        <header className="contract-modal-header">
          <div className="contract-modal-heading">
            <div className="contract-modal-icon">
              <FilePlus2 size={21} />
            </div>

            <div>
              <h2 id="add-contract-title">
                Add employment contract
              </h2>

              <p>
                Record a new contract for this
                employee.
              </p>
            </div>
          </div>

          <button
            type="button"
            className="contract-modal-close"
            onClick={onClose}
            aria-label="Close contract form"
            disabled={isSubmitting}
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

          <div className="contract-form-grid">
            <label className="form-control contract-form-full">
              <span>
                Contract type
                <strong>*</strong>
              </span>

              <select
                name="contractType"
                value={
                  formData.contractType
                }
                onChange={handleChange}
                disabled={isSubmitting}
                required
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
              <span>
                Start date
                <strong>*</strong>
              </span>

              <input
                name="startDate"
                type="date"
                value={formData.startDate}
                onChange={handleChange}
                disabled={isSubmitting}
                required
              />
            </label>

            <label className="form-control">
              <span>
                End date
                {requiresEndDate && (
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
                disabled={
                  isSubmitting ||
                  !requiresEndDate
                }
                required={requiresEndDate}
              />

              {!requiresEndDate && (
                <small>
                  Permanent contracts do not
                  require an end date.
                </small>
              )}
            </label>
          </div>

          <footer className="contract-modal-actions">
            <button
              type="button"
              className="contract-secondary-button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="contract-primary-button"
              disabled={isSubmitting}
            >
              <Save size={17} />

              {isSubmitting
                ? "Saving contract..."
                : "Save contract"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default AddContractModal;