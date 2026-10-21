--
-- PostgreSQL database dump
--

\restrict jbRkzVvFzDsQ0ePFnM7tk6kqpjkKS2C5dGMgdhEaCpktcxdIMFG70lm46UFLql9

-- Dumped from database version 18.6 (Postgres.app)
-- Dumped by pg_dump version 18.6 (Postgres.app)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: EXTENSION btree_gist; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION btree_gist IS 'support for indexing common datatypes in GiST';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_users (
    id integer NOT NULL,
    employee_id integer,
    full_name character varying(150) NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(100) NOT NULL,
    role character varying(20) DEFAULT 'EMPLOYEE'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    auth_version integer DEFAULT 0 NOT NULL,
    must_change_password boolean DEFAULT false NOT NULL,
    CONSTRAINT lowercase_user_email CHECK (((email)::text = lower((email)::text))),
    CONSTRAINT valid_auth_version CHECK ((auth_version >= 0)),
    CONSTRAINT valid_user_role CHECK (((role)::text = ANY ((ARRAY['ADMIN'::character varying, 'HR'::character varying, 'EMPLOYEE'::character varying, 'DIRECTOR'::character varying, 'FINANCE'::character varying, 'DEPUTY_CEO'::character varying, 'CEO'::character varying, 'CHAIRMAN'::character varying])::text[])))
);


--
-- Name: app_users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.app_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: app_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.app_users_id_seq OWNED BY public.app_users.id;


--
-- Name: approval_delegations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.approval_delegations (
    id integer NOT NULL,
    delegator_user_id integer NOT NULL,
    delegate_user_id integer NOT NULL,
    authority_role character varying(20) NOT NULL,
    reason text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by_user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    revoked_at timestamp with time zone,
    revoked_by_user_id integer,
    CONSTRAINT different_delegation_users CHECK ((delegator_user_id <> delegate_user_id)),
    CONSTRAINT valid_delegation_authority CHECK (((authority_role)::text = ANY ((ARRAY['CEO'::character varying, 'CHAIRMAN'::character varying])::text[]))),
    CONSTRAINT valid_delegation_dates CHECK ((ends_at > starts_at))
);


--
-- Name: approval_delegations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.approval_delegations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: approval_delegations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.approval_delegations_id_seq OWNED BY public.approval_delegations.id;


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    contract_type character varying(50) NOT NULL,
    start_date date NOT NULL,
    end_date date,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    termination_date date,
    termination_reason text,
    CONSTRAINT valid_contract_dates CHECK (((end_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT valid_contract_status CHECK (((status)::text = ANY ((ARRAY['UPCOMING'::character varying, 'ACTIVE'::character varying, 'EXPIRED'::character varying, 'TERMINATED'::character varying, 'RENEWED'::character varying, 'CANCELLED'::character varying])::text[]))),
    CONSTRAINT valid_termination_details CHECK ((((status)::text <> 'TERMINATED'::text) OR ((termination_date IS NOT NULL) AND (termination_reason IS NOT NULL) AND (length(TRIM(BOTH FROM termination_reason)) >= 5) AND (end_date = termination_date))))
);


--
-- Name: contracts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.contracts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: contracts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.contracts_id_seq OWNED BY public.contracts.id;


--
-- Name: department_directors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.department_directors (
    id integer NOT NULL,
    department_id integer NOT NULL,
    director_user_id integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    assigned_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ended_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT valid_director_assignment_dates CHECK (((ended_at IS NULL) OR (ended_at >= assigned_at)))
);


--
-- Name: department_directors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.department_directors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: department_directors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.department_directors_id_seq OWNED BY public.department_directors.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    unit_type character varying(20) DEFAULT 'DEPARTMENT'::character varying NOT NULL,
    parent_department_id integer,
    approval_route character varying(20) DEFAULT 'DIRECTOR'::character varying NOT NULL,
    CONSTRAINT valid_organizational_approval_route CHECK (((approval_route)::text = ANY ((ARRAY['DIRECTOR'::character varying, 'CEO'::character varying, 'NONE'::character varying])::text[]))),
    CONSTRAINT valid_organizational_unit_type CHECK (((unit_type)::text = ANY ((ARRAY['DEPARTMENT'::character varying, 'UNIT'::character varying, 'SUBSIDIARY'::character varying, 'OFFICE'::character varying, 'UNASSIGNED'::character varying])::text[])))
);


--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.departments ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.departments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: employee_leave_entitlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_leave_entitlements (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    leave_type_id integer NOT NULL,
    leave_year integer NOT NULL,
    entitled_days integer NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT valid_entitled_days CHECK ((entitled_days >= 0)),
    CONSTRAINT valid_leave_year CHECK (((leave_year >= 2000) AND (leave_year <= 2100)))
);


--
-- Name: employee_leave_entitlements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employee_leave_entitlements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employee_leave_entitlements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employee_leave_entitlements_id_seq OWNED BY public.employee_leave_entitlements.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    staff_number character varying(30) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    position_id integer NOT NULL,
    photo_filename character varying(255)
);


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.employees ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.employees_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    leave_type_id integer NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    requested_days integer NOT NULL,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    decision_note text,
    decision_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    decided_by_user_id integer,
    CONSTRAINT valid_leave_dates CHECK ((end_date >= start_date)),
    CONSTRAINT valid_leave_request_status CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'CANCELLED'::character varying])::text[]))),
    CONSTRAINT valid_requested_days CHECK ((requested_days > 0))
);


--
-- Name: leave_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;


--
-- Name: leave_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_types (
    id integer NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(100) NOT NULL,
    annual_entitlement integer,
    is_paid boolean DEFAULT true NOT NULL,
    requires_attachment boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT valid_annual_entitlement CHECK (((annual_entitlement IS NULL) OR (annual_entitlement >= 0))),
    CONSTRAINT valid_leave_type_code CHECK (((code)::text ~ '^[A-Z][A-Z0-9_]*$'::text))
);


--
-- Name: leave_types_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.leave_types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: leave_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.leave_types_id_seq OWNED BY public.leave_types.id;


--
-- Name: mission_approval_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_approval_actions (
    id integer NOT NULL,
    mission_id integer NOT NULL,
    stage character varying(20) NOT NULL,
    decision character varying(20) NOT NULL,
    action_by_user_id integer NOT NULL,
    comment text,
    acted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    department_id integer,
    delegation_id integer,
    CONSTRAINT valid_department_approval_stage CHECK (((((stage)::text = 'DEPARTMENT'::text) AND (department_id IS NOT NULL)) OR (((stage)::text = ANY ((ARRAY['HR'::character varying, 'CEO'::character varying, 'CHAIRMAN'::character varying])::text[])) AND (department_id IS NULL)))),
    CONSTRAINT valid_mission_approval_stage CHECK (((stage)::text = ANY ((ARRAY['DEPARTMENT'::character varying, 'HR'::character varying, 'CEO'::character varying, 'CHAIRMAN'::character varying])::text[]))),
    CONSTRAINT valid_mission_decision CHECK (((decision)::text = ANY ((ARRAY['VERIFIED'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: mission_approval_actions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mission_approval_actions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mission_approval_actions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mission_approval_actions_id_seq OWNED BY public.mission_approval_actions.id;


--
-- Name: mission_approval_requirements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_approval_requirements (
    id integer NOT NULL,
    mission_id integer NOT NULL,
    stage character varying(20) NOT NULL,
    department_id integer,
    assigned_user_id integer,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    completed_by_user_id integer,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    sequence_order integer DEFAULT 1 NOT NULL,
    CONSTRAINT valid_requirement_completion CHECK (((((status)::text = 'PENDING'::text) AND (completed_by_user_id IS NULL) AND (completed_at IS NULL)) OR (((status)::text <> 'PENDING'::text) AND (completed_by_user_id IS NOT NULL) AND (completed_at IS NOT NULL)))),
    CONSTRAINT valid_requirement_department CHECK (((((stage)::text = 'DEPARTMENT'::text) AND (department_id IS NOT NULL)) OR (((stage)::text = ANY ((ARRAY['HR'::character varying, 'CEO'::character varying, 'CHAIRMAN'::character varying])::text[])) AND (department_id IS NULL)))),
    CONSTRAINT valid_requirement_sequence CHECK ((sequence_order > 0)),
    CONSTRAINT valid_requirement_stage CHECK (((stage)::text = ANY ((ARRAY['DEPARTMENT'::character varying, 'HR'::character varying, 'CEO'::character varying, 'CHAIRMAN'::character varying])::text[]))),
    CONSTRAINT valid_requirement_status CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'VERIFIED'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'CANCELLED'::character varying])::text[])))
);


--
-- Name: mission_approval_requirements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mission_approval_requirements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mission_approval_requirements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mission_approval_requirements_id_seq OWNED BY public.mission_approval_requirements.id;


--
-- Name: mission_disbursements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_disbursements (
    id integer NOT NULL,
    mission_id integer NOT NULL,
    funding_item_id integer NOT NULL,
    participant_employee_id integer,
    payment_type character varying(30) NOT NULL,
    amount numeric(14,2) NOT NULL,
    currency character varying(10) DEFAULT 'RWF'::character varying NOT NULL,
    payment_reference character varying(100),
    paid_at timestamp with time zone,
    paid_by_user_id integer,
    status character varying(20) DEFAULT 'PENDING'::character varying NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id integer NOT NULL,
    updated_by_user_id integer,
    cancelled_by_user_id integer,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    CONSTRAINT paid_disbursement_details CHECK ((((status)::text <> 'PAID'::text) OR ((paid_at IS NOT NULL) AND (paid_by_user_id IS NOT NULL)))),
    CONSTRAINT valid_cancelled_disbursement CHECK ((((status)::text <> 'CANCELLED'::text) OR ((cancelled_by_user_id IS NOT NULL) AND (cancelled_at IS NOT NULL) AND (NULLIF(TRIM(BOTH FROM cancellation_reason), ''::text) IS NOT NULL)))),
    CONSTRAINT valid_mission_disbursement_amount CHECK ((amount > (0)::numeric)),
    CONSTRAINT valid_mission_disbursement_status CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'PAID'::character varying, 'CANCELLED'::character varying])::text[]))),
    CONSTRAINT valid_mission_payment_type CHECK (((payment_type)::text = ANY ((ARRAY['ADVANCE'::character varying, 'PER_DIEM'::character varying, 'DIRECT_PAYMENT'::character varying, 'REIMBURSEMENT'::character varying, 'REFUND'::character varying])::text[])))
);


--
-- Name: mission_disbursements_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.mission_disbursements ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.mission_disbursements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mission_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_documents (
    id integer NOT NULL,
    mission_id integer NOT NULL,
    report_id integer,
    document_type character varying(30) NOT NULL,
    original_filename character varying(255) NOT NULL,
    stored_filename character varying(255) NOT NULL,
    mime_type character varying(100),
    file_size integer,
    uploaded_by_user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reconciliation_item_id integer,
    CONSTRAINT valid_mission_document_context CHECK ((NOT ((report_id IS NOT NULL) AND (reconciliation_item_id IS NOT NULL)))),
    CONSTRAINT valid_mission_document_type CHECK (((document_type)::text = ANY ((ARRAY['INVITATION'::character varying, 'APPROVAL'::character varying, 'TICKET'::character varying, 'RECEIPT'::character varying, 'REPORT_ATTACHMENT'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT valid_mission_file_size CHECK (((file_size IS NULL) OR (file_size >= 0)))
);


--
-- Name: mission_documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mission_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mission_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mission_documents_id_seq OWNED BY public.mission_documents.id;


--
-- Name: mission_expense_reconciliations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_expense_reconciliations (
    id integer NOT NULL,
    mission_id integer NOT NULL,
    participant_employee_id integer CONSTRAINT mission_expense_reconciliation_participant_employee_id_not_null NOT NULL,
    status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    amount_received numeric(14,2) DEFAULT 0 NOT NULL,
    amount_accounted_for numeric(14,2) DEFAULT 0 NOT NULL,
    amount_returned numeric(14,2) DEFAULT 0 NOT NULL,
    currency character varying(10) DEFAULT 'RWF'::character varying NOT NULL,
    declaration_note text,
    submitted_at timestamp with time zone,
    verified_by_user_id integer,
    verified_at timestamp with time zone,
    rejected_by_user_id integer,
    rejected_at timestamp with time zone,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    submitted_by_user_id integer,
    created_by_user_id integer,
    CONSTRAINT valid_reconciliation_amounts CHECK (((amount_received >= (0)::numeric) AND (amount_accounted_for >= (0)::numeric) AND (amount_returned >= (0)::numeric) AND (amount_returned <= amount_received))),
    CONSTRAINT valid_reconciliation_balance CHECK (((amount_accounted_for + amount_returned) <= amount_received)),
    CONSTRAINT valid_reconciliation_rejection CHECK ((((status)::text <> 'REJECTED'::text) OR ((rejected_by_user_id IS NOT NULL) AND (rejected_at IS NOT NULL) AND (NULLIF(TRIM(BOTH FROM rejection_reason), ''::text) IS NOT NULL)))),
    CONSTRAINT valid_reconciliation_status CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'VERIFIED'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT valid_reconciliation_submission CHECK ((((status)::text = 'DRAFT'::text) OR (submitted_at IS NOT NULL))),
    CONSTRAINT valid_reconciliation_verification CHECK ((((status)::text <> 'VERIFIED'::text) OR ((verified_by_user_id IS NOT NULL) AND (verified_at IS NOT NULL))))
);


--
-- Name: mission_expense_reconciliations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.mission_expense_reconciliations ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.mission_expense_reconciliations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mission_funding_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_funding_items (
    id integer NOT NULL,
    mission_id integer NOT NULL,
    participant_employee_id integer,
    cost_category character varying(30) NOT NULL,
    funding_source character varying(30) NOT NULL,
    funding_organization character varying(200),
    estimated_amount numeric(14,2) DEFAULT 0 NOT NULL,
    approved_amount numeric(14,2) DEFAULT 0 NOT NULL,
    currency character varying(10) DEFAULT 'RWF'::character varying NOT NULL,
    requires_reconciliation boolean DEFAULT false NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id integer NOT NULL,
    updated_by_user_id integer,
    CONSTRAINT external_funder_requires_name CHECK ((((funding_source)::text <> ALL ((ARRAY['HOST_INSTITUTION'::character varying, 'PARTNER'::character varying, 'OTHER'::character varying])::text[])) OR (NULLIF(TRIM(BOTH FROM funding_organization), ''::text) IS NOT NULL))),
    CONSTRAINT valid_mission_funding_amounts CHECK (((estimated_amount >= (0)::numeric) AND (approved_amount >= (0)::numeric))),
    CONSTRAINT valid_mission_funding_category CHECK (((cost_category)::text = ANY ((ARRAY['TRANSPORT'::character varying, 'ACCOMMODATION'::character varying, 'PER_DIEM'::character varying, 'MEALS'::character varying, 'VISA'::character varying, 'INSURANCE'::character varying, 'COMMUNICATION'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT valid_mission_funding_currency CHECK (((length(TRIM(BOTH FROM currency)) >= 3) AND (length(TRIM(BOTH FROM currency)) <= 10))),
    CONSTRAINT valid_mission_funding_source CHECK (((funding_source)::text = ANY ((ARRAY['PSF'::character varying, 'HOST_INSTITUTION'::character varying, 'PARTNER'::character varying, 'EMPLOYEE_REIMBURSEMENT'::character varying, 'OTHER'::character varying])::text[])))
);


--
-- Name: mission_funding_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.mission_funding_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.mission_funding_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mission_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_participants (
    id integer NOT NULL,
    mission_id integer NOT NULL,
    employee_id integer NOT NULL,
    participant_role character varying(100),
    per_diem_rate numeric(14,2) DEFAULT 0 NOT NULL,
    per_diem_days integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    department_id integer NOT NULL,
    participant_level character varying(20) DEFAULT 'EMPLOYEE'::character varying NOT NULL,
    CONSTRAINT valid_mission_participant_level CHECK (((participant_level)::text = ANY ((ARRAY['EMPLOYEE'::character varying, 'DIRECTOR'::character varying, 'DEPUTY_CEO'::character varying, 'CEO'::character varying])::text[]))),
    CONSTRAINT valid_per_diem CHECK (((per_diem_rate >= (0)::numeric) AND (per_diem_days >= 0)))
);


--
-- Name: mission_participants_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mission_participants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mission_participants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mission_participants_id_seq OWNED BY public.mission_participants.id;


--
-- Name: mission_reconciliation_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_reconciliation_actions (
    id integer NOT NULL,
    reconciliation_id integer NOT NULL,
    decision character varying(20) NOT NULL,
    comment text,
    amount_received numeric(14,2) NOT NULL,
    amount_accounted_for numeric(14,2) NOT NULL,
    amount_returned numeric(14,2) NOT NULL,
    outstanding_balance numeric(14,2) NOT NULL,
    action_by_user_id integer NOT NULL,
    acted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT rejected_action_requires_comment CHECK ((((decision)::text <> 'REJECTED'::text) OR (NULLIF(TRIM(BOTH FROM comment), ''::text) IS NOT NULL))),
    CONSTRAINT valid_reconciliation_action_decision CHECK (((decision)::text = ANY ((ARRAY['VERIFIED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: mission_reconciliation_actions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.mission_reconciliation_actions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.mission_reconciliation_actions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mission_reconciliation_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_reconciliation_items (
    id integer NOT NULL,
    reconciliation_id integer NOT NULL,
    cost_category character varying(30) NOT NULL,
    description text NOT NULL,
    expense_date date NOT NULL,
    amount numeric(14,2) NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    receipt_exception_reason text,
    CONSTRAINT valid_receipt_exception_reason CHECK (((receipt_exception_reason IS NULL) OR (NULLIF(TRIM(BOTH FROM receipt_exception_reason), ''::text) IS NOT NULL))),
    CONSTRAINT valid_reconciliation_item_amount CHECK ((amount > (0)::numeric)),
    CONSTRAINT valid_reconciliation_item_category CHECK (((cost_category)::text = ANY ((ARRAY['TRANSPORT'::character varying, 'ACCOMMODATION'::character varying, 'MEALS'::character varying, 'VISA'::character varying, 'INSURANCE'::character varying, 'COMMUNICATION'::character varying, 'OTHER'::character varying])::text[]))),
    CONSTRAINT valid_reconciliation_item_description CHECK ((NULLIF(TRIM(BOTH FROM description), ''::text) IS NOT NULL))
);


--
-- Name: mission_reconciliation_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.mission_reconciliation_items ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.mission_reconciliation_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: mission_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mission_reports (
    id integer NOT NULL,
    mission_id integer NOT NULL,
    submitted_by_employee_id integer NOT NULL,
    activities text,
    outcomes text,
    challenges text,
    recommendations text,
    conclusion text,
    status character varying(20) DEFAULT 'DRAFT'::character varying NOT NULL,
    submitted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    follow_up_actions text,
    CONSTRAINT valid_mission_report_status CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying])::text[]))),
    CONSTRAINT valid_report_submission_state CHECK (((((status)::text = 'DRAFT'::text) AND (submitted_at IS NULL)) OR (((status)::text = 'SUBMITTED'::text) AND (submitted_at IS NOT NULL))))
);


--
-- Name: mission_reports_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.mission_reports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: mission_reports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.mission_reports_id_seq OWNED BY public.mission_reports.id;


--
-- Name: missions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.missions (
    id integer NOT NULL,
    mission_number character varying(40),
    title character varying(200) NOT NULL,
    purpose text NOT NULL,
    destination character varying(200) NOT NULL,
    mission_type character varying(20) DEFAULT 'LOCAL'::character varying NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    transport_details text,
    accommodation_details text,
    estimated_transport_cost numeric(14,2) DEFAULT 0 NOT NULL,
    estimated_accommodation_cost numeric(14,2) DEFAULT 0 NOT NULL,
    estimated_other_cost numeric(14,2) DEFAULT 0 NOT NULL,
    currency character varying(10) DEFAULT 'RWF'::character varying NOT NULL,
    status character varying(30) DEFAULT 'DRAFT'::character varying NOT NULL,
    rejection_reason text,
    cancellation_reason text,
    created_by_user_id integer NOT NULL,
    submitted_at timestamp with time zone,
    department_verified_at timestamp with time zone,
    hr_verified_at timestamp with time zone,
    approved_at timestamp with time zone,
    rejected_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_by_user_id integer,
    CONSTRAINT valid_mission_costs CHECK (((estimated_transport_cost >= (0)::numeric) AND (estimated_accommodation_cost >= (0)::numeric) AND (estimated_other_cost >= (0)::numeric))),
    CONSTRAINT valid_mission_dates CHECK ((end_date >= start_date)),
    CONSTRAINT valid_mission_status CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SUBMITTED'::character varying, 'DEPARTMENT_VERIFIED'::character varying, 'HR_VERIFIED'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'CANCELLED'::character varying, 'COMPLETED'::character varying])::text[]))),
    CONSTRAINT valid_mission_type CHECK (((mission_type)::text = ANY ((ARRAY['LOCAL'::character varying, 'INTERNATIONAL'::character varying])::text[])))
);


--
-- Name: missions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.missions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: missions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.missions_id_seq OWNED BY public.missions.id;


--
-- Name: positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.positions (
    id integer NOT NULL,
    department_id integer NOT NULL,
    title character varying(150) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: positions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.positions ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.positions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: public_holidays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.public_holidays (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    holiday_date date NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: public_holidays_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.public_holidays_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: public_holidays_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.public_holidays_id_seq OWNED BY public.public_holidays.id;


--
-- Name: staff_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_cards (
    id integer NOT NULL,
    employee_id integer NOT NULL,
    card_number character varying(40),
    verification_token uuid NOT NULL,
    issued_at date DEFAULT CURRENT_DATE NOT NULL,
    expires_at date NOT NULL,
    status character varying(20) DEFAULT 'ACTIVE'::character varying NOT NULL,
    revoked_at timestamp with time zone,
    revocation_reason text,
    created_by_user_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    revocation_type character varying(20),
    revoked_by_user_id integer,
    CONSTRAINT valid_revocation_type CHECK (((revocation_type IS NULL) OR ((revocation_type)::text = ANY ((ARRAY['LOST'::character varying, 'STOLEN'::character varying, 'DAMAGED'::character varying, 'TERMINATED'::character varying, 'OTHER'::character varying])::text[])))),
    CONSTRAINT valid_staff_card_dates CHECK ((expires_at > issued_at)),
    CONSTRAINT valid_staff_card_status CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'REVOKED'::character varying, 'REPLACED'::character varying])::text[])))
);


--
-- Name: staff_cards_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.staff_cards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: staff_cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.staff_cards_id_seq OWNED BY public.staff_cards.id;


--
-- Name: app_users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users ALTER COLUMN id SET DEFAULT nextval('public.app_users_id_seq'::regclass);


--
-- Name: approval_delegations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_delegations ALTER COLUMN id SET DEFAULT nextval('public.approval_delegations_id_seq'::regclass);


--
-- Name: contracts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts ALTER COLUMN id SET DEFAULT nextval('public.contracts_id_seq'::regclass);


--
-- Name: department_directors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_directors ALTER COLUMN id SET DEFAULT nextval('public.department_directors_id_seq'::regclass);


--
-- Name: employee_leave_entitlements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_entitlements ALTER COLUMN id SET DEFAULT nextval('public.employee_leave_entitlements_id_seq'::regclass);


--
-- Name: leave_requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);


--
-- Name: leave_types id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types ALTER COLUMN id SET DEFAULT nextval('public.leave_types_id_seq'::regclass);


--
-- Name: mission_approval_actions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_approval_actions ALTER COLUMN id SET DEFAULT nextval('public.mission_approval_actions_id_seq'::regclass);


--
-- Name: mission_approval_requirements id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_approval_requirements ALTER COLUMN id SET DEFAULT nextval('public.mission_approval_requirements_id_seq'::regclass);


--
-- Name: mission_documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_documents ALTER COLUMN id SET DEFAULT nextval('public.mission_documents_id_seq'::regclass);


--
-- Name: mission_participants id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_participants ALTER COLUMN id SET DEFAULT nextval('public.mission_participants_id_seq'::regclass);


--
-- Name: mission_reports id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reports ALTER COLUMN id SET DEFAULT nextval('public.mission_reports_id_seq'::regclass);


--
-- Name: missions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions ALTER COLUMN id SET DEFAULT nextval('public.missions_id_seq'::regclass);


--
-- Name: public_holidays id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_holidays ALTER COLUMN id SET DEFAULT nextval('public.public_holidays_id_seq'::regclass);


--
-- Name: staff_cards id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_cards ALTER COLUMN id SET DEFAULT nextval('public.staff_cards_id_seq'::regclass);


--
-- Name: app_users app_users_employee_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_employee_id_key UNIQUE (employee_id);


--
-- Name: app_users app_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_pkey PRIMARY KEY (id);


--
-- Name: approval_delegations approval_delegations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_delegations
    ADD CONSTRAINT approval_delegations_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: department_directors department_directors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_directors
    ADD CONSTRAINT department_directors_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: employee_leave_entitlements employee_leave_entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_entitlements
    ADD CONSTRAINT employee_leave_entitlements_pkey PRIMARY KEY (id);


--
-- Name: employees employees_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_email_key UNIQUE (email);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: employees employees_staff_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_staff_number_key UNIQUE (staff_number);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: leave_types leave_types_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_code_key UNIQUE (code);


--
-- Name: leave_types leave_types_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_name_key UNIQUE (name);


--
-- Name: leave_types leave_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_types
    ADD CONSTRAINT leave_types_pkey PRIMARY KEY (id);


--
-- Name: mission_approval_actions mission_approval_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_approval_actions
    ADD CONSTRAINT mission_approval_actions_pkey PRIMARY KEY (id);


--
-- Name: mission_approval_requirements mission_approval_requirements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_approval_requirements
    ADD CONSTRAINT mission_approval_requirements_pkey PRIMARY KEY (id);


--
-- Name: mission_disbursements mission_disbursements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_disbursements
    ADD CONSTRAINT mission_disbursements_pkey PRIMARY KEY (id);


--
-- Name: mission_documents mission_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_documents
    ADD CONSTRAINT mission_documents_pkey PRIMARY KEY (id);


--
-- Name: mission_expense_reconciliations mission_expense_reconciliations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_expense_reconciliations
    ADD CONSTRAINT mission_expense_reconciliations_pkey PRIMARY KEY (id);


--
-- Name: mission_funding_items mission_funding_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_funding_items
    ADD CONSTRAINT mission_funding_items_pkey PRIMARY KEY (id);


--
-- Name: mission_participants mission_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_participants
    ADD CONSTRAINT mission_participants_pkey PRIMARY KEY (id);


--
-- Name: mission_reconciliation_actions mission_reconciliation_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reconciliation_actions
    ADD CONSTRAINT mission_reconciliation_actions_pkey PRIMARY KEY (id);


--
-- Name: mission_reconciliation_items mission_reconciliation_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reconciliation_items
    ADD CONSTRAINT mission_reconciliation_items_pkey PRIMARY KEY (id);


--
-- Name: mission_reports mission_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reports
    ADD CONSTRAINT mission_reports_pkey PRIMARY KEY (id);


--
-- Name: missions missions_mission_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_mission_number_key UNIQUE (mission_number);


--
-- Name: missions missions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_pkey PRIMARY KEY (id);


--
-- Name: contracts no_overlapping_employee_contracts; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT no_overlapping_employee_contracts EXCLUDE USING gist (employee_id WITH =, daterange(start_date, COALESCE(end_date, 'infinity'::date), '[]'::text) WITH &&) WHERE (((status)::text = ANY ((ARRAY['UPCOMING'::character varying, 'ACTIVE'::character varying, 'EXPIRED'::character varying, 'TERMINATED'::character varying])::text[])));


--
-- Name: leave_requests no_overlapping_leave_requests; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT no_overlapping_leave_requests EXCLUDE USING gist (employee_id WITH =, daterange(start_date, end_date, '[]'::text) WITH &&) WHERE (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying])::text[])));


--
-- Name: positions positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (id);


--
-- Name: public_holidays public_holidays_holiday_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_holidays
    ADD CONSTRAINT public_holidays_holiday_date_key UNIQUE (holiday_date);


--
-- Name: public_holidays public_holidays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.public_holidays
    ADD CONSTRAINT public_holidays_pkey PRIMARY KEY (id);


--
-- Name: staff_cards staff_cards_card_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_cards
    ADD CONSTRAINT staff_cards_card_number_key UNIQUE (card_number);


--
-- Name: staff_cards staff_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_cards
    ADD CONSTRAINT staff_cards_pkey PRIMARY KEY (id);


--
-- Name: staff_cards staff_cards_verification_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_cards
    ADD CONSTRAINT staff_cards_verification_token_key UNIQUE (verification_token);


--
-- Name: employee_leave_entitlements unique_employee_leave_entitlement; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_entitlements
    ADD CONSTRAINT unique_employee_leave_entitlement UNIQUE (employee_id, leave_type_id, leave_year);


--
-- Name: mission_reports unique_employee_mission_report; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reports
    ADD CONSTRAINT unique_employee_mission_report UNIQUE (mission_id, submitted_by_employee_id);


--
-- Name: mission_funding_items unique_funding_item_mission; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_funding_items
    ADD CONSTRAINT unique_funding_item_mission UNIQUE (id, mission_id);


--
-- Name: mission_participants unique_mission_participant; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_participants
    ADD CONSTRAINT unique_mission_participant UNIQUE (mission_id, employee_id);


--
-- Name: mission_expense_reconciliations unique_participant_mission_currency_reconciliation; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_expense_reconciliations
    ADD CONSTRAINT unique_participant_mission_currency_reconciliation UNIQUE (mission_id, participant_employee_id, currency);


--
-- Name: positions unique_position_per_department; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT unique_position_per_department UNIQUE (department_id, title);


--
-- Name: app_users unique_user_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT unique_user_email UNIQUE (email);


--
-- Name: active_approval_delegations_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX active_approval_delegations_index ON public.approval_delegations USING btree (delegator_user_id, delegate_user_id, starts_at, ends_at) WHERE (is_active = true);


--
-- Name: department_directors_user_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX department_directors_user_index ON public.department_directors USING btree (director_user_id);


--
-- Name: mission_actions_mission_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_actions_mission_index ON public.mission_approval_actions USING btree (mission_id);


--
-- Name: mission_disbursements_created_by_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_disbursements_created_by_index ON public.mission_disbursements USING btree (created_by_user_id);


--
-- Name: mission_disbursements_funding_item_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_disbursements_funding_item_index ON public.mission_disbursements USING btree (funding_item_id);


--
-- Name: mission_disbursements_participant_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_disbursements_participant_index ON public.mission_disbursements USING btree (participant_employee_id);


--
-- Name: mission_disbursements_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_disbursements_status_index ON public.mission_disbursements USING btree (status);


--
-- Name: mission_documents_mission_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_documents_mission_index ON public.mission_documents USING btree (mission_id);


--
-- Name: mission_documents_reconciliation_item_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_documents_reconciliation_item_index ON public.mission_documents USING btree (reconciliation_item_id);


--
-- Name: mission_funding_created_by_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_funding_created_by_index ON public.mission_funding_items USING btree (created_by_user_id);


--
-- Name: mission_funding_items_mission_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_funding_items_mission_index ON public.mission_funding_items USING btree (mission_id);


--
-- Name: mission_funding_items_participant_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_funding_items_participant_index ON public.mission_funding_items USING btree (participant_employee_id);


--
-- Name: mission_funding_items_source_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_funding_items_source_index ON public.mission_funding_items USING btree (funding_source);


--
-- Name: mission_participants_department_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_participants_department_index ON public.mission_participants USING btree (department_id);


--
-- Name: mission_participants_employee_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_participants_employee_index ON public.mission_participants USING btree (employee_id);


--
-- Name: mission_reconciliations_employee_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_reconciliations_employee_index ON public.mission_expense_reconciliations USING btree (participant_employee_id);


--
-- Name: mission_reconciliations_mission_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_reconciliations_mission_index ON public.mission_expense_reconciliations USING btree (mission_id);


--
-- Name: mission_reconciliations_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_reconciliations_status_index ON public.mission_expense_reconciliations USING btree (status);


--
-- Name: mission_reconciliations_submitted_by_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_reconciliations_submitted_by_index ON public.mission_expense_reconciliations USING btree (submitted_by_user_id);


--
-- Name: mission_reports_mission_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_reports_mission_index ON public.mission_reports USING btree (mission_id);


--
-- Name: mission_requirements_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mission_requirements_status_index ON public.mission_approval_requirements USING btree (mission_id, status);


--
-- Name: missions_dates_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX missions_dates_index ON public.missions USING btree (start_date, end_date);


--
-- Name: missions_status_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX missions_status_index ON public.missions USING btree (status);


--
-- Name: one_active_card_per_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_active_card_per_employee ON public.staff_cards USING btree (employee_id) WHERE ((status)::text = 'ACTIVE'::text);


--
-- Name: one_active_director_per_department; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_active_director_per_department ON public.department_directors USING btree (department_id) WHERE (is_active = true);


--
-- Name: one_department_action_per_mission; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_department_action_per_mission ON public.mission_approval_actions USING btree (mission_id, department_id) WHERE ((stage)::text = 'DEPARTMENT'::text);


--
-- Name: one_department_requirement_per_mission; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_department_requirement_per_mission ON public.mission_approval_requirements USING btree (mission_id, department_id) WHERE ((stage)::text = 'DEPARTMENT'::text);


--
-- Name: one_non_department_action_per_mission; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_non_department_action_per_mission ON public.mission_approval_actions USING btree (mission_id, stage) WHERE ((stage)::text = ANY ((ARRAY['HR'::character varying, 'CEO'::character varying, 'CHAIRMAN'::character varying])::text[]));


--
-- Name: one_stage_requirement_per_mission; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX one_stage_requirement_per_mission ON public.mission_approval_requirements USING btree (mission_id, stage) WHERE ((stage)::text = ANY ((ARRAY['HR'::character varying, 'CEO'::character varying, 'CHAIRMAN'::character varying])::text[]));


--
-- Name: reconciliation_actions_date_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reconciliation_actions_date_index ON public.mission_reconciliation_actions USING btree (acted_at);


--
-- Name: reconciliation_actions_reconciliation_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reconciliation_actions_reconciliation_index ON public.mission_reconciliation_actions USING btree (reconciliation_id);


--
-- Name: reconciliation_actions_user_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reconciliation_actions_user_index ON public.mission_reconciliation_actions USING btree (action_by_user_id);


--
-- Name: reconciliation_items_category_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reconciliation_items_category_index ON public.mission_reconciliation_items USING btree (cost_category);


--
-- Name: reconciliation_items_reconciliation_index; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reconciliation_items_reconciliation_index ON public.mission_reconciliation_items USING btree (reconciliation_id);


--
-- Name: app_users app_users_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_users
    ADD CONSTRAINT app_users_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE SET NULL;


--
-- Name: approval_delegations delegations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_delegations
    ADD CONSTRAINT delegations_created_by_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: approval_delegations delegations_delegate_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_delegations
    ADD CONSTRAINT delegations_delegate_fkey FOREIGN KEY (delegate_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: approval_delegations delegations_delegator_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_delegations
    ADD CONSTRAINT delegations_delegator_fkey FOREIGN KEY (delegator_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: approval_delegations delegations_revoked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.approval_delegations
    ADD CONSTRAINT delegations_revoked_by_fkey FOREIGN KEY (revoked_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: department_directors department_directors_department_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_directors
    ADD CONSTRAINT department_directors_department_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE RESTRICT;


--
-- Name: department_directors department_directors_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.department_directors
    ADD CONSTRAINT department_directors_user_fkey FOREIGN KEY (director_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: departments departments_parent_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_parent_fkey FOREIGN KEY (parent_department_id) REFERENCES public.departments(id) ON DELETE RESTRICT;


--
-- Name: mission_disbursements disbursement_funding_mission_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_disbursements
    ADD CONSTRAINT disbursement_funding_mission_fkey FOREIGN KEY (funding_item_id, mission_id) REFERENCES public.mission_funding_items(id, mission_id) ON DELETE RESTRICT;


--
-- Name: mission_disbursements disbursement_participant_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_disbursements
    ADD CONSTRAINT disbursement_participant_fkey FOREIGN KEY (mission_id, participant_employee_id) REFERENCES public.mission_participants(mission_id, employee_id) ON DELETE RESTRICT;


--
-- Name: employee_leave_entitlements employee_leave_entitlements_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_entitlements
    ADD CONSTRAINT employee_leave_entitlements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: employee_leave_entitlements employee_leave_entitlements_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_leave_entitlements
    ADD CONSTRAINT employee_leave_entitlements_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- Name: contracts fk_contract_employee; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT fk_contract_employee FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: employees fk_employee_position; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT fk_employee_position FOREIGN KEY (position_id) REFERENCES public.positions(id) ON DELETE RESTRICT;


--
-- Name: positions fk_position_department; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT fk_position_department FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE RESTRICT;


--
-- Name: leave_requests leave_requests_decided_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_decided_by_user_id_fkey FOREIGN KEY (decided_by_user_id) REFERENCES public.app_users(id) ON DELETE SET NULL;


--
-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: leave_requests leave_requests_leave_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_leave_type_id_fkey FOREIGN KEY (leave_type_id) REFERENCES public.leave_types(id);


--
-- Name: mission_approval_actions mission_actions_delegation_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_approval_actions
    ADD CONSTRAINT mission_actions_delegation_fkey FOREIGN KEY (delegation_id) REFERENCES public.approval_delegations(id) ON DELETE RESTRICT;


--
-- Name: mission_approval_actions mission_actions_department_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_approval_actions
    ADD CONSTRAINT mission_actions_department_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE RESTRICT;


--
-- Name: mission_approval_actions mission_actions_mission_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_approval_actions
    ADD CONSTRAINT mission_actions_mission_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: mission_approval_actions mission_actions_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_approval_actions
    ADD CONSTRAINT mission_actions_user_fkey FOREIGN KEY (action_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: mission_disbursements mission_disbursements_cancelled_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_disbursements
    ADD CONSTRAINT mission_disbursements_cancelled_by_user_id_fkey FOREIGN KEY (cancelled_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: mission_disbursements mission_disbursements_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_disbursements
    ADD CONSTRAINT mission_disbursements_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: mission_disbursements mission_disbursements_funding_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_disbursements
    ADD CONSTRAINT mission_disbursements_funding_item_id_fkey FOREIGN KEY (funding_item_id) REFERENCES public.mission_funding_items(id) ON DELETE RESTRICT;


--
-- Name: mission_disbursements mission_disbursements_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_disbursements
    ADD CONSTRAINT mission_disbursements_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE RESTRICT;


--
-- Name: mission_disbursements mission_disbursements_paid_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_disbursements
    ADD CONSTRAINT mission_disbursements_paid_by_user_id_fkey FOREIGN KEY (paid_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: mission_disbursements mission_disbursements_participant_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_disbursements
    ADD CONSTRAINT mission_disbursements_participant_employee_id_fkey FOREIGN KEY (participant_employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: mission_disbursements mission_disbursements_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_disbursements
    ADD CONSTRAINT mission_disbursements_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: mission_documents mission_documents_mission_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_documents
    ADD CONSTRAINT mission_documents_mission_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: mission_documents mission_documents_reconciliation_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_documents
    ADD CONSTRAINT mission_documents_reconciliation_item_id_fkey FOREIGN KEY (reconciliation_item_id) REFERENCES public.mission_reconciliation_items(id) ON DELETE CASCADE;


--
-- Name: mission_documents mission_documents_report_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_documents
    ADD CONSTRAINT mission_documents_report_fkey FOREIGN KEY (report_id) REFERENCES public.mission_reports(id) ON DELETE CASCADE;


--
-- Name: mission_documents mission_documents_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_documents
    ADD CONSTRAINT mission_documents_user_fkey FOREIGN KEY (uploaded_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: mission_expense_reconciliations mission_expense_reconciliations_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_expense_reconciliations
    ADD CONSTRAINT mission_expense_reconciliations_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: mission_expense_reconciliations mission_expense_reconciliations_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_expense_reconciliations
    ADD CONSTRAINT mission_expense_reconciliations_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE RESTRICT;


--
-- Name: mission_expense_reconciliations mission_expense_reconciliations_participant_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_expense_reconciliations
    ADD CONSTRAINT mission_expense_reconciliations_participant_employee_id_fkey FOREIGN KEY (participant_employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: mission_expense_reconciliations mission_expense_reconciliations_rejected_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_expense_reconciliations
    ADD CONSTRAINT mission_expense_reconciliations_rejected_by_user_id_fkey FOREIGN KEY (rejected_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: mission_expense_reconciliations mission_expense_reconciliations_submitted_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_expense_reconciliations
    ADD CONSTRAINT mission_expense_reconciliations_submitted_by_user_id_fkey FOREIGN KEY (submitted_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: mission_expense_reconciliations mission_expense_reconciliations_verified_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_expense_reconciliations
    ADD CONSTRAINT mission_expense_reconciliations_verified_by_user_id_fkey FOREIGN KEY (verified_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: mission_funding_items mission_funding_items_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_funding_items
    ADD CONSTRAINT mission_funding_items_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: mission_funding_items mission_funding_items_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_funding_items
    ADD CONSTRAINT mission_funding_items_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: mission_funding_items mission_funding_items_participant_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_funding_items
    ADD CONSTRAINT mission_funding_items_participant_employee_id_fkey FOREIGN KEY (participant_employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: mission_funding_items mission_funding_items_updated_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_funding_items
    ADD CONSTRAINT mission_funding_items_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: mission_funding_items mission_funding_participant_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_funding_items
    ADD CONSTRAINT mission_funding_participant_fkey FOREIGN KEY (mission_id, participant_employee_id) REFERENCES public.mission_participants(mission_id, employee_id) ON DELETE RESTRICT;


--
-- Name: mission_participants mission_participants_department_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_participants
    ADD CONSTRAINT mission_participants_department_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE RESTRICT;


--
-- Name: mission_participants mission_participants_employee_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_participants
    ADD CONSTRAINT mission_participants_employee_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: mission_participants mission_participants_mission_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_participants
    ADD CONSTRAINT mission_participants_mission_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: mission_reconciliation_actions mission_reconciliation_actions_action_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reconciliation_actions
    ADD CONSTRAINT mission_reconciliation_actions_action_by_user_id_fkey FOREIGN KEY (action_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: mission_reconciliation_actions mission_reconciliation_actions_reconciliation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reconciliation_actions
    ADD CONSTRAINT mission_reconciliation_actions_reconciliation_id_fkey FOREIGN KEY (reconciliation_id) REFERENCES public.mission_expense_reconciliations(id) ON DELETE CASCADE;


--
-- Name: mission_reconciliation_items mission_reconciliation_items_reconciliation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reconciliation_items
    ADD CONSTRAINT mission_reconciliation_items_reconciliation_id_fkey FOREIGN KEY (reconciliation_id) REFERENCES public.mission_expense_reconciliations(id) ON DELETE CASCADE;


--
-- Name: mission_reports mission_reports_employee_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reports
    ADD CONSTRAINT mission_reports_employee_fkey FOREIGN KEY (submitted_by_employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: mission_reports mission_reports_mission_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_reports
    ADD CONSTRAINT mission_reports_mission_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: mission_approval_requirements mission_requirements_assigned_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_approval_requirements
    ADD CONSTRAINT mission_requirements_assigned_user_fkey FOREIGN KEY (assigned_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: mission_approval_requirements mission_requirements_completed_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_approval_requirements
    ADD CONSTRAINT mission_requirements_completed_user_fkey FOREIGN KEY (completed_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: mission_approval_requirements mission_requirements_department_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_approval_requirements
    ADD CONSTRAINT mission_requirements_department_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE RESTRICT;


--
-- Name: mission_approval_requirements mission_requirements_mission_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_approval_requirements
    ADD CONSTRAINT mission_requirements_mission_fkey FOREIGN KEY (mission_id) REFERENCES public.missions(id) ON DELETE CASCADE;


--
-- Name: missions missions_completed_by_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_completed_by_user_fkey FOREIGN KEY (completed_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: missions missions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.missions
    ADD CONSTRAINT missions_created_by_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: mission_expense_reconciliations reconciliation_participant_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mission_expense_reconciliations
    ADD CONSTRAINT reconciliation_participant_fkey FOREIGN KEY (mission_id, participant_employee_id) REFERENCES public.mission_participants(mission_id, employee_id) ON DELETE RESTRICT;


--
-- Name: staff_cards staff_cards_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_cards
    ADD CONSTRAINT staff_cards_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- Name: staff_cards staff_cards_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_cards
    ADD CONSTRAINT staff_cards_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE RESTRICT;


--
-- Name: staff_cards staff_cards_revoked_by_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_cards
    ADD CONSTRAINT staff_cards_revoked_by_user_id_fkey FOREIGN KEY (revoked_by_user_id) REFERENCES public.app_users(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict jbRkzVvFzDsQ0ePFnM7tk6kqpjkKS2C5dGMgdhEaCpktcxdIMFG70lm46UFLql9

