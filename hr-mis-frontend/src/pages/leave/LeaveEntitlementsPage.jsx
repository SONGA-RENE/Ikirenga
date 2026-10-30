import {
  AlertCircle,
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronDown,
  CircleCheck,
  CircleMinus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, Navigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext.jsx";

import {
  generateAnnualLeaveEntitlements,
  getEmployeeLeaveBalances,
  getEntitlementEmployees,
  getLeaveTypes,
  grantEmployeeLeaveEntitlement,
} from "../../api/leaveApi.js";

import {
  formatLeaveDate,
  formatLeaveStatus,
  getTodayISODate,
} from "./leaveUtils.js";

import "./leave.css";

const currentYear = new Date().getFullYear();

const initialGrantForm = {
  employeeId: "",
  leaveTypeId: "",
  leaveYear: String(currentYear),
  entitledDays: "18",
  availableFrom: `${currentYear}-01-01`,
  grantNote: "",
};

function LeaveEntitlementsPage() {
  const { user } = useAuth();

  const mayManage = ["ADMIN", "HR"].includes(user?.role);

  const [employees, setEmployees] = useState([]);

  const [leaveTypes, setLeaveTypes] = useState([]);

  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const [selectedYear, setSelectedYear] = useState(currentYear);

  const [searchTerm, setSearchTerm] = useState("");

  const [balanceData, setBalanceData] = useState(null);

  const [isLoading, setIsLoading] = useState(true);

  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  const [error, setError] = useState("");

  const [balanceError, setBalanceError] = useState("");

  const [isGrantModalOpen, setIsGrantModalOpen] = useState(false);

  const [grantForm, setGrantForm] = useState(initialGrantForm);

  const [grantError, setGrantError] = useState("");

  const [isGranting, setIsGranting] = useState(false);

  const [isGenerationModalOpen, setIsGenerationModalOpen] = useState(false);

  const [asOfDate, setAsOfDate] = useState(getTodayISODate());

  const [isGenerating, setIsGenerating] = useState(false);

  const [generationError, setGenerationError] = useState("");

  const [generationResult, setGenerationResult] = useState(null);

  const loadAdministrationData = useCallback(async (signal) => {
    setIsLoading(true);
    setError("");

    try {
      const [employeeResult, leaveTypeResult] = await Promise.all([
        getEntitlementEmployees({
          signal,
        }),

        getLeaveTypes({
          signal,
        }),
      ]);

      const activeEmployees = (
        Array.isArray(employeeResult.data) ? employeeResult.data : []
      ).filter(
        (employee) =>
          employee.isActive &&
          ["ACTIVE", "ON_NOTICE"].includes(employee.employmentStatus),
      );

      const annualTypes = (
        Array.isArray(leaveTypeResult.data) ? leaveTypeResult.data : []
      ).filter(
        (leaveType) =>
          leaveType.isActive && leaveType.entitlementMode === "ANNUAL_BUCKET",
      );

      setEmployees(activeEmployees);
      setLeaveTypes(annualTypes);

      setSelectedEmployeeId(
        (current) => current || String(activeEmployees[0]?.id || ""),
      );
    } catch (requestError) {
      if (
        requestError.code === "ERR_CANCELED" ||
        requestError.name === "CanceledError"
      ) {
        return;
      }

      setError(
        requestError.response?.data?.message ||
          "Unable to load entitlement administration data",
      );
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  const loadBalances = useCallback(
    async (signal) => {
      if (!selectedEmployeeId) {
        setBalanceData(null);
        return;
      }

      setIsBalanceLoading(true);
      setBalanceError("");

      try {
        const result = await getEmployeeLeaveBalances(
          selectedEmployeeId,
          selectedYear,
          { signal },
        );

        setBalanceData(result.data || null);
      } catch (requestError) {
        if (
          requestError.code === "ERR_CANCELED" ||
          requestError.name === "CanceledError"
        ) {
          return;
        }

        setBalanceError(
          requestError.response?.data?.message ||
            "Unable to load employee balances",
        );
      } finally {
        if (!signal?.aborted) {
          setIsBalanceLoading(false);
        }
      }
    },
    [selectedEmployeeId, selectedYear],
  );

  useEffect(() => {
    const controller = new AbortController();

    loadAdministrationData(controller.signal);

    return () => controller.abort();
  }, [loadAdministrationData]);

  useEffect(() => {
    const controller = new AbortController();

    loadBalances(controller.signal);

    return () => controller.abort();
  }, [loadBalances]);

  const filteredEmployees = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    if (!search) {
      return employees;
    }

    return employees.filter((employee) => {
      const searchable = [
        employee.firstName,
        employee.lastName,
        employee.staffNumber,
        employee.position,
        employee.department,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(search);
    });
  }, [employees, searchTerm]);

  const selectedEmployee = employees.find(
    (employee) => String(employee.id) === String(selectedEmployeeId),
  );

  function openGrantModal() {
    const annualType = leaveTypes[0];

    setGrantError("");

    setGrantForm({
      employeeId: selectedEmployeeId,
      leaveTypeId: String(annualType?.id || ""),
      leaveYear: String(selectedYear),
      entitledDays: String(annualType?.annualEntitlement || 18),
      availableFrom: `${selectedYear}-01-01`,
      grantNote: "",
    });

    setIsGrantModalOpen(true);
  }

  function updateGrantField(event) {
    const { name, value } = event.target;

    setGrantForm((current) => {
      const next = {
        ...current,
        [name]: value,
      };

      if (name === "leaveYear") {
        next.availableFrom = `${value}-01-01`;
      }

      if (name === "leaveTypeId") {
        const policy = leaveTypes.find(
          (leaveType) => String(leaveType.id) === value,
        );

        if (policy) {
          next.entitledDays = String(policy.annualEntitlement);
        }
      }

      return next;
    });
  }

  async function submitGrant(event) {
    event.preventDefault();
    setGrantError("");

    if (grantForm.grantNote.trim().length < 5) {
      setGrantError("Grant note must contain at least 5 characters");

      return;
    }

    setIsGranting(true);

    try {
      await grantEmployeeLeaveEntitlement({
        employeeId: Number(grantForm.employeeId),
        leaveTypeId: Number(grantForm.leaveTypeId),
        leaveYear: Number(grantForm.leaveYear),
        entitledDays: Number(grantForm.entitledDays),
        availableFrom: grantForm.availableFrom,
        grantNote: grantForm.grantNote.trim(),
      });

      setIsGrantModalOpen(false);

      setSelectedEmployeeId(grantForm.employeeId);

      setSelectedYear(Number(grantForm.leaveYear));

      await loadBalances();
    } catch (requestError) {
      setGrantError(
        requestError.response?.data?.message || "Unable to grant entitlement",
      );
    } finally {
      setIsGranting(false);
    }
  }

  async function runGeneration() {
    setGenerationError("");
    setIsGenerating(true);

    try {
      const result = await generateAnnualLeaveEntitlements(asOfDate);

      setGenerationResult(result.data);

      await loadBalances();
    } catch (requestError) {
      setGenerationError(
        requestError.response?.data?.message ||
          "Unable to generate annual entitlements",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  if (!mayManage) {
    return <Navigate to="/leave" replace />;
  }

  return (
    <div className="leave-page">
      <div className="details-page-navigation">
        <Link to="/leave" className="back-link">
          <ArrowLeft size={18} />
          Leave dashboard
        </Link>
      </div>

      <header className="leave-list-header">
        <div>
          <p className="eyebrow">Balance administration</p>

          <h1>Leave entitlements</h1>

          <p>
            Review employee balances, grant manual entitlements and run annual
            generation.
          </p>
        </div>

        <div className="entitlement-header-actions">
          <button
            type="button"
            className="secondary-action-button"
            onClick={() => {
              setGenerationResult(null);
              setGenerationError("");
              setIsGenerationModalOpen(true);
            }}
          >
            <Sparkles size={18} />
            Generate annual
          </button>

          <button
            type="button"
            className="page-primary-action"
            disabled={!selectedEmployeeId || leaveTypes.length === 0}
            onClick={openGrantModal}
          >
            <UserPlus size={18} />
            Manual grant
          </button>
        </div>
      </header>

      {error && (
        <div className="leave-error-state">
          <AlertCircle size={27} />
          <h2>Data could not be loaded</h2>
          <p>{error}</p>

          <button
            type="button"
            className="retry-button"
            onClick={() => loadAdministrationData()}
          >
            <RefreshCw size={17} />
            Try again
          </button>
        </div>
      )}

      {!error && isLoading && (
        <div className="page-loading-state">
          <div className="loading-spinner" />
          <p>Loading entitlement records...</p>
        </div>
      )}

      {!error && !isLoading && (
        <div className="entitlement-layout">
          <aside className="entitlement-employee-panel">
            <div className="entitlement-search">
              <Search size={18} />

              <input
                type="search"
                placeholder="Search employees"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <div className="entitlement-employee-list">
              {filteredEmployees.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  className={
                    String(employee.id) === String(selectedEmployeeId)
                      ? "entitlement-employee active"
                      : "entitlement-employee"
                  }
                  onClick={() => setSelectedEmployeeId(String(employee.id))}
                >
                  <strong>
                    {employee.firstName} {employee.lastName}
                  </strong>

                  <span>{employee.staffNumber}</span>

                  <small>{employee.position}</small>
                </button>
              ))}
            </div>
          </aside>

          <main className="entitlement-balance-panel">
            <header className="entitlement-balance-header">
              <div>
                <span>Selected employee</span>

                <h2>
                  {selectedEmployee
                    ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}`
                    : "No employee selected"}
                </h2>

                {selectedEmployee && (
                  <p>
                    {selectedEmployee.staffNumber} ·{" "}
                    {selectedEmployee.department}
                  </p>
                )}
              </div>

              <label>
                <span>Balance year</span>

                <div>
                  <select
                    value={selectedYear}
                    onChange={(event) =>
                      setSelectedYear(Number(event.target.value))
                    }
                  >
                    {[
                      currentYear - 1,
                      currentYear,
                      currentYear + 1,
                      currentYear + 2,
                    ].map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>

                  <ChevronDown size={17} />
                </div>
              </label>
            </header>

            {balanceError && (
              <div className="leave-inline-error">
                <AlertCircle size={19} />
                <span>{balanceError}</span>
              </div>
            )}

            {isBalanceLoading && (
              <div className="page-loading-state">
                <div className="loading-spinner" />
                <p>Loading balances...</p>
              </div>
            )}

            {!balanceError && !isBalanceLoading && balanceData && (
              <section className="entitlement-balance-list">
                {balanceData.balances
                  .filter((balance) => balance.usesBalance)
                  .map((balance) => (
                    <article
                      className="entitlement-balance-card"
                      key={balance.leaveTypeId}
                    >
                      <header>
                        <div>
                          <span>{balance.code}</span>

                          <h3>{balance.name}</h3>
                        </div>

                        <strong>{balance.totalAvailableDays} available</strong>
                      </header>

                      <div className="entitlement-totals">
                        <div>
                          <span>Entitled</span>
                          <strong>{balance.totalEntitledDays}</strong>
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

                      <div className="entitlement-buckets">
                        {balance.buckets.length === 0 ? (
                          <p>No entitlement bucket exists for this year.</p>
                        ) : (
                          balance.buckets.map((bucket) => (
                            <div key={bucket.entitlementId}>
                              <strong>{bucket.leaveYear}</strong>

                              <span>{bucket.availableDays} available</span>

                              <span>
                                Available{" "}
                                {formatLeaveDate(bucket.availableFrom)}
                              </span>

                              <span>
                                Expires {formatLeaveDate(bucket.expiresOn)}
                              </span>

                              <small>{formatLeaveStatus(bucket.source)}</small>
                            </div>
                          ))
                        )}
                      </div>
                    </article>
                  ))}
              </section>
            )}
          </main>
        </div>
      )}

      {isGrantModalOpen && (
        <div className="leave-modal-backdrop">
          <section className="leave-modal entitlement-modal">
            <header className="leave-modal-header">
              <div>
                <p className="eyebrow">Manual adjustment</p>
                <h2>Grant leave entitlement</h2>
                <p>This action directly changes an employee’s leave balance.</p>
              </div>

              <button
                type="button"
                className="leave-modal-close"
                disabled={isGranting}
                onClick={() => setIsGrantModalOpen(false)}
              >
                <X size={20} />
              </button>
            </header>

            <form className="entitlement-grant-form" onSubmit={submitGrant}>
              {grantError && (
                <div className="leave-form-error">
                  <AlertCircle size={19} />
                  <span>{grantError}</span>
                </div>
              )}

              <label>
                <span>Employee</span>
                <select
                  name="employeeId"
                  value={grantForm.employeeId}
                  onChange={updateGrantField}
                  required
                >
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.staffNumber} — {employee.firstName}{" "}
                      {employee.lastName}
                    </option>
                  ))}
                </select>
              </label>

              <div className="entitlement-form-grid">
                <label>
                  <span>Leave type</span>
                  <select
                    name="leaveTypeId"
                    value={grantForm.leaveTypeId}
                    onChange={updateGrantField}
                    required
                  >
                    {leaveTypes.map((leaveType) => (
                      <option key={leaveType.id} value={leaveType.id}>
                        {leaveType.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Leave year</span>
                  <input
                    type="number"
                    name="leaveYear"
                    min="2000"
                    max="2100"
                    value={grantForm.leaveYear}
                    onChange={updateGrantField}
                    required
                  />
                </label>

                <label>
                  <span>Entitled days</span>
                  <input
                    type="number"
                    name="entitledDays"
                    min="1"
                    value={grantForm.entitledDays}
                    onChange={updateGrantField}
                    required
                  />
                </label>

                <label>
                  <span>Available from</span>
                  <input
                    type="date"
                    name="availableFrom"
                    value={grantForm.availableFrom}
                    onChange={updateGrantField}
                    required
                  />
                </label>
              </div>

              <label>
                <span>Grant note</span>
                <textarea
                  name="grantNote"
                  value={grantForm.grantNote}
                  onChange={updateGrantField}
                  rows="4"
                  placeholder="Explain why this manual entitlement is being granted"
                  required
                />
              </label>

              <footer className="leave-modal-actions">
                <button
                  type="button"
                  className="secondary-action-button"
                  disabled={isGranting}
                  onClick={() => setIsGrantModalOpen(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="page-primary-action"
                  disabled={isGranting}
                >
                  <Check size={18} />

                  {isGranting ? "Granting..." : "Grant entitlement"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {isGenerationModalOpen && (
        <div className="leave-modal-backdrop">
          <section className="leave-modal entitlement-generation-modal">
            <header className="leave-modal-header">
              <div>
                <p className="eyebrow">Organization-wide operation</p>
                <h2>Generate annual entitlements</h2>
                <p>
                  Eligible employees will receive missing annual entitlement
                  buckets.
                </p>
              </div>

              <button
                type="button"
                className="leave-modal-close"
                disabled={isGenerating}
                onClick={() => setIsGenerationModalOpen(false)}
              >
                <X size={20} />
              </button>
            </header>

            <div className="entitlement-generation-content">
              <label>
                <span>Generate as of</span>

                <input
                  type="date"
                  value={asOfDate}
                  max={getTodayISODate()}
                  onChange={(event) => setAsOfDate(event.target.value)}
                />
              </label>

              {generationError && (
                <div className="leave-form-error">
                  <AlertCircle size={19} />
                  <span>{generationError}</span>
                </div>
              )}

              {!generationResult && (
                <div className="entitlement-generation-warning">
                  <ShieldAlert size={22} />

                  <p>
                    Generation is idempotent: existing employee, leave-type and
                    year combinations will be skipped.
                  </p>
                </div>
              )}

              {generationResult && (
                <div className="generation-results">
                  <div className="generation-result-summary">
                    <article>
                      <CircleCheck size={21} />
                      <strong>{generationResult.generatedCount}</strong>
                      <span>Generated</span>
                    </article>

                    <article>
                      <CircleMinus size={21} />
                      <strong>{generationResult.skippedCount}</strong>
                      <span>Skipped</span>
                    </article>

                    <article>
                      <ShieldAlert size={21} />
                      <strong>{generationResult.ineligibleCount}</strong>
                      <span>Ineligible</span>
                    </article>
                  </div>

                  {generationResult.ineligible?.length > 0 && (
                    <div className="generation-exception-list">
                      <h3>Records requiring attention</h3>

                      {generationResult.ineligible.map((record, index) => (
                        <div
                          key={`${record.employeeId}-${record.entitlementYear || index}`}
                        >
                          <strong>
                            {record.employeeName || record.staffNumber}
                          </strong>

                          <span>{formatLeaveStatus(record.reason)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <footer className="leave-modal-actions">
              <button
                type="button"
                className="secondary-action-button"
                disabled={isGenerating}
                onClick={() => setIsGenerationModalOpen(false)}
              >
                Close
              </button>

              <button
                type="button"
                className="page-primary-action"
                disabled={isGenerating || !asOfDate}
                onClick={runGeneration}
              >
                <Sparkles size={18} />

                {isGenerating
                  ? "Generating..."
                  : generationResult
                    ? "Run again"
                    : "Generate entitlements"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

export default LeaveEntitlementsPage;
