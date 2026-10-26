import { getEmployeeLifecycleDashboard } from "../services/employeeLifecycleDashboardService.js";

export async function getLifecycleDashboard(request, response, next) {
  try {
    const dashboard = await getEmployeeLifecycleDashboard();

    return response.status(200).json({
      success: true,
      data: dashboard,
    });
  } catch (error) {
    next(error);
  }
}
