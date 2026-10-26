import {
  AlertCircle,
  CalendarDays,
  FileText,
  RefreshCw,
  Plus,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getEmployeeContracts,
} from "../../api/contractApi.js";

import AddContractModal from
  "./AddContractModal.jsx";

import ContractActionModal from
  "./ContractActionModal.jsx";

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

function formatContractType(value) {
  const labels = {
    PERMANENT: "Permanent",
    FIXED_TERM: "Fixed-term",
    INTERNSHIP: "Internship",
  };

  return labels[value] || value;
}

function formatStatus(value) {
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

function EmployeeContractSection({
  employeeId,
}) {
  const [contracts, setContracts] =
    useState([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [isAddingContract, setIsAddingContract] =
    useState(false);

  const [successMessage, setSuccessMessage] =
    useState("");

  const [
    selectedContractAction,
    setSelectedContractAction,
  ] = useState(null);

  async function loadContracts(signal) {
    setIsLoading(true);
    setError("");

    try {
      const result =
        await getEmployeeContracts(
          employeeId,
          { signal },
        );

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

  async function handleContractActionCompleted(
  result,
) {
  setSuccessMessage(result.message);

  setSelectedContractAction(null);

  await loadContracts();

  window.setTimeout(() => {
    setSuccessMessage("");
  }, 5000);
}

  useEffect(() => {
    const controller =
      new AbortController();

    loadContracts(controller.signal);

    return () => {
      controller.abort();
    };
  }, [employeeId]);

  const activeContract = useMemo(
    () =>
      contracts.find(
        (contract) =>
          contract.status === "ACTIVE",
      ) || null,
    [contracts],
  );

  async function handleContractCreated(
  result,
  ) {
    setSuccessMessage(result.message);

    setIsAddingContract(false);

    await loadContracts();

    window.setTimeout(() => {
      setSuccessMessage("");
    }, 5000);
  }

  if (isLoading) {
    return (
      <section className="employee-record-section">
        <div className="section-loading-state">
          <div className="loading-spinner" />

          <p>
            Loading employee contracts...
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
    <section className="employee-record-section">
      <div className="employee-record-section-header">
        <div className="employee-record-heading">
          <div className="employee-record-icon">
            <FileText size={21} />
          </div>

          <div>
            <h2>Employment contracts</h2>

            <p>
              Current contract and complete
              contract history.
            </p>
          </div>
        </div>

      <div className="contract-header-actions">
        <span className="record-count-badge">
          {contracts.length}
          {" "}
          {contracts.length === 1
            ? "contract"
            : "contracts"}
        </span>

        <button
          type="button"
          className="add-contract-button"
          onClick={() => {
            setSuccessMessage("");
            setIsAddingContract(true);
          }}
        >
          <Plus size={17} />
          Add contract
        </button>
      </div>
      {successMessage && (
        <div
          className="contract-success-message"
          role="status"
        >
          {successMessage}
        </div>
      )}
      </div>
      {error ? (
        <div className="section-error-state">
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
      ) : contracts.length === 0 ? (
        <div className="section-empty-state">
          <FileText size={26} />

          <div>
            <strong>
              No contract recorded
            </strong>

            <p>
              This employee does not yet have
              an employment contract in the
              system.
            </p>
          </div>
        </div>
      ) : (
        <>
          {!activeContract && (
            <div className="contract-warning">
              <AlertCircle size={19} />

              <div>
                <strong>
                  No active contract
                </strong>

                <p>
                  This employee has contract
                  history, but none of the
                  contracts is currently
                  active.
                </p>
              </div>
            </div>
          )}

          {activeContract && (
            <article className="current-contract-card">
              <div>
                <span className="contract-card-label">
                  Current contract
                </span>

                <h3>
                  {formatContractType(
                    activeContract.contractType,
                  )}
                </h3>
              </div>

              <div className="current-contract-dates">
                <span>
                  <CalendarDays size={16} />
                  {formatDate(
                    activeContract.startDate,
                  )}
                </span>

                <span aria-hidden="true">
                  →
                </span>

                <span>
                  {formatDate(
                    activeContract.endDate,
                  )}
                </span>
              </div>

              <span className="contract-status contract-status-active">
                Active
              </span>
            </article>
          )}

          <div className="contract-history">
            <div className="contract-history-header">
              <h3>Contract history</h3>
            </div>

            <div className="contract-table-wrapper">
              <table className="contract-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Start date</th>
                    <th>End date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {contracts.map(
                    (contract) => (
                      <tr key={contract.id}>
                        <td>
                          <strong>
                            {formatContractType(
                              contract.contractType,
                            )}
                          </strong>
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
                            {formatStatus(
                              contract.status,
                            )}
                          </span>
                        </td>
                        <td>
                          <div className="contract-row-actions">
                            {contract.status === "ACTIVE" && (
                              <>
                                <button
                                  type="button"
                                  className="contract-action-button"
                                  onClick={() =>
                                    setSelectedContractAction({
                                      action: "RENEW",
                                      contract,
                                    })
                                  }
                                >
                                  Renew
                                </button>

                                <button
                                  type="button"
                                  className="contract-action-button contract-action-danger"
                                  onClick={() =>
                                    setSelectedContractAction({
                                      action: "TERMINATE",
                                      contract,
                                    })
                                  }
                                >
                                  Terminate
                                </button>
                              </>
                            )}

                            {contract.status ===
                              "UPCOMING" && (
                              <button
                                type="button"
                                className="contract-action-button contract-action-danger"
                                onClick={() =>
                                  setSelectedContractAction({
                                    action: "CANCEL",
                                    contract,
                                  })
                                }
                              >
                                Cancel
                              </button>
                            )}

                            {!["ACTIVE", "UPCOMING"].includes(
                              contract.status,
                            ) && (
                              <span className="contract-no-actions">
                                —
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      
    </section>
    {isAddingContract && (
        <AddContractModal
          employeeId={employeeId}
          onClose={() =>
            setIsAddingContract(false)
          }
          onSuccess={
            handleContractCreated
          }
        />
      )}

      {selectedContractAction && (
        <ContractActionModal
          action={
            selectedContractAction.action
          }
          contract={
            selectedContractAction.contract
          }
          onClose={() =>
            setSelectedContractAction(null)
          }
          onSuccess={
            handleContractActionCompleted
          }
        />
      )}
      </>
  );
}

export default EmployeeContractSection;