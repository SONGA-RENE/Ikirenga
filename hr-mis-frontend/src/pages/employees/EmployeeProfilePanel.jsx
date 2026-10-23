import {
  AlertCircle,
  CalendarDays,
  Eye,
  EyeOff,
  IdCard,
  MapPin,
  Pencil,
  Phone,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  getEmployeeProfile,
  revealEmployeeIdentifier,
  updateEmployeeProfile,
} from "../../api/employeeApi.js";

import { useAuth } from
  "../../auth/AuthContext.jsx";

const emptyProfile = {
  dateOfBirth: "",
  gender: "",
  nationality: "",
  maritalStatus: "",
  primaryPhone: "",
  alternativePhone: "",
  personalEmail: "",
  residentialAddress: "",
  district: "",
  sector: "",
  nationalId: "",
  passportNumber: "",
};

const genderOptions = [
  { value: "", label: "Select gender" },
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
  {
    value: "PREFER_NOT_TO_SAY",
    label: "Prefer not to say",
  },
];

const maritalStatusOptions = [
  {
    value: "",
    label: "Select marital status",
  },
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "DIVORCED", label: "Divorced" },
  { value: "WIDOWED", label: "Widowed" },
];

function readableValue(value) {
  if (!value) {
    return "Not provided";
  }

  return String(value)
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function formatDate(value) {
  if (!value) {
    return "Not provided";
  }

  const date = new Date(
    `${String(value).slice(0, 10)}T00:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "long",
      year: "numeric",
    },
  ).format(date);
}

function normalizeProfileForForm(profile) {
  return {
    dateOfBirth:
      profile?.dateOfBirth?.slice(0, 10) || "",

    gender: profile?.gender || "",

    nationality:
      profile?.nationality || "",

    maritalStatus:
      profile?.maritalStatus || "",

    primaryPhone:
      profile?.primaryPhone || "",

    alternativePhone:
      profile?.alternativePhone || "",

    personalEmail:
      profile?.personalEmail || "",

    residentialAddress:
      profile?.residentialAddress || "",

    district: profile?.district || "",
    sector: profile?.sector || "",

    // Sensitive identifiers are never prefilled.
    nationalId: "",
    passportNumber: "",
  };
}

function removeEmptySensitiveFields(data) {
  const submittedData = {
    ...data,
  };

  if (!submittedData.nationalId?.trim()) {
    delete submittedData.nationalId;
  }

  if (
    !submittedData.passportNumber?.trim()
  ) {
    delete submittedData.passportNumber;
  }

  return submittedData;
}

function EmployeeProfilePanel({
  employeeId,
}) {
  const { user } = useAuth();

  const [profile, setProfile] =
    useState(null);

  const [formData, setFormData] =
    useState(emptyProfile);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isEditing, setIsEditing] =
    useState(false);

  const [isSaving, setIsSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [revealType, setRevealType] =
    useState(null);

  const canManageProfile = [
    "ADMIN",
    "HR",
  ].includes(user?.role);

  async function loadProfile(signal) {
    setIsLoading(true);
    setError("");

    try {
      const result =
        await getEmployeeProfile(
          employeeId,
          { signal },
        );

      setProfile(result);
      setFormData(
        normalizeProfileForForm(result),
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
          "Unable to retrieve employee profile",
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

    loadProfile(controller.signal);

    return () => {
      controller.abort();
    };
  }, [employeeId]);

  function handleChange(event) {
    const { name, value } =
      event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function startEditing() {
    setFormData(
      normalizeProfileForForm(profile),
    );

    setError("");
    setSuccessMessage("");
    setIsEditing(true);
  }

  function cancelEditing() {
    setFormData(
      normalizeProfileForForm(profile),
    );

    setError("");
    setIsEditing(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setSuccessMessage("");
    setIsSaving(true);

    try {
      const submittedData =
        removeEmptySensitiveFields({
          ...formData,

          personalEmail:
            formData.personalEmail
              .trim()
              .toLowerCase(),

          nationality:
            formData.nationality.trim(),

          primaryPhone:
            formData.primaryPhone.trim(),

          alternativePhone:
            formData.alternativePhone.trim(),

          residentialAddress:
            formData.residentialAddress.trim(),

          district:
            formData.district.trim(),

          sector:
            formData.sector.trim(),

          nationalId:
            formData.nationalId.trim(),

          passportNumber:
            formData.passportNumber.trim(),
        });

      const result =
        await updateEmployeeProfile(
          employeeId,
          submittedData,
        );

      setProfile(result.profile);

      setFormData(
        normalizeProfileForForm(
          result.profile,
        ),
      );

      setSuccessMessage(
        result.message ||
          "Employee profile updated successfully",
      );

      setIsEditing(false);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to update employee profile",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section className="employee-profile-panel">
        <div className="profile-panel-loading">
          <div className="loading-spinner" />

          <p>Loading personal profile...</p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="employee-profile-panel">
        <header className="profile-panel-header">
          <div className="profile-panel-heading">
            <div className="profile-panel-icon">
              <UserRound size={21} />
            </div>

            <div>
              <h2>Employee profile</h2>

              <p>
                Personal, contact and
                identification information.
              </p>
            </div>
          </div>

          {canManageProfile &&
            !isEditing && (
              <button
                type="button"
                className="profile-edit-button"
                onClick={startEditing}
              >
                <Pencil size={17} />
                Edit profile
              </button>
            )}
        </header>

        {error && (
          <div
            className="alert alert-error profile-message"
            role="alert"
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div
            className="alert alert-success profile-message"
            role="status"
          >
            <ShieldCheck size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {isEditing ? (
          <form
            className="profile-edit-form"
            onSubmit={handleSubmit}
          >
            <div className="profile-form-grid">
              <label className="form-control">
                <span>Date of birth</span>

                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                />
              </label>

              <label className="form-control">
                <span>Gender</span>

                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                >
                  {genderOptions.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="form-control">
                <span>Nationality</span>

                <input
                  type="text"
                  name="nationality"
                  value={
                    formData.nationality
                  }
                  onChange={handleChange}
                  placeholder="Rwandan"
                />
              </label>

              <label className="form-control">
                <span>Marital status</span>

                <select
                  name="maritalStatus"
                  value={
                    formData.maritalStatus
                  }
                  onChange={handleChange}
                >
                  {maritalStatusOptions.map(
                    (option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="form-control">
                <span>Primary telephone</span>

                <input
                  type="tel"
                  name="primaryPhone"
                  value={
                    formData.primaryPhone
                  }
                  onChange={handleChange}
                  placeholder="+250 788 000 000"
                />
              </label>

              <label className="form-control">
                <span>
                  Alternative telephone
                </span>

                <input
                  type="tel"
                  name="alternativePhone"
                  value={
                    formData.alternativePhone
                  }
                  onChange={handleChange}
                  placeholder="+250 7..."
                />
              </label>

              <label className="form-control form-control-full">
                <span>Personal email</span>

                <input
                  type="email"
                  name="personalEmail"
                  value={
                    formData.personalEmail
                  }
                  onChange={handleChange}
                  placeholder="employee@example.com"
                />
              </label>

              <label className="form-control form-control-full">
                <span>
                  Residential address
                </span>

                <input
                  type="text"
                  name="residentialAddress"
                  value={
                    formData.residentialAddress
                  }
                  onChange={handleChange}
                  placeholder="Current residential address"
                />
              </label>

              <label className="form-control">
                <span>District</span>

                <input
                  type="text"
                  name="district"
                  value={formData.district}
                  onChange={handleChange}
                  placeholder="Gasabo"
                />
              </label>

              <label className="form-control">
                <span>Sector</span>

                <input
                  type="text"
                  name="sector"
                  value={formData.sector}
                  onChange={handleChange}
                  placeholder="Kacyiru"
                />
              </label>
            </div>

            <div className="sensitive-form-section">
              <div className="sensitive-form-heading">
                <ShieldCheck size={20} />

                <div>
                  <h3>
                    Sensitive identifiers
                  </h3>

                  <p>
                    Leave these fields blank
                    to keep the existing
                    values unchanged.
                  </p>
                </div>
              </div>

              <div className="profile-form-grid">
                <label className="form-control">
                  <span>National ID</span>

                  <input
                    type="text"
                    name="nationalId"
                    value={
                      formData.nationalId
                    }
                    onChange={handleChange}
                    placeholder={
                      profile?.nationalIdMasked ||
                      "Enter National ID"
                    }
                    autoComplete="off"
                  />
                </label>

                <label className="form-control">
                  <span>Passport number</span>

                  <input
                    type="text"
                    name="passportNumber"
                    value={
                      formData.passportNumber
                    }
                    onChange={handleChange}
                    placeholder={
                      profile?.passportMasked ||
                      "Enter passport number"
                    }
                    autoComplete="off"
                  />
                </label>
              </div>
            </div>

            <div className="profile-form-actions">
              <button
                type="button"
                className="form-cancel-button"
                onClick={cancelEditing}
                disabled={isSaving}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="form-submit-button"
                disabled={isSaving}
              >
                <Save size={17} />

                {isSaving
                  ? "Saving..."
                  : "Save profile"}
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-information-grid">
            <ProfileGroup
              icon={CalendarDays}
              title="Personal information"
            >
              <ProfileItem
                label="Date of birth"
                value={formatDate(
                  profile?.dateOfBirth,
                )}
              />

              <ProfileItem
                label="Gender"
                value={readableValue(
                  profile?.gender,
                )}
              />

              <ProfileItem
                label="Nationality"
                value={
                  profile?.nationality ||
                  "Not provided"
                }
              />

              <ProfileItem
                label="Marital status"
                value={readableValue(
                  profile?.maritalStatus,
                )}
              />
            </ProfileGroup>

            <ProfileGroup
              icon={Phone}
              title="Contact information"
            >
              <ProfileItem
                label="Primary telephone"
                value={
                  profile?.primaryPhone ||
                  "Not provided"
                }
              />

              <ProfileItem
                label="Alternative telephone"
                value={
                  profile?.alternativePhone ||
                  "Not provided"
                }
              />

              <ProfileItem
                label="Personal email"
                value={
                  profile?.personalEmail ||
                  "Not provided"
                }
              />
            </ProfileGroup>

            <ProfileGroup
              icon={MapPin}
              title="Residential information"
            >
              <ProfileItem
                label="Address"
                value={
                  profile?.residentialAddress ||
                  "Not provided"
                }
              />

              <ProfileItem
                label="District"
                value={
                  profile?.district ||
                  "Not provided"
                }
              />

              <ProfileItem
                label="Sector"
                value={
                  profile?.sector ||
                  "Not provided"
                }
              />
            </ProfileGroup>

            <ProfileGroup
              icon={IdCard}
              title="Identification"
            >
              <SensitiveIdentifier
                label="National ID"
                maskedValue={
                  profile?.nationalIdMasked
                }
                hasValue={
                  profile?.hasNationalId
                }
                canReveal={
                  canManageProfile
                }
                onReveal={() =>
                  setRevealType(
                    "NATIONAL_ID",
                  )
                }
              />

              <SensitiveIdentifier
                label="Passport number"
                maskedValue={
                  profile?.passportMasked
                }
                hasValue={
                  profile?.hasPassport
                }
                canReveal={
                  canManageProfile
                }
                onReveal={() =>
                  setRevealType(
                    "PASSPORT",
                  )
                }
              />
            </ProfileGroup>
          </div>
        )}
      </section>

      {revealType && (
        <RevealIdentifierDialog
          employeeId={employeeId}
          identifierType={revealType}
          onClose={() =>
            setRevealType(null)
          }
        />
      )}
    </>
  );
}

function ProfileGroup({
  icon: Icon,
  title,
  children,
}) {
  return (
    <article className="profile-information-group">
      <div className="profile-group-heading">
        <Icon size={18} />
        <h3>{title}</h3>
      </div>

      <dl className="profile-data-list">
        {children}
      </dl>
    </article>
  );
}

function ProfileItem({
  label,
  value,
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function SensitiveIdentifier({
  label,
  maskedValue,
  hasValue,
  canReveal,
  onReveal,
}) {
  return (
    <div className="sensitive-identifier-row">
      <div>
        <dt>{label}</dt>

        <dd>
          {hasValue
            ? maskedValue
            : "Not provided"}
        </dd>
      </div>

      {hasValue && canReveal && (
        <button
          type="button"
          className="reveal-identifier-button"
          onClick={onReveal}
        >
          <Eye size={15} />
          Reveal
        </button>
      )}
    </div>
  );
}

function RevealIdentifierDialog({
  employeeId,
  identifierType,
  onClose,
}) {
  const [password, setPassword] =
    useState("");

  const [reason, setReason] =
    useState("");

  const [revealedValue, setRevealedValue] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const identifierLabel =
    identifierType === "NATIONAL_ID"
      ? "National ID"
      : "passport number";

  function closeDialog() {
    setPassword("");
    setReason("");
    setRevealedValue("");
    setError("");
    onClose();
  }

  async function handleReveal(event) {
    event.preventDefault();

    setError("");
    setRevealedValue("");

    if (!password || !reason.trim()) {
      setError(
        "Your password and access reason are required.",
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const result =
        await revealEmployeeIdentifier(
          employeeId,
          {
            identifierType,
            password,
            reason: reason.trim(),
          },
        );

      setPassword("");
      setRevealedValue(
        result.value || "",
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to reveal identifier",
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
          closeDialog();
        }
      }}
    >
      <section
        className="identifier-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="identifier-dialog-title"
      >
        <header className="identifier-dialog-header">
          <div>
            <p className="eyebrow">
              RESTRICTED INFORMATION
            </p>

            <h2 id="identifier-dialog-title">
              Reveal {identifierLabel}
            </h2>
          </div>

          <button
            type="button"
            className="dialog-close-button"
            onClick={closeDialog}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </header>

        {revealedValue ? (
          <div className="revealed-identifier">
            <ShieldCheck size={24} />

            <p>{identifierLabel}</p>

            <strong>
              {revealedValue}
            </strong>

            <span>
              Close this window immediately
              after completing the authorized
              task.
            </span>

            <button
              type="button"
              className="form-submit-button"
              onClick={closeDialog}
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleReveal}>
            <p className="dialog-description">
              This access will be recorded in
              the security audit log.
            </p>

            {error && (
              <div
                className="alert alert-error profile-message"
                role="alert"
              >
                <AlertCircle size={17} />
                <span>{error}</span>
              </div>
            )}

            <label className="form-control">
              <span>
                Reason for access
                <strong>*</strong>
              </span>

              <textarea
                value={reason}
                onChange={(event) =>
                  setReason(
                    event.target.value,
                  )
                }
                placeholder="Explain the authorized purpose for viewing this information"
                rows={3}
                required
              />
            </label>

            <label className="form-control">
              <span>
                Confirm your password
                <strong>*</strong>
              </span>

              <div className="secure-password-input">
                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value,
                    )
                  }
                  autoComplete="current-password"
                  required
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (current) =>
                        !current,
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </div>
            </label>

            <div className="profile-form-actions">
              <button
                type="button"
                className="form-cancel-button"
                onClick={closeDialog}
                disabled={isSubmitting}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="form-submit-button"
                disabled={isSubmitting}
              >
                <ShieldCheck size={17} />

                {isSubmitting
                  ? "Verifying..."
                  : "Verify and reveal"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

export default EmployeeProfilePanel;