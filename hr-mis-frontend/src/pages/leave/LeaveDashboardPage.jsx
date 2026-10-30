import {
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  History,
  RotateCcw,
  Scale,
  UsersRound,
  CalendarRange,
  Settings2,
  Database,
} from "lucide-react";

import { Link } from "react-router-dom";
import "./leave.css";

import { useAuth } from "../../auth/AuthContext.jsx";

function LeaveDashboardPage() {
  const { user } = useAuth();

  const hasEmployeeRecord = Boolean(user?.employeeId);

  const canApprove = [
    "HR",
    "DIRECTOR",
    "DEPUTY_CEO",
    "CEO",
    "CHAIRMAN",
  ].includes(user?.role);

  const canDecideCancellations = ["HR", "CEO", "CHAIRMAN"].includes(user?.role);

  const canVerifyReturns = ["ADMIN", "HR"].includes(user?.role);

  const canManageAllRequests = ["ADMIN", "HR"].includes(user?.role);

  const canManageLeavePolicies = ["ADMIN", "HR"].includes(user?.role);

  const canManageLeaveConfiguration = ["ADMIN", "HR"].includes(user?.role);
  return (
    <div className="leave-page">
      <header className="leave-page-header">
        <div>
          <p className="eyebrow">Employee self-service</p>

          <h1>Leave management</h1>

          <p>
            Request leave, review balances, track approvals and manage return
            workflows.
          </p>
        </div>

        {hasEmployeeRecord && (
          <Link to="/leave/request" className="page-primary-action">
            <CalendarPlus size={18} />
            Request leave
          </Link>
        )}
      </header>

      <section className="leave-navigation-grid">
        {hasEmployeeRecord && (
          <>
            <Link to="/leave/request" className="leave-navigation-card">
              <span className="leave-navigation-icon">
                <CalendarPlus size={23} />
              </span>

              <div>
                <h2>Request leave</h2>

                <p>
                  Submit a new leave request through the appropriate approval
                  workflow.
                </p>
              </div>
            </Link>

            <Link to="/leave/my-requests" className="leave-navigation-card">
              <span className="leave-navigation-icon">
                <History size={23} />
              </span>

              <div>
                <h2>My leave requests</h2>

                <p>
                  Review pending, approved, rejected and cancelled requests.
                </p>
              </div>
            </Link>

            <Link to="/leave/balances" className="leave-navigation-card">
              <span className="leave-navigation-icon">
                <Scale size={23} />
              </span>

              <div>
                <h2>Leave balances</h2>

                <p>
                  View entitlements, reserved days, consumed days and available
                  balances.
                </p>
              </div>
            </Link>
          </>
        )}

        {canApprove && (
          <Link to="/leave/approvals" className="leave-navigation-card">
            <span className="leave-navigation-icon">
              <ClipboardCheck size={23} />
            </span>

            <div>
              <h2>Approval inbox</h2>

              <p>
                Review leave requests assigned specifically to your account.
              </p>
            </div>
          </Link>
        )}

        {canDecideCancellations && (
          <Link to="/leave/cancellations" className="leave-navigation-card">
            <span className="leave-navigation-icon">
              <RotateCcw size={23} />
            </span>

            <div>
              <h2>Cancellation inbox</h2>

              <p>Decide pending cancellation requests assigned to you.</p>
            </div>
          </Link>
        )}

        {canVerifyReturns && (
          <Link
            to="/leave/currently-on-leave"
            className="leave-navigation-card"
          >
            <span className="leave-navigation-icon">
              <UsersRound size={23} />
            </span>

            <div>
              <h2>Employees on leave</h2>

              <p>
                View employees currently away and their expected return dates.
              </p>
            </div>
          </Link>
        )}

        {!hasEmployeeRecord &&
          !canApprove &&
          !canDecideCancellations &&
          !canVerifyReturns && (
            <div className="leave-empty-access">
              <CalendarDays size={28} />

              <h2>No leave functions assigned</h2>

              <p>
                Your user account is not linked to an employee or leave approval
                responsibility.
              </p>
            </div>
          )}

        {canManageAllRequests && (
          <Link to="/leave/all-requests" className="leave-navigation-card">
            <span className="leave-navigation-icon">
              <CalendarRange size={23} />
            </span>

            <div>
              <h2>All leave requests</h2>

              <p>
                Search and review leave requests submitted across the
                organization.
              </p>
            </div>
          </Link>
        )}

        {canManageLeavePolicies && (
          <Link to="/leave/types" className="leave-navigation-card">
            <span className="leave-navigation-icon">
              <Settings2 size={23} />
            </span>

            <div>
              <h2>Leave types</h2>

              <p>
                Configure entitlement, duration, eligibility and attachment
                rules.
              </p>
            </div>
          </Link>
        )}

        {canManageLeavePolicies && (
          <Link to="/leave/entitlements" className="leave-navigation-card">
            <span className="leave-navigation-icon">
              <Database size={23} />
            </span>

            <div>
              <h2>Leave entitlements</h2>

              <p>
                Generate annual balances, grant manual entitlements and review
                employee leave buckets.
              </p>
            </div>
          </Link>
        )}

        {canManageLeaveConfiguration && (
          <Link to="/leave/public-holidays" className="leave-navigation-card">
            <span className="leave-navigation-icon">
              <CalendarRange size={23} />
            </span>

            <div>
              <h2>Public holidays</h2>

              <p>
                Import Rwanda&apos;s annual calendar and maintain specially
                announced holidays.
              </p>
            </div>
          </Link>
        )}
      </section>
    </div>
  );
}

export default LeaveDashboardPage;
