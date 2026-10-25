-- Plan Pilot SFA — kurasi dokumen (dari Superhuman Docs/Coda, read-only)
-- + data subdist (manual) jadi satu "paket" permanen per rencana pilot,
-- lalu bisa di-generate jadi file Excel "Form Detail PILOT" (format sama
-- persis kayak template Form_Request_Pilot_SFA_For_MD_*.xlsx yang
-- dikasih user). RLS disabled, konsisten sama tabel lain di app ini.

create table if not exists pilot_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by text,
  created_at timestamptz not null default now()
);

create table if not exists pilot_plan_subdist (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references pilot_plans(id) on delete cascade,
  sort_order int not null default 0,
  kode_subdist text,
  nama_subdist text,
  keterangan text,
  pilot_by text
);

create table if not exists pilot_plan_docs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references pilot_plans(id) on delete cascade,
  sort_order int not null default 0,
  modul text,
  doc_no_nama text,
  keterangan text,
  on_version text,
  req_by text,
  test_by text,
  status text,
  -- Jejak asal dokumen ini dari Superhuman Docs (buat traceability, bukan
  -- dipakai buat nge-fetch ulang — datanya udah "nempel" permanen di sini).
  source_coda_doc_id text,
  source_coda_table_id text,
  source_coda_row_id text
);

create index if not exists idx_pilot_plan_subdist_plan on pilot_plan_subdist(plan_id);
create index if not exists idx_pilot_plan_docs_plan on pilot_plan_docs(plan_id);
