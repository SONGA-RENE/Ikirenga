import { useState } from "react";

import { Outlet } from "react-router-dom";

import Sidebar from "./Sidebar.jsx";

function DashboardLayout() {
  const [
    isSidebarCollapsed,
    setIsSidebarCollapsed,
  ] = useState(false);

  function toggleSidebar() {
    setIsSidebarCollapsed(
      (current) => !current,
    );
  }

  return (
    <div
      className={`dashboard-shell ${
        isSidebarCollapsed
          ? "sidebar-is-collapsed"
          : ""
      }`}
    >
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={toggleSidebar}
      />

      <main className="dashboard-content">
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;