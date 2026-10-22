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

const navigationItems = [
  {
    title: "Dashboard",
    path: "/dashboard",
    icon: LayoutDashboard,
    enabled: true,
  },
  {
    title: "Employees",
    path: "/employees",
    icon: Users,
    enabled: true,
  },
  {
    title: "Contracts",
    path: "/contracts",
    icon: FileText,
    enabled: false,
  },
  {
    title: "Leave",
    path: "/leave",
    icon: CalendarDays,
    enabled: false,
  },
  {
    title: "Missions",
    path: "/missions",
    icon: BriefcaseBusiness,
    enabled: false,
  },
  {
    title: "Staff Cards",
    path: "/staff-cards",
    icon: CreditCard,
    enabled: false,
  },
];

function Sidebar({
  isCollapsed,
  onToggle,
}) {
  const { logout } = useAuth();

  return (
    <aside className="sidebar">
      <div>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img
              src="/branding/ikirenga-icon.png"
              alt=""
              className="sidebar-brand-icon"
            />

            <div className="sidebar-brand-text">
              <strong>Ikirenga</strong>

              <span>
                PSF Human Resources MIS
              </span>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggle}
            aria-label={
              isCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
            aria-expanded={!isCollapsed}
            title={
              isCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar"
            }
          >
            {isCollapsed ? (
              <PanelLeftOpen size={19} />
            ) : (
              <PanelLeftClose size={19} />
            )}
          </button>
        </div>

        <nav
          className="sidebar-navigation"
          aria-label="Main navigation"
        >
          {navigationItems.map((item) => {
            const Icon = item.icon;

            if (!item.enabled) {
              return (
                <button
                  key={item.title}
                  type="button"
                  className="navigation-link"
                  disabled
                  title={
                    isCollapsed
                      ? `${item.title} — coming soon`
                      : "Coming soon"
                  }
                >
                  <Icon size={20} />

                  <span className="navigation-label">
                    {item.title}
                  </span>
                </button>
              );
            }

            return (
              <NavLink
                key={item.title}
                to={item.path}
                className={({ isActive }) =>
                  `navigation-link ${
                    isActive ? "active" : ""
                  }`
                }
                title={
                  isCollapsed
                    ? item.title
                    : undefined
                }
              >
                <Icon size={20} />

                <span className="navigation-label">
                  {item.title}
                </span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      <button
        type="button"
        className="logout-button"
        onClick={logout}
        title={
          isCollapsed
            ? "Sign out"
            : undefined
        }
      >
        <LogOut size={20} />

        <span className="navigation-label">
          Sign out
        </span>
      </button>
    </aside>
  );
}

export default Sidebar;