import * as employeeService from "../services/employeeService.js";
import { updateEmployeePhoto } from "../services/employeeService.js";
import {
  deleteEmployeePhoto,
} from "../utils/employeePhotoUtils.js";

const allowedFields = [
  "staffNumber",
  "firstName",
  "lastName",
  "email",
  "positionId",
];

function parseEmployeeId(value) {
  const employeeId = Number(value);

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return null;
  }

  return employeeId;
}

function normalizeEmployeeData(data) {
  const normalizedData = {};

  for (const [field, value] of Object.entries(data)) {
    if (typeof value === "string") {
      let normalizedValue = value.trim();

      if (field === "email") {
        normalizedValue = normalizedValue.toLowerCase();
      }

      if (field === "staffNumber") {
        normalizedValue = normalizedValue.toUpperCase();
      }

      normalizedData[field] = normalizedValue;
    } else {
      normalizedData[field] = value;
    }
  }

  return normalizedData;
}

export async function getEmployees(request, response, next) {
  try {
    const employees = await employeeService.findAll();

    response.status(200).json({
      success: true,
      count: employees.length,
      data: employees,
    });
  } catch (error) {
    next(error);
  }
}

export async function getEmployee(request, response, next) {
  const employeeId = parseEmployeeId(request.params.id);

  if (!employeeId) {
    return response.status(400).json({
      success: false,
      message: "Employee ID must be a positive number",
    });
  }

  try {
    const employee = await employeeService.findById(employeeId);

    if (!employee) {
      return response.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    response.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    next(error);
  }
}

export async function createEmployee(request, response, next) {
  const submittedData = {
    staffNumber: request.body.staffNumber,
    firstName: request.body.firstName,
    lastName: request.body.lastName,
    email: request.body.email,
    positionId: Number(request.body.positionId),
  };

  const requiredTextFields = [
    submittedData.staffNumber,
    submittedData.firstName,
    submittedData.lastName,
    submittedData.email,
  ];

  const hasInvalidText = requiredTextFields.some(
    (value) =>
      typeof value !== "string" ||
      value.trim() === ""
  );

  const hasInvalidPosition =
    !Number.isInteger(submittedData.positionId) ||
    submittedData.positionId <= 0;

  if (hasInvalidText || hasInvalidPosition) {
    return response.status(400).json({
      success: false,
      message: "Valid employee information and positionId are required",
    });
  }

  try {
    const normalizedData = normalizeEmployeeData(submittedData);

   const employee =
    await employeeService.create(
      normalizedData,
      request.user.id,
    );

    response.status(201).json({
      success: true,
      message: "Employee created successfully",
      data: employee,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEmployee(
  request,
  response,
  next,
) {
  const employeeId = parseEmployeeId(
    request.params.id,
  );

  if (!employeeId) {
    return response.status(400).json({
      success: false,
      message:
        "Employee ID must be a positive number",
    });
  }

  const submittedFields = Object.keys(
    request.body,
  );

  if (submittedFields.length === 0) {
    return response.status(400).json({
      success: false,
      message:
        "Provide at least one field to update",
    });
  }

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

  const hasInvalidValue =
    submittedFields.some(
      (field) =>
        typeof request.body[field] !==
          "string" ||
        request.body[field].trim() === "",
    );

  if (hasInvalidValue) {
    return response.status(400).json({
      success: false,
      message:
        "Submitted employee fields cannot be empty",
    });
  }

  try {
    const normalizedData =
      normalizeEmployeeData(
        request.body,
      );

    const employee =
      await employeeService.update(
        employeeId,
        normalizedData,
      );

    if (!employee) {
      return response.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    return response.status(200).json({
      success: true,
      message:
        "Employee updated successfully",
      data: employee,
    });
  } catch (error) {
    next(error);
  }
}

export async function deactivateEmployee(request, response, next) {
  const employeeId = parseEmployeeId(request.params.id);

  if (!employeeId) {
    return response.status(400).json({
      success: false,
      message: "Employee ID must be a positive number",
    });
  }

  try {
    const employee =
      await employeeService.deactivate(
        employeeId,
        request.user.id,
      );

    if (!employee) {
      return response.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    response.status(200).json({
      success: true,
      message: "Employee deactivated successfully",
      data: employee,
    });
  } catch (error) {
    next(error);
  }
}

export async function uploadPhoto(
  request,
  response,
  next,
) {
  const uploadedFilename = request.file?.filename;

  try {
    const employeeId = Number(request.params.id);

    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      if (uploadedFilename) {
        await deleteEmployeePhoto(uploadedFilename);
      }

      return response.status(400).json({
        success: false,
        message:
          "Employee ID must be a positive integer",
      });
    }

    if (!request.file) {
      return response.status(400).json({
        success: false,
        message: "An employee photo is required",
      });
    }

    const result = await updateEmployeePhoto(
      employeeId,
      uploadedFilename,
    );

    if (!result) {
      await deleteEmployeePhoto(uploadedFilename);

      return response.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    const {
      employee,
      previousPhotoFilename,
    } = result;

    if (
      previousPhotoFilename &&
      previousPhotoFilename !== uploadedFilename
    ) {
      try {
        await deleteEmployeePhoto(
          previousPhotoFilename,
        );
      } catch (cleanupError) {
        console.error(
          "Unable to delete previous employee photo:",
          cleanupError,
        );
      }
    }

    return response.status(200).json({
      success: true,
      message: previousPhotoFilename
        ? "Employee photo replaced successfully"
        : "Employee photo uploaded successfully",
      data: {
        ...employee,
        photoUrl:
          `/uploads/employees/${employee.photoFilename}`,
      },
    });
  } catch (error) {
    if (uploadedFilename) {
      try {
        await deleteEmployeePhoto(uploadedFilename);
      } catch (cleanupError) {
        console.error(
          "Unable to clean up failed photo upload:",
          cleanupError,
        );
      }
    }

    next(error);
  }
}