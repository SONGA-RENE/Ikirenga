import {
  findEmployeeProfile,
  saveEmployeeProfile,
} from "../services/employeeProfileService.js";

import {
  normalizeIdentifier,
} from "../utils/employeeDataEncryption.js";

function parsePositiveInteger(value) {
  const number = Number(value);

  return Number.isInteger(number) &&
    number > 0
    ? number
    : null;
}

function normalizeOptionalText(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = String(value).trim();

  return normalized || null;
}

function isValidDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00Z`,
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) ===
      value
  );
}

export async function getEmployeeProfile(
  request,
  response,
  next,
) {
  try {
    const employeeId =
      parsePositiveInteger(
        request.params.employeeId,
      );

    if (!employeeId) {
      return response.status(400).json({
        success: false,
        message:
          "Employee ID must be a positive integer",
      });
    }

    const profile =
      await findEmployeeProfile(
        employeeId,
      );

    if (!profile) {
      return response.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    return response.status(200).json({
      success: true,
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEmployeeProfile(
  request,
  response,
  next,
) {
  try {
    const employeeId =
      parsePositiveInteger(
        request.params.employeeId,
      );

    if (!employeeId) {
      return response.status(400).json({
        success: false,
        message:
          "Employee ID must be a positive integer",
      });
    }

    const allowedFields = [
      "dateOfBirth",
      "gender",
      "nationality",
      "maritalStatus",
      "primaryPhone",
      "alternativePhone",
      "personalEmail",
      "residentialAddress",
      "district",
      "sector",
      "nationalId",
      "passportNumber",
    ];

    const submittedFields =
      Object.keys(request.body);

    const invalidFields =
      submittedFields.filter(
        (field) =>
          !allowedFields.includes(field),
      );

    if (submittedFields.length === 0) {
      return response.status(400).json({
        success: false,
        message:
          "Provide at least one profile field",
      });
    }

    if (invalidFields.length > 0) {
      return response.status(400).json({
        success: false,
        message:
          `These fields cannot be updated: ` +
          invalidFields.join(", "),
      });
    }

    const normalizedData = {};

    const textFields = [
      "nationality",
      "primaryPhone",
      "alternativePhone",
      "residentialAddress",
      "district",
      "sector",
    ];

    for (const field of textFields) {
      if (
        request.body[field] !== undefined
      ) {
        normalizedData[field] =
          normalizeOptionalText(
            request.body[field],
          );
      }
    }

    if (
      request.body.personalEmail !==
      undefined
    ) {
      normalizedData.personalEmail =
        normalizeOptionalText(
          request.body.personalEmail,
        )?.toLowerCase() ?? null;
    }

    if (
      request.body.dateOfBirth !==
      undefined
    ) {
      if (
        request.body.dateOfBirth !==
          null &&
        !isValidDate(
          request.body.dateOfBirth,
        )
      ) {
        return response.status(400).json({
          success: false,
          message:
            "dateOfBirth must use YYYY-MM-DD format",
        });
      }

      normalizedData.dateOfBirth =
        request.body.dateOfBirth;
    }

    const genders = [
      "MALE",
      "FEMALE",
      "OTHER",
      "PREFER_NOT_TO_SAY",
    ];

    if (
      request.body.gender !== undefined
    ) {
      const gender =
        request.body.gender === null
          ? null
          : String(
              request.body.gender,
            )
              .trim()
              .toUpperCase();

      if (
        gender !== null &&
        !genders.includes(gender)
      ) {
        return response.status(400).json({
          success: false,
          message:
            "Invalid gender value",
        });
      }

      normalizedData.gender = gender;
    }

    const maritalStatuses = [
      "SINGLE",
      "MARRIED",
      "DIVORCED",
      "WIDOWED",
      "SEPARATED",
      "PREFER_NOT_TO_SAY",
    ];

    if (
      request.body.maritalStatus !==
      undefined
    ) {
      const maritalStatus =
        request.body.maritalStatus ===
        null
          ? null
          : String(
              request.body
                .maritalStatus,
            )
              .trim()
              .toUpperCase();

      if (
        maritalStatus !== null &&
        !maritalStatuses.includes(
          maritalStatus,
        )
      ) {
        return response.status(400).json({
          success: false,
          message:
            "Invalid marital status",
        });
      }

      normalizedData.maritalStatus =
        maritalStatus;
    }

    if (
      request.body.nationalId !==
      undefined
    ) {
      const nationalId =
        normalizeIdentifier(
          request.body.nationalId,
        );

      if (
        nationalId !== null &&
        !/^\d{16}$/.test(nationalId)
      ) {
        return response.status(400).json({
          success: false,
          message:
            "Rwandan National ID must contain exactly 16 digits",
        });
      }

      normalizedData.nationalId =
        nationalId;
    }

    if (
      request.body.passportNumber !==
      undefined
    ) {
      const passportNumber =
        normalizeIdentifier(
          request.body.passportNumber,
        );

      if (
        passportNumber !== null &&
        !/^[A-Z0-9]{5,20}$/.test(
          passportNumber,
        )
      ) {
        return response.status(400).json({
          success: false,
          message:
            "Passport number must contain 5 to 20 letters or numbers",
        });
      }

      normalizedData.passportNumber =
        passportNumber;
    }

    const profile =
      await saveEmployeeProfile(
        employeeId,
        normalizedData,
        request.user.id,
      );

    return response.status(200).json({
      success: true,
      message:
        "Employee profile updated successfully",
      data: profile,
    });
  } catch (error) {
    next(error);
  }
}