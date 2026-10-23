import {
  archiveFamilyContact,
  createFamilyContact,
  findEmployeeFamilyContacts,
  updateFamilyContact,
} from "../services/employeeFamilyContactService.js";

const allowedContactTypes = [
  "PARENT",
  "GUARDIAN",
  "SPOUSE",
  "NEXT_OF_KIN",
  "EMERGENCY_CONTACT",
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

function normalizeContactData(
  body,
  partial = false,
) {
  const data = {};

  if (
    !partial ||
    body.contactType !== undefined
  ) {
    data.contactType =
      body.contactType
        ?.trim()
        .toUpperCase();
  }

  if (
    !partial ||
    body.fullName !== undefined
  ) {
    data.fullName =
      body.fullName?.trim();
  }

  if (
    !partial ||
    body.relationship !== undefined
  ) {
    data.relationship =
      body.relationship?.trim();
  }

  for (const field of [
    "phoneNumber",
    "alternativePhone",
    "address",
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
    body.email !== undefined
  ) {
    data.email =
      optionalText(
        body.email,
      )?.toLowerCase() ?? null;
  }

  if (
    !partial ||
    body.isPrimary !== undefined
  ) {
    data.isPrimary =
      body.isPrimary === true;
  }

  return data;
}

function validateContactData(
  data,
  partial = false,
) {
  if (
    data.contactType !== undefined &&
    !allowedContactTypes.includes(
      data.contactType,
    )
  ) {
    return "Invalid family contact type";
  }

  if (
    (!partial ||
      data.fullName !== undefined) &&
    !data.fullName
  ) {
    return "Contact full name is required";
  }

  if (
    (!partial ||
      data.relationship !== undefined) &&
    !data.relationship
  ) {
    return "Relationship is required";
  }

  if (
    ["NEXT_OF_KIN", "EMERGENCY_CONTACT"]
      .includes(data.contactType) &&
    !data.phoneNumber
  ) {
    return (
      "A telephone number is required for " +
      "next-of-kin and emergency contacts"
    );
  }

  return null;
}

export async function getFamilyContacts(
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
      await findEmployeeFamilyContacts(
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
      count: result.contacts.length,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function addFamilyContact(
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
      normalizeContactData(
        request.body,
      );

    const validationError =
      validateContactData(data);

    if (validationError) {
      return response.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const contact =
      await createFamilyContact(
        employeeId,
        data,
        request.user.id,
      );

    return response.status(201).json({
      success: true,
      message:
        "Family contact created successfully",
      data: contact,
    });
  } catch (error) {
    next(error);
  }
}

export async function editFamilyContact(
  request,
  response,
  next,
) {
  try {
    const employeeId =
      parsePositiveInteger(
        request.params.employeeId,
      );

    const contactId =
      parsePositiveInteger(
        request.params.contactId,
      );

    if (!employeeId || !contactId) {
      return response.status(400).json({
        success: false,
        message:
          "Employee ID and contact ID must be positive integers",
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
      normalizeContactData(
        request.body,
        true,
      );

    const validationError =
      validateContactData(
        data,
        true,
      );

    if (validationError) {
      return response.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const contact =
      await updateFamilyContact(
        employeeId,
        contactId,
        data,
        request.user.id,
      );

    return response.status(200).json({
      success: true,
      message:
        "Family contact updated successfully",
      data: contact,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeFamilyContact(
  request,
  response,
  next,
) {
  try {
    const employeeId =
      parsePositiveInteger(
        request.params.employeeId,
      );

    const contactId =
      parsePositiveInteger(
        request.params.contactId,
      );

    if (!employeeId || !contactId) {
      return response.status(400).json({
        success: false,
        message:
          "Employee ID and contact ID must be positive integers",
      });
    }

    const contact =
      await archiveFamilyContact(
        employeeId,
        contactId,
        request.user.id,
      );

    if (!contact) {
      return response.status(404).json({
        success: false,
        message:
          "Active family contact not found",
      });
    }

    return response.status(200).json({
      success: true,
      message:
        "Family contact archived successfully",
      data: contact,
    });
  } catch (error) {
    next(error);
  }
}