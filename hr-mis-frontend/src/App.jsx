import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./auth/ProtectedRoute.jsx";

import DashboardLayout from "./components/layout/DashboardLayout.jsx";

import DashboardPage from "./pages/DashboardPage.jsx";

import EmployeeListPage from "./pages/employees/EmployeeListPage.jsx";

import EmployeeDetailsPage from "./pages/employees/EmployeeDetailsPage.jsx";

import LoginPage from "./pages/LoginPage.jsx";

import EmployeeCreatePage from "./pages/employees/EmployeeCreatePage.jsx";

import EmployeeEditPage from "./pages/employees/EmployeeEditPage.jsx";

import ContractListPage from "./pages/contracts/ContractListPage.jsx";

import EmployeeLifecycleDashboardPage from "./pages/employees/EmployeeLifecycleDashboardPage.jsx";

import LeaveDashboardPage from "./pages/leave/LeaveDashboardPage.jsx";

import RequestLeavePage from "./pages/leave/RequestLeavePage.jsx";

import MyLeaveRequestsPage from "./pages/leave/MyLeaveRequestsPage.jsx";

import LeaveBalancesPage from "./pages/leave/LeaveBalancesPage.jsx";

import LeaveApprovalsPage from "./pages/leave/LeaveApprovalsPage.jsx";

import LeaveCancellationsPage from "./pages/leave/LeaveCancellationsPage.jsx";

import LeaveReturnsPage from "./pages/leave/LeaveReturnsPage.jsx";

import EmployeesOnLeavePage from "./pages/leave/EmployeesOnLeavePage.jsx";

import LeaveRequestDetailsPage from "./pages/leave/LeaveRequestDetailsPage.jsx";

import AllLeaveRequestsPage from "./pages/leave/AllLeaveRequestsPage.jsx";

import LeaveTypesPage from "./pages/leave/LeaveTypesPage.jsx";

import LeaveEntitlementsPage from "./pages/leave/LeaveEntitlementsPage.jsx";

import PublicHolidaysPage from "./pages/leave/PublicHolidaysPage.jsx";

function App() {
  return (
    <Routes>
      {/* Public route */}
      <Route path="/login" element={<LoginPage />} />

      {/* All authenticated pages */}
      <Route element={<ProtectedRoute />}>
        {/* All dashboard pages with sidebar */}
        <Route element={<DashboardLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route path="/employees" element={<EmployeeListPage />} />

          <Route path="/employees/new" element={<EmployeeCreatePage />} />

          <Route
            path="/employees/:employeeId"
            element={<EmployeeDetailsPage />}
          />

          <Route
            path="/employees/:employeeId/edit"
            element={<EmployeeEditPage />}
          />

          <Route path="/contracts" element={<ContractListPage />} />

          <Route
            path="/employees/lifecycle"
            element={<EmployeeLifecycleDashboardPage />}
          />

          <Route path="/leave" element={<LeaveDashboardPage />} />
          <Route path="/leave/request" element={<RequestLeavePage />} />

          <Route path="/leave/my-requests" element={<MyLeaveRequestsPage />} />

          <Route path="/leave/balances" element={<LeaveBalancesPage />} />
          <Route path="/leave/approvals" element={<LeaveApprovalsPage />} />
          <Route
            path="/leave/cancellations"
            element={<LeaveCancellationsPage />}
          />
          <Route path="/leave/returns" element={<LeaveReturnsPage />} />

          <Route
            path="/leave/currently-on-leave"
            element={<EmployeesOnLeavePage />}
          />
          <Route
            path="/leave/requests/:requestId"
            element={<LeaveRequestDetailsPage />}
          />
          <Route
            path="/leave/all-requests"
            element={<AllLeaveRequestsPage />}
          />
          <Route path="/leave/types" element={<LeaveTypesPage />} />
          <Route
            path="/leave/entitlements"
            element={<LeaveEntitlementsPage />}
          />
          <Route
            path="/leave/public-holidays"
            element={<PublicHolidaysPage />}
          />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
