import {
  archiveEducationRecord,
  createEducationRecord,
  findEmployeeEducation,
  updateEducationRecord,
} from "../services/employeeEducationService.js";

const educationLevels = [
  "PRIMARY",
  "SECONDARY",
  "TVET",
  "CERTIFICATE",
  "DIPLOMA",
  "BACHELOR",
  "POSTGRADUATE_DIPLOMA",
  "MASTER",
  "DOCTORATE",
  "PROFESSIONAL",
  "OTHER",
];

function parsePositiveInteger(value) {
  const number = Number(value);

  return Number.isInteger(number) &&
    number > 0
    ? number
    : null;
}

function optionalText(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return String(value).trim() || null;
}

function optionalYear(value) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return value === undefined
      ? undefined
      : null;
  }

  return Number(value);
}

function normalizeEducationData(
  body,
  partial = false,
) {
  const data = {};

  if (
    !partial ||
    body.educationLevel !== undefined
  ) {
    data.educationLevel =
      body.educationLevel
        ?.trim()
        .toUpperCase();
  }

  for (const field of [
    "institutionName",
    "qualification",
    "fieldOfStudy",
    "country",
    "notes",
  ]) {
    if (
      !partial ||
      body[field] !== undefined
    ) {
      data[field] =
        optionalText(body[field]);
    }
  }

  if (
    !partial ||
    body.startYear !== undefined
  ) {
    data.startYear =
      optionalYear(body.startYear);
  }

  if (
    !partial ||
    body.graduationYear !==
      undefined
  ) {
    data.graduationYear =
      optionalYear(
        body.graduationYear,
      );
  }

  if (
    !partial ||
    body.isHighestQualification !==
      undefined
  ) {
    data.isHighestQualification =
      body.isHighestQualification ===
      true;
  }

  return data;
}

function validateEducationData(
  data,
  partial = false,
) {
  if (
    (!partial ||
      data.educationLevel !==
        undefined) &&
    !educationLevels.includes(
      data.educationLevel,
    )
  ) {
    return "Invalid education level";
  }

  for (const field of [
    "startYear",
    "graduationYear",
  ]) {
    const value = data[field];

    if (
      value !== undefined &&
      value !== null &&
      (
        !Number.isInteger(value) ||
        value < 1900 ||
        value > 2200
      )
    ) {
      return (
        `${field} must be a valid ` +
        "four-digit year"
      );
    }
  }

  if (
    data.startYear !== undefined &&
    data.startYear !== null &&
    data.graduationYear !== undefined &&
    data.graduationYear !== null &&
    data.graduationYear <
      data.startYear
  ) {
    return (
      "Graduation year cannot be " +
      "before the start year"
    );
  }

  return null;
}

export async function getEducationRecords(
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

    const result =
      await findEmployeeEducation(
        employeeId,
      );

    if (!result) {
      return response.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    return response.status(200).json({
      success: true,
      count:
        result.educationRecords.length,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function addEducationRecord(
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

    const data =
      normalizeEducationData(
        request.body,
      );

    const validationError =
      validateEducationData(data);

    if (validationError) {
      return response.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const record =
      await createEducationRecord(
        employeeId,
        data,
        request.user.id,
      );

    return response.status(201).json({
      success: true,
      message:
        "Education record created successfully",
      data: record,
    });
  } catch (error) {
    next(error);
  }
}

export async function editEducationRecord(
  request,
  response,
  next,
) {
  try {
    const employeeId =
      parsePositiveInteger(
        request.params.employeeId,
      );

    const educationId =
      parsePositiveInteger(
        request.params.educationId,
      );

    if (!employeeId || !educationId) {
      return response.status(400).json({
        success: false,
        message:
          "Employee ID and education ID must be positive integers",
      });
    }

    if (
      Object.keys(request.body).length ===
      0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Provide at least one field to update",
      });
    }

    const data =
      normalizeEducationData(
        request.body,
        true,
      );

    const validationError =
      validateEducationData(
        data,
        true,
      );

    if (validationError) {
      return response.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const record =
      await updateEducationRecord(
        employeeId,
        educationId,
        data,
        request.user.id,
      );

    return response.status(200).json({
      success: true,
      message:
        "Education record updated successfully",
      data: record,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeEducationRecord(
  request,
  response,
  next,
) {
  try {
    const employeeId =
      parsePositiveInteger(
        request.params.employeeId,
      );

    const educationId =
      parsePositiveInteger(
        request.params.educationId,
      );

    if (!employeeId || !educationId) {
      return response.status(400).json({
        success: false,
        message:
          "Employee ID and education ID must be positive integers",
      });
    }

    const record =
      await archiveEducationRecord(
        employeeId,
        educationId,
        request.user.id,
      );

    if (!record) {
      return response.status(404).json({
        success: false,
        message:
          "Active education record not found",
      });
    }

    return response.status(200).json({
      success: true,
      message:
        "Education record archived successfully",
      data: record,
    });
  } catch (error) {
    next(error);
  }
}