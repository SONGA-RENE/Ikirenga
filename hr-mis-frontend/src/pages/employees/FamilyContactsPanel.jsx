import {
  AlertCircle,
  Edit3,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  archiveEmployeeFamilyContact,
  createEmployeeFamilyContact,
  getEmployeeFamilyContacts,
  updateEmployeeFamilyContact,
} from "../../api/employeeApi.js";

import { useAuth } from
  "../../auth/AuthContext.jsx";

const emptyForm = {
  contactType: "NEXT_OF_KIN",
  fullName: "",
  relationship: "",
  phoneNumber: "",
  alternativePhone: "",
  email: "",
  address: "",
  isPrimary: false,
};

const contactTypes = [
  {
    value: "PARENT",
    label: "Parent",
  },
  {
    value: "GUARDIAN",
    label: "Guardian",
  },
  {
    value: "SPOUSE",
    label: "Spouse",
  },
  {
    value: "NEXT_OF_KIN",
    label: "Next of kin",
  },
  {
    value: "EMERGENCY_CONTACT",
    label: "Emergency contact",
  },
  {
    value: "OTHER",
    label: "Other",
  },
];

function readableContactType(value) {
  if (!value) {
    return "Contact";
  }

  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase(),
    );
}

function FamilyContactsPanel({
  employeeId,
}) {
  const { user } = useAuth();

  const [employee, setEmployee] =
    useState(null);

  const [contacts, setContacts] =
    useState([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [successMessage, setSuccessMessage] =
    useState("");

  const [editingContact, setEditingContact] =
    useState(null);

  const [showForm, setShowForm] =
    useState(false);

  const canManageContacts = [
    "ADMIN",
    "HR",
  ].includes(user?.role);

  async function loadContacts(signal) {
    setIsLoading(true);
    setError("");

    try {
      const result =
        await getEmployeeFamilyContacts(
          employeeId,
          { signal },
        );

      setEmployee({
        id: result.id,
        staffNumber: result.staffNumber,
        fullName: result.fullName,
      });

      setContacts(
        Array.isArray(result.contacts)
          ? result.contacts
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
          "Unable to retrieve family contacts",
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

    loadContacts(controller.signal);

    return () => {
      controller.abort();
    };
  }, [employeeId]);

  function openCreateForm() {
    setEditingContact(null);
    setError("");
    setSuccessMessage("");
    setShowForm(true);
  }

  function openEditForm(contact) {
    setEditingContact(contact);
    setError("");
    setSuccessMessage("");
    setShowForm(true);
  }

  function closeForm() {
    setEditingContact(null);
    setShowForm(false);
  }

  async function handleArchive(contact) {
    const confirmed = window.confirm(
      `Archive ${contact.fullName} from this employee's contacts?`,
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccessMessage("");

    try {
      const result =
        await archiveEmployeeFamilyContact(
          employeeId,
          contact.id,
        );

      setContacts((current) =>
        current.filter(
          (item) =>
            item.id !== contact.id,
        ),
      );

      setSuccessMessage(
        result.message ||
          "Family contact archived successfully",
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to archive family contact",
      );
    }
  }

  function handleSavedContact(
    savedContact,
    message,
  ) {
    setContacts((current) => {
      const contactExists =
        current.some(
          (contact) =>
            contact.id === savedContact.id,
        );

      let updatedContacts =
        contactExists
          ? current.map((contact) =>
              contact.id ===
              savedContact.id
                ? savedContact
                : contact,
            )
          : [
              savedContact,
              ...current,
            ];

      if (savedContact.isPrimary) {
        updatedContacts =
          updatedContacts.map(
            (contact) => ({
              ...contact,

              isPrimary:
                contact.id ===
                savedContact.id,
            }),
          );
      }

      return updatedContacts;
    });

    setSuccessMessage(message);
    closeForm();
  }

  return (
    <>
      <section className="family-contacts-panel">
        <header className="family-panel-header">
          <div className="family-panel-heading">
            <div className="family-panel-icon">
              <UsersRound size={21} />
            </div>

            <div>
              <h2>
                Family and emergency contacts
              </h2>

              <p>
                Next of kin, parents,
                guardians and emergency
                contacts.
              </p>
            </div>
          </div>

          {canManageContacts && (
            <button
              type="button"
              className="family-add-button"
              onClick={openCreateForm}
            >
              <Plus size={17} />
              Add contact
            </button>
          )}
        </header>

        {error && (
          <div
            className="alert alert-error family-panel-message"
            role="alert"
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div
            className="alert alert-success family-panel-message"
            role="status"
          >
            <ShieldCheck size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {isLoading ? (
          <div className="family-panel-loading">
            <div className="loading-spinner" />

            <p>
              Loading family contacts...
            </p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="family-empty-state">
            <UsersRound size={28} />

            <h3>No contacts recorded</h3>

            <p>
              Add the employee’s next of kin
              or emergency contact.
            </p>

            {canManageContacts && (
              <button
                type="button"
                onClick={openCreateForm}
              >
                <Plus size={16} />
                Add first contact
              </button>
            )}
          </div>
        ) : (
          <div className="family-contact-grid">
            {contacts.map((contact) => (
              <article
                className={`family-contact-card ${
                  contact.isPrimary
                    ? "family-contact-primary"
                    : ""
                }`}
                key={contact.id}
              >
                <div className="family-card-top">
                  <div className="family-contact-avatar">
                    {contact.fullName
                      .split(" ")
                      .filter(Boolean)
                      .map((name) => name[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </div>

                  <div className="family-contact-title">
                    <div>
                      <h3>
                        {contact.fullName}
                      </h3>

                      <span>
                        {readableContactType(
                          contact.contactType,
                        )}
                      </span>
                    </div>

                    {contact.isPrimary && (
                      <span className="primary-contact-badge">
                        <Star size={12} />
                        Primary
                      </span>
                    )}
                  </div>
                </div>

                <dl className="family-contact-details">
                  <div>
                    <dt>Relationship</dt>
                    <dd>
                      {contact.relationship ||
                        "Not provided"}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      <Phone size={14} />
                      Telephone
                    </dt>

                    <dd>
                      {contact.phoneNumber ? (
                        <a
                          href={`tel:${contact.phoneNumber}`}
                        >
                          {
                            contact.phoneNumber
                          }
                        </a>
                      ) : (
                        "Not provided"
                      )}
                    </dd>
                  </div>

                  {contact.alternativePhone && (
                    <div>
                      <dt>
                        Alternative telephone
                      </dt>

                      <dd>
                        <a
                          href={`tel:${contact.alternativePhone}`}
                        >
                          {
                            contact.alternativePhone
                          }
                        </a>
                      </dd>
                    </div>
                  )}

                  <div>
                    <dt>
                      <Mail size={14} />
                      Email
                    </dt>

                    <dd>
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                        >
                          {contact.email}
                        </a>
                      ) : (
                        "Not provided"
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      <MapPin size={14} />
                      Address
                    </dt>

                    <dd>
                      {contact.address ||
                        "Not provided"}
                    </dd>
                  </div>
                </dl>

                {canManageContacts && (
                  <div className="family-card-actions">
                    <button
                      type="button"
                      className="family-edit-button"
                      onClick={() =>
                        openEditForm(contact)
                      }
                    >
                      <Edit3 size={15} />
                      Edit
                    </button>

                    <button
                      type="button"
                      className="family-archive-button"
                      onClick={() =>
                        handleArchive(contact)
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
        <FamilyContactDialog
          employeeId={employeeId}
          employee={employee}
          contact={editingContact}
          onClose={closeForm}
          onSaved={handleSavedContact}
        />
      )}
    </>
  );
}

function FamilyContactDialog({
  employeeId,
  employee,
  contact,
  onClose,
  onSaved,
}) {
  const [formData, setFormData] =
    useState(() => ({
      ...emptyForm,

      ...(contact
        ? {
            contactType:
              contact.contactType,

            fullName:
              contact.fullName || "",

            relationship:
              contact.relationship || "",

            phoneNumber:
              contact.phoneNumber || "",

            alternativePhone:
              contact.alternativePhone ||
              "",

            email:
              contact.email || "",

            address:
              contact.address || "",

            isPrimary:
              Boolean(contact.isPrimary),
          }
        : {}),
    }));

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  const isEditing = Boolean(contact);

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

    const submittedData = {
      contactType:
        formData.contactType,

      fullName:
        formData.fullName.trim(),

      relationship:
        formData.relationship.trim(),

      phoneNumber:
        formData.phoneNumber.trim(),

      alternativePhone:
        formData.alternativePhone
          .trim() || null,

      email:
        formData.email
          .trim()
          .toLowerCase() || null,

      address:
        formData.address.trim() || null,

      isPrimary:
        formData.isPrimary,
    };

    if (
      !submittedData.contactType ||
      !submittedData.fullName
    ) {
      setError(
        "Contact type and full name are required.",
      );

      return;
    }

    if (
      [
        "NEXT_OF_KIN",
        "EMERGENCY_CONTACT",
      ].includes(
        submittedData.contactType,
      ) &&
      !submittedData.phoneNumber
    ) {
      setError(
        "A telephone number is required for a next of kin or emergency contact.",
      );

      return;
    }

    setIsSubmitting(true);

    try {
      const result = isEditing
        ? await updateEmployeeFamilyContact(
            employeeId,
            contact.id,
            submittedData,
          )
        : await createEmployeeFamilyContact(
            employeeId,
            submittedData,
          );

      onSaved(
        result.contact,
        result.message ||
          (isEditing
            ? "Family contact updated successfully"
            : "Family contact created successfully"),
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Unable to save family contact",
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
        className="family-contact-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="family-dialog-title"
      >
        <header className="family-dialog-header">
          <div>
            <p className="eyebrow">
              {isEditing
                ? "UPDATE CONTACT"
                : "NEW CONTACT"}
            </p>

            <h2 id="family-dialog-title">
              {isEditing
                ? "Edit family contact"
                : "Add family contact"}
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
          className="family-contact-form"
          onSubmit={handleSubmit}
        >
          {error && (
            <div
              className="alert alert-error family-dialog-message"
              role="alert"
            >
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          <div className="family-form-grid">
            <label className="form-control">
              <span>
                Contact type
                <strong>*</strong>
              </span>

              <select
                name="contactType"
                value={formData.contactType}
                onChange={handleChange}
                required
              >
                {contactTypes.map(
                  (type) => (
                    <option
                      key={type.value}
                      value={type.value}
                    >
                      {type.label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="form-control">
              <span>
                Full name
                <strong>*</strong>
              </span>

              <input
                name="fullName"
                type="text"
                value={formData.fullName}
                onChange={handleChange}
                placeholder="Contact's full name"
                required
              />
            </label>

            <label className="form-control">
              <span>Relationship</span>

              <input
                name="relationship"
                type="text"
                value={
                  formData.relationship
                }
                onChange={handleChange}
                placeholder="Father, sister, spouse..."
              />
            </label>

            <label className="form-control">
              <span>Telephone</span>

              <input
                name="phoneNumber"
                type="tel"
                value={
                  formData.phoneNumber
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
                name="alternativePhone"
                type="tel"
                value={
                  formData.alternativePhone
                }
                onChange={handleChange}
                placeholder="+250 7..."
              />
            </label>

            <label className="form-control">
              <span>Email</span>

              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="contact@example.com"
              />
            </label>

            <label className="form-control form-control-full">
              <span>Address</span>

              <input
                name="address"
                type="text"
                value={formData.address}
                onChange={handleChange}
                placeholder="Current address"
              />
            </label>
          </div>

          <label className="primary-contact-option">
            <input
              name="isPrimary"
              type="checkbox"
              checked={formData.isPrimary}
              onChange={handleChange}
            />

            <span>
              <Star size={17} />

              <span>
                <strong>
                  Primary contact
                </strong>

                <small>
                  Mark this as the employee’s
                  main family or emergency
                  contact.
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
              <UserRound size={17} />

              {isSubmitting
                ? "Saving..."
                : isEditing
                  ? "Save changes"
                  : "Add contact"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default FamilyContactsPanel;