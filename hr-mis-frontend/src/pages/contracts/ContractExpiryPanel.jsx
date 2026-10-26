import {
  AlertCircle,
  CalendarClock,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import { Link } from "react-router-dom";

import {
  getExpiringContracts,
} from "../../api/contractApi.js";

function formatDate(value) {
  if (!value) {
    return "Not available";
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

function ContractExpiryPanel() {
  const [selectedDays, setSelectedDays] =
    useState(90);

  const [result, setResult] =
    useState({
      contracts: [],
      count: 0,
      summary: {
        critical: 0,
        warning: 0,
        notice: 0,
      },
    });

  const [isLoading, setIsLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  async function loadContracts(signal) {
    setIsLoading(true);
    setError("");

    try {
      const response =
        await getExpiringContracts(
          selectedDays,
          { signal },
        );

      setResult(response);
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
          "Unable to retrieve contract alerts",
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
  }, [selectedDays]);

  return (
    <section className="contract-expiry-panel">
      <div className="contract-expiry-header">
        <div className="contract-expiry-heading">
          <div className="contract-expiry-icon">
            <CalendarClock size={22} />
          </div>

          <div>
            <h2>Contract expiry alerts</h2>

            <p>
              Active contracts approaching
              their end dates.
            </p>
          </div>
        </div>

        <label className="expiry-period-filter">
          <span>Period</span>

          <select
            value={selectedDays}
            onChange={(event) =>
              setSelectedDays(
                Number(event.target.value),
              )
            }
          >
            <option value={30}>
              Next 30 days
            </option>

            <option value={60}>
              Next 60 days
            </option>

            <option value={90}>
              Next 90 days
            </option>

            <option value={180}>
              Next 180 days
            </option>
          </select>
        </label>
      </div>

      {error ? (
        <div className="contract-alert-error">
          <AlertCircle size={20} />

          <div>
            <strong>
              Alerts could not be loaded
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
      ) : isLoading ? (
        <div className="contract-alert-loading">
          <div className="loading-spinner" />

          <p>
            Loading contract alerts...
          </p>
        </div>
      ) : (
        <>
          <div className="contract-alert-summary">
            <article className="alert-summary-card alert-critical">
              <strong>
                {result.summary.critical}
              </strong>

              <span>
                Expiring within 30 days
              </span>
            </article>

            <article className="alert-summary-card alert-warning">
              <strong>
                {result.summary.warning}
              </strong>

              <span>
                Expiring in 31–60 days
              </span>
            </article>

            <article className="alert-summary-card alert-notice">
              <strong>
                {result.summary.notice}
              </strong>

              <span>
                Expiring after 60 days
              </span>
            </article>
          </div>

          {result.contracts.length === 0 ? (
            <div className="contract-alert-empty">
              <CalendarClock size={27} />

              <div>
                <strong>
                  No contracts are approaching
                  expiry
                </strong>

                <p>
                  No active contracts end within
                  the selected period.
                </p>
              </div>
            </div>
          ) : (
            <div className="contract-alert-list">
              {result.contracts.map(
                (contract) => (
                  <Link
                    key={contract.id}
                    to={`/employees/${contract.employeeId}`}
                    className="contract-alert-item"
                  >
                    <span
                      className={`contract-alert-indicator severity-${contract.severity.toLowerCase()}`}
                    />

                    <div className="contract-alert-employee">
                      <strong>
                        {contract.employeeName}
                      </strong>

                      <span>
                        {contract.staffNumber}
                        {" · "}
                        {contract.position ||
                          "Position not assigned"}
                      </span>
                    </div>

                    <div className="contract-alert-detail">
                      <span>
                        {formatContractType(
                          contract.contractType,
                        )}
                      </span>

                      <strong>
                        Ends{" "}
                        {formatDate(
                          contract.endDate,
                        )}
                      </strong>
                    </div>

                    <span
                      className={`expiry-days-badge severity-${contract.severity.toLowerCase()}`}
                    >
                      {contract.daysRemaining}
                      {" "}
                      {contract.daysRemaining === 1
                        ? "day"
                        : "days"}
                    </span>

                    <ChevronRight size={19} />
                  </Link>
                ),
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default ContractExpiryPanel;