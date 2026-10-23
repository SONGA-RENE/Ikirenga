-- =====================================================
-- 003: PSF APPROVED ORGANIZATIONAL STRUCTURE
-- =====================================================
-- Remove the obsolete unit-type constraint.
-- Migration 002 already created valid_department_unit_type
-- with the complete approved set of values.
ALTER TABLE departments
DROP CONSTRAINT IF EXISTS
  valid_organizational_unit_type;

-- PostgreSQL allows multiple NULL values in a normal
-- unique index, so a partial index is unnecessary.
DROP INDEX IF EXISTS
  positions_position_code_unique;

CREATE UNIQUE INDEX
  positions_position_code_unique
ON positions(position_code);
-- =====================================================
-- 1. ORGANIZATIONAL UNITS
-- =====================================================

WITH organizational_units (
  unit_code,
  name,
  unit_type,
  parent_code,
  description
) AS (
  VALUES
    (
      'CEO',
      'CEO''s Office',
      'OFFICE',
      NULL,
      'Office of the Chief Executive Officer'
    ),
    (
      'BOARD-SEC',
      'Board Secretariat',
      'SECRETARIAT',
      'CEO',
      'Administrative support to the Board of Directors'
    ),
    (
      'ADV',
      'Advocacy',
      'DIRECTORATE',
      'CEO',
      'Advocacy Directorate'
    ),
    (
      'BRC',
      'Business Research Center',
      'SUBSIDIARY',
      'ADV',
      'PSF Business Research Center'
    ),
    (
      'FIN',
      'Finance',
      'DIRECTORATE',
      'CEO',
      'Finance Directorate'
    ),
    (
      'IA',
      'Internal Audit',
      'UNIT',
      'CEO',
      'Internal Audit Unit'
    ),
    (
      'HR',
      'Human Resources',
      'DEPARTMENT',
      'CEO',
      'Human Resources Department'
    ),
    (
      'GOV',
      'Governance',
      'DIRECTORATE',
      'CEO',
      'Governance Directorate'
    ),
    (
      'GOV-IR',
      'Institutional Relations',
      'UNIT',
      'GOV',
      'Institutional Relations Unit'
    ),
    (
      'GOV-DPC',
      'District and Provinces Coordination',
      'UNIT',
      'GOV',
      'District and Provinces Coordination Unit'
    ),
    (
      'SPIU',
      'Single Project Implementation Unit',
      'DIRECTORATE',
      'CEO',
      'Single Project Implementation Unit'
    ),
    (
      'IBI',
      'Imanzi Business Institute',
      'SUBSIDIARY',
      'SPIU',
      'PSF subsidiary'
    ),
    (
      'ED',
      'Entrepreneurs Desk',
      'SUBSIDIARY',
      'SPIU',
      'PSF subsidiary'
    ),
    (
      'PLAN',
      'Planning',
      'DIRECTORATE',
      'CEO',
      'Planning Directorate'
    ),
    (
      'PLAN-ME',
      'Monitoring and Evaluation',
      'UNIT',
      'PLAN',
      'Monitoring and Evaluation Unit'
    ),
    (
      'PLAN-COMMS',
      'Communication and Marketing',
      'UNIT',
      'PLAN',
      'Communication and Marketing Unit'
    ),
    (
      'CALL',
      'Call Center',
      'UNIT',
      'PLAN-COMMS',
      'PSF Call Center'
    ),
    (
      'PLAN-PROC',
      'Procurement',
      'UNIT',
      'PLAN',
      'Procurement Unit'
    ),
    (
      'OPS',
      'Operations',
      'DIRECTORATE',
      'CEO',
      'Operations Directorate'
    ),
    (
      'IT',
      'Information Technology',
      'UNIT',
      'OPS',
      'Information Technology Unit'
    ),
    (
      'HEALTH',
      'Health Scheme',
      'SCHEME',
      'OPS',
      'PSF Health Scheme'
    ),
    (
      'LOG',
      'Logistics',
      'UNIT',
      'OPS',
      'Logistics Unit'
    ),
    (
      'EXPO',
      'Expo',
      'UNIT',
      'OPS',
      'PSF Expo Unit'
    ),
    (
      'MEMBERSHIP',
      'Membership and Golden Circle',
      'UNIT',
      'OPS',
      'Membership and Golden Circle Unit'
    )
)
INSERT INTO departments (
  name,
  description,
  unit_type,
  unit_code,
  is_active
)
SELECT
  name,
  description,
  unit_type,
  unit_code,
  TRUE
FROM organizational_units
ON CONFLICT (name)
DO UPDATE SET
  description = EXCLUDED.description,
  unit_type = EXCLUDED.unit_type,
  unit_code = EXCLUDED.unit_code,
  is_active = TRUE,
  updated_at = CURRENT_TIMESTAMP;

-- Assign organizational-unit parents after all units exist.
WITH unit_parents (
  child_code,
  parent_code
) AS (
  VALUES
    ('BOARD-SEC', 'CEO'),
    ('ADV', 'CEO'),
    ('BRC', 'ADV'),
    ('FIN', 'CEO'),
    ('IA', 'CEO'),
    ('HR', 'CEO'),
    ('GOV', 'CEO'),
    ('GOV-IR', 'GOV'),
    ('GOV-DPC', 'GOV'),
    ('SPIU', 'CEO'),
    ('IBI', 'SPIU'),
    ('ED', 'SPIU'),
    ('PLAN', 'CEO'),
    ('PLAN-ME', 'PLAN'),
    ('PLAN-COMMS', 'PLAN'),
    ('CALL', 'PLAN-COMMS'),
    ('PLAN-PROC', 'PLAN'),
    ('OPS', 'CEO'),
    ('IT', 'OPS'),
    ('HEALTH', 'OPS'),
    ('LOG', 'OPS'),
    ('EXPO', 'OPS'),
    ('MEMBERSHIP', 'OPS')
)
UPDATE departments AS child
SET
  parent_department_id = parent.id,
  updated_at = CURRENT_TIMESTAMP
FROM unit_parents
JOIN departments AS parent
  ON parent.unit_code =
    unit_parents.parent_code
WHERE child.unit_code =
  unit_parents.child_code;

-- =====================================================
-- 2. MAP EXISTING POSITIONS
-- =====================================================

UPDATE positions
SET
  position_code = 'CEO-001',
  title = 'Chief Executive Officer',
  seat_number = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 15
  AND position_code IS NULL;

UPDATE positions
SET
  position_code = 'CEO-DCEO-001',
  title = 'Deputy Chief Executive Officer',
  seat_number = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 14
  AND position_code IS NULL;

UPDATE positions
SET
  position_code = 'ADV-DIR-001',
  title = 'Director of Advocacy',
  seat_number = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 7
  AND position_code IS NULL;

UPDATE positions
SET
  position_code = 'FIN-DIR-001',
  title = 'Director of Finance',
  seat_number = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 13
  AND position_code IS NULL;

UPDATE positions
SET
  position_code = 'FIN-OFF-001',
  title = 'Finance Officer',
  seat_number = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 6
  AND position_code IS NULL;

UPDATE positions
SET
  position_code = 'HR-DIR-001',
  title = 'Director of Human Resources',
  seat_number = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 12
  AND position_code IS NULL;

UPDATE positions
SET
  position_code = 'HR-OFF-001',
  title = 'Human Resources Officer',
  seat_number = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 5
  AND position_code IS NULL;

UPDATE positions
SET
  position_code = 'OPS-DIR-001',
  title = 'Director of Operations',
  seat_number = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 8
  AND position_code IS NULL;

UPDATE positions
SET
  position_code = 'IT-HEAD-001',
  title = 'Head of Information Technology',
  seat_number = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 4
  AND position_code IS NULL;

UPDATE positions
SET
  position_code = 'IBI-ED-001',
  title = 'Executive Director',
  seat_number = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 9
  AND position_code IS NULL;

UPDATE positions
SET
  position_code = 'BRC-ED-001',
  title = 'Executive Director',
  seat_number = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 10
  AND position_code IS NULL;

UPDATE positions
SET
  position_code = 'ED-ED-001',
  title = 'Executive Director',
  seat_number = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE id = 11
  AND position_code IS NULL;

-- =====================================================
-- 3. CREATE ALL SINGLE-SEAT POSITIONS
-- =====================================================

WITH approved_positions (
  position_code,
  unit_code,
  title,
  location_name,
  seat_number,
  description
) AS (
  VALUES
    (
      'CEO-001',
      'CEO',
      'Chief Executive Officer',
      NULL,
      1,
      'Chief Executive Officer of PSF'
    ),
    (
      'CEO-DCEO-001',
      'CEO',
      'Deputy Chief Executive Officer',
      NULL,
      1,
      'Deputy Chief Executive Officer of PSF'
    ),
    (
      'BOARD-SEC-001',
      'BOARD-SEC',
      'Secretary of the Board',
      NULL,
      1,
      'Secretary to the PSF Board of Directors'
    ),
    (
      'CEO-ADV-001',
      'CEO',
      'Advisor to the CEO',
      NULL,
      1,
      'Advisor to the Chief Executive Officer'
    ),
    (
      'CEO-LEGAL-001',
      'CEO',
      'Legal Advisor and Policy Analyst',
      NULL,
      1,
      'Legal and policy advisory position'
    ),

    (
      'ADV-DIR-001',
      'ADV',
      'Director of Advocacy',
      NULL,
      1,
      'Director of the Advocacy Directorate'
    ),
    (
      'ADV-PPD-001',
      'ADV',
      'Head of Public-Private Dialogue',
      NULL,
      1,
      'Head of Public-Private Dialogue'
    ),
    (
      'ADV-TRADE-001',
      'ADV',
      'Head of Trade Negotiations',
      NULL,
      1,
      'Head of Trade Negotiations'
    ),

    (
      'BRC-ED-001',
      'BRC',
      'Executive Director',
      NULL,
      1,
      'Executive Director of Business Research Center'
    ),
    (
      'BRC-HQR-001',
      'BRC',
      'Head of Quality Research',
      NULL,
      1,
      'Head of Quality Research'
    ),
    (
      'BRC-PART-001',
      'BRC',
      'Partnership Officer',
      NULL,
      1,
      'Partnership Officer'
    ),
    (
      'BRC-ENV-001',
      'BRC',
      'Environmental Expert',
      NULL,
      1,
      'Environmental Expert'
    ),
    (
      'BRC-HRA-001',
      'BRC',
      'Head of Research and Analysis',
      NULL,
      1,
      'Head of Research and Analysis'
    ),
    (
      'BRC-EA-001',
      'BRC',
      'Assistant to the Executive Director',
      NULL,
      1,
      'Assistant to the Executive Director'
    ),
    (
      'BRC-FIN-001',
      'BRC',
      'Finance Officer',
      NULL,
      1,
      'Finance Officer'
    ),
    (
      'BRC-COMMS-001',
      'BRC',
      'Communication and Marketing Officer',
      NULL,
      1,
      'Communication and Marketing Officer'
    ),

    (
      'FIN-DIR-001',
      'FIN',
      'Director of Finance',
      NULL,
      1,
      'Director of Finance'
    ),
    (
      'FIN-OFF-001',
      'FIN',
      'Finance Officer',
      NULL,
      1,
      'Finance Officer'
    ),
    (
      'FIN-ACC-001',
      'FIN',
      'Accountant',
      NULL,
      1,
      'Accountant'
    ),

    (
      'IA-DIR-001',
      'IA',
      'Director of Internal Audit',
      NULL,
      1,
      'Director of Internal Audit'
    ),

    (
      'HR-DIR-001',
      'HR',
      'Director of Human Resources',
      NULL,
      1,
      'Director of Human Resources'
    ),
    (
      'HR-OFF-001',
      'HR',
      'Human Resources Officer',
      NULL,
      1,
      'Human Resources Officer'
    ),
    (
      'HR-CSO-001',
      'HR',
      'Central Secretariat Officer',
      NULL,
      1,
      'Central Secretariat Officer'
    ),

    (
      'GOV-DIR-001',
      'GOV',
      'Director of Governance',
      NULL,
      1,
      'Director of Governance'
    ),
    (
      'GOV-IR-HEAD-001',
      'GOV-IR',
      'Head of Institutional Relations',
      NULL,
      1,
      'Head of Institutional Relations'
    ),
    (
      'GOV-DPC-HEAD-001',
      'GOV-DPC',
      'Head of District and Provinces Coordination',
      NULL,
      1,
      'Head of District and Provinces Coordination'
    ),

    (
      'SPIU-DIR-001',
      'SPIU',
      'Director of SPIU',
      NULL,
      1,
      'Director of the Single Project Implementation Unit'
    ),
    (
      'SPIU-TRADE-001',
      'SPIU',
      'Head of Trade Cluster',
      NULL,
      1,
      'Head of Trade Cluster'
    ),
    (
      'SPIU-AGRI-001',
      'SPIU',
      'Head of Agriculture Cluster',
      NULL,
      1,
      'Head of Agriculture Cluster'
    ),
    (
      'SPIU-SERVICE-001',
      'SPIU',
      'Head of Services Cluster',
      NULL,
      1,
      'Head of Services Cluster'
    ),
    (
      'SPIU-INDUSTRY-001',
      'SPIU',
      'Head of Industry Cluster',
      NULL,
      1,
      'Head of Industry Cluster'
    ),
    (
      'SPIU-SPECIAL-001',
      'SPIU',
      'Head of Specialized Cluster',
      NULL,
      1,
      'Head of Specialized Cluster'
    ),

    (
      'IBI-ED-001',
      'IBI',
      'Executive Director',
      NULL,
      1,
      'Executive Director of Imanzi Business Institute'
    ),
    (
      'IBI-FIN-001',
      'IBI',
      'Finance Officer',
      NULL,
      1,
      'Finance Officer'
    ),
    (
      'IBI-ACC-001',
      'IBI',
      'Accountant',
      NULL,
      1,
      'Accountant'
    ),
    (
      'IBI-PART-001',
      'IBI',
      'Partnership Officer',
      NULL,
      1,
      'Partnership Officer'
    ),

    (
      'ED-ED-001',
      'ED',
      'Executive Director',
      NULL,
      1,
      'Executive Director of Entrepreneurs Desk'
    ),
    (
      'ED-PART-001',
      'ED',
      'Partnership Expert',
      NULL,
      1,
      'Partnership Expert'
    ),
    (
      'ED-ACC-001',
      'ED',
      'Accountant',
      NULL,
      1,
      'Accountant'
    ),

    (
      'PLAN-DIR-001',
      'PLAN',
      'Director of Planning',
      NULL,
      1,
      'Director of Planning'
    ),
    (
      'PLAN-ME-HEAD-001',
      'PLAN-ME',
      'Head of Monitoring and Evaluation',
      NULL,
      1,
      'Head of Monitoring and Evaluation'
    ),
    (
      'PLAN-COMMS-HEAD-001',
      'PLAN-COMMS',
      'Head of Communication and Marketing',
      NULL,
      1,
      'Head of Communication and Marketing'
    ),
    (
      'PLAN-PROC-HEAD-001',
      'PLAN-PROC',
      'Head of Procurement',
      NULL,
      1,
      'Head of Procurement'
    ),

    (
      'OPS-DIR-001',
      'OPS',
      'Director of Operations',
      NULL,
      1,
      'Director of Operations'
    ),
    (
      'MEMBERSHIP-HEAD-001',
      'MEMBERSHIP',
      'Head of Membership and Golden Circle',
      NULL,
      1,
      'Head of Membership and Golden Circle'
    ),
    (
      'EXPO-HEAD-001',
      'EXPO',
      'Head of Expo',
      NULL,
      1,
      'Head of Expo'
    ),

    (
      'IT-HEAD-001',
      'IT',
      'Head of Information Technology',
      NULL,
      1,
      'Head of Information Technology'
    ),
    (
      'IT-DIG-001',
      'IT',
      'Head of Digitalization',
      NULL,
      1,
      'Head of Digitalization'
    ),
    (
      'IT-SOFT-001',
      'IT',
      'Head of Software Development',
      NULL,
      1,
      'Head of Software Development'
    ),

    (
      'HEALTH-COORD-001',
      'HEALTH',
      'PSF Health Scheme Coordinator',
      NULL,
      1,
      'PSF Health Scheme Coordinator'
    ),
    (
      'HEALTH-ACC-001',
      'HEALTH',
      'Accountant',
      NULL,
      1,
      'Health Scheme Accountant'
    ),
    (
      'HEALTH-EVAL-001',
      'HEALTH',
      'Health Document Evaluation Officer',
      NULL,
      1,
      'Health Document Evaluation Officer'
    ),

    (
      'LOG-HEAD-001',
      'LOG',
      'Head of Logistics',
      NULL,
      1,
      'Head of Logistics'
    ),
    (
      'LOG-MAINT-001',
      'LOG',
      'Maintenance Officer',
      NULL,
      1,
      'Maintenance Officer'
    ),
    (
      'LOG-COURIER-001',
      'LOG',
      'Courier Officer',
      NULL,
      1,
      'Courier Officer'
    ),
    (
      'LOG-CUSTOMER-001',
      'LOG',
      'Customer Relations Officer',
      NULL,
      1,
      'Customer Relations Officer'
    ),
    (
      'LOG-HOSP-001',
      'LOG',
      'Hospitality Assistant',
      NULL,
      1,
      'Hospitality Assistant'
    )
)
INSERT INTO positions (
  department_id,
  position_code,
  title,
  location_name,
  seat_number,
  description,
  is_active
)
SELECT
  departments.id,
  approved_positions.position_code,
  approved_positions.title,
  approved_positions.location_name,
  approved_positions.seat_number,
  approved_positions.description,
  TRUE
FROM approved_positions
JOIN departments
  ON departments.unit_code =
    approved_positions.unit_code
ON CONFLICT (position_code)
DO UPDATE SET
  department_id = EXCLUDED.department_id,
  title = EXCLUDED.title,
  location_name = EXCLUDED.location_name,
  seat_number = EXCLUDED.seat_number,
  description = EXCLUDED.description,
  is_active = TRUE,
  updated_at = CURRENT_TIMESTAMP;

-- =====================================================
-- 4. REPEATED APPROVED SEATS
-- =====================================================

-- Five Region Manager positions.
WITH regions (
  position_code,
  location_name,
  seat_number
) AS (
  VALUES
    ('REG-KIGALI-001', 'City of Kigali', 1),
    ('REG-NORTH-001', 'Northern Province', 2),
    ('REG-SOUTH-001', 'Southern Province', 3),
    ('REG-EAST-001', 'Eastern Province', 4),
    ('REG-WEST-001', 'Western Province', 5)
)
INSERT INTO positions (
  department_id,
  position_code,
  title,
  location_name,
  seat_number,
  description,
  is_active
)
SELECT
  departments.id,
  regions.position_code,
  'Region Manager',
  regions.location_name,
  regions.seat_number,
  'Regional coordination position',
  TRUE
FROM regions
JOIN departments
  ON departments.unit_code = 'GOV-DPC'
ON CONFLICT (position_code)
DO UPDATE SET
  title = EXCLUDED.title,
  department_id = EXCLUDED.department_id,
  location_name = EXCLUDED.location_name,
  seat_number = EXCLUDED.seat_number,
  is_active = TRUE,
  updated_at = CURRENT_TIMESTAMP;

-- Thirty District Manager positions.
WITH districts (
  position_code,
  district,
  seat_number
) AS (
  VALUES
    ('DIST-GASABO-001', 'Gasabo', 1),
    ('DIST-KICUKIRO-001', 'Kicukiro', 2),
    ('DIST-NYARUGENGE-001', 'Nyarugenge', 3),

    ('DIST-BURERA-001', 'Burera', 4),
    ('DIST-GAKENKE-001', 'Gakenke', 5),
    ('DIST-GICUMBI-001', 'Gicumbi', 6),
    ('DIST-MUSANZE-001', 'Musanze', 7),
    ('DIST-RULINDO-001', 'Rulindo', 8),

    ('DIST-GISAGARA-001', 'Gisagara', 9),
    ('DIST-HUYE-001', 'Huye', 10),
    ('DIST-KAMONYI-001', 'Kamonyi', 11),
    ('DIST-MUHANGA-001', 'Muhanga', 12),
    ('DIST-NYAMAGABE-001', 'Nyamagabe', 13),
    ('DIST-NYANZA-001', 'Nyanza', 14),
    ('DIST-NYARUGURU-001', 'Nyaruguru', 15),
    ('DIST-RUHANGO-001', 'Ruhango', 16),

    ('DIST-BUGESERA-001', 'Bugesera', 17),
    ('DIST-GATSIBO-001', 'Gatsibo', 18),
    ('DIST-KAYONZA-001', 'Kayonza', 19),
    ('DIST-KIREHE-001', 'Kirehe', 20),
    ('DIST-NGOMA-001', 'Ngoma', 21),
    ('DIST-NYAGATARE-001', 'Nyagatare', 22),
    ('DIST-RWAMAGANA-001', 'Rwamagana', 23),

    ('DIST-KARONGI-001', 'Karongi', 24),
    ('DIST-NGORORERO-001', 'Ngororero', 25),
    ('DIST-NYABIHU-001', 'Nyabihu', 26),
    ('DIST-NYAMASHEKE-001', 'Nyamasheke', 27),
    ('DIST-RUBAVU-001', 'Rubavu', 28),
    ('DIST-RUSIZI-001', 'Rusizi', 29),
    ('DIST-RUTSIRO-001', 'Rutsiro', 30)
)
INSERT INTO positions (
  department_id,
  position_code,
  title,
  location_name,
  seat_number,
  description,
  is_active
)
SELECT
  departments.id,
  districts.position_code,
  'District Manager',
  districts.district,
  districts.seat_number,
  'District coordination position',
  TRUE
FROM districts
JOIN departments
  ON departments.unit_code = 'GOV-DPC'
ON CONFLICT (position_code)
DO UPDATE SET
  title = EXCLUDED.title,
  department_id = EXCLUDED.department_id,
  location_name = EXCLUDED.location_name,
  seat_number = EXCLUDED.seat_number,
  is_active = TRUE,
  updated_at = CURRENT_TIMESTAMP;

-- Two Call Center Officers.
WITH call_center_seats (
  position_code,
  seat_number
) AS (
  VALUES
    ('CALL-OFF-001', 1),
    ('CALL-OFF-002', 2)
)
INSERT INTO positions (
  department_id,
  position_code,
  title,
  seat_number,
  description,
  is_active
)
SELECT
  departments.id,
  call_center_seats.position_code,
  'Call Center Officer',
  call_center_seats.seat_number,
  'Call Center Officer',
  TRUE
FROM call_center_seats
JOIN departments
  ON departments.unit_code = 'CALL'
ON CONFLICT (position_code)
DO UPDATE SET
  title = EXCLUDED.title,
  department_id = EXCLUDED.department_id,
  seat_number = EXCLUDED.seat_number,
  is_active = TRUE,
  updated_at = CURRENT_TIMESTAMP;

-- Three Driver positions.
WITH driver_seats (
  position_code,
  seat_number
) AS (
  VALUES
    ('LOG-DRIVER-001', 1),
    ('LOG-DRIVER-002', 2),
    ('LOG-DRIVER-003', 3)
)
INSERT INTO positions (
  department_id,
  position_code,
  title,
  seat_number,
  description,
  is_active
)
SELECT
  departments.id,
  driver_seats.position_code,
  'Driver',
  driver_seats.seat_number,
  'Official Driver',
  TRUE
FROM driver_seats
JOIN departments
  ON departments.unit_code = 'LOG'
ON CONFLICT (position_code)
DO UPDATE SET
  title = EXCLUDED.title,
  department_id = EXCLUDED.department_id,
  seat_number = EXCLUDED.seat_number,
  is_active = TRUE,
  updated_at = CURRENT_TIMESTAMP;

-- =====================================================
-- 5. POSITION REPORTING RELATIONSHIPS
-- =====================================================

WITH reporting_lines (
  child_code,
  parent_code
) AS (
  VALUES
    ('CEO-DCEO-001', 'CEO-001'),
    ('BOARD-SEC-001', 'CEO-001'),
    ('CEO-ADV-001', 'CEO-001'),
    ('CEO-LEGAL-001', 'CEO-001'),

    ('ADV-DIR-001', 'CEO-001'),
    ('ADV-PPD-001', 'ADV-DIR-001'),
    ('ADV-TRADE-001', 'ADV-DIR-001'),
    ('BRC-ED-001', 'ADV-DIR-001'),
    ('BRC-HQR-001', 'BRC-ED-001'),
    ('BRC-PART-001', 'BRC-ED-001'),
    ('BRC-ENV-001', 'BRC-ED-001'),
    ('BRC-HRA-001', 'BRC-ED-001'),
    ('BRC-EA-001', 'BRC-ED-001'),
    ('BRC-FIN-001', 'BRC-ED-001'),
    ('BRC-COMMS-001', 'BRC-ED-001'),

    ('FIN-DIR-001', 'CEO-001'),
    ('FIN-OFF-001', 'FIN-DIR-001'),
    ('FIN-ACC-001', 'FIN-DIR-001'),

    ('IA-DIR-001', 'CEO-001'),

    ('HR-DIR-001', 'CEO-001'),
    ('HR-OFF-001', 'HR-DIR-001'),
    ('HR-CSO-001', 'HR-DIR-001'),

    ('GOV-DIR-001', 'CEO-DCEO-001'),
    ('GOV-IR-HEAD-001', 'GOV-DIR-001'),
    ('GOV-DPC-HEAD-001', 'GOV-DIR-001'),

    ('SPIU-DIR-001', 'CEO-DCEO-001'),
    ('SPIU-TRADE-001', 'SPIU-DIR-001'),
    ('SPIU-AGRI-001', 'SPIU-DIR-001'),
    ('SPIU-SERVICE-001', 'SPIU-DIR-001'),
    ('SPIU-INDUSTRY-001', 'SPIU-DIR-001'),
    ('SPIU-SPECIAL-001', 'SPIU-DIR-001'),

    ('IBI-ED-001', 'SPIU-DIR-001'),
    ('IBI-FIN-001', 'IBI-ED-001'),
    ('IBI-ACC-001', 'IBI-ED-001'),
    ('IBI-PART-001', 'IBI-ED-001'),

    ('ED-ED-001', 'SPIU-DIR-001'),
    ('ED-PART-001', 'ED-ED-001'),
    ('ED-ACC-001', 'ED-ED-001'),

    ('PLAN-DIR-001', 'CEO-DCEO-001'),
    ('PLAN-ME-HEAD-001', 'PLAN-DIR-001'),
    ('PLAN-COMMS-HEAD-001', 'PLAN-DIR-001'),
    ('PLAN-PROC-HEAD-001', 'PLAN-DIR-001'),

    ('OPS-DIR-001', 'CEO-DCEO-001'),
    ('MEMBERSHIP-HEAD-001', 'OPS-DIR-001'),
    ('EXPO-HEAD-001', 'OPS-DIR-001'),
    ('IT-HEAD-001', 'OPS-DIR-001'),
    ('IT-DIG-001', 'IT-HEAD-001'),
    ('IT-SOFT-001', 'IT-HEAD-001'),

    ('HEALTH-COORD-001', 'OPS-DIR-001'),
    ('HEALTH-ACC-001', 'HEALTH-COORD-001'),
    ('HEALTH-EVAL-001', 'HEALTH-COORD-001'),

    ('LOG-HEAD-001', 'OPS-DIR-001'),
    ('LOG-MAINT-001', 'LOG-HEAD-001'),
    ('LOG-COURIER-001', 'LOG-HEAD-001'),
    ('LOG-CUSTOMER-001', 'LOG-HEAD-001'),
    ('LOG-HOSP-001', 'LOG-HEAD-001')
)
UPDATE positions AS child
SET
  reports_to_position_id = parent.id,
  updated_at = CURRENT_TIMESTAMP
FROM reporting_lines
JOIN positions AS parent
  ON parent.position_code =
    reporting_lines.parent_code
WHERE child.position_code =
  reporting_lines.child_code;

-- Region Managers report to the Head of District
-- and Provinces Coordination.
UPDATE positions
SET
  reports_to_position_id = (
    SELECT id
    FROM positions
    WHERE position_code =
      'GOV-DPC-HEAD-001'
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE position_code LIKE 'REG-%';

-- District Managers report to their respective Region Manager.
WITH district_reporting (
  district_code,
  region_code
) AS (
  VALUES
    ('DIST-GASABO-001', 'REG-KIGALI-001'),
    ('DIST-KICUKIRO-001', 'REG-KIGALI-001'),
    ('DIST-NYARUGENGE-001', 'REG-KIGALI-001'),

    ('DIST-BURERA-001', 'REG-NORTH-001'),
    ('DIST-GAKENKE-001', 'REG-NORTH-001'),
    ('DIST-GICUMBI-001', 'REG-NORTH-001'),
    ('DIST-MUSANZE-001', 'REG-NORTH-001'),
    ('DIST-RULINDO-001', 'REG-NORTH-001'),

    ('DIST-GISAGARA-001', 'REG-SOUTH-001'),
    ('DIST-HUYE-001', 'REG-SOUTH-001'),
    ('DIST-KAMONYI-001', 'REG-SOUTH-001'),
    ('DIST-MUHANGA-001', 'REG-SOUTH-001'),
    ('DIST-NYAMAGABE-001', 'REG-SOUTH-001'),
    ('DIST-NYANZA-001', 'REG-SOUTH-001'),
    ('DIST-NYARUGURU-001', 'REG-SOUTH-001'),
    ('DIST-RUHANGO-001', 'REG-SOUTH-001'),

    ('DIST-BUGESERA-001', 'REG-EAST-001'),
    ('DIST-GATSIBO-001', 'REG-EAST-001'),
    ('DIST-KAYONZA-001', 'REG-EAST-001'),
    ('DIST-KIREHE-001', 'REG-EAST-001'),
    ('DIST-NGOMA-001', 'REG-EAST-001'),
    ('DIST-NYAGATARE-001', 'REG-EAST-001'),
    ('DIST-RWAMAGANA-001', 'REG-EAST-001'),

    ('DIST-KARONGI-001', 'REG-WEST-001'),
    ('DIST-NGORORERO-001', 'REG-WEST-001'),
    ('DIST-NYABIHU-001', 'REG-WEST-001'),
    ('DIST-NYAMASHEKE-001', 'REG-WEST-001'),
    ('DIST-RUBAVU-001', 'REG-WEST-001'),
    ('DIST-RUSIZI-001', 'REG-WEST-001'),
    ('DIST-RUTSIRO-001', 'REG-WEST-001')
)
UPDATE positions AS district_position
SET
  reports_to_position_id =
    region_position.id,
  updated_at = CURRENT_TIMESTAMP
FROM district_reporting
JOIN positions AS region_position
  ON region_position.position_code =
    district_reporting.region_code
WHERE district_position.position_code =
  district_reporting.district_code;

-- Call Center Officers report to Head of
-- Communication and Marketing.
UPDATE positions
SET
  reports_to_position_id = (
    SELECT id
    FROM positions
    WHERE position_code =
      'PLAN-COMMS-HEAD-001'
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE position_code LIKE 'CALL-OFF-%';

-- Drivers report to Head of Logistics.
UPDATE positions
SET
  reports_to_position_id = (
    SELECT id
    FROM positions
    WHERE position_code =
      'LOG-HEAD-001'
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE position_code LIKE 'LOG-DRIVER-%';

-- =====================================================
-- 6. SAFETY VALIDATION
-- =====================================================

DO $$
DECLARE
  missing_position_codes integer;
  missing_reporting_managers integer;
BEGIN
  SELECT COUNT(*)
  INTO missing_position_codes
  FROM positions
  JOIN departments
    ON departments.id = positions.department_id
  WHERE departments.unit_code IS NOT NULL
    AND positions.position_code IS NULL;

  IF missing_position_codes > 0 THEN
    RAISE NOTICE
      '% legacy positions remain without position codes',
      missing_position_codes;
  END IF;

  SELECT COUNT(*)
  INTO missing_reporting_managers
  FROM positions
  WHERE position_code IS NOT NULL
    AND position_code <> 'CEO-001'
    AND reports_to_position_id IS NULL;

  IF missing_reporting_managers > 0 THEN
    RAISE EXCEPTION
      'Migration stopped: % approved positions have no reporting manager',
      missing_reporting_managers;
  END IF;
END
$$;