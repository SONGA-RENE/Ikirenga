import {
  BriefcaseBusiness,
  CalendarDays,
  CreditCard,
  FileText,
  LogOut,
  Users,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext.jsx";

const modules = [
  {
    title: "Employees",
    description:
      "Manage employee records and organizational information.",
    icon: Users,
  },
  {
    title: "Contracts",
    description:
      "Monitor employment contracts and expiry dates.",
    icon: FileText,
  },
  {
    title: "Leave",
    description:
      "Manage leave requests, balances and approvals.",
    icon: CalendarDays,
  },
  {
    title: "Missions",
    description:
      "Manage missions, approvals, reports and reconciliation.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Staff Cards",
    description:
      "Issue, verify, revoke and replace staff cards.",
    icon: CreditCard,
  },
];

function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div>
          <div className="sidebar-brand">
            <div className="brand-mark small">
              IK
            </div>

            <div>
              <strong>Ikirenga</strong>
              <span>HR MIS</span>
            </div>
          </div>

          <nav className="sidebar-navigation">
            <a
              className="navigation-link active"
              href="/dashboard"
            >
              Dashboard
            </a>

            {modules.map((module) => (
              <button
                key={module.title}
                className="navigation-link"
                type="button"
              >
                {module.title}
              </button>
            ))}
          </nav>
        </div>

        <button
          className="logout-button"
          type="button"
          onClick={logout}
        >
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      <main className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <p className="eyebrow">
              IKIRENGA OVERVIEW
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
              {user.fullName
                .split(" ")
                .map((name) => name[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </div>

            <div>
              <strong>{user.fullName}</strong>
              <span>{user.role}</span>
            </div>
          </div>
        </header>

        <section className="module-grid">
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

                <button type="button">
                  Open module
                </button>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}

export default DashboardPage;