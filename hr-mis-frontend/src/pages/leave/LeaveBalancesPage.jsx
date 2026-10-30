import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  RefreshCw,
  Scale,
  WalletCards,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { getMyLeaveBalances } from "../../api/leaveApi.js";

import { formatLeaveDate } from "./leaveUtils.js";

import "./leave.css";

function LeaveBalancesPage() {
  const [year, setYear] = useState(new Date().getFullYear());

  const [balanceData, setBalanceData] = useState(null);

  const [isLoading, setIsLoading] = useState(true);

  const [error, setError] = useState("");

  const loadBalances = useCallback(
    async (signal) => {
      setIsLoading(true);
      setError("");

      try {
        const result = await getMyLeaveBalances(year, { signal });

        setBalanceData(result.data || null);
      } catch (requestError) {
        if (
          requestError.name === "CanceledError" ||
          requestError.code === "ERR_CANCELED"
        ) {
          return;
        }

        setError(
          requestError.response?.data?.message ||
            "Unable to load leave balances",
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

    loadBalances(controller.signal);

    return () => controller.abort();
  }, [loadBalances]);

  const balances = balanceData?.balances || [];

  return (
    <div className="leave-page">
      <div className="details-page-navigation">
        <Link to="/leave" className="back-link">
          <ArrowLeft size={18} />
          Leave management
        </Link>
      </div>

      <header className="leave-list-header">
        <div>
          <p className="eyebrow">Leave entitlement</p>

          <h1>My leave balances</h1>

          <p>
            Review available, reserved and consumed leave days by entitlement
            year.
          </p>
        </div>

        <label className="leave-year-selector">
          <span>Balance year</span>

          <select
            value={year}
            onChange={(event) => setYear(Number(event.target.value))}
          >
            {Array.from(
              { length: 5 },
              (_, index) => new Date().getFullYear() - 2 + index,
            ).map((optionYear) => (
              <option key={optionYear} value={optionYear}>
                {optionYear}
              </option>
            ))}
          </select>
        </label>
      </header>

      {error && (
        <div className="leave-error-state">
          <AlertCircle size={26} />

          <h2>Leave balances could not be loaded</h2>

          <p>{error}</p>

          <button
            type="button"
            className="retry-button"
            onClick={() => loadBalances()}
          >
            <RefreshCw size={17} />
            Try again
          </button>
        </div>
      )}

      {!error && isLoading && (
        <div className="page-loading-state">
          <div className="loading-spinner" />

          <p>Loading leave balances...</p>
        </div>
      )}

      {!error && !isLoading && balances.length === 0 && (
        <div className="leave-empty-state">
          <Scale size={30} />

          <h2>No leave balances found</h2>

          <p>There are no active leave types for the selected year.</p>
        </div>
      )}

      {!error && !isLoading && balances.length > 0 && (
        <section className="leave-balance-grid">
          {balances.map((balance) => (
            <article
              className={`leave-balance-card ${
                !balance.isEligible ? "leave-balance-ineligible" : ""
              }`}
              key={balance.leaveTypeId}
            >
              <div className="leave-balance-header">
                <div className="leave-balance-icon">
                  {balance.usesBalance ? (
                    <WalletCards size={22} />
                  ) : (
                    <CalendarClock size={22} />
                  )}
                </div>

                <div>
                  <span>{balance.code}</span>

                  <h2>{balance.name}</h2>
                </div>

                {balance.isEligible ? (
                  <CheckCircle2 size={20} className="leave-eligible-icon" />
                ) : (
                  <span className="leave-ineligible-label">Not eligible</span>
                )}
              </div>

              {balance.usesBalance ? (
                <>
                  <div className="leave-balance-totals">
                    <div>
                      <span>Available</span>

                      <strong>{balance.totalAvailableDays}</strong>
                    </div>

                    <div>
                      <span>Reserved</span>

                      <strong>{balance.totalReservedDays}</strong>
                    </div>

                    <div>
                      <span>Consumed</span>

                      <strong>{balance.totalConsumedDays}</strong>
                    </div>

                    <div>
                      <span>Remaining</span>

                      <strong>{balance.totalRemainingDays}</strong>
                    </div>
                  </div>

                  <div className="leave-bucket-list">
                    {balance.buckets.length === 0 ? (
                      <p className="leave-no-buckets">
                        No entitlement bucket has been granted.
                      </p>
                    ) : (
                      balance.buckets.map((bucket) => (
                        <div
                          className="leave-bucket-item"
                          key={bucket.entitlementId}
                        >
                          <div>
                            <strong>{bucket.leaveYear}</strong>

                            <span>{bucket.source}</span>
                          </div>

                          <dl>
                            <div>
                              <dt>Available</dt>
                              <dd>{bucket.availableDays}</dd>
                            </div>

                            <div>
                              <dt>Available from</dt>
                              <dd>{formatLeaveDate(bucket.availableFrom)}</dd>
                            </div>

                            <div>
                              <dt>Expires</dt>
                              <dd>{formatLeaveDate(bucket.expiresOn)}</dd>
                            </div>
                          </dl>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="leave-policy-summary">
                  <p>This leave type does not use an annual balance.</p>

                  {balance.durationValue && (
                    <strong>
                      {balance.durationValue}{" "}
                      {balance.durationUnit === "CALENDAR_MONTHS"
                        ? "calendar month(s)"
                        : balance.durationUnit === "WORKING_DAYS"
                          ? "working day(s)"
                          : "requested period"}
                    </strong>
                  )}

                  {balance.requiresAttachment && (
                    <span>Supporting documentation required</span>
                  )}
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

export default LeaveBalancesPage;
