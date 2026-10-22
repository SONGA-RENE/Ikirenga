import {
  BriefcaseBusiness,
  CalendarDays,
  CreditCard,
  FileText,
  Users,
} from "lucide-react";

import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.jsx";

const modules = [
  {
    title: "Employees",
    description:
      "Manage employee records and organizational information.",
    icon: Users,
    path: "/employees",
    enabled: true,
  },
  {
    title: "Contracts",
    description:
      "Monitor employment contracts and expiry dates.",
    icon: FileText,
    enabled: false,
  },
  {
    title: "Leave",
    description:
      "Manage leave requests, balances and approvals.",
    icon: CalendarDays,
    enabled: false,
  },
  {
    title: "Missions",
    description:
      "Manage missions, approvals, reports and reconciliation.",
    icon: BriefcaseBusiness,
    enabled: false,
  },
  {
    title: "Staff Cards",
    description:
      "Issue, verify, revoke and replace staff cards.",
    icon: CreditCard,
    enabled: false,
  },
];

function DashboardPage() {
  const { user } = useAuth();

  const userInitials = user.fullName
    .split(" ")
    .filter(Boolean)
    .map((name) => name[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">
            Ikirenga overview
          </p>

          <h1>
            Welcome, {user.fullName}
          </h1>

          <p>
            Manage PSF human resources
            operations from one place.
          </p>
        </div>

        <div className="user-summary">
          <div className="user-avatar">
            {userInitials}
          </div>

          <div>
            <strong>{user.fullName}</strong>
            <span>{user.role}</span>
          </div>
        </div>
      </header>

      <section
        className="module-grid"
        aria-label="HR modules"
      >
        {modules.map((module) => {
          const Icon = module.icon;

          return (
            <article
              className="module-card"
              key={module.title}
            >
              <div className="module-icon">
                <Icon size={24} />
              </div>

              <h2>{module.title}</h2>

              <p>{module.description}</p>

              {module.enabled ? (
                <Link
                  to={module.path}
                  className="module-card-link"
                >
                  Open module
                </Link>
              ) : (
                <span className="module-unavailable">
                  Coming soon
                </span>
              )}
            </article>
          );
        })}
      </section>
    </>
  );
}

export default DashboardPage;