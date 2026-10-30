import {
  BriefcaseBusiness,
  CalendarDays,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Users,
} from "lucide-react";

import { NavLink } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext.jsx";
import { hasPermission } from "../../auth/permissions.js";
const navigationItems = [
  {
    title: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    enabled: true,
    permission: null,
  },
  {
    title: "Employees",
    path: "/employees",
    icon: Users,
    enabled: true,
    permission: "VIEW_EMPLOYEES",
  },
  {
    title: "Contracts",
    path: "/contracts",
    icon: FileText,
    enabled: true,
    permission: "VIEW_CONTRACTS",
  },
  {
    title: "Leave",
    path: "/leave",
    icon: CalendarDays,
    enabled: true,
    permission: "VIEW_LEAVE",
  },
  {
    title: "Missions",
    path: "/missions",
    icon: BriefcaseBusiness,
    enabled: false,
    permission: null,
  },
  {
    title: "Staff Cards",
    path: "/staff-cards",
    icon: CreditCard,
    enabled: false,
    permission: null,
  },
];

function Sidebar({ isCollapsed, onToggle }) {
  const { user, logout } = useAuth();

  const visibleNavigationItems = navigationItems.filter((item) => {
    if (!item.permission) {
      return true;
    }

    return hasPermission(user, item.permission);
  });

  return (
    <aside className="sidebar">
      <div>
        {/* Keep your existing sidebar header here */}

        <nav className="sidebar-navigation" aria-label="Main navigation">
          {visibleNavigationItems.map((item) => {
            const Icon = item.icon;

            if (!item.enabled) {
              return (
                <button
                  key={item.title}
                  type="button"
                  className="navigation-link"
                  disabled
                  title={
                    isCollapsed ? `${item.title} — coming soon` : "Coming soon"
                  }
                >
                  <Icon size={20} />

                  <span className="navigation-label">{item.title}</span>
                </button>
              );
            }

            return (
              <NavLink
                key={item.title}
                to={item.path}
                className={({ isActive }) =>
                  `navigation-link ${isActive ? "active" : ""}`
                }
                title={isCollapsed ? item.title : undefined}
              >
                <Icon size={20} />

                <span className="navigation-label">{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <button type="button" className="logout-button" onClick={logout}>
        <LogOut size={20} />

        <span className="navigation-label">Sign out</span>
      </button>
    </aside>
  );
}

export default Sidebar;
