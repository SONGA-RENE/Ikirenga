-- =====================================================
-- 006: SENSITIVE EMPLOYEE DATA ACCESS AUDIT
-- =====================================================

CREATE TABLE sensitive_data_access_logs (
  id integer
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  employee_id integer NOT NULL,

  accessed_by_user_id integer NOT NULL,

  identifier_type character varying(30)
    NOT NULL,

  access_outcome character varying(20)
    NOT NULL,

  access_reason text NOT NULL,

  denial_reason text,

  ip_address character varying(100),

  user_agent text,

  accessed_at timestamp with time zone
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT sensitive_access_employee_fkey
  FOREIGN KEY (employee_id)
  REFERENCES employees(id)
  ON DELETE RESTRICT,

  CONSTRAINT sensitive_access_user_fkey
  FOREIGN KEY (accessed_by_user_id)
  REFERENCES app_users(id)
  ON DELETE RESTRICT,

  CONSTRAINT valid_sensitive_identifier_type
  CHECK (
    identifier_type IN (
      'NATIONAL_ID',
      'PASSPORT'
    )
  ),

  CONSTRAINT valid_sensitive_access_outcome
  CHECK (
    access_outcome IN (
      'GRANTED',
      'DENIED'
    )
  )
);

CREATE INDEX sensitive_access_employee_index
ON sensitive_data_access_logs(
  employee_id,
  accessed_at DESC
);

CREATE INDEX sensitive_access_user_index
ON sensitive_data_access_logs(
  accessed_by_user_id,
  accessed_at DESC
);