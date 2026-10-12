import {
  findAllContracts,
  findContractById,
  findOverlappingContract,
  insertContract,
  renewContract,
  terminateContract,
} from "../services/contractService.js";

const allowedTypes = ["PERMANENT", "FIXED_TERM", "INTERNSHIP"];


export async function getAllContracts(request, response, next) {
  try {
    const contracts = await findAllContracts();

    response.status(200).json({
      success: true,
      count: contracts.length,
      data: contracts,
    });
  } catch (error) {
    next(error);
  }
}

export async function getContractById(request, response, next) {
  try {
    const id = Number(request.params.id);

    if (!Number.isInteger(id) || id <= 0) {
      return response.status(400).json({
        success: false,
        message: "Contract ID must be a positive integer",
      });
    }

    const contract = await findContractById(id);

    if (!contract) {
      return response.status(404).json({
        success: false,
        message: "Contract not found",
      });
    }

    response.status(200).json({
      success: true,
      data: contract,
    });
  } catch (error) {
    next(error);
  }
}

export async function createContract(request, response, next) {
  try {
      const {
      employeeId,
      contractType,
      startDate,
      endDate = null,
    } = request.body;

    if (!employeeId || !contractType || !startDate) {
      return response.status(400).json({
        success: false,
        message: "Employee, contract type and start date are required",
      });
    }

    if (!allowedTypes.includes(contractType)) {
      return response.status(400).json({
        success: false,
        message: `Contract type must be one of: ${allowedTypes.join(", ")}`,
      });
    }

    if (endDate && new Date(endDate) < new Date(startDate)) {
      return response.status(400).json({
        success: false,
        message: "End date cannot be earlier than start date",
      });
    }
    const overlappingContract = await findOverlappingContract({
      employeeId,
      startDate,
      endDate,
    });

    if (overlappingContract) {
      return response.status(409).json({
        success: false,
        message: "This employee already has a contract covering these dates",
        conflict: {
          contractId: overlappingContract.id,
          startDate: overlappingContract.startDate,
          endDate: overlappingContract.endDate,
          status: overlappingContract.status,
        },
      });
    }
    const contract = await insertContract({
      employeeId,
      contractType,
      startDate,
      endDate,
    });

    response.status(201).json({
      success: true,
      message: "Contract created successfully",
      data: contract,
    });
    } catch (error) {
      if (error.code === "23503") {
        return response.status(400).json({
          success: false,
          message: "The selected employee does not exist",
        });
      }

      if (error.code === "23P01") {
        return response.status(409).json({
          success: false,
          message: "This employee already has a contract covering these dates",
        });
      }

      next(error);
    }
}

export async function renewEmployeeContract(request, response, next) {
  try {
    const contractId = Number(request.params.id);
    const { contractType, startDate, endDate = null } = request.body;

    if (!Number.isInteger(contractId) || contractId <= 0) {
      return response.status(400).json({
        success: false,
        message: "Contract ID must be a positive integer",
      });
    }

    if (!contractType || !startDate) {
      return response.status(400).json({
        success: false,
        message: "Contract type and start date are required",
      });
    }

    if (!allowedTypes.includes(contractType)) {
      return response.status(400).json({
        success: false,
        message: `Contract type must be one of: ${allowedTypes.join(", ")}`,
      });
    }

    const parsedStartDate = new Date(startDate);
    const parsedEndDate = endDate ? new Date(endDate) : null;

    if (
      Number.isNaN(parsedStartDate.getTime()) ||
      (parsedEndDate && Number.isNaN(parsedEndDate.getTime()))
    ) {
      return response.status(400).json({
        success: false,
        message: "Dates must use a valid format such as YYYY-MM-DD",
      });
    }

    if (parsedEndDate && parsedEndDate < parsedStartDate) {
      return response.status(400).json({
        success: false,
        message: "End date cannot be earlier than start date",
      });
    }

    const contract = await renewContract(contractId, {
      contractType,
      startDate,
      endDate,
    });

    response.status(201).json({
      success: true,
      message: "Contract renewed successfully",
      data: contract,
    });
  } catch (error) {
    if (error.statusCode) {
      return response.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
}
export async function terminateEmployeeContract(
  request,
  response,
  next,
) {
  try {
    const contractId = Number(request.params.id);
    const { terminationDate, terminationReason } = request.body;

    if (!Number.isInteger(contractId) || contractId <= 0) {
      return response.status(400).json({
        success: false,
        message: "Contract ID must be a positive integer",
      });
    }

    if (!terminationDate || !terminationReason?.trim()) {
      return response.status(400).json({
        success: false,
        message:
          "Termination date and termination reason are required",
      });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(terminationDate)) {
      return response.status(400).json({
        success: false,
        message: "Termination date must use YYYY-MM-DD format",
      });
    }

    if (terminationReason.trim().length < 5) {
      return response.status(400).json({
        success: false,
        message:
          "Termination reason must contain at least 5 characters",
      });
    }

    const contract = await terminateContract(
      contractId,
      terminationDate,
      terminationReason.trim(),
    );

    response.status(200).json({
      success: true,
      message: "Contract terminated successfully",
      data: contract,
    });
  } catch (error) {
    if (error.statusCode) {
      return response.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
}