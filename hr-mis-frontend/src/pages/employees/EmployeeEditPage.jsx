import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Save,
  UserRound,
  X,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  getEmployeeById,
  updateEmployee,
  uploadEmployeePhoto,
} from "../../api/employeeApi.js";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL;

function EmployeeEditPage() {
  const { employeeId } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] =
    useState(null);

  const [formData, setFormData] =
    useState({
      staffNumber: "",
      firstName: "",
      lastName: "",
      email: "",
    });

  const [photoFile, setPhotoFile] =
    useState(null);

  const [photoPreview, setPhotoPreview] =
    useState("");

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadEmployee() {
      try {
        const result =
          await getEmployeeById(
            employeeId,
            {
              signal:
                controller.signal,
            },
          );

        setEmployee(result);

        setFormData({
          staffNumber:
            result.staffNumber || "",

          firstName:
            result.firstName || "",

          lastName:
            result.lastName || "",

          email:
            result.email || "",
        });

        if (result.photoFilename) {
          setPhotoPreview(
            `${apiBaseUrl}/uploads/employees/${encodeURIComponent(
              result.photoFilename,
            )}`,
          );
        }
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
          requestError.response?.data
            ?.message ||
            requestError.message ||
            "Unable to retrieve employee",
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setIsLoading(false);
        }
      }
    }

    loadEmployee();

    return () => {
      controller.abort();
    };
  }, [employeeId]);

  useEffect(() => {
    if (!photoFile) {
      return undefined;
    }

    const previewUrl =
      URL.createObjectURL(photoFile);

    setPhotoPreview(previewUrl);

    return () => {
      URL.revokeObjectURL(
        previewUrl,
      );
    };
  }, [photoFile]);

  function handleChange(event) {
    const { name, value } =
      event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handlePhotoChange(event) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Employee photo must be a JPG, JPEG or PNG image.",
      );

      event.target.value = "";
      return;
    }

    setError("");
    setPhotoFile(file);
  }

  function removeSelectedPhoto() {
    setPhotoFile(null);

    if (employee?.photoFilename) {
      setPhotoPreview(
        `${apiBaseUrl}/uploads/employees/${encodeURIComponent(
          employee.photoFilename,
        )}`,
      );
    } else {
      setPhotoPreview("");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setIsSubmitting(true);

    const submittedData = {
      staffNumber:
        formData.staffNumber
          .trim()
          .toUpperCase(),

      firstName:
        formData.firstName.trim(),

      lastName:
        formData.lastName.trim(),

      email:
        formData.email
          .trim()
          .toLowerCase(),
    };

    if (
      !submittedData.staffNumber ||
      !submittedData.firstName ||
      !submittedData.lastName ||
      !submittedData.email
    ) {
      setError(
        "Complete all required employee information.",
      );

      setIsSubmitting(false);
      return;
    }

    let detailsSaved = false;

    try {
      await updateEmployee(
        employeeId,
        submittedData,
      );

      detailsSaved = true;

      if (photoFile) {
        await uploadEmployeePhoto(
          employeeId,
          photoFile,
        );
      }

      navigate(
        `/employees/${employeeId}`,
        {
          replace: true,
          state: {
            message:
              "Employee updated successfully",
          },
        },
      );
    } catch (requestError) {
      const requestMessage =
        requestError.response?.data
          ?.message ||
        requestError.message ||
        "Unable to update employee";

      setError(
        detailsSaved && photoFile
          ? `Employee information was saved, but the photo upload failed: ${requestMessage}`
          : requestMessage,
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="page-loading-state">
        <div className="loading-spinner" />

        <p>Loading employee...</p>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="details-error-state">
        <AlertCircle size={28} />

        <h1>
          Employee could not be loaded
        </h1>

        <p>{error}</p>

        <Link
          to="/employees"
          className="secondary-action"
        >
          <ArrowLeft size={17} />
          Employees
        </Link>
      </div>
    );
  }

  const initials = [
    formData.firstName,
    formData.lastName,
  ]
    .filter(Boolean)
    .map((name) => name[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <div className="details-page-navigation">
        <Link
          to={`/employees/${employeeId}`}
          className="back-link"
        >
          <ArrowLeft size={18} />
          Back to employee
        </Link>
      </div>

      <header className="page-header">
        <div>
          <p className="eyebrow">
            EMPLOYEE MANAGEMENT
          </p>

          <h1>Edit employee</h1>

          <p>
            Update the employee’s official
            record and profile photo.
          </p>
        </div>

        <div className="page-header-icon">
          <UserRound size={25} />
        </div>
      </header>

      <form
        className="employee-edit-form"
        onSubmit={handleSubmit}
      >
        {error && (
          <div
            className="alert alert-error employee-form-alert"
            role="alert"
          >
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <section className="employee-photo-section">
          <div className="employee-photo-editor">
            <div className="employee-edit-photo">
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Employee preview"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>

            <div className="employee-photo-controls">
              <h2>Employee photo</h2>

              <p>
                Upload a clear JPG or PNG
                portrait.
              </p>

              <div>
                <label className="photo-upload-button">
                  <Camera size={17} />
                  Choose photo

                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                    onChange={
                      handlePhotoChange
                    }
                  />
                </label>

                {photoFile && (
                  <button
                    type="button"
                    className="photo-remove-button"
                    onClick={
                      removeSelectedPhoto
                    }
                  >
                    <X size={16} />
                    Remove selection
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="form-section">
          <div className="form-section-header">
            <h2>
              Official employee information
            </h2>

            <p>
              Position changes are managed
              separately through appointment
              management.
            </p>
          </div>

          <div className="form-grid">
            <label className="form-control">
              <span>
                Staff number
                <strong>*</strong>
              </span>

              <input
                type="text"
                name="staffNumber"
                value={
                  formData.staffNumber
                }
                onChange={handleChange}
                required
              />
            </label>

            <label className="form-control">
              <span>
                Official email
                <strong>*</strong>
              </span>

              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </label>

            <label className="form-control">
              <span>
                First name
                <strong>*</strong>
              </span>

              <input
                type="text"
                name="firstName"
                value={
                  formData.firstName
                }
                onChange={handleChange}
                required
              />
            </label>

            <label className="form-control">
              <span>
                Last name
                <strong>*</strong>
              </span>

              <input
                type="text"
                name="lastName"
                value={
                  formData.lastName
                }
                onChange={handleChange}
                required
              />
            </label>

            <label className="form-control form-control-full">
              <span>Current position</span>

              <input
                type="text"
                value={
                  employee.position ||
                  "Not assigned"
                }
                disabled
                readOnly
              />

              <small>
                Use Manage appointment on
                the employee details page
                to transfer this employee.
              </small>
            </label>
          </div>
        </section>

        <div className="employee-form-actions">
          <Link
            to={`/employees/${employeeId}`}
            className="form-cancel-button"
          >
            Cancel
          </Link>

          <button
            type="submit"
            className="form-submit-button"
            disabled={isSubmitting}
          >
            <Save size={18} />

            {isSubmitting
              ? "Saving employee..."
              : "Save changes"}
          </button>
        </div>
      </form>
    </>
  );
}

export default EmployeeEditPage;