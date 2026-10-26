import {
  AlertCircle,
  FileText,
  RefreshCw,
  Search,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  getContracts,
} from "../../api/contractApi.js";

function formatDate(value) {
  if (!value) {
    return "Open-ended";
  }

  const date = new Date(
    `${value}T00:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function formatLabel(value) {
  if (!value) {
    return "Unknown";
  }

  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase(),
    );
}

function ContractListPage() {
  const [contracts, setContracts] =
    useState([]);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("ALL");

  const [typeFilter, setTypeFilter] =
    useState("ALL");

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadContracts(signal) {
    setIsLoading(true);
    setError("");

    try {
      const result = await getContracts({
        signal,
      });

      setContracts(result.contracts);
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
          "Unable to retrieve contracts",
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

    loadContracts(controller.signal);

    return () => {
      controller.abort();
    };
  }, []);

  const summary = useMemo(() => {
    return contracts.reduce(
      (result, contract) => {
        result.total += 1;

        if (
          contract.status === "ACTIVE"
        ) {
          result.active += 1;
        }

        if (
          contract.status === "UPCOMING"
        ) {
          result.upcoming += 1;
        }

        if (
          ["EXPIRED", "TERMINATED"].includes(
            contract.status,
          )
        ) {
          result.closed += 1;
        }

        return result;
      },
      {
        total: 0,
        active: 0,
        upcoming: 0,
        closed: 0,
      },
    );
  }, [contracts]);

  const filteredContracts =
    useMemo(() => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();

      return contracts.filter(
        (contract) => {
          const matchesSearch =
            !normalizedSearch ||
            [
              contract.staffNumber,
              contract.firstName,
              contract.lastName,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(
                normalizedSearch,
              );

          const matchesStatus =
            statusFilter === "ALL" ||
            contract.status ===
              statusFilter;

          const matchesType =
            typeFilter === "ALL" ||
            contract.contractType ===
              typeFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesType
          );
        },
      );
    }, [
      contracts,
      searchTerm,
      statusFilter,
      typeFilter,
    ]);

  if (isLoading) {
    return (
      <div className="page-loading-state">
        <div className="loading-spinner" />
        <p>Loading contracts...</p>
      </div>
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">
            Contract management
          </p>

          <h1>Employment contracts</h1>

          <p>
            Monitor current, upcoming and
            historical employee contracts.
          </p>
        </div>

        <div className="page-header-icon">
          <FileText size={25} />
        </div>
      </header>

      {error && (
        <div className="contract-register-error">
          <AlertCircle size={20} />

          <div>
            <strong>
              Contracts could not be loaded
            </strong>
            <p>{error}</p>
          </div>

          <button
            type="button"
            onClick={() =>
              loadContracts()
            }
          >
            <RefreshCw size={16} />
            Retry
          </button>
        </div>
      )}

      {!error && (
        <>
          <section className="contract-register-summary">
            <article>
              <span>Total contracts</span>
              <strong>{summary.total}</strong>
            </article>

            <article className="summary-active">
              <span>Active</span>
              <strong>{summary.active}</strong>
            </article>

            <article className="summary-upcoming">
              <span>Upcoming</span>
              <strong>{summary.upcoming}</strong>
            </article>

            <article className="summary-closed">
              <span>Expired/terminated</span>
              <strong>{summary.closed}</strong>
            </article>
          </section>

          <section className="contract-register">
            <div className="contract-register-toolbar">
              <label className="contract-search">
                <Search size={18} />

                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(
                      event.target.value,
                    )
                  }
                  placeholder="Search employee or staff number"
                />
              </label>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value,
                  )
                }
                aria-label="Filter by status"
              >
                <option value="ALL">
                  All statuses
                </option>
                <option value="ACTIVE">
                  Active
                </option>
                <option value="UPCOMING">
                  Upcoming
                </option>
                <option value="EXPIRED">
                  Expired
                </option>
                <option value="TERMINATED">
                  Terminated
                </option>
                <option value="CANCELLED">
                  Cancelled
                </option>
              </select>

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(
                    event.target.value,
                  )
                }
                aria-label="Filter by type"
              >
                <option value="ALL">
                  All contract types
                </option>
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
            </div>

            <div className="contract-register-count">
              Showing{" "}
              <strong>
                {filteredContracts.length}
              </strong>{" "}
              of{" "}
              <strong>
                {contracts.length}
              </strong>{" "}
              contracts
            </div>

            <div className="contract-table-wrapper">
              <table className="contract-table contract-register-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Staff number</th>
                    <th>Type</th>
                    <th>Start date</th>
                    <th>End date</th>
                    <th>Status</th>
                    <th>Profile</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredContracts.map(
                    (contract) => (
                      <tr key={contract.id}>
                        <td>
                          <strong>
                            {contract.firstName}
                            {" "}
                            {contract.lastName}
                          </strong>
                        </td>

                        <td>
                          {contract.staffNumber}
                        </td>

                        <td>
                          {formatLabel(
                            contract.contractType,
                          )}
                        </td>

                        <td>
                          {formatDate(
                            contract.startDate,
                          )}
                        </td>

                        <td>
                          {formatDate(
                            contract.endDate,
                          )}
                        </td>

                        <td>
                          <span
                            className={`contract-status contract-status-${contract.status
                              .toLowerCase()
                              .replaceAll("_", "-")}`}
                          >
                            {formatLabel(
                              contract.status,
                            )}
                          </span>
                        </td>

                        <td>
                          <Link
                            to={`/employees/${contract.employeeId}`}
                            className="contract-profile-link"
                          >
                            View employee
                          </Link>
                        </td>
                      </tr>
                    ),
                  )}

                  {filteredContracts.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="contract-register-empty"
                      >
                        No contracts match the
                        selected filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

export default ContractListPage;