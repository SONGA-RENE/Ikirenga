import {
  BriefcaseBusiness,
  CalendarDays,
  CreditCard,
  FileText,
  Users,
} from "lucide-react";

import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext.jsx";

import ContractExpiryPanel from "./contracts/ContractExpiryPanel.jsx";
import { hasPermission } from "../auth/permissions.js";

const modules = [
  {
    title: "Employees",
    description: "Manage employee records and organizational information.",
    icon: Users,
    path: "/employees",
    enabled: true,
    permission: "VIEW_EMPLOYEES",
  },
  {
    title: "Contracts",
    description: "Monitor employment contracts and expiry dates.",
    icon: FileText,
    path: "/contracts",
    enabled: true,
    permission: "VIEW_CONTRACTS",
  },
  {
    title: "Leave",
    description: "Manage leave requests, balances and approvals.",
    icon: CalendarDays,
    path: "/leave",
    enabled: true,
    permission: "VIEW_LEAVE",
  },
];

function DashboardPage() {
  const { user } = useAuth();

  const visibleModules = modules.filter(
    (module) => !module.permission || hasPermission(user, module.permission),
  );

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
          <p className="eyebrow">Ikirenga overview</p>

          <h1>Welcome, {user.fullName}</h1>

          <p>Manage PSF human resources operations from one place.</p>
        </div>

        <div className="user-summary">
          <div className="user-avatar">{userInitials}</div>

          <div>
            <strong>{user.fullName}</strong>
            <span>{user.role}</span>
          </div>
        </div>
      </header>

      <section className="module-grid" aria-label="HR modules">
        {visibleModules.map((module) => {
          const Icon = module.icon;

          return (
            <article className="module-card" key={module.title}>
              <div className="module-icon">
                <Icon size={24} />
              </div>

              <h2>{module.title}</h2>

              <p>{module.description}</p>

              {module.enabled ? (
                <Link to={module.path} className="module-card-link">
                  Open module
                </Link>
              ) : (
                <span className="module-unavailable">Coming soon</span>
              )}
            </article>
          );
        })}
      </section>

      {["ADMIN", "HR"].includes(user.role) && <ContractExpiryPanel />}
    </>
  );
}

export default DashboardPage;
