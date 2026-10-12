import {
  findEmployeeForStaffCard,
} from "../services/staffCardService.js";

import {
  generateStaffCardPdf,
} from "../utils/staffCardGenerator.js";

export async function downloadStaffCard(
  request,
  response,
  next,
) {
  try {
    const employeeId = Number(request.params.id);

    if (
      !Number.isInteger(employeeId) ||
      employeeId <= 0
    ) {
      return response.status(400).json({
        success: false,
        message:
          "Employee ID must be a positive integer",
      });
    }

    const employee =
      await findEmployeeForStaffCard(employeeId);

    if (!employee) {
      return response.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }    

    if (!employee.isActive) {
      return response.status(409).json({
        success: false,
        message:
          "A staff card cannot be generated for an inactive employee",
      });
    }

    if (!employee.cardId) {
      return response.status(409).json({
        success: false,
        message:
          "Issue an active staff card before generating the PDF",
      });
    }

    if (employee.cardStatus !== "ACTIVE") {
      return response.status(409).json({
        success: false,
        message:
          "Only an active staff card can be generated",
      });
    }

    const pdfBuffer =
      await generateStaffCardPdf(employee);

    const safeStaffNumber =
      employee.staffNumber.replace(
        /[^a-zA-Z0-9_-]/g,
        "-",
      );

    response.set({
      "Content-Type": "application/pdf",
      "Content-Disposition":
        `attachment; filename="staff-card-${safeStaffNumber}.pdf"`,
      "Content-Length": pdfBuffer.length,
      "Cache-Control": "no-store",
    });

    return response.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
}