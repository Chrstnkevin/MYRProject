-- ============================================================
-- MIGRATION: Developer KPI Tables
-- Jalankan di Supabase → SQL Editor
-- ============================================================

-- 1. dev_coda → dari sheet "Data Source (CODA)"
CREATE TABLE IF NOT EXISTS dev_coda (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  adop_project_backlog text,
  project             text,
  application         text,
  year_dev            int4,
  year_done           int4,
  doc_type            text,
  doc_name            text,
  tshirt_sizing       text,
  dev_point           numeric,
  dev_pic             text,
  status_dev          text,
  work_complete       numeric,
  start_date          date,
  finish_date         date,
  deadline            date,
  pilot               text,
  release             text,
  test_cycle          text,
  doc_cycle           text,
  year_request        int4,
  quartal             text,
  doc_date            date,
  "user"              text,
  user_request        text,
  plan_pilot          text,
  dev_sprint_ds       text,
  group_dev           text,
  bobot_dokumen       numeric,
  appx                text,
  is_empty_deadline   boolean,
  is_empty_dev_point  boolean,
  is_empty_doc_point  boolean,
  dev_point_bugs      numeric,
  flag_bugs           text,
  flag_on_time        text,
  flag_testing        text,
  flag_pilot          text,
  flag_done_dev       text,
  created_at          timestamptz DEFAULT now()
);

-- 2. dev_sprint → dari sheet "Data Source (Dev Sprint)"
CREATE TABLE IF NOT EXISTS dev_sprint (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sprint              text,
  adop_sprint         text,
  adop_project_backlog text,
  product_backlog     text,
  sprint_pic          text,
  dev_pic_pb          text,
  workload_pb         numeric,
  plan_start          date,
  plan_finish         date,
  pct_sprint          numeric,
  pct_exp_result      numeric,
  is_plan             boolean,
  status_dev_pb       text,
  tshirt_sizing_pb    text,
  dev_point_pb        numeric,
  work_complete_pb    numeric,
  start_date_pb       date,
  finish_date_pb      date,
  deadline_pb         date,
  test_cycle_pb       text,
  doc_cycle_pb        text,
  is_empty_dev_point  boolean,
  created_at          timestamptz DEFAULT now()
);

-- 3. dev_backlog → dari sheet "Data Source (Project Backlog)"
CREATE TABLE IF NOT EXISTS dev_backlog (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "user"              text,
  application         text,
  kpi                 text,
  request             text,
  status_ss           text,
  status_project      text,
  time_request        text,
  deadline            text,
  timeline            text,
  pct_work_complete   numeric,
  pic_dev             text,
  dev_group           text,
  pic_br              text,
  pic_apps            text,
  doc_ref             text,
  status_dev          text,
  review_sprint       text,
  dev_sprint          text,
  adop_sprint         text,
  weekly_report       text,
  flag_sprint         text,
  flag_tracking       text,
  weekly_sprint       text,
  remark              text,
  created_at          timestamptz DEFAULT now()
);

-- ============================================================
-- DISABLE RLS (opsional, sesuaikan dengan security policy kamu)
-- ============================================================
ALTER TABLE dev_coda    DISABLE ROW LEVEL SECURITY;
ALTER TABLE dev_sprint  DISABLE ROW LEVEL SECURITY;
ALTER TABLE dev_backlog DISABLE ROW LEVEL SECURITY;
