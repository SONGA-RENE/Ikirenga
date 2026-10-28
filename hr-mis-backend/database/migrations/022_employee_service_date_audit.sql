BEGIN;

CREATE TABLE employee_service_date_history (
  id INTEGER GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  employee_id INTEGER NOT NULL,

  previous_service_start_date DATE,

  new_service_start_date DATE NOT NULL,

  previous_verified BOOLEAN
    NOT NULL DEFAULT FALSE,

  change_reason TEXT NOT NULL,

  changed_by_user_id INTEGER NOT NULL,

  changed_at TIMESTAMPTZ
    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT service_date_history_employee_fkey
    FOREIGN KEY (employee_id)
    REFERENCES employees(id)
    ON DELETE RESTRICT,

  CONSTRAINT service_date_history_user_fkey
    FOREIGN KEY (changed_by_user_id)
    REFERENCES app_users(id)
    ON DELETE RESTRICT,

  CONSTRAINT valid_service_date_change_reason
    CHECK (
      LENGTH(TRIM(change_reason)) >= 5
    )
);

CREATE INDEX employee_service_date_history_index
ON employee_service_date_history (
  employee_id,
  changed_at DESC
);

COMMIT;