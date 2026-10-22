import {
  findAllPositions,
} from "../services/positionService.js";

export async function getPositions(
  request,
  response,
  next,
) {
  try {
    const positions =
      await findAllPositions();

    return response.status(200).json({
      success: true,
      count: positions.length,
      data: positions,
    });
  } catch (error) {
    next(error);
  }
}