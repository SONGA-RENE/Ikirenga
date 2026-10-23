import * as positionService
  from "../services/positionService.js";


function parsePositiveInteger(value) {
  const parsedValue = Number(value);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    return null;
  }

  return parsedValue;
}

function normalizeNullableText(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = String(value).trim();

  return normalized || null;
}
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

export async function getAvailablePositions(
  request,
  response,
  next,
) {
  try {
    const positions =
      await positionService.findAvailablePositions();

    return response.status(200).json({
      success: true,
      count: positions.length,
      data: positions,
    });
  } catch (error) {
    next(error);
  }
}

export async function addPosition(
  request,
  response,
  next,
) {
  try {
    const departmentId =
      parsePositiveInteger(
        request.body.departmentId,
      );

    const reportsToPositionId =
      request.body.reportsToPositionId ===
        null ||
      request.body.reportsToPositionId ===
        undefined
        ? null
        : parsePositiveInteger(
            request.body
              .reportsToPositionId,
          );

    const seatNumber =
      request.body.seatNumber === undefined
        ? 1
        : parsePositiveInteger(
            request.body.seatNumber,
          );

    const positionCode =
      request.body.positionCode
        ?.trim()
        .toUpperCase();

    const title =
      request.body.title?.trim();

    if (
      !positionCode ||
      !/^[A-Z0-9-]+$/.test(positionCode)
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Position code may contain only uppercase letters, numbers and hyphens",
      });
    }

    if (!title) {
      return response.status(400).json({
        success: false,
        message: "Position title is required",
      });
    }

    if (!departmentId || !seatNumber) {
      return response.status(400).json({
        success: false,
        message:
          "Valid departmentId and seatNumber are required",
      });
    }

    if (
      request.body.reportsToPositionId !=
        null &&
      !reportsToPositionId
    ) {
      return response.status(400).json({
        success: false,
        message:
          "reportsToPositionId must be a positive integer or null",
      });
    }

    const position =
      await positionService.createPosition({
        positionCode,
        title,
        departmentId,
        reportsToPositionId,
        locationName:
          normalizeNullableText(
            request.body.locationName,
          ),
        seatNumber,
        description:
          normalizeNullableText(
            request.body.description,
          ),
      });

    return response.status(201).json({
      success: true,
      message:
        "Position created successfully",
      data: position,
    });
  } catch (error) {
    next(error);
  }
}

export async function editPosition(
  request,
  response,
  next,
) {
  try {
    const positionId =
      parsePositiveInteger(
        request.params.positionId,
      );

    if (!positionId) {
      return response.status(400).json({
        success: false,
        message:
          "Position ID must be a positive integer",
      });
    }

    const allowedFields = [
      "title",
      "departmentId",
      "reportsToPositionId",
      "locationName",
      "seatNumber",
      "description",
    ];

    const submittedFields =
      Object.keys(request.body);

    const invalidFields =
      submittedFields.filter(
        (field) =>
          !allowedFields.includes(field),
      );

    if (invalidFields.length > 0) {
      return response.status(400).json({
        success: false,
        message:
          `These fields cannot be updated: ` +
          invalidFields.join(", "),
      });
    }

    if (submittedFields.length === 0) {
      return response.status(400).json({
        success: false,
        message:
          "Provide at least one field to update",
      });
    }

    const changes = {};

    if (request.body.title !== undefined) {
      const title =
        request.body.title?.trim();

      if (!title) {
        return response.status(400).json({
          success: false,
          message:
            "Position title cannot be empty",
        });
      }

      changes.title = title;
    }

    if (
      request.body.departmentId !==
      undefined
    ) {
      const departmentId =
        parsePositiveInteger(
          request.body.departmentId,
        );

      if (!departmentId) {
        return response.status(400).json({
          success: false,
          message:
            "departmentId must be a positive integer",
        });
      }

      changes.departmentId = departmentId;
    }

    if (
      request.body.reportsToPositionId !==
      undefined
    ) {
      if (
        request.body.reportsToPositionId ===
        null
      ) {
        changes.reportsToPositionId =
          null;
      } else {
        const reportsToPositionId =
          parsePositiveInteger(
            request.body
              .reportsToPositionId,
          );

        if (!reportsToPositionId) {
          return response
            .status(400)
            .json({
              success: false,
              message:
                "reportsToPositionId must be a positive integer or null",
            });
        }

        changes.reportsToPositionId =
          reportsToPositionId;
      }
    }

    if (
      request.body.locationName !==
      undefined
    ) {
      changes.locationName =
        normalizeNullableText(
          request.body.locationName,
        );
    }

    if (
      request.body.description !==
      undefined
    ) {
      changes.description =
        normalizeNullableText(
          request.body.description,
        );
    }

    if (
      request.body.seatNumber !==
      undefined
    ) {
      const seatNumber =
        parsePositiveInteger(
          request.body.seatNumber,
        );

      if (!seatNumber) {
        return response.status(400).json({
          success: false,
          message:
            "seatNumber must be a positive integer",
        });
      }

      changes.seatNumber = seatNumber;
    }

    const position =
      await positionService.updatePosition(
        positionId,
        changes,
      );

    if (!position) {
      return response.status(404).json({
        success: false,
        message: "Position not found",
      });
    }

    return response.status(200).json({
      success: true,
      message:
        "Position updated successfully",
      data: position,
    });
  } catch (error) {
    next(error);
  }
}

export async function removePosition(
  request,
  response,
  next,
) {
  try {
    const positionId =
      parsePositiveInteger(
        request.params.positionId,
      );

    if (!positionId) {
      return response.status(400).json({
        success: false,
        message:
          "Position ID must be a positive integer",
      });
    }

    const position =
      await positionService
        .deactivatePosition(positionId);

    if (!position) {
      return response.status(404).json({
        success: false,
        message: "Position not found",
      });
    }

    return response.status(200).json({
      success: true,
      message:
        "Position deactivated successfully",
      data: position,
    });
  } catch (error) {
    next(error);
  }
}

export async function getActingEligiblePositions(
  request,
  response,
  next,
) {
  try {
    const positions =
      await positionService
        .findActingEligiblePositions();

    return response.status(200).json({
      success: true,
      count: positions.length,
      data: positions,
    });
  } catch (error) {
    next(error);
  }
}