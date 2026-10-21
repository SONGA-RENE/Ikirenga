import {
  getFinanceDashboard,
  getMissionClosureReadiness,
} from "../services/missionMonitoringService.js";

export async function getFinanceDashboardSummary(
  request,
  response,
  next,
) {
  try {
    const result =
      await getFinanceDashboard();

    return response.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function getClosureReadiness(
  request,
  response,
  next,
) {
  try {
    const result =
      await getMissionClosureReadiness();

    return response.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}