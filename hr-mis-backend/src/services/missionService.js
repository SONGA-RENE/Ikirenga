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

export async function completeMission(
  missionId,
  completedByUserId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const missionResult = await client.query(
      `
        SELECT
          id,
          mission_number AS "missionNumber",
          status,
          start_date AS "startDate",
          end_date AS "endDate",

          end_date <= CURRENT_DATE
            AS "missionHasEnded"

        FROM missions

        WHERE id = $1

        FOR UPDATE
      `,
      [missionId],
    );

    const mission = missionResult.rows[0];

    if (!mission) {
      const error = new Error(
        "Mission not found",
      );
      error.statusCode = 404;
      throw error;
    }

    if (mission.status === "COMPLETED") {
      const error = new Error(
        "Mission has already been completed",
      );
      error.statusCode = 409;
      throw error;
    }

    if (mission.status !== "APPROVED") {
      const error = new Error(
        "Only an approved mission can be completed",
      );
      error.statusCode = 409;
      throw error;
    }

    if (!mission.missionHasEnded) {
      const error = new Error(
        "Mission cannot be completed before its end date",
      );
      error.statusCode = 409;
      throw error;
    }

    /*
     * Participant report validation
     */
    const reportStatusResult =
      await client.query(
        `
          SELECT
            COUNT(
              mission_participants.id
            )::integer
              AS "totalParticipants",

            (
              COUNT(mission_reports.id)
              FILTER (
                WHERE mission_reports.status =
                  'SUBMITTED'
              )
            )::integer
              AS "submittedReports",

            (
              COUNT(mission_reports.id)
              FILTER (
                WHERE mission_reports.status =
                  'DRAFT'
              )
            )::integer
              AS "draftReports"

          FROM mission_participants

          LEFT JOIN mission_reports
            ON mission_reports.mission_id =
              mission_participants.mission_id
            AND
              mission_reports
                .submitted_by_employee_id =
              mission_participants.employee_id

          WHERE
            mission_participants.mission_id = $1
        `,
        [missionId],
      );

    const reportStatus =
      reportStatusResult.rows[0];

    if (reportStatus.totalParticipants === 0) {
      const error = new Error(
        "Mission cannot be completed because it has no participants",
      );
      error.statusCode = 409;
      throw error;
    }

    const missingReports =
      reportStatus.totalParticipants -
      reportStatus.submittedReports -
      reportStatus.draftReports;

    if (
      reportStatus.submittedReports !==
      reportStatus.totalParticipants
    ) {
      const error = new Error(
        `Mission cannot be completed: ` +
        `${reportStatus.submittedReports} of ` +
        `${reportStatus.totalParticipants} participant reports submitted, ` +
        `${reportStatus.draftReports} draft, ` +
        `${missingReports} not started`,
      );

      error.statusCode = 409;
      throw error;
    }

    /*
     * Pending disbursement validation
     */
    const disbursementResult =
      await client.query(
        `
          SELECT
            (
              COUNT(*)
              FILTER (
                WHERE status = 'PENDING'
              )
            )::integer
              AS "pendingDisbursements",

            (
              COUNT(*)
              FILTER (
                WHERE status = 'PAID'
              )
            )::integer
              AS "paidDisbursements",

            (
              COUNT(*)
              FILTER (
                WHERE status = 'CANCELLED'
              )
            )::integer
              AS "cancelledDisbursements"

          FROM mission_disbursements

          WHERE mission_id = $1
        `,
        [missionId],
      );

    const disbursementStatus =
      disbursementResult.rows[0];

    if (
      disbursementStatus
        .pendingDisbursements > 0
    ) {
      const error = new Error(
        `Mission cannot be completed: ` +
        `${disbursementStatus.pendingDisbursements} ` +
        `disbursement(s) are still pending`,
      );

      error.statusCode = 409;
      throw error;
    }

    /*
     * Accountable advance and reconciliation
     * validation.
     *
     * One financial obligation exists for each:
     * mission + participant + currency.
     */
    const reconciliationResult =
      await client.query(
        `
          WITH accountable_advances AS (
            SELECT
              disbursements.mission_id,

              disbursements
                .participant_employee_id
                AS employee_id,

              disbursements.currency,

              SUM(disbursements.amount)
                AS accountable_amount

            FROM mission_disbursements
              AS disbursements

            JOIN mission_funding_items
              AS funding
              ON funding.id =
                disbursements.funding_item_id
              AND funding.mission_id =
                disbursements.mission_id

            WHERE
              disbursements.mission_id = $1
              AND disbursements.status = 'PAID'
              AND funding.requires_reconciliation =
                TRUE

            GROUP BY
              disbursements.mission_id,
              disbursements
                .participant_employee_id,
              disbursements.currency
          )

          SELECT
            COUNT(*)::integer
              AS "requiredReconciliations",

            (
              COUNT(*)
              FILTER (
                WHERE reconciliation.id IS NULL
              )
            )::integer
              AS "missingReconciliations",

            (
              COUNT(*)
              FILTER (
                WHERE reconciliation.status =
                  'DRAFT'
              )
            )::integer
              AS "draftReconciliations",

            (
              COUNT(*)
              FILTER (
                WHERE reconciliation.status =
                  'SUBMITTED'
              )
            )::integer
              AS "submittedReconciliations",

            (
              COUNT(*)
              FILTER (
                WHERE reconciliation.status =
                  'REJECTED'
              )
            )::integer
              AS "rejectedReconciliations",

            (
              COUNT(*)
              FILTER (
                WHERE reconciliation.status =
                  'VERIFIED'
              )
            )::integer
              AS "verifiedReconciliations",

            (
              COUNT(*)
              FILTER (
                WHERE
                  reconciliation.status =
                    'VERIFIED'
                  AND reconciliation
                    .amount_received =
                    advances.accountable_amount
                  AND (
                    reconciliation.amount_received
                    - reconciliation
                      .amount_accounted_for
                    - reconciliation
                      .amount_returned
                  ) = 0
              )
            )::integer
              AS "clearedReconciliations",

            (
              COUNT(*)
              FILTER (
                WHERE
                  reconciliation.id IS NOT NULL
                  AND (
                    reconciliation.amount_received
                    <> advances.accountable_amount
                    OR (
                      reconciliation.amount_received
                      - reconciliation
                        .amount_accounted_for
                      - reconciliation
                        .amount_returned
                    ) <> 0
                  )
              )
            )::integer
              AS "invalidReconciliations"

          FROM accountable_advances
            AS advances

          LEFT JOIN
            mission_expense_reconciliations
              AS reconciliation
            ON reconciliation.mission_id =
              advances.mission_id
            AND reconciliation
              .participant_employee_id =
              advances.employee_id
            AND reconciliation.currency =
              advances.currency
        `,
        [missionId],
      );

    const financeStatus =
      reconciliationResult.rows[0];

    if (
      financeStatus.missingReconciliations > 0
    ) {
      const error = new Error(
        `Mission cannot be completed: ` +
        `${financeStatus.missingReconciliations} ` +
        `required financial reconciliation(s) ` +
        `have not been created`,
      );

      error.statusCode = 409;
      throw error;
    }

    const unverifiedReconciliations =
      financeStatus.requiredReconciliations -
      financeStatus.verifiedReconciliations;

    if (unverifiedReconciliations > 0) {
      const error = new Error(
        `Mission cannot be completed: ` +
        `${unverifiedReconciliations} required ` +
        `financial reconciliation(s) are not verified ` +
        `(${financeStatus.draftReconciliations} draft, ` +
        `${financeStatus.submittedReconciliations} submitted, ` +
        `${financeStatus.rejectedReconciliations} rejected)`,
      );

      error.statusCode = 409;
      throw error;
    }

    if (
      financeStatus.invalidReconciliations > 0 ||
      financeStatus.clearedReconciliations !==
        financeStatus
          .requiredReconciliations
    ) {
      const error = new Error(
        "Mission cannot be completed because one or more financial reconciliations have an outstanding balance or no longer match the amount disbursed",
      );

      error.statusCode = 409;
      throw error;
    }

    /*
     * Complete mission
     */
    const updateResult = await client.query(
      `
        UPDATE missions
        SET
          status = 'COMPLETED',
          completed_at = CURRENT_TIMESTAMP,
          completed_by_user_id = $2,
          updated_at = CURRENT_TIMESTAMP

        WHERE
          id = $1
          AND status = 'APPROVED'

        RETURNING
          id,
          mission_number AS "missionNumber",
          status,
          start_date AS "startDate",
          end_date AS "endDate",
          completed_at AS "completedAt",

          completed_by_user_id
            AS "completedByUserId",

          updated_at AS "updatedAt"
      `,
      [
        missionId,
        completedByUserId,
      ],
    );

    if (!updateResult.rows[0]) {
      const error = new Error(
        "Mission status changed while completion was being processed",
      );
      error.statusCode = 409;
      throw error;
    }

    await client.query("COMMIT");

    return {
      ...updateResult.rows[0],

      reportSummary: {
        totalParticipants:
          reportStatus.totalParticipants,

        submittedReports:
          reportStatus.submittedReports,

        draftReports:
          reportStatus.draftReports,

        missingReports,
      },

      financeSummary: {
        pendingDisbursements:
          disbursementStatus
            .pendingDisbursements,

        paidDisbursements:
          disbursementStatus
            .paidDisbursements,

        cancelledDisbursements:
          disbursementStatus
            .cancelledDisbursements,

        requiredReconciliations:
          financeStatus
            .requiredReconciliations,

        verifiedReconciliations:
          financeStatus
            .verifiedReconciliations,

        clearedReconciliations:
          financeStatus
            .clearedReconciliations,

        outstandingReconciliations:
          financeStatus
            .requiredReconciliations -
          financeStatus
            .clearedReconciliations,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function createMissionReportDraft(
  missionId,
  userId,
  reportData,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `
        SELECT
          id,
          employee_id AS "employeeId",
          is_active AS "isActive"
        FROM app_users
        WHERE id = $1
      `,
      [userId],
    );

    const user = userResult.rows[0];

    if (!user || !user.isActive) {
      const error = new Error(
        "Active user account not found",
      );
      error.statusCode = 403;
      throw error;
    }

    if (!user.employeeId) {
      const error = new Error(
        "Your user account is not linked to an employee",
      );
      error.statusCode = 403;
      throw error;
    }

    const missionResult = await client.query(
        `
          SELECT
            id,
            mission_number AS "missionNumber",
            status,
            start_date AS "startDate",
            end_date AS "endDate",
            end_date <= CURRENT_DATE
              AS "missionHasEnded"
          FROM missions
          WHERE id = $1
        `,
        [missionId],
   );

    const mission = missionResult.rows[0];

    if (!mission) {
      const error = new Error("Mission not found");
      error.statusCode = 404;
      throw error;
    }

      if (mission.status !== "APPROVED") {
      const error = new Error(
        "Reports can only be created for approved missions",
      );
      error.statusCode = 409;
      throw error;
    }

    if (!mission.missionHasEnded) {
      const error = new Error(
        "A mission report cannot be created before the mission end date",
      );
      error.statusCode = 409;
      throw error;
    }

    const participantResult = await client.query(
      `
        SELECT id
        FROM mission_participants
        WHERE mission_id = $1
          AND employee_id = $2
      `,
      [missionId, user.employeeId],
    );

    if (participantResult.rowCount === 0) {
      const error = new Error(
        "You cannot report on a mission you did not participate in",
      );
      error.statusCode = 403;
      throw error;
    }

    const existingReportResult =
      await client.query(
        `
          SELECT id, status
          FROM mission_reports
          WHERE mission_id = $1
            AND submitted_by_employee_id = $2
        `,
        [missionId, user.employeeId],
      );

    if (existingReportResult.rowCount > 0) {
      const error = new Error(
        "You already have a report for this mission",
      );
      error.statusCode = 409;
      throw error;
    }

    const cleanOptionalText = (value) => {
      if (typeof value !== "string") {
        return null;
      }

      const cleanedValue = value.trim();

      return cleanedValue || null;
    };

    const reportResult = await client.query(
      `
        INSERT INTO mission_reports (
          mission_id,
          submitted_by_employee_id,
          activities,
          outcomes,
          challenges,
          recommendations,
          conclusion,
          follow_up_actions,
          status
        )
        VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, 'DRAFT'
        )
        RETURNING
          id,
          mission_id AS "missionId",
          submitted_by_employee_id
            AS "submittedByEmployeeId",
          activities,
          outcomes,
          challenges,
          recommendations,
          conclusion,
          follow_up_actions AS "followUpActions",
          status,
          submitted_at AS "submittedAt",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
      `,
      [
        missionId,
        user.employeeId,
        cleanOptionalText(reportData.activities),
        cleanOptionalText(reportData.outcomes),
        cleanOptionalText(reportData.challenges),
        cleanOptionalText(
          reportData.recommendations,
        ),
        cleanOptionalText(reportData.conclusion),
        cleanOptionalText(
          reportData.followUpActions,
        ),
      ],
    );

    await client.query("COMMIT");

    return reportResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");

    if (error.code === "23505") {
      const conflictError = new Error(
        "You already have a report for this mission",
      );
      conflictError.statusCode = 409;
      throw conflictError;
    }

    throw error;
  } finally {
    client.release();
  }
}
export async function updateMissionReportDraft(
  missionId,
  userId,
  reportData,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reportResult = await client.query(
      `
        SELECT
          mission_reports.id,
          mission_reports.status
        FROM mission_reports

        JOIN app_users
          ON app_users.employee_id =
            mission_reports.submitted_by_employee_id

        WHERE mission_reports.mission_id = $1
          AND app_users.id = $2

        FOR UPDATE OF mission_reports
      `,
      [missionId, userId],
    );

    const report = reportResult.rows[0];

    if (!report) {
      const error = new Error(
        "Mission report draft not found",
      );
      error.statusCode = 404;
      throw error;
    }

    if (report.status !== "DRAFT") {
      const error = new Error(
        "A submitted mission report cannot be edited",
      );
      error.statusCode = 409;
      throw error;
    }

    const fieldMap = {
      activities: "activities",
      outcomes: "outcomes",
      challenges: "challenges",
      recommendations: "recommendations",
      conclusion: "conclusion",
      followUpActions: "follow_up_actions",
    };

    const assignments = [];
    const values = [report.id];

    for (const [requestField, databaseColumn]
      of Object.entries(fieldMap)) {
      if (
        Object.hasOwn(
          reportData,
          requestField,
        )
      ) {
        const value =
          typeof reportData[requestField] ===
          "string"
            ? reportData[requestField].trim() ||
              null
            : null;

        values.push(value);

        assignments.push(
          `${databaseColumn} = $${values.length}`,
        );
      }
    }

    if (assignments.length === 0) {
      const error = new Error(
        "Provide at least one report field to update",
      );
      error.statusCode = 400;
      throw error;
    }

    const updatedReportResult =
      await client.query(
        `
          UPDATE mission_reports
          SET
            ${assignments.join(", ")},
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING
            id,
            mission_id AS "missionId",
            submitted_by_employee_id
              AS "submittedByEmployeeId",
            activities,
            outcomes,
            challenges,
            recommendations,
            conclusion,
            follow_up_actions
              AS "followUpActions",
            status,
            submitted_at AS "submittedAt",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        values,
      );

    await client.query("COMMIT");

    return updatedReportResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function submitMissionReport(
  missionId,
  userId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reportResult = await client.query(
     `
        SELECT
          mission_reports.id,
          mission_reports.activities,
          mission_reports.outcomes,
          mission_reports.status,

          missions.status AS "missionStatus",

          missions.end_date <= CURRENT_DATE
            AS "missionHasEnded"

        FROM mission_reports

        JOIN app_users
          ON app_users.employee_id =
            mission_reports.submitted_by_employee_id

        JOIN missions
          ON missions.id =
            mission_reports.mission_id

        WHERE mission_reports.mission_id = $1
          AND app_users.id = $2

        FOR UPDATE OF mission_reports
      `,
      [missionId, userId],
    );

    const report = reportResult.rows[0];

    if (!report) {
      const error = new Error(
        "Mission report draft not found",
      );
      error.statusCode = 404;
      throw error;
    }

      if (report.status === "SUBMITTED") {
        const error = new Error(
          "Mission report has already been submitted",
        );
        error.statusCode = 409;
        throw error;
      }

      if (report.missionStatus !== "APPROVED") {
        const error = new Error(
          "Reports can only be submitted while the mission is approved and awaiting closure",
        );
        error.statusCode = 409;
        throw error;
      }

      if (!report.missionHasEnded) {
        const error = new Error(
          "A report cannot be submitted before the mission end date",
        );
        error.statusCode = 409;
        throw error;
      }

      if (
        !report.activities?.trim() ||
        !report.outcomes?.trim()
      ) {
        const error = new Error(
          "Activities and outcomes are required before submission",
        );
        error.statusCode = 400;
        throw error;
      }
    const submittedReportResult =
      await client.query(
        `
          UPDATE mission_reports
          SET
            activities = TRIM(activities),
            outcomes = TRIM(outcomes),
            status = 'SUBMITTED',
            submitted_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING
            id,
            mission_id AS "missionId",
            submitted_by_employee_id
              AS "submittedByEmployeeId",
            activities,
            outcomes,
            challenges,
            recommendations,
            conclusion,
            follow_up_actions
              AS "followUpActions",
            status,
            submitted_at AS "submittedAt",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        `,
        [report.id],
      );

    await client.query("COMMIT");

    return submittedReportResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function findMyMissionReport(
  missionId,
  userId,
) {
  const result = await pool.query(
    `
      SELECT
        mission_reports.id,
        mission_reports.mission_id
          AS "missionId",

        missions.mission_number
          AS "missionNumber",
        missions.title AS "missionTitle",
        missions.destination,
        missions.start_date AS "startDate",
        missions.end_date AS "endDate",

        mission_reports.submitted_by_employee_id
          AS "submittedByEmployeeId",

        CONCAT(
          employees.first_name,
          ' ',
          employees.last_name
        ) AS "submittedBy",

        mission_reports.activities,
        mission_reports.outcomes,
        mission_reports.challenges,
        mission_reports.recommendations,
        mission_reports.conclusion,

        mission_reports.follow_up_actions
          AS "followUpActions",

        mission_reports.status,
        mission_reports.submitted_at
          AS "submittedAt",
        mission_reports.created_at
          AS "createdAt",
        mission_reports.updated_at
          AS "updatedAt"

      FROM mission_reports

      JOIN missions
        ON missions.id =
          mission_reports.mission_id

      JOIN employees
        ON employees.id =
          mission_reports.submitted_by_employee_id

      JOIN app_users
        ON app_users.employee_id =
          mission_reports.submitted_by_employee_id

      WHERE mission_reports.mission_id = $1
        AND app_users.id = $2
    `,
    [missionId, userId],
  );

  return result.rows[0] || null;
}
export async function findMissionReportTracking(
  missionId,
) {
  const missionResult = await pool.query(
    `
      SELECT
        id,
        mission_number AS "missionNumber",
        title,
        status,
        start_date AS "startDate",
        end_date AS "endDate"
      FROM missions
      WHERE id = $1
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
        mission_participants.employee_id
          AS "employeeId",

        employees.staff_number
          AS "staffNumber",

        CONCAT(
          employees.first_name,
          ' ',
          employees.last_name
        ) AS "fullName",

        positions.title AS "position",
        departments.name AS "department",

        mission_reports.id AS "reportId",

        COALESCE(
          mission_reports.status,
          'NOT_STARTED'
        ) AS "reportStatus",

        mission_reports.submitted_at
          AS "submittedAt",

        mission_reports.created_at
          AS "reportCreatedAt",

        mission_reports.updated_at
          AS "reportUpdatedAt"

      FROM mission_participants

      JOIN employees
        ON employees.id =
          mission_participants.employee_id

      LEFT JOIN positions
        ON positions.id =
          employees.position_id

      LEFT JOIN departments
        ON departments.id =
          mission_participants.department_id

      LEFT JOIN mission_reports
        ON mission_reports.mission_id =
          mission_participants.mission_id
        AND mission_reports.submitted_by_employee_id =
          mission_participants.employee_id

      WHERE mission_participants.mission_id = $1

      ORDER BY
        employees.first_name,
        employees.last_name
    `,
    [missionId],
  );

  const participants = participantResult.rows;

  const summary = {
    totalParticipants: participants.length,

    submittedReports: participants.filter(
      (participant) =>
        participant.reportStatus ===
        "SUBMITTED",
    ).length,

    draftReports: participants.filter(
      (participant) =>
        participant.reportStatus === "DRAFT",
    ).length,

    missingReports: participants.filter(
      (participant) =>
        participant.reportStatus ===
        "NOT_STARTED",
    ).length,
  };

  return {
    ...mission,
    reportSummary: summary,
    participants,
  };
}
export async function findMissionReportById(
  missionId,
  reportId,
) {
  const result = await pool.query(
    `
      SELECT
        mission_reports.id,
        mission_reports.mission_id
          AS "missionId",

        missions.mission_number
          AS "missionNumber",
        missions.title AS "missionTitle",
        missions.destination,
        missions.start_date AS "startDate",
        missions.end_date AS "endDate",

        mission_reports.submitted_by_employee_id
          AS "submittedByEmployeeId",

        employees.staff_number AS "staffNumber",

        CONCAT(
          employees.first_name,
          ' ',
          employees.last_name
        ) AS "submittedBy",

        positions.title AS "position",
        departments.name AS "department",

        mission_reports.activities,
        mission_reports.outcomes,
        mission_reports.challenges,
        mission_reports.recommendations,
        mission_reports.conclusion,

        mission_reports.follow_up_actions
          AS "followUpActions",

        mission_reports.status,
        mission_reports.submitted_at
          AS "submittedAt",
        mission_reports.created_at
          AS "createdAt",
        mission_reports.updated_at
          AS "updatedAt"

      FROM mission_reports

      JOIN missions
        ON missions.id =
          mission_reports.mission_id

      JOIN employees
        ON employees.id =
          mission_reports.submitted_by_employee_id

      LEFT JOIN positions
        ON positions.id =
          employees.position_id

      LEFT JOIN departments
        ON departments.id =
          positions.department_id

      WHERE mission_reports.id = $1
        AND mission_reports.mission_id = $2
    `,
    [reportId, missionId],
  );

    const report = result.rows[0];

    if (!report) {
      return null;
    }

    const documentResult = await pool.query(
      `
        SELECT
          mission_documents.id,
          mission_documents.mission_id
            AS "missionId",
          mission_documents.report_id
            AS "reportId",
          mission_documents.document_type
            AS "documentType",
          mission_documents.original_filename
            AS "originalFilename",
          mission_documents.mime_type
            AS "mimeType",
          mission_documents.file_size
            AS "fileSize",
          mission_documents.uploaded_by_user_id
            AS "uploadedByUserId",
          uploader.full_name AS "uploadedBy",
          mission_documents.created_at
            AS "createdAt"

        FROM mission_documents

        JOIN app_users AS uploader
          ON uploader.id =
            mission_documents.uploaded_by_user_id

        WHERE mission_documents.mission_id = $1
          AND mission_documents.report_id = $2

        ORDER BY
          mission_documents.created_at,
          mission_documents.id
      `,
      [
        missionId,
        reportId,
      ],
    );

    const documents = documentResult.rows.map(
      (document) => ({
        ...document,
        downloadEndpoint:
          `/api/missions/documents/${document.id}/download`,
      }),
    );

    return {
      ...report,
      documentCount: documents.length,
      documents,
    };
    }
export async function saveMissionReportDocument(
  missionId,
  userId,
  documentType,
  file,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const reportResult = await client.query(
      `
        SELECT
          mission_reports.id,
          mission_reports.status,
          mission_reports.submitted_by_employee_id
            AS "employeeId",
          missions.status AS "missionStatus"
          missions.end_date <= CURRENT_DATE
         AS "missionHasEnded"

        FROM mission_reports

        JOIN missions
          ON missions.id =
            mission_reports.mission_id

        JOIN app_users
          ON app_users.employee_id =
            mission_reports.submitted_by_employee_id

        WHERE mission_reports.mission_id = $1
          AND app_users.id = $2

        FOR UPDATE OF mission_reports
      `,
      [missionId, userId],
    );

    const report = reportResult.rows[0];

    if (!report) {
      const error = new Error(
        "Mission report draft not found for the current user",
      );
      error.statusCode = 404;
      throw error;
    }

    if (report.missionStatus !== "APPROVED") {
      const error = new Error(
        "Documents can only be uploaded while the mission is approved and awaiting closure",
      );
      error.statusCode = 409;
      throw error;
    }

    if (!report.missionHasEnded) {
      const error = new Error(
        "Documents cannot be uploaded before the mission end date",
      );
      error.statusCode = 409;
      throw error;
    }

    if (report.status !== "DRAFT") {
      const error = new Error(
        "Documents cannot be added after report submission",
      );
      error.statusCode = 409;
      throw error;
    }

    const documentResult = await client.query(
      `
        INSERT INTO mission_documents (
          mission_id,
          report_id,
          document_type,
          original_filename,
          stored_filename,
          mime_type,
          file_size,
          uploaded_by_user_id
        )
        VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8
        )
        RETURNING
          id,
          mission_id AS "missionId",
          report_id AS "reportId",
          document_type AS "documentType",
          original_filename
            AS "originalFilename",
          stored_filename AS "storedFilename",
          mime_type AS "mimeType",
          file_size AS "fileSize",
          uploaded_by_user_id
            AS "uploadedByUserId",
          created_at AS "createdAt"
      `,
      [
        missionId,
        report.id,
        documentType,
        file.originalname,
        file.filename,
        file.mimetype,
        file.size,
        userId,
      ],
    );

    await client.query("COMMIT");

    return documentResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function findMyMissionReportDocuments(
  missionId,
  userId,
) {
  const result = await pool.query(
    `
      SELECT
        mission_documents.id,
        mission_documents.mission_id
          AS "missionId",
        mission_documents.report_id
          AS "reportId",
        mission_documents.document_type
          AS "documentType",
        mission_documents.original_filename
          AS "originalFilename",
        mission_documents.mime_type
          AS "mimeType",
        mission_documents.file_size
          AS "fileSize",
        mission_documents.created_at
          AS "createdAt"

      FROM mission_documents

      JOIN mission_reports
        ON mission_reports.id =
          mission_documents.report_id

      JOIN app_users
        ON app_users.employee_id =
          mission_reports.submitted_by_employee_id

      WHERE mission_documents.mission_id = $1
        AND app_users.id = $2

      ORDER BY mission_documents.created_at
    `,
    [missionId, userId],
  );

  return result.rows;
}

export async function findAccessibleMissionDocument(
  documentId,
  userId,
  userRole,
) {
  const result = await pool.query(
    `
      SELECT
        mission_documents.id,
        mission_documents.mission_id
          AS "missionId",
        mission_documents.report_id
          AS "reportId",
        mission_documents.original_filename
          AS "originalFilename",
        mission_documents.stored_filename
          AS "storedFilename",
        mission_documents.mime_type
          AS "mimeType",

        report_owner.id AS "ownerUserId"

      FROM mission_documents

      JOIN mission_reports
        ON mission_reports.id =
          mission_documents.report_id

      LEFT JOIN app_users AS report_owner
        ON report_owner.employee_id =
          mission_reports.submitted_by_employee_id

      WHERE mission_documents.id = $1
        AND (
          $2::text IN ('ADMIN', 'HR')
          OR report_owner.id = $3
        )
    `,
    [documentId, userRole, userId],
  );

  return result.rows[0] || null;
}

export async function deleteMyMissionReportDocument(
  missionId,
  documentId,
  userId,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const documentResult = await client.query(
      `
        SELECT
          mission_documents.id,
          mission_documents.original_filename
            AS "originalFilename",
          mission_documents.stored_filename
            AS "storedFilename",
          mission_documents.document_type
            AS "documentType",
          mission_reports.status
            AS "reportStatus"

        FROM mission_documents

        JOIN mission_reports
          ON mission_reports.id =
            mission_documents.report_id

        JOIN app_users
          ON app_users.employee_id =
            mission_reports.submitted_by_employee_id

        WHERE mission_documents.id = $1
          AND mission_documents.mission_id = $2
          AND app_users.id = $3

        FOR UPDATE OF
          mission_documents,
          mission_reports
      `,
      [
        documentId,
        missionId,
        userId,
      ],
    );

    const document =
      documentResult.rows[0];

    if (!document) {
      const error = new Error(
        "Document not found or access denied",
      );
      error.statusCode = 404;
      throw error;
    }

    if (document.reportStatus !== "DRAFT") {
      const error = new Error(
        "Documents cannot be deleted after report submission",
      );
      error.statusCode = 409;
      throw error;
    }

    await client.query(
      `
        DELETE FROM mission_documents
        WHERE id = $1
      `,
      [documentId],
    );

    await client.query("COMMIT");

    return document;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function findMyMissionHistory(
  userId,
  page,
  limit,
) {
  const userResult = await pool.query(
    `
      SELECT
        id,
        employee_id AS "employeeId",
        is_active AS "isActive"
      FROM app_users
      WHERE id = $1
    `,
    [userId],
  );

  const user = userResult.rows[0];

  if (!user || !user.isActive) {
    const error = new Error(
      "Active user account not found",
    );
    error.statusCode = 403;
    throw error;
  }

  if (!user.employeeId) {
    const error = new Error(
      "Your account is not linked to an employee",
    );
    error.statusCode = 403;
    throw error;
  }

  const offset = (page - 1) * limit;

  const [countResult, missionResult] =
    await Promise.all([
      pool.query(
        `
          SELECT COUNT(*)::integer AS "total"
          FROM mission_participants
          WHERE employee_id = $1
        `,
        [user.employeeId],
      ),

      pool.query(
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
            missions.currency,
            missions.status,

            mission_participants.participant_role
              AS "participantRole",

            mission_participants.per_diem_rate
              AS "perDiemRate",

            mission_participants.per_diem_days
              AS "perDiemDays",

            (
              mission_participants.per_diem_rate
              * mission_participants.per_diem_days
            ) AS "totalPerDiem",

            mission_reports.id AS "reportId",

            COALESCE(
              mission_reports.status,
              'NOT_STARTED'
            ) AS "reportStatus",

            mission_reports.submitted_at
              AS "reportSubmittedAt",

            missions.approved_at AS "approvedAt",
            missions.completed_at
              AS "completedAt",

            CASE
              WHEN missions.status <> 'APPROVED'
                THEN missions.status

              WHEN CURRENT_DATE <
                missions.start_date
                THEN 'UPCOMING'

              WHEN CURRENT_DATE <
                missions.end_date
                THEN 'IN_PROGRESS'

              WHEN mission_reports.id IS NULL
                THEN 'REPORT_NOT_STARTED'

              WHEN mission_reports.status = 'DRAFT'
                THEN 'REPORT_DRAFT'

              WHEN mission_reports.status =
                'SUBMITTED'
                THEN 'AWAITING_HR_COMPLETION'

              ELSE missions.status
            END AS "workflowStatus"

          FROM mission_participants

          JOIN missions
            ON missions.id =
              mission_participants.mission_id

          LEFT JOIN mission_reports
            ON mission_reports.mission_id =
              mission_participants.mission_id
            AND
              mission_reports.submitted_by_employee_id =
              mission_participants.employee_id

          WHERE mission_participants.employee_id = $1

          ORDER BY
            missions.start_date DESC,
            missions.id DESC

          LIMIT $2
          OFFSET $3
        `,
        [
          user.employeeId,
          limit,
          offset,
        ],
      ),
    ]);

  const total = countResult.rows[0].total;

  return {
    missions: missionResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages:
        total === 0
          ? 0
          : Math.ceil(total / limit),
    },
  };
}
export async function findMissionDashboardSummary(
  filters,
) {
  const {
    dateFrom = null,
    dateTo = null,
    departmentId = null,
  } = filters;

  const values = [
    dateFrom,
    dateTo,
    departmentId,
  ];

  const missionFilter = `
    ($1::date IS NULL
      OR missions.end_date >= $1::date)

    AND ($2::date IS NULL
      OR missions.start_date <= $2::date)

    AND (
      $3::integer IS NULL
      OR EXISTS (
        SELECT 1
        FROM mission_participants
        WHERE mission_participants.mission_id =
          missions.id
          AND mission_participants.department_id =
            $3::integer
      )
    )
  `;

  const [
    overviewResult,
    statusResult,
    typeResult,
    reportResult,
    costResult,
  ] = await Promise.all([
    pool.query(
      `
        SELECT
          COUNT(*)::integer
            AS "totalMissions",

          COUNT(*) FILTER (
            WHERE status = 'APPROVED'
          )::integer AS "approvedMissions",

          COUNT(*) FILTER (
            WHERE status = 'COMPLETED'
          )::integer AS "completedMissions",

          COUNT(*) FILTER (
            WHERE status = 'REJECTED'
          )::integer AS "rejectedMissions",

          COUNT(*) FILTER (
            WHERE status = 'CANCELLED'
          )::integer AS "cancelledMissions",

          COUNT(*) FILTER (
            WHERE status = 'APPROVED'
              AND CURRENT_DATE < start_date
          )::integer AS "upcomingMissions",

          COUNT(*) FILTER (
            WHERE status = 'APPROVED'
              AND CURRENT_DATE >= start_date
              AND CURRENT_DATE < end_date
          )::integer AS "missionsInProgress",

          COUNT(*) FILTER (
            WHERE status = 'APPROVED'
              AND end_date <= CURRENT_DATE
          )::integer AS "missionsAwaitingClosure"

        FROM missions
        WHERE ${missionFilter}
      `,
      values,
    ),

    pool.query(
      `
        SELECT
          status,
          COUNT(*)::integer AS "count"
        FROM missions
        WHERE ${missionFilter}
        GROUP BY status
        ORDER BY status
      `,
      values,
    ),

    pool.query(
      `
        SELECT
          mission_type AS "missionType",
          COUNT(*)::integer AS "count"
        FROM missions
        WHERE ${missionFilter}
        GROUP BY mission_type
        ORDER BY mission_type
      `,
      values,
    ),

    pool.query(
      `
        WITH filtered_missions AS (
          SELECT
            missions.id,
            missions.status,
            missions.end_date
          FROM missions
          WHERE ${missionFilter}
        )

        SELECT
          COUNT(
            mission_participants.id
          )::integer AS "requiredReports",

          COUNT(mission_reports.id)
            FILTER (
              WHERE mission_reports.status =
                'SUBMITTED'
            )::integer AS "submittedReports",

          COUNT(mission_reports.id)
            FILTER (
              WHERE mission_reports.status =
                'DRAFT'
            )::integer AS "draftReports",

          COUNT(mission_participants.id)
            FILTER (
              WHERE mission_reports.id IS NULL
            )::integer AS "missingReports"

        FROM filtered_missions

        JOIN mission_participants
          ON mission_participants.mission_id =
            filtered_missions.id

        LEFT JOIN mission_reports
          ON mission_reports.mission_id =
            mission_participants.mission_id
          AND
            mission_reports.submitted_by_employee_id =
              mission_participants.employee_id

        WHERE filtered_missions.status
          IN ('APPROVED', 'COMPLETED')
          AND filtered_missions.end_date <=
            CURRENT_DATE
      `,
      values,
    ),

    pool.query(
      `
        WITH filtered_missions AS (
          SELECT
            missions.id,
            missions.currency,

            (
              missions.estimated_transport_cost
              + missions.estimated_accommodation_cost
              + missions.estimated_other_cost
            ) AS "baseCost"

          FROM missions
          WHERE ${missionFilter}
        ),

        mission_costs AS (
          SELECT
            filtered_missions.id,
            filtered_missions.currency,

            filtered_missions."baseCost"
            + COALESCE(
                SUM(
                  mission_participants.per_diem_rate
                  * mission_participants.per_diem_days
                ),
                0
              ) AS "totalEstimatedCost"

          FROM filtered_missions

          LEFT JOIN mission_participants
            ON mission_participants.mission_id =
              filtered_missions.id

          GROUP BY
            filtered_missions.id,
            filtered_missions.currency,
            filtered_missions."baseCost"
        )

        SELECT
          currency,

          SUM("totalEstimatedCost")
            AS "totalEstimatedCost"

        FROM mission_costs
        GROUP BY currency
        ORDER BY currency
      `,
      values,
    ),
  ]);

  const statusBreakdown =
    Object.fromEntries(
      statusResult.rows.map((item) => [
        item.status,
        item.count,
      ]),
    );

  const missionTypeBreakdown =
    Object.fromEntries(
      typeResult.rows.map((item) => [
        item.missionType,
        item.count,
      ]),
    );

  return {
    filters: {
      dateFrom,
      dateTo,
      departmentId,
    },
    overview: overviewResult.rows[0],
    statusBreakdown,
    missionTypeBreakdown,
    reporting: reportResult.rows[0],
    estimatedCostsByCurrency:
      costResult.rows,
  };
}
export async function findOutstandingMissionReports(
  filters,
) {
  const {
    dateFrom = null,
    dateTo = null,
    departmentId = null,
    reportStatus = null,
    page = 1,
    limit = 10,
  } = filters;

  const offset = (page - 1) * limit;

  const filterValues = [
    dateFrom,
    dateTo,
    departmentId,
    reportStatus,
  ];

  const conditions = `
    missions.status IN (
      'APPROVED',
      'COMPLETED'
    )

    AND missions.end_date <= CURRENT_DATE

    AND mission_reports.status IS DISTINCT
      FROM 'SUBMITTED'

    AND (
      $1::date IS NULL
      OR missions.end_date >= $1::date
    )

    AND (
      $2::date IS NULL
      OR missions.start_date <= $2::date
    )

    AND (
      $3::integer IS NULL
      OR mission_participants.department_id =
        $3::integer
    )

    AND (
      $4::text IS NULL
      OR COALESCE(
        mission_reports.status,
        'NOT_STARTED'
      ) = $4::text
    )
  `;

  const fromAndJoins = `
    FROM mission_participants

    JOIN missions
      ON missions.id =
        mission_participants.mission_id

    JOIN employees
      ON employees.id =
        mission_participants.employee_id

    LEFT JOIN positions
      ON positions.id =
        employees.position_id

    LEFT JOIN departments
      ON departments.id =
        mission_participants.department_id

    LEFT JOIN app_users
      ON app_users.employee_id =
        mission_participants.employee_id

    LEFT JOIN mission_reports
      ON mission_reports.mission_id =
        mission_participants.mission_id
      AND
        mission_reports.submitted_by_employee_id =
          mission_participants.employee_id
  `;

  const [countResult, dataResult] =
    await Promise.all([
      pool.query(
        `
          SELECT COUNT(*)::integer AS "total"
          ${fromAndJoins}
          WHERE ${conditions}
        `,
        filterValues,
      ),

      pool.query(
        `
          SELECT
            missions.id AS "missionId",
            missions.mission_number
              AS "missionNumber",
            missions.title AS "missionTitle",
            missions.destination,
            missions.start_date AS "startDate",
            missions.end_date AS "endDate",
            missions.status AS "missionStatus",

            (
              CURRENT_DATE - missions.end_date
            )::integer AS "daysOverdue",

            employees.id AS "employeeId",
            employees.staff_number
              AS "staffNumber",

            CONCAT(
              employees.first_name,
              ' ',
              employees.last_name
            ) AS "fullName",

            employees.email,
            positions.title AS "position",

            mission_participants.department_id
              AS "departmentId",

            departments.name AS "department",

            app_users.id AS "userId",
            app_users.is_active
              AS "userAccountActive",

            CASE
              WHEN app_users.id IS NOT NULL
                AND app_users.is_active = TRUE
                THEN TRUE
              ELSE FALSE
            END AS "canSubmitOnline",

            mission_reports.id AS "reportId",

            COALESCE(
              mission_reports.status,
              'NOT_STARTED'
            ) AS "reportStatus",

            mission_reports.created_at
              AS "reportCreatedAt",

            mission_reports.updated_at
              AS "reportUpdatedAt"

          ${fromAndJoins}

          WHERE ${conditions}

          ORDER BY
            missions.end_date ASC,
            employees.first_name,
            employees.last_name

          LIMIT $5
          OFFSET $6
        `,
        [
          ...filterValues,
          limit,
          offset,
        ],
      ),
    ]);

  const total = countResult.rows[0].total;

  return {
    outstandingReports: dataResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages:
        total === 0
          ? 0
          : Math.ceil(total / limit),
    },
  };
}

export async function findMissionRegister(
  filters,
) {
  const {
    status = null,
    missionType = null,
    departmentId = null,
    employeeId = null,
    destination = null,
    dateFrom = null,
    dateTo = null,
    search = null,
    page = 1,
    limit = 10,
  } = filters;

  const offset = (page - 1) * limit;

  const filterValues = [
    status,
    missionType,
    departmentId,
    employeeId,
    destination,
    dateFrom,
    dateTo,
    search,
  ];

  const conditions = `
    ($1::text IS NULL
      OR missions.status = $1::text)

    AND ($2::text IS NULL
      OR missions.mission_type = $2::text)

    AND (
      $3::integer IS NULL
      OR EXISTS (
        SELECT 1
        FROM mission_participants
        WHERE mission_participants.mission_id =
          missions.id
          AND mission_participants.department_id =
            $3::integer
      )
    )

    AND (
      $4::integer IS NULL
      OR EXISTS (
        SELECT 1
        FROM mission_participants
        WHERE mission_participants.mission_id =
          missions.id
          AND mission_participants.employee_id =
            $4::integer
      )
    )

    AND (
      $5::text IS NULL
      OR missions.destination ILIKE
        '%' || $5::text || '%'
    )

    AND (
      $6::date IS NULL
      OR missions.end_date >= $6::date
    )

    AND (
      $7::date IS NULL
      OR missions.start_date <= $7::date
    )

    AND (
      $8::text IS NULL
      OR missions.mission_number ILIKE
        '%' || $8::text || '%'
      OR missions.title ILIKE
        '%' || $8::text || '%'
      OR missions.purpose ILIKE
        '%' || $8::text || '%'
    )
  `;

  const [countResult, dataResult] =
    await Promise.all([
      pool.query(
        `
          SELECT COUNT(*)::integer AS "total"
          FROM missions
          WHERE ${conditions}
        `,
        filterValues,
      ),

      pool.query(
        `
          SELECT
            missions.id,
            missions.mission_number
              AS "missionNumber",
            missions.title,
            missions.destination,
            missions.mission_type
              AS "missionType",
            missions.start_date
              AS "startDate",
            missions.end_date
              AS "endDate",
            missions.currency,
            missions.status,

            missions.created_by_user_id
              AS "createdByUserId",
            creator.full_name AS "createdBy",

            missions.approved_at AS "approvedAt",
            missions.completed_at
              AS "completedAt",
            missions.created_at AS "createdAt",
            missions.updated_at AS "updatedAt",

            (
              missions.estimated_transport_cost
              + missions.estimated_accommodation_cost
              + missions.estimated_other_cost
            ) AS "baseEstimatedCost",

            participant_summary."participantCount",
            participant_summary."totalPerDiem",
            participant_summary."submittedReports",
            participant_summary."draftReports",
            participant_summary."missingReports",

            (
              missions.estimated_transport_cost
              + missions.estimated_accommodation_cost
              + missions.estimated_other_cost
              + participant_summary."totalPerDiem"
            ) AS "totalEstimatedCost",

            ARRAY(
              SELECT DISTINCT departments.name
              FROM mission_participants
              JOIN departments
                ON departments.id =
                  mission_participants.department_id
              WHERE mission_participants.mission_id =
                missions.id
              ORDER BY departments.name
            ) AS "departments",

            CASE
              WHEN missions.status <> 'APPROVED'
                THEN missions.status

              WHEN CURRENT_DATE <
                missions.start_date
                THEN 'UPCOMING'

              WHEN CURRENT_DATE <
                missions.end_date
                THEN 'IN_PROGRESS'

              WHEN
                participant_summary."participantCount" > 0
                AND
                participant_summary."submittedReports" =
                  participant_summary."participantCount"
                THEN 'AWAITING_HR_COMPLETION'

              WHEN participant_summary."draftReports" > 0
                THEN 'REPORTING_IN_PROGRESS'

              ELSE 'REPORTS_OUTSTANDING'
            END AS "workflowStatus"

          FROM missions

          JOIN app_users AS creator
            ON creator.id =
              missions.created_by_user_id

          LEFT JOIN LATERAL (
            SELECT
              COUNT(
                mission_participants.id
              )::integer AS "participantCount",

              COALESCE(
                SUM(
                  mission_participants.per_diem_rate
                  * mission_participants.per_diem_days
                ),
                0
              ) AS "totalPerDiem",

              COUNT(mission_reports.id)
                FILTER (
                  WHERE mission_reports.status =
                    'SUBMITTED'
                )::integer
                AS "submittedReports",

              COUNT(mission_reports.id)
                FILTER (
                  WHERE mission_reports.status =
                    'DRAFT'
                )::integer
                AS "draftReports",

              COUNT(mission_participants.id)
                FILTER (
                  WHERE mission_reports.id IS NULL
                )::integer
                AS "missingReports"

            FROM mission_participants

            LEFT JOIN mission_reports
              ON mission_reports.mission_id =
                mission_participants.mission_id
              AND
                mission_reports.submitted_by_employee_id =
                  mission_participants.employee_id

            WHERE mission_participants.mission_id =
              missions.id
          ) AS participant_summary
            ON TRUE

          WHERE ${conditions}

          ORDER BY
            missions.start_date DESC,
            missions.id DESC

          LIMIT $9
          OFFSET $10
        `,
        [
          ...filterValues,
          limit,
          offset,
        ],
      ),
    ]);

  const total = countResult.rows[0].total;

  return {
    missions: dataResult.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages:
        total === 0
          ? 0
          : Math.ceil(total / limit),
    },
  };
}
export async function saveReconciliationReceipt(
  missionId,
  reconciliationId,
  itemId,
  userId,
  file,
) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const contextResult = await client.query(
      `
        SELECT
          items.id AS "itemId",
          reconciliation.id
            AS "reconciliationId",
          reconciliation.status
            AS "reconciliationStatus",
          missions.status AS "missionStatus",
          app_users.employee_id
            AS "userEmployeeId",
          reconciliation.participant_employee_id
            AS "participantEmployeeId"

        FROM mission_reconciliation_items
          AS items

        JOIN mission_expense_reconciliations
          AS reconciliation
          ON reconciliation.id =
            items.reconciliation_id

        JOIN missions
          ON missions.id =
            reconciliation.mission_id

        JOIN app_users
          ON app_users.id = $4

        WHERE
          missions.id = $1
          AND reconciliation.id = $2
          AND items.id = $3

        FOR UPDATE OF
          items,
          reconciliation,
          missions
      `,
      [
        missionId,
        reconciliationId,
        itemId,
        userId,
      ],
    );

    const context = contextResult.rows[0];

    if (!context) {
      const error = new Error(
        "Reconciliation expense item not found",
      );
      error.statusCode = 404;
      throw error;
    }

    if (
      context.userEmployeeId !==
      context.participantEmployeeId
    ) {
      const error = new Error(
        "You cannot upload receipts for another participant",
      );
      error.statusCode = 403;
      throw error;
    }

    if (
      !["DRAFT", "REJECTED"].includes(
        context.reconciliationStatus,
      )
    ) {
      const error = new Error(
        "Receipts can only be uploaded while the reconciliation is draft or rejected",
      );
      error.statusCode = 409;
      throw error;
    }

    if (context.missionStatus !== "APPROVED") {
      const error = new Error(
        "The mission is no longer open for receipt uploads",
      );
      error.statusCode = 409;
      throw error;
    }

    const insertResult = await client.query(
      `
        INSERT INTO mission_documents (
          mission_id,
          report_id,
          reconciliation_item_id,
          document_type,
          original_filename,
          stored_filename,
          mime_type,
          file_size,
          uploaded_by_user_id
        )
        VALUES (
          $1,
          NULL,
          $2,
          'RECEIPT',
          $3,
          $4,
          $5,
          $6,
          $7
        )
        RETURNING
          id,
          mission_id AS "missionId",

          reconciliation_item_id
            AS "reconciliationItemId",

          document_type AS "documentType",

          original_filename
            AS "originalFilename",

          stored_filename
            AS "storedFilename",

          mime_type AS "mimeType",
          file_size AS "fileSize",

          uploaded_by_user_id
            AS "uploadedByUserId",

          created_at AS "createdAt"
      `,
      [
        missionId,
        itemId,
        file.originalname,
        file.filename,
        file.mimetype,
        file.size,
        userId,
      ],
    );

    await client.query(
      `
        UPDATE mission_reconciliation_items
        SET
          receipt_exception_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `,
      [itemId],
    );

    await client.query("COMMIT");

    return insertResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findReconciliationReceipts({
  missionId,
  reconciliationId,
  itemId,
  userId,
  userRole,
}) {
  const contextResult = await pool.query(
    `
      SELECT
        reconciliation.participant_employee_id
          AS "participantEmployeeId",

        app_users.employee_id
          AS "userEmployeeId"

      FROM mission_reconciliation_items
        AS items

      JOIN mission_expense_reconciliations
        AS reconciliation
        ON reconciliation.id =
          items.reconciliation_id

      JOIN app_users
        ON app_users.id = $4

      WHERE
        reconciliation.mission_id = $1
        AND reconciliation.id = $2
        AND items.id = $3
    `,
    [
      missionId,
      reconciliationId,
      itemId,
      userId,
    ],
  );

  const context = contextResult.rows[0];

  if (!context) {
    return null;
  }

  const privilegedRoles = new Set([
    "ADMIN",
    "HR",
    "FINANCE",
  ]);

  if (
    !privilegedRoles.has(userRole) &&
    context.userEmployeeId !==
      context.participantEmployeeId
  ) {
    const error = new Error(
      "You do not have permission to view these receipts",
    );
    error.statusCode = 403;
    throw error;
  }

  const result = await pool.query(
    `
      SELECT
        documents.id,
        documents.mission_id AS "missionId",

        documents.reconciliation_item_id
          AS "reconciliationItemId",

        documents.document_type
          AS "documentType",

        documents.original_filename
          AS "originalFilename",

        documents.mime_type AS "mimeType",
        documents.file_size AS "fileSize",

        documents.uploaded_by_user_id
          AS "uploadedByUserId",

        uploader.full_name AS "uploadedBy",

        documents.created_at AS "createdAt"

      FROM mission_documents AS documents

      JOIN app_users AS uploader
        ON uploader.id =
          documents.uploaded_by_user_id

      WHERE
        documents.mission_id = $1
        AND documents.reconciliation_item_id = $2
        AND documents.document_type = 'RECEIPT'

      ORDER BY
        documents.created_at,
        documents.id
    `,
    [
      missionId,
      itemId,
    ],
  );

  return result.rows;
}

export async function findAccessibleReconciliationReceipt({
  missionId,
  documentId,
  userId,
  userRole,
}) {
  const result = await pool.query(
    `
      SELECT
        documents.id,
        documents.mission_id AS "missionId",

        documents.reconciliation_item_id
          AS "reconciliationItemId",

        documents.document_type
          AS "documentType",

        documents.original_filename
          AS "originalFilename",

        documents.stored_filename
          AS "storedFilename",

        documents.mime_type AS "mimeType",
        documents.file_size AS "fileSize",

        reconciliation.participant_employee_id
          AS "participantEmployeeId",

        viewer.employee_id
          AS "viewerEmployeeId"

      FROM mission_documents AS documents

      JOIN mission_reconciliation_items AS items
        ON items.id =
          documents.reconciliation_item_id

      JOIN mission_expense_reconciliations
        AS reconciliation
        ON reconciliation.id =
          items.reconciliation_id

      JOIN app_users AS viewer
        ON viewer.id = $3

      WHERE
        documents.id = $1
        AND documents.mission_id = $2
        AND documents.document_type = 'RECEIPT'
        AND documents.reconciliation_item_id
          IS NOT NULL
    `,
    [
      documentId,
      missionId,
      userId,
    ],
  );

  const document = result.rows[0];

  if (!document) {
    return null;
  }

  const privilegedRoles = new Set([
    "ADMIN",
    "HR",
    "FINANCE",
  ]);

  if (
    !privilegedRoles.has(userRole) &&
    document.viewerEmployeeId !==
      document.participantEmployeeId
  ) {
    return null;
  }

  delete document.viewerEmployeeId;
  delete document.participantEmployeeId;

  return document;
}

export async function deleteMyReconciliationReceipt({
  missionId,
  reconciliationId,
  itemId,
  documentId,
  userId,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `
        SELECT
          documents.id,

          documents.document_type
            AS "documentType",

          documents.original_filename
            AS "originalFilename",

          documents.stored_filename
            AS "storedFilename",

          reconciliation.status
            AS "reconciliationStatus",

          reconciliation.participant_employee_id
            AS "participantEmployeeId",

          missions.status AS "missionStatus",

          app_users.employee_id
            AS "userEmployeeId"

        FROM mission_documents AS documents

        JOIN mission_reconciliation_items AS items
          ON items.id =
            documents.reconciliation_item_id

        JOIN mission_expense_reconciliations
          AS reconciliation
          ON reconciliation.id =
            items.reconciliation_id

        JOIN missions
          ON missions.id =
            reconciliation.mission_id

        JOIN app_users
          ON app_users.id = $5

        WHERE
          documents.id = $1
          AND documents.mission_id = $2
          AND reconciliation.id = $3
          AND items.id = $4
          AND documents.document_type = 'RECEIPT'

        FOR UPDATE OF
          documents,
          items,
          reconciliation,
          missions
      `,
      [
        documentId,
        missionId,
        reconciliationId,
        itemId,
        userId,
      ],
    );

    const document = result.rows[0];

    if (!document) {
      const error = new Error(
        "Receipt not found",
      );
      error.statusCode = 404;
      throw error;
    }

    if (
      document.userEmployeeId !==
      document.participantEmployeeId
    ) {
      const error = new Error(
        "You cannot delete another participant's receipt",
      );
      error.statusCode = 403;
      throw error;
    }

    if (
      !["DRAFT", "REJECTED"].includes(
        document.reconciliationStatus,
      )
    ) {
      const error = new Error(
        "Receipts cannot be deleted after reconciliation submission",
      );
      error.statusCode = 409;
      throw error;
    }

    if (document.missionStatus !== "APPROVED") {
      const error = new Error(
        "The mission is no longer open for receipt deletion",
      );
      error.statusCode = 409;
      throw error;
    }

    await client.query(
      `
        DELETE FROM mission_documents
        WHERE id = $1
      `,
      [documentId],
    );

    await client.query("COMMIT");

    return {
      id: document.id,
      documentType: document.documentType,
      originalFilename:
        document.originalFilename,
      storedFilename:
        document.storedFilename,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}