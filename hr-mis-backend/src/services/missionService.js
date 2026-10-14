import pool from "../config/database.js";

export async function createMission({
  title,
  purpose,
  destination,
  missionType,
  startDate,
  endDate,
  transportDetails,
  accommodationDetails,
  estimatedTransportCost,
  estimatedAccommodationCost,
  estimatedOtherCost,
  currency,
  participants,
  createdByUserId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

          const durationResult = await client.query(
        `
          SELECT
            ($2::date - $1::date) + 1
              AS "missionDurationDays"
        `,
        [startDate, endDate],
      );

      const missionDurationDays = Number(
        durationResult.rows[0].missionDurationDays,
      );

      if (
        !Number.isInteger(missionDurationDays) ||
        missionDurationDays <= 0
      ) {
        const error = new Error(
          "Mission dates are invalid",
        );

        error.statusCode = 400;
        throw error;
      }

    const uniqueEmployeeIds = [
      ...new Set(
        participants.map(
          (participant) => participant.employeeId,
        ),
      ),
    ];

    if (
      uniqueEmployeeIds.length !== participants.length
    ) {
      const error = new Error(
        "The same employee cannot be added more than once",
      );

      error.statusCode = 400;
      throw error;
    }

     const employeeResult = await client.query(
  `
        SELECT
          employees.id,
          employees.staff_number AS "staffNumber",
          employees.first_name AS "firstName",
          employees.last_name AS "lastName",
          employees.is_active AS "isActive",
          positions.department_id AS "departmentId",

          CASE
            WHEN app_users.role IN (
              'DIRECTOR',
              'DEPUTY_CEO',
              'CEO'
            )
            THEN app_users.role
            ELSE 'EMPLOYEE'
          END AS "participantLevel"

        FROM employees

        JOIN positions
          ON positions.id = employees.position_id

        LEFT JOIN app_users
          ON app_users.employee_id = employees.id
          AND app_users.is_active = TRUE

        WHERE employees.id = ANY($1::integer[])

        FOR UPDATE OF employees
      `,
      [uniqueEmployeeIds],
    );

    if (
      employeeResult.rows.length !==
      uniqueEmployeeIds.length
    ) {
      const foundIds = employeeResult.rows.map(
        (employee) => employee.id,
      );

      const missingIds = uniqueEmployeeIds.filter(
        (employeeId) =>
          !foundIds.includes(employeeId),
      );

      const error = new Error(
        `Employee not found: ${missingIds.join(", ")}`,
      );

      error.statusCode = 404;
      throw error;
    }

    const inactiveEmployees =
      employeeResult.rows.filter(
        (employee) => !employee.isActive,
      );

    if (inactiveEmployees.length > 0) {
      const names = inactiveEmployees.map(
        (employee) =>
          `${employee.firstName} ${employee.lastName}`,
      );

      const error = new Error(
        `Inactive employees cannot be added to a mission: ${names.join(", ")}`,
      );

      error.statusCode = 409;
      throw error;
    }

        const employeeById = new Map(
      employeeResult.rows.map((employee) => [
        employee.id,
        employee,
      ]),
    );

    const missionResult = await client.query(
      `
        INSERT INTO missions (
          title,
          purpose,
          destination,
          mission_type,
          start_date,
          end_date,
          transport_details,
          accommodation_details,
          estimated_transport_cost,
          estimated_accommodation_cost,
          estimated_other_cost,
          currency,
          created_by_user_id
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11, $12, $13
        )
        RETURNING
          id,
          mission_number AS "missionNumber",
          title,
          purpose,
          destination,
          mission_type AS "missionType",
          start_date AS "startDate",
          end_date AS "endDate",
          transport_details AS "transportDetails",
          accommodation_details
            AS "accommodationDetails",
          estimated_transport_cost
            AS "estimatedTransportCost",
          estimated_accommodation_cost
            AS "estimatedAccommodationCost",
          estimated_other_cost
            AS "estimatedOtherCost",
          currency,
          status,
          created_by_user_id AS "createdByUserId",
          created_at AS "createdAt"
      `,
      [
        title,
        purpose,
        destination,
        missionType,
        startDate,
        endDate,
        transportDetails || null,
        accommodationDetails || null,
        estimatedTransportCost,
        estimatedAccommodationCost,
        estimatedOtherCost,
        currency,
        createdByUserId,
      ],
    );

    const mission = missionResult.rows[0];

    const yearResult = await client.query(
      `
        SELECT EXTRACT(
          YEAR FROM $1::date
        )::integer AS year
      `,
      [startDate],
    );

    const missionYear = yearResult.rows[0].year;

    const missionNumber =
      `MIS-${missionYear}-${String(
        mission.id,
      ).padStart(5, "0")}`;

    const numberedMissionResult =
      await client.query(
        `
          UPDATE missions
          SET
            mission_number = $2,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING
            id,
            mission_number AS "missionNumber",
            title,
            purpose,
            destination,
            mission_type AS "missionType",
            start_date AS "startDate",
            end_date AS "endDate",
            transport_details AS "transportDetails",
            accommodation_details
              AS "accommodationDetails",
            estimated_transport_cost
              AS "estimatedTransportCost",
            estimated_accommodation_cost
              AS "estimatedAccommodationCost",
            estimated_other_cost
              AS "estimatedOtherCost",
            currency,
            status,
            created_by_user_id AS "createdByUserId",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [mission.id, missionNumber],
      );

    const insertedParticipants = [];

    for (const participant of participants) {
      const employee = employeeById.get(
        participant.employeeId,
      );

      const participantResult =
        await client.query(
          `
            INSERT INTO mission_participants (
              mission_id,
              employee_id,
              department_id,
              participant_level,
              participant_role,
              per_diem_rate,
              per_diem_days
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING
              id,
              mission_id AS "missionId",
              employee_id AS "employeeId",
              department_id AS "departmentId",
              participant_level AS "participantLevel",
              participant_role AS "participantRole",
              per_diem_rate AS "perDiemRate",
              per_diem_days AS "perDiemDays"
          `,
          [
            mission.id,
            participant.employeeId,
            employee.departmentId,
            employee.participantLevel,
            participant.participantRole || null,
            participant.perDiemRate || 0,
            missionDurationDays,
          ],
        );

      insertedParticipants.push(
        participantResult.rows[0],
      );
    }

    const creatorResult = await client.query(
  `
    SELECT
      id,
      employee_id AS "employeeId",
      role,
      is_active AS "isActive"
    FROM app_users
    WHERE id = $1
  `,
  [createdByUserId],
);

const creator = creatorResult.rows[0];

if (!creator || !creator.isActive) {
  const error = new Error(
    "Mission creator account is inactive or missing",
  );

  error.statusCode = 403;
  throw error;
}

const mayCreateForOthers = [
  "ADMIN",
  "HR",
].includes(creator.role);

if (!mayCreateForOthers) {
  if (!creator.employeeId) {
    const error = new Error(
      "Your account is not linked to an employee record",
    );

    error.statusCode = 403;
    throw error;
  }

  if (
    !uniqueEmployeeIds.includes(
      creator.employeeId,
    )
  ) {
    const error = new Error(
      "You must be included as a participant when creating a mission",
    );

    error.statusCode = 403;
    throw error;
  }
}

    await client.query("COMMIT");

    return {
      ...numberedMissionResult.rows[0],
      participants: insertedParticipants,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findMissionById(
  missionId,viewerUserId,
) {

  const hasAccess =
    await canUserAccessMission({
      missionId,
      userId: viewerUserId,
    });

  if (!hasAccess) {
    return null;
  }
  const missionResult = await pool.query(
  `
    SELECT
      missions.id,

      missions.mission_number
        AS "missionNumber",

      missions.title,
      missions.purpose,
      missions.destination,

      missions.mission_type
        AS "missionType",

      missions.start_date
        AS "startDate",

      missions.end_date
        AS "endDate",

      missions.transport_details
        AS "transportDetails",

      missions.accommodation_details
        AS "accommodationDetails",

      missions.estimated_transport_cost
        AS "estimatedTransportCost",

      missions.estimated_accommodation_cost
        AS "estimatedAccommodationCost",

      missions.estimated_other_cost
        AS "estimatedOtherCost",

      (
        missions.estimated_transport_cost
        + missions.estimated_accommodation_cost
        + missions.estimated_other_cost
      ) AS "baseEstimatedCost",

      missions.currency,
      missions.status,

      missions.rejection_reason
        AS "rejectionReason",

      missions.cancellation_reason
        AS "cancellationReason",

      missions.created_by_user_id
        AS "createdByUserId",

      creator.full_name
        AS "createdBy",

      missions.submitted_at
        AS "submittedAt",

      missions.department_verified_at
        AS "departmentVerifiedAt",

      missions.hr_verified_at
        AS "hrVerifiedAt",

      missions.approved_at
        AS "approvedAt",

      missions.rejected_at
        AS "rejectedAt",

      missions.cancelled_at
        AS "cancelledAt",

      missions.completed_at
        AS "completedAt",

      missions.created_at
        AS "createdAt",

      missions.updated_at
        AS "updatedAt"

    FROM missions

    JOIN app_users AS creator
      ON creator.id =
        missions.created_by_user_id

    WHERE missions.id = $1
  `,
  [missionId],
);

  const mission = missionResult.rows[0];

  if (!mission) {
    return null;
  }

  const participantResult = await pool.query(
  `
    SELECT
      mission_participants.id,
      mission_participants.participant_level
      AS "participantLevel",

      mission_participants.employee_id
        AS "employeeId",

      mission_participants.department_id
        AS "departmentId",

      employees.staff_number
        AS "staffNumber",

      employees.first_name
        AS "firstName",

      employees.last_name
        AS "lastName",

      CONCAT(
        employees.first_name,
        ' ',
        employees.last_name
      ) AS "fullName",

      employees.email,
      employees.is_active AS "isActive",

      positions.title AS "position",
      departments.name AS "department",

      mission_participants.participant_role
        AS "participantRole",

      mission_participants.per_diem_rate
        AS "perDiemRate",

      mission_participants.per_diem_days
        AS "perDiemDays",

      (
        mission_participants.per_diem_rate
        * mission_participants.per_diem_days
      ) AS "totalPerDiem"

    FROM mission_participants

    JOIN employees
      ON employees.id =
        mission_participants.employee_id

    LEFT JOIN positions
      ON positions.id =
        employees.position_id

    JOIN departments
      ON departments.id =
        mission_participants.department_id

    WHERE mission_participants.mission_id = $1

    ORDER BY
      employees.first_name,
      employees.last_name
  `,
  [missionId],
);

  const approvalResult = await pool.query(
    `
      SELECT
        mission_approval_actions.id,
        mission_approval_actions.stage,
        mission_approval_actions.decision,
        mission_approval_actions.comment,

        mission_approval_actions.action_by_user_id
          AS "actionByUserId",

        action_user.full_name AS "actionBy",

        mission_approval_actions.acted_at
          AS "actedAt"

      FROM mission_approval_actions

      JOIN app_users AS action_user
        ON action_user.id =
          mission_approval_actions.action_by_user_id

      WHERE mission_approval_actions.mission_id = $1

      ORDER BY
        mission_approval_actions.acted_at,
        mission_approval_actions.id
    `,
    [missionId],
  );

  const totalPerDiem =
    participantResult.rows.reduce(
      (total, participant) =>
        total + Number(participant.totalPerDiem),
      0,
    );

  const baseEstimatedCost =
    Number(mission.baseEstimatedCost);

  return {
    ...mission,
    totalPerDiem: totalPerDiem.toFixed(2),
    totalEstimatedCost: (
      baseEstimatedCost + totalPerDiem
    ).toFixed(2),
    participants: participantResult.rows,
    approvalHistory: approvalResult.rows,
  };
}

export async function submitMission({
  missionId,
  submittedByUserId,
  submittedByRole,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const missionResult = await client.query(
      `
        SELECT
          id,
          mission_number AS "missionNumber",
          created_by_user_id AS "createdByUserId",
          status
        FROM missions
        WHERE id = $1
        FOR UPDATE
      `,
      [missionId],
    );

    const mission = missionResult.rows[0];

    if (!mission) {
      const error = new Error("Mission not found");
      error.statusCode = 404;
      throw error;
    }

    if (mission.status !== "DRAFT") {
      const error = new Error(
        `Only a draft mission can be submitted. Current status: ${mission.status}`,
      );

      error.statusCode = 409;
      throw error;
    }

    if (
      mission.createdByUserId !==
        submittedByUserId &&
      submittedByRole !== "ADMIN"
    ) {
      const error = new Error(
        "Only the mission creator can submit this mission",
      );

      error.statusCode = 403;
      throw error;
    }

    const participantResult =
      await client.query(
        `
          SELECT
            mission_participants.employee_id
              AS "employeeId",

            mission_participants.department_id
              AS "departmentId",

            mission_participants.participant_level
              AS "participantLevel",

            employees.is_active AS "isActive",

            CONCAT(
              employees.first_name,
              ' ',
              employees.last_name
            ) AS "fullName",

            departments.name AS "department",
            departments.approval_route
              AS "approvalRoute"

          FROM mission_participants

          JOIN employees
            ON employees.id =
              mission_participants.employee_id

          JOIN departments
            ON departments.id =
              mission_participants.department_id

          WHERE mission_participants.mission_id = $1

          FOR UPDATE OF mission_participants
        `,
        [missionId],
      );

    const participants =
      participantResult.rows;

    if (participants.length === 0) {
      const error = new Error(
        "A mission must have at least one participant",
      );

      error.statusCode = 409;
      throw error;
    }

    const inactiveParticipants =
      participants.filter(
        (participant) => !participant.isActive,
      );

    if (inactiveParticipants.length > 0) {
      const error = new Error(
        `Inactive employees cannot participate: ${inactiveParticipants
          .map((participant) => participant.fullName)
          .join(", ")}`,
      );

      error.statusCode = 409;
      throw error;
    }

    const participantEmployeeIds =
      participants.map(
        (participant) => participant.employeeId,
      );

    const regularParticipants =
      participants.filter(
        (participant) =>
          participant.participantLevel ===
          "EMPLOYEE",
      );

    const hasCeoParticipant =
      participants.some(
        (participant) =>
          participant.participantLevel === "CEO",
      );

    const requirements = [];

    /*
     * Determine departments requiring Director
     * verification. CEO's Office bypasses this stage.
     */
    const directorDepartments = new Map();

    for (const participant of regularParticipants) {
      if (participant.approvalRoute === "NONE") {
        const error = new Error(
          `${participant.fullName} belongs to ${participant.department}, which has no approval route`,
        );

        error.statusCode = 409;
        throw error;
      }

      if (
        participant.approvalRoute === "DIRECTOR"
      ) {
        directorDepartments.set(
          participant.departmentId,
          participant.department,
        );
      }
    }

    let sequenceOrder = 1;

    for (
      const [departmentId, departmentName]
      of directorDepartments
    ) {
      const directorResult =
        await client.query(
          `
            SELECT
              app_users.id AS "userId",
              app_users.employee_id
                AS "employeeId",
              app_users.full_name AS "fullName"

            FROM department_directors

            JOIN app_users
              ON app_users.id =
                department_directors.director_user_id

            WHERE
              department_directors.department_id = $1
              AND department_directors.is_active = TRUE
              AND app_users.is_active = TRUE
              AND app_users.role = 'DIRECTOR'

            LIMIT 1
          `,
          [departmentId],
        );

      const director =
        directorResult.rows[0];

      if (!director) {
        const error = new Error(
          `No active Director is assigned to ${departmentName}`,
        );

        error.statusCode = 409;
        throw error;
      }

      if (
        director.employeeId &&
        participantEmployeeIds.includes(
          director.employeeId,
        )
      ) {
        const error = new Error(
          `${director.fullName} cannot verify this mission because they are a participant`,
        );

        error.statusCode = 409;
        throw error;
      }

      requirements.push({
        stage: "DEPARTMENT",
        departmentId,
        assignedUserId: director.userId,
        sequenceOrder,
      });
    }

    if (directorDepartments.size > 0) {
      sequenceOrder += 1;
    }

    /*
     * Regular employees require HR verification,
     * including employees from the CEO's Office.
     */
    if (regularParticipants.length > 0) {
      const hrResult = await client.query(
        `
          SELECT
            id,
            employee_id AS "employeeId",
            full_name AS "fullName"
          FROM app_users
          WHERE role = 'HR'
            AND is_active = TRUE
            AND (
              employee_id IS NULL
              OR NOT (
                employee_id =
                ANY($1::integer[])
              )
            )
          ORDER BY id
          LIMIT 1
        `,
        [participantEmployeeIds],
      );

      const hrUser = hrResult.rows[0];

      if (!hrUser) {
        const error = new Error(
          "No eligible HR user is available to verify this mission",
        );

        error.statusCode = 409;
        throw error;
      }

      requirements.push({
        stage: "HR",
        departmentId: null,
        assignedUserId: hrUser.id,
        sequenceOrder,
      });

      sequenceOrder += 1;
    }

    /*
     * CEO approves every mission unless the CEO
     * participates. The Chairman then approves.
     */
    const finalStage = hasCeoParticipant
      ? "CHAIRMAN"
      : "CEO";

    const finalApproverResult =
      await client.query(
        `
          SELECT
            id,
            employee_id AS "employeeId",
            full_name AS "fullName"
          FROM app_users
          WHERE role = $1
            AND is_active = TRUE
            AND (
              employee_id IS NULL
              OR NOT (
                employee_id =
                ANY($2::integer[])
              )
            )
          ORDER BY id
          LIMIT 1
        `,
        [
          finalStage,
          participantEmployeeIds,
        ],
      );

    const finalApprover =
      finalApproverResult.rows[0];

    if (!finalApprover) {
      const error = new Error(
        `No eligible ${finalStage} approver is available`,
      );

      error.statusCode = 409;
      throw error;
    }

    requirements.push({
      stage: finalStage,
      departmentId: null,
      assignedUserId: finalApprover.id,
      sequenceOrder,
    });

    await client.query(
      `
        DELETE FROM mission_approval_requirements
        WHERE mission_id = $1
      `,
      [missionId],
    );

    const insertedRequirements = [];

    for (const requirement of requirements) {
      const requirementResult =
        await client.query(
          `
            INSERT INTO mission_approval_requirements (
              mission_id,
              stage,
              department_id,
              assigned_user_id,
              sequence_order
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING
              id,
              mission_id AS "missionId",
              stage,
              department_id AS "departmentId",
              assigned_user_id
                AS "assignedUserId",
              sequence_order AS "sequenceOrder",
              status,
              created_at AS "createdAt"
          `,
          [
            missionId,
            requirement.stage,
            requirement.departmentId,
            requirement.assignedUserId,
            requirement.sequenceOrder,
          ],
        );

      insertedRequirements.push(
        requirementResult.rows[0],
      );
    }

    const updateResult = await client.query(
      `
        UPDATE missions
        SET
          status = 'SUBMITTED',
          submitted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING
          id,
          mission_number AS "missionNumber",
          status,
          submitted_at AS "submittedAt",
          updated_at AS "updatedAt"
      `,
      [missionId],
    );

    await client.query("COMMIT");

    return {
      ...updateResult.rows[0],
      approvalRequirements:
        insertedRequirements,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function decideMissionRequirement({
  missionId,
  requirementId,
  decision,
  comment,
  actionByUserId,
  actionByRole,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const requirementResult =
      await client.query(
        `
          SELECT
            requirements.id,
            requirements.mission_id
              AS "missionId",
            requirements.stage,
            requirements.department_id
              AS "departmentId",
            requirements.assigned_user_id
              AS "assignedUserId",
            requirements.sequence_order
              AS "sequenceOrder",
            requirements.status,

            missions.status AS "missionStatus"

          FROM mission_approval_requirements
            AS requirements

          JOIN missions
            ON missions.id =
              requirements.mission_id

          WHERE requirements.id = $1
            AND requirements.mission_id = $2

          FOR UPDATE OF requirements, missions
        `,
        [requirementId, missionId],
      );

    const requirement =
      requirementResult.rows[0];

    if (!requirement) {
      const error = new Error(
        "Mission approval requirement not found",
      );

      error.statusCode = 404;
      throw error;
    }

    if (requirement.status !== "PENDING") {
      const error = new Error(
        `This requirement has already been processed. Current status: ${requirement.status}`,
      );

      error.statusCode = 409;
      throw error;
    }

    const allowedMissionStatuses = [
      "SUBMITTED",
      "DEPARTMENT_VERIFIED",
      "HR_VERIFIED",
    ];

    if (
      !allowedMissionStatuses.includes(
        requirement.missionStatus,
      )
    ) {
      const error = new Error(
        `Mission cannot be processed in status: ${requirement.missionStatus}`,
      );

      error.statusCode = 409;
      throw error;
    }

    const currentSequenceResult =
      await client.query(
        `
          SELECT MIN(sequence_order)
            AS "currentSequence"
          FROM mission_approval_requirements
          WHERE mission_id = $1
            AND status = 'PENDING'
        `,
        [missionId],
      );

    const currentSequence = Number(
      currentSequenceResult.rows[0]
        .currentSequence,
    );

    if (
      requirement.sequenceOrder !==
      currentSequence
    ) {
      const error = new Error(
        "A previous approval stage must be completed first",
      );

      error.statusCode = 409;
      throw error;
    }

    let delegationId = null;

    if (
      requirement.assignedUserId !==
      actionByUserId
    ) {
      if (
        requirement.stage !== "CEO" ||
        actionByRole !== "DEPUTY_CEO"
      ) {
        const error = new Error(
          "You are not assigned to this approval requirement",
        );

        error.statusCode = 403;
        throw error;
      }

      const delegationResult =
        await client.query(
          `
            SELECT id
            FROM approval_delegations
            WHERE delegator_user_id = $1
              AND delegate_user_id = $2
              AND authority_role = 'CEO'
              AND is_active = TRUE
              AND CURRENT_TIMESTAMP
                BETWEEN starts_at AND ends_at
            ORDER BY created_at DESC
            LIMIT 1
          `,
          [
            requirement.assignedUserId,
            actionByUserId,
          ],
        );

      const delegation =
        delegationResult.rows[0];

      if (!delegation) {
        const error = new Error(
          "No active CEO approval delegation exists for this user",
        );

        error.statusCode = 403;
        throw error;
      }

      delegationId = delegation.id;
    }

    const actorResult = await client.query(
      `
        SELECT
          id,
          employee_id AS "employeeId",
          full_name AS "fullName"
        FROM app_users
        WHERE id = $1
          AND is_active = TRUE
      `,
      [actionByUserId],
    );

    const actor = actorResult.rows[0];

    if (!actor) {
      const error = new Error(
        "Approver account is inactive or missing",
      );

      error.statusCode = 403;
      throw error;
    }

    if (actor.employeeId) {
      const conflictResult =
        await client.query(
          `
            SELECT 1
            FROM mission_participants
            WHERE mission_id = $1
              AND employee_id = $2
          `,
          [missionId, actor.employeeId],
        );

      if (conflictResult.rows[0]) {
        const error = new Error(
          "You cannot verify or approve a mission in which you are a participant",
        );

        error.statusCode = 409;
        throw error;
      }
    }

    const expectedPositiveDecision = [
      "DEPARTMENT",
      "HR",
    ].includes(requirement.stage)
      ? "VERIFIED"
      : "APPROVED";

    const allowedDecisions = [
      expectedPositiveDecision,
      "REJECTED",
    ];

    if (!allowedDecisions.includes(decision)) {
      const error = new Error(
        `Decision for ${requirement.stage} must be ${expectedPositiveDecision} or REJECTED`,
      );

      error.statusCode = 400;
      throw error;
    }
// // reject 1
//       if (decision === "REJECTED") {
      
//       await client.query(
//         `
//           UPDATE mission_approval_requirements
//           SET
//             status = 'CANCELLED',
//             completed_by_user_id = $2,
//             completed_at = CURRENT_TIMESTAMP
//           WHERE mission_id = $1
//             AND id <> $3
//             AND status = 'PENDING'
//         `,
//         [
//           missionId,
//           actionByUserId,
//           requirementId,
//         ],
//       );

//       missionUpdateResult = await client.query(
//         `
//           UPDATE missions
//           SET
//             status = 'REJECTED',
//             rejection_reason = $2,
//             rejected_at = CURRENT_TIMESTAMP,
//             updated_at = CURRENT_TIMESTAMP
//           WHERE id = $1
//           RETURNING
//             id,
//             mission_number AS "missionNumber",
//             status,
//             rejection_reason
//               AS "rejectionReason",
//             rejected_at AS "rejectedAt",
//             updated_at AS "updatedAt"
//         `,
//         [
//           missionId,
//           comment.trim(),
//         ],
//       );
//     }

    const updatedRequirementResult =
      await client.query(
        `
          UPDATE mission_approval_requirements
          SET
            status = $2,
            completed_by_user_id = $3,
            completed_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING
            id,
            mission_id AS "missionId",
            stage,
            department_id AS "departmentId",
            assigned_user_id
              AS "assignedUserId",
            sequence_order AS "sequenceOrder",
            status,
            completed_by_user_id
              AS "completedByUserId",
            completed_at AS "completedAt"
        `,
        [
          requirementId,
          decision,
          actionByUserId,
        ],
      );

    await client.query(
      `
        INSERT INTO mission_approval_actions (
          mission_id,
          stage,
          department_id,
          decision,
          action_by_user_id,
          delegation_id,
          comment
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        missionId,
        requirement.stage,
        requirement.departmentId,
        decision,
        actionByUserId,
        delegationId,
        comment?.trim() || null,
      ],
    );
      // Declare this before the rejection condition
      let missionUpdateResult;

      if (decision === "REJECTED") {
        // Cancel every remaining pending approval
        await client.query(
          `
            UPDATE mission_approval_requirements
            SET
              status = 'CANCELLED',
              completed_by_user_id = $2,
              completed_at = CURRENT_TIMESTAMP
            WHERE mission_id = $1
              AND id <> $3
              AND status = 'PENDING'
          `,
          [
            missionId,
            actionByUserId,
            requirementId,
          ],
        );

        // Reject the mission
        missionUpdateResult = await client.query(
          `
            UPDATE missions
            SET
              status = 'REJECTED',
              rejection_reason = $2,
              rejected_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING
              id,
              mission_number AS "missionNumber",
              status,
              rejection_reason AS "rejectionReason",
              rejected_at AS "rejectedAt",
              updated_at AS "updatedAt"
          `,
          [missionId, comment.trim()],
        );
      } else {
        const sameSequenceResult =
          await client.query(
            `
              SELECT COUNT(*)::integer
                AS "pendingCount"
              FROM mission_approval_requirements
              WHERE mission_id = $1
                AND sequence_order = $2
                AND status = 'PENDING'
            `,
            [
              missionId,
              requirement.sequenceOrder,
            ],
          );

      const pendingAtCurrentSequence =
        sameSequenceResult.rows[0]
          .pendingCount;

      if (pendingAtCurrentSequence > 0) {
        missionUpdateResult =
          await client.query(
            `
              UPDATE missions
              SET updated_at = CURRENT_TIMESTAMP
              WHERE id = $1
              RETURNING
                id,
                mission_number
                  AS "missionNumber",
                status,
                updated_at AS "updatedAt"
            `,
            [missionId],
          );
      } else {
        const nextRequirementResult =
          await client.query(
            `
              SELECT
                stage,
                sequence_order AS "sequenceOrder"
              FROM mission_approval_requirements
              WHERE mission_id = $1
                AND status = 'PENDING'
              ORDER BY sequence_order
              LIMIT 1
            `,
            [missionId],
          );

        const nextRequirement =
          nextRequirementResult.rows[0];

        if (!nextRequirement) {
          missionUpdateResult =
            await client.query(
              `
                UPDATE missions
                SET
                  status = 'APPROVED',
                  approved_at =
                    CURRENT_TIMESTAMP,
                  updated_at =
                    CURRENT_TIMESTAMP
                WHERE id = $1
                RETURNING
                  id,
                  mission_number
                    AS "missionNumber",
                  status,
                  approved_at
                    AS "approvedAt",
                  updated_at
                    AS "updatedAt"
              `,
              [missionId],
            );
        } else {
          let nextMissionStatus =
            requirement.missionStatus;

          if (
            nextRequirement.stage === "HR"
          ) {
            nextMissionStatus =
              "DEPARTMENT_VERIFIED";
          } else if (
            ["CEO", "CHAIRMAN"].includes(
              nextRequirement.stage,
            )
          ) {
            nextMissionStatus =
              "HR_VERIFIED";
          }

          const markDepartmentVerified =
          nextMissionStatus ===
          "DEPARTMENT_VERIFIED";

        const markHrVerified =
          nextMissionStatus === "HR_VERIFIED";

        missionUpdateResult =
          await client.query(
            `
              UPDATE missions
              SET
                status = $2,

                department_verified_at =
                  CASE
                    WHEN $3::boolean
                    THEN CURRENT_TIMESTAMP
                    ELSE department_verified_at
                  END,

                hr_verified_at =
                  CASE
                    WHEN $4::boolean
                    THEN CURRENT_TIMESTAMP
                    ELSE hr_verified_at
                  END,

                updated_at = CURRENT_TIMESTAMP

              WHERE id = $1

              RETURNING
                id,

                mission_number
                  AS "missionNumber",

                status,

                department_verified_at
                  AS "departmentVerifiedAt",

                hr_verified_at
                  AS "hrVerifiedAt",

                updated_at
                  AS "updatedAt"
            `,
            [
              missionId,
              nextMissionStatus,
              markDepartmentVerified,
              markHrVerified,
            ],
          );
        }
      }
    }

    await client.query("COMMIT");

    return {
      requirement:
        updatedRequirementResult.rows[0],
      mission: missionUpdateResult.rows[0],
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findPendingMissionApprovals({
  userId,
}) {
  const result = await pool.query(
    `
      SELECT
        requirements.id
          AS "requirementId",

        requirements.mission_id
          AS "missionId",

        requirements.stage,
        requirements.department_id
          AS "departmentId",

        departments.name
          AS "department",

        requirements.assigned_user_id
          AS "assignedUserId",

        assigned_user.full_name
          AS "assignedTo",

        requirements.sequence_order
          AS "sequenceOrder",

        requirements.status
          AS "requirementStatus",

        missions.mission_number
          AS "missionNumber",

        missions.title,
        missions.purpose,
        missions.destination,

        missions.mission_type
          AS "missionType",

        missions.start_date
          AS "startDate",

        missions.end_date
          AS "endDate",

        missions.currency,
        missions.status AS "missionStatus",

        missions.estimated_transport_cost
          AS "estimatedTransportCost",

        missions.estimated_accommodation_cost
          AS "estimatedAccommodationCost",

        missions.estimated_other_cost
          AS "estimatedOtherCost",

        creator.full_name AS "createdBy",

        CASE
          WHEN requirements.assigned_user_id = $1
          THEN FALSE
          ELSE TRUE
        END AS "isDelegated",

        CASE
          WHEN requirements.assigned_user_id = $1
          THEN NULL
          ELSE (
            SELECT delegation.id
            FROM approval_delegations
              AS delegation
            WHERE
              delegation.delegator_user_id =
                requirements.assigned_user_id

              AND delegation.delegate_user_id = $1

              AND delegation.authority_role = 'CEO'

              AND delegation.is_active = TRUE

              AND CURRENT_TIMESTAMP
                BETWEEN delegation.starts_at
                AND delegation.ends_at

            ORDER BY delegation.created_at DESC
            LIMIT 1
          )
        END AS "delegationId",

        COALESCE(
          (
            SELECT JSONB_AGG(
              JSONB_BUILD_OBJECT(
                'employeeId',
                  participant.employee_id,
                'staffNumber',
                  employee.staff_number,
                'fullName',
                  CONCAT(
                    employee.first_name,
                    ' ',
                    employee.last_name
                  ),
                'participantLevel',
                  participant.participant_level,
                'participantRole',
                  participant.participant_role
              )
              ORDER BY
                employee.first_name,
                employee.last_name
            )

            FROM mission_participants
              AS participant

            JOIN employees AS employee
              ON employee.id =
                participant.employee_id

            WHERE participant.mission_id =
              missions.id
          ),
          '[]'::jsonb
        ) AS participants

      FROM mission_approval_requirements
        AS requirements

      JOIN missions
        ON missions.id =
          requirements.mission_id

      JOIN app_users AS assigned_user
        ON assigned_user.id =
          requirements.assigned_user_id

      JOIN app_users AS creator
        ON creator.id =
          missions.created_by_user_id

      LEFT JOIN departments
        ON departments.id =
          requirements.department_id

      JOIN app_users AS logged_in_user
        ON logged_in_user.id = $1
        AND logged_in_user.is_active = TRUE

      WHERE requirements.status = 'PENDING'

        AND missions.status IN (
          'SUBMITTED',
          'DEPARTMENT_VERIFIED',
          'HR_VERIFIED'
        )

        AND requirements.sequence_order = (
          SELECT MIN(pending.sequence_order)
          FROM mission_approval_requirements
            AS pending
          WHERE pending.mission_id =
            requirements.mission_id
            AND pending.status = 'PENDING'
        )

        AND (
          requirements.assigned_user_id = $1

          OR (
            requirements.stage = 'CEO'

            AND logged_in_user.role =
              'DEPUTY_CEO'

            AND EXISTS (
              SELECT 1
              FROM approval_delegations
                AS delegation
              WHERE
                delegation.delegator_user_id =
                  requirements.assigned_user_id

                AND delegation.delegate_user_id =
                  $1

                AND delegation.authority_role =
                  'CEO'

                AND delegation.is_active = TRUE

                AND CURRENT_TIMESTAMP
                  BETWEEN delegation.starts_at
                  AND delegation.ends_at
            )
          )
        )

        AND NOT EXISTS (
          SELECT 1
          FROM mission_participants
            AS conflict_participant
          WHERE
            conflict_participant.mission_id =
              missions.id

            AND conflict_participant.employee_id =
              logged_in_user.employee_id
        )

      ORDER BY
        missions.start_date,
        requirements.sequence_order,
        missions.id
    `,
    [userId],
  );

  return result.rows;
}

async function canUserAccessMission({
  missionId,
  userId,
}) {
  const result = await pool.query(
    `
      SELECT EXISTS (
        SELECT 1

        FROM missions

        JOIN app_users AS viewer
          ON viewer.id = $2
          AND viewer.is_active = TRUE

        WHERE missions.id = $1

          AND (
            viewer.role IN ('ADMIN', 'HR')

            OR missions.created_by_user_id =
              viewer.id

            OR EXISTS (
              SELECT 1
              FROM mission_participants
              WHERE
                mission_participants.mission_id =
                  missions.id

                AND
                mission_participants.employee_id =
                  viewer.employee_id
            )

            OR EXISTS (
              SELECT 1
              FROM mission_approval_requirements
              WHERE
                mission_approval_requirements.mission_id =
                  missions.id

                AND
                mission_approval_requirements.assigned_user_id =
                  viewer.id
            )

            OR EXISTS (
              SELECT 1

              FROM mission_approval_requirements
                AS requirement

              JOIN approval_delegations
                AS delegation
                ON delegation.delegator_user_id =
                  requirement.assigned_user_id

              WHERE
                requirement.mission_id =
                  missions.id

                AND requirement.stage = 'CEO'

                AND delegation.delegate_user_id =
                  viewer.id

                AND delegation.authority_role =
                  'CEO'

                AND delegation.is_active = TRUE

                AND CURRENT_TIMESTAMP
                  BETWEEN delegation.starts_at
                  AND delegation.ends_at
            )
          )
      ) AS "hasAccess"
    `,
    [missionId, userId],
  );

  return result.rows[0].hasAccess;
}