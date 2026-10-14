import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import employeeRoutes from "./routes/employeeRoutes.js";
import contractRoutes from "./routes/contractRoutes.js";
import leaveTypeRoutes from "./routes/leaveTypeRoutes.js";
import publicHolidayRoutes from "./routes/publicHolidayRoutes.js";
import leaveBalanceRoutes from "./routes/leaveBalanceRoutes.js";
import leaveRequestRoutes from "./routes/leaveRequestRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import selfServiceRoutes from "./routes/selfServiceRoutes.js";
import staffCardRoutes from "./routes/staffCardRoutes.js";
import { errorHandler } from "./middleware/errorHandler.js";
import publicStaffCardRoutes
  from "./routes/publicStaffCardRoutes.js";

  import missionRoutes from "./routes/missionRoutes.js";

const app = express();

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);

// Parse JSON request bodies
app.use(express.json());

// Serve public assets such as the logo and signature
app.use(
  "/public",
  express.static(path.join(currentDirectory, "../public")),
);

// Serve uploaded employee files
app.use(
  "/uploads",
  express.static(path.join(currentDirectory, "../uploads")),
);

app.get("/", (request, response) => {
  response.status(200).json({
    success: true,
    message: "HR MIS API is running",
  });
});

app.use("/api/employees", employeeRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/leave-types", leaveTypeRoutes);
app.use("/api/public-holidays", publicHolidayRoutes);
app.use("/api/leave-requests", leaveRequestRoutes);
app.use("/api/leave-balances", leaveBalanceRoutes);
app.use(
  "/staff-cards",
  publicStaffCardRoutes,
);
app.use("/api/staff-cards", staffCardRoutes);
app.use("/api/me", selfServiceRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/missions", missionRoutes);



// Handle unknown endpoints
app.use((request, response) => {
  response.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// Error middleware must always be registered last
app.use(errorHandler);

export default app;