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
            path="employees/:employeeId/edit"
            element={<EmployeeEditPage />}
          />
          <Route path="/contracts" element={<ContractListPage />} />
          <Route
            path="employees/lifecycle"
            element={<EmployeeLifecycleDashboardPage />}
          />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
