import {
  AlertCircle,
  ArrowLeft,
  Save,
  UserPlus,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useNavigate,
} from "react-router-dom";

import {
  createEmployee,
} from "../../api/employeeApi.js";

import {
  getAvailablePositions,
} from "../../api/positionApi.js";

const initialFormData = {
  staffNumber: "",
  firstName: "",
  lastName: "",
  email: "",
  positionId: "",
};

function EmployeeCreatePage() {
  const navigate = useNavigate();

  const [formData, setFormData] =
    useState(initialFormData);

  const [positions, setPositions] =
    useState([]);

  const [isLoadingPositions, setIsLoadingPositions] =
    useState(true);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadPositions() {
      try {
        const result =
          await getAvailablePositions({
            signal: controller.signal,
          });

        setPositions(
          result.filter(
            (position) =>
              position.isActive,
          ),
        );
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
            "Unable to retrieve positions",
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
  }, []);

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
    }));
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

      positionId:
        Number(formData.positionId),
    };

    if (
      !submittedData.staffNumber ||
      !submittedData.firstName ||
      !submittedData.lastName ||
      !submittedData.email ||
      !Number.isInteger(
        submittedData.positionId,
      ) ||
      submittedData.positionId <= 0
    ) {
      setError(
        "Complete all required employee information.",
      );

      setIsSubmitting(false);
      return;
    }

    try {
      const employee =
        await createEmployee(
          submittedData,
        );

      navigate(
        `/employees/${employee.id}`,
        {
          replace: true,
        },
      );
    } catch (requestError) {
      setError(
        requestError.response?.data
          ?.message ||
          requestError.message ||
          "Unable to create employee",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="details-page-navigation">
        <Link
          to="/employees"
          className="back-link"
        >
          <ArrowLeft size={18} />
          Back to employees
        </Link>
      </div>

      <header className="page-header">
        <div>
          <p className="eyebrow">
            Employee management
          </p>

          <h1>Add employee</h1>

          <p>
            Create a new PSF employee
            record and assign their
            organizational position.
          </p>
        </div>

        <div className="page-header-icon">
          <UserPlus size={25} />
        </div>
      </header>

      <form
        className="employee-form"
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

        <section className="form-section">
          <div className="form-section-header">
            <h2>Employee information</h2>

            <p>
              Enter the employee’s identity
              and contact information.
            </p>
          </div>

          <div className="form-grid">
            <label className="form-control">
              <span>
                Staff number
                <strong>*</strong>
              </span>

              <input
                name="staffNumber"
                type="text"
                value={formData.staffNumber}
                onChange={handleChange}
                placeholder="PSF-030"
                autoComplete="off"
                required
              />
            </label>

            <label className="form-control">
              <span>
                Email address
                <strong>*</strong>
              </span>

              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="employee@psf.org.rw"
                autoComplete="email"
                required
              />
            </label>

            <label className="form-control">
              <span>
                First name
                <strong>*</strong>
              </span>

              <input
                name="firstName"
                type="text"
                value={formData.firstName}
                onChange={handleChange}
                placeholder="First name"
                autoComplete="given-name"
                required
              />
            </label>

            <label className="form-control">
              <span>
                Last name
                <strong>*</strong>
              </span>

              <input
                name="lastName"
                type="text"
                value={formData.lastName}
                onChange={handleChange}
                placeholder="Last name"
                autoComplete="family-name"
                required
              />
            </label>

            <label className="form-control form-control-full">
              <span>
                Position
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
                    ? "Loading positions..."
                    : "Select employee position"}
                </option>

                {!isLoadingPositions &&
                  positions.length === 0 && (
                    <option value="" disabled>
                      No vacant positions available
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
                            {position.positionCode
                              ? ` (${position.positionCode})`
                              : ""}
                          </option>
                        ),
                      )}
                    </optgroup>
                  ),
                )}
              </select>

              <small>
                Only active and currently vacant
                positions are displayed. The
                organizational unit is assigned
                automatically.
              </small>
            </label>
          </div>
        </section>

        <div className="employee-form-actions">
          <Link
            to="/employees"
            className="form-cancel-button"
          >
            Cancel
          </Link>

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
              ? "Creating employee..."
              : "Create employee"}
          </button>
        </div>
      </form>
    </>
  );
}

export default EmployeeCreatePage;