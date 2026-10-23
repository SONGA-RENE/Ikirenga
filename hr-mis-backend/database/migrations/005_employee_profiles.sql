-- =====================================================
-- 005: EXPANDED EMPLOYEE PROFILES
-- =====================================================

-- =====================================================
-- EMPLOYEE PROFILE
-- =====================================================

CREATE TABLE employee_profiles (
  employee_id integer PRIMARY KEY,

  date_of_birth date,

  gender character varying(30),

  nationality character varying(100)
    DEFAULT 'Rwandan',

  marital_status character varying(30),

  primary_phone character varying(30),

  alternative_phone character varying(30),

  personal_email character varying(255),

  residential_address text,

  district character varying(100),

  sector character varying(100),

  -- National ID is encrypted by the application.
  national_id_encrypted text,

  national_id_iv character varying(32),

  national_id_auth_tag
    character varying(32),

  national_id_hash
    character varying(64),

  national_id_last_four
    character varying(4),

  -- Passport is encrypted by the application.
  passport_encrypted text,

  passport_iv character varying(32),

  passport_auth_tag
    character varying(32),

  passport_hash character varying(64),

  passport_last_four
    character varying(4),

  created_by_user_id integer,

  updated_by_user_id integer,

  created_at timestamp with time zone
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at timestamp with time zone
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT employee_profile_employee_fkey
  FOREIGN KEY (employee_id)
  REFERENCES employees(id)
  ON DELETE CASCADE,

  CONSTRAINT employee_profile_created_by_fkey
  FOREIGN KEY (created_by_user_id)
  REFERENCES app_users(id)
  ON DELETE SET NULL,

  CONSTRAINT employee_profile_updated_by_fkey
  FOREIGN KEY (updated_by_user_id)
  REFERENCES app_users(id)
  ON DELETE SET NULL,

  CONSTRAINT valid_employee_gender
  CHECK (
    gender IS NULL
    OR gender IN (
      'MALE',
      'FEMALE',
      'OTHER',
      'PREFER_NOT_TO_SAY'
    )
  ),

  CONSTRAINT valid_employee_marital_status
  CHECK (
    marital_status IS NULL
    OR marital_status IN (
      'SINGLE',
      'MARRIED',
      'DIVORCED',
      'WIDOWED',
      'SEPARATED',
      'PREFER_NOT_TO_SAY'
    )
  ),

  CONSTRAINT valid_employee_birth_date
  CHECK (
    date_of_birth IS NULL
    OR date_of_birth >= DATE '1900-01-01'
  ),

  CONSTRAINT valid_personal_email_case
  CHECK (
    personal_email IS NULL
    OR personal_email =
      LOWER(personal_email)
  ),

  CONSTRAINT complete_national_id_encryption
  CHECK (
    (
      national_id_encrypted IS NULL
      AND national_id_iv IS NULL
      AND national_id_auth_tag IS NULL
      AND national_id_hash IS NULL
      AND national_id_last_four IS NULL
    )
    OR
    (
      national_id_encrypted IS NOT NULL
      AND national_id_iv IS NOT NULL
      AND national_id_auth_tag IS NOT NULL
      AND national_id_hash IS NOT NULL
      AND national_id_last_four IS NOT NULL
    )
  ),

  CONSTRAINT complete_passport_encryption
  CHECK (
    (
      passport_encrypted IS NULL
      AND passport_iv IS NULL
      AND passport_auth_tag IS NULL
      AND passport_hash IS NULL
      AND passport_last_four IS NULL
    )
    OR
    (
      passport_encrypted IS NOT NULL
      AND passport_iv IS NOT NULL
      AND passport_auth_tag IS NOT NULL
      AND passport_hash IS NOT NULL
      AND passport_last_four IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX
  employee_profiles_national_id_unique
ON employee_profiles(national_id_hash)
WHERE national_id_hash IS NOT NULL;

CREATE UNIQUE INDEX
  employee_profiles_passport_unique
ON employee_profiles(passport_hash)
WHERE passport_hash IS NOT NULL;

CREATE INDEX
  employee_profiles_birth_date_index
ON employee_profiles(date_of_birth);

-- =====================================================
-- FAMILY, PARENT AND EMERGENCY CONTACTS
-- =====================================================

CREATE TABLE employee_family_contacts (
  id integer
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  employee_id integer NOT NULL,

  contact_type character varying(30)
    NOT NULL,

  full_name character varying(200)
    NOT NULL,

  relationship character varying(100)
    NOT NULL,

  phone_number character varying(30),

  alternative_phone character varying(30),

  email character varying(255),

  address text,

  is_primary boolean
    NOT NULL
    DEFAULT FALSE,

  created_by_user_id integer,

  updated_by_user_id integer,

  created_at timestamp with time zone
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at timestamp with time zone
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT employee_family_contact_employee_fkey
  FOREIGN KEY (employee_id)
  REFERENCES employees(id)
  ON DELETE CASCADE,

  CONSTRAINT employee_family_contact_created_by_fkey
  FOREIGN KEY (created_by_user_id)
  REFERENCES app_users(id)
  ON DELETE SET NULL,

  CONSTRAINT employee_family_contact_updated_by_fkey
  FOREIGN KEY (updated_by_user_id)
  REFERENCES app_users(id)
  ON DELETE SET NULL,

  CONSTRAINT valid_family_contact_type
  CHECK (
    contact_type IN (
      'PARENT',
      'GUARDIAN',
      'SPOUSE',
      'NEXT_OF_KIN',
      'EMERGENCY_CONTACT',
      'OTHER'
    )
  ),

  CONSTRAINT valid_family_contact_email_case
  CHECK (
    email IS NULL
    OR email = LOWER(email)
  )
);

CREATE INDEX
  employee_family_contacts_employee_index
ON employee_family_contacts(
  employee_id,
  contact_type
);

CREATE UNIQUE INDEX
  one_primary_family_contact_per_employee
ON employee_family_contacts(employee_id)
WHERE is_primary = TRUE;

-- =====================================================
-- EDUCATION HISTORY
-- =====================================================

CREATE TABLE employee_education_records (
  id integer
    GENERATED ALWAYS AS IDENTITY
    PRIMARY KEY,

  employee_id integer NOT NULL,

  education_level character varying(40)
    NOT NULL,

  institution_name character varying(255),

  qualification character varying(255),

  field_of_study character varying(255),

  country character varying(100),

  start_year integer,

  graduation_year integer,

  is_highest_qualification boolean
    NOT NULL
    DEFAULT FALSE,

  notes text,

  created_by_user_id integer,

  updated_by_user_id integer,

  created_at timestamp with time zone
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at timestamp with time zone
    NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT employee_education_employee_fkey
  FOREIGN KEY (employee_id)
  REFERENCES employees(id)
  ON DELETE CASCADE,

  CONSTRAINT employee_education_created_by_fkey
  FOREIGN KEY (created_by_user_id)
  REFERENCES app_users(id)
  ON DELETE SET NULL,

  CONSTRAINT employee_education_updated_by_fkey
  FOREIGN KEY (updated_by_user_id)
  REFERENCES app_users(id)
  ON DELETE SET NULL,

  CONSTRAINT valid_education_level
  CHECK (
    education_level IN (
      'PRIMARY',
      'SECONDARY',
      'TVET',
      'CERTIFICATE',
      'DIPLOMA',
      'BACHELOR',
      'POSTGRADUATE_DIPLOMA',
      'MASTER',
      'DOCTORATE',
      'PROFESSIONAL',
      'OTHER'
    )
  ),

  CONSTRAINT valid_education_years
  CHECK (
    (
      start_year IS NULL
      OR start_year BETWEEN 1900 AND 2200
    )
    AND
    (
      graduation_year IS NULL
      OR graduation_year
        BETWEEN 1900 AND 2200
    )
    AND
    (
      start_year IS NULL
      OR graduation_year IS NULL
      OR graduation_year >= start_year
    )
  )
);

CREATE INDEX
  employee_education_employee_index
ON employee_education_records(
  employee_id,
  graduation_year DESC
);

CREATE UNIQUE INDEX
  one_highest_qualification_per_employee
ON employee_education_records(employee_id)
WHERE is_highest_qualification = TRUE;