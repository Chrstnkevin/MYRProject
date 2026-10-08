-- ============================================================
-- Data Transfer HO — snapshot status transfer data per subdist (ADP)
-- dari sistem HO (Head Office) terpisah dari Ficom (host beda:
-- 52.163.214.18:8081, bukan ficom-phi.mayora.co.id). Endpoint dicapture
-- user: GET /api/ho/dashboard-subdist/next-date-phi/OmsetDif (list per
-- subdist), GET .../percentage (ringkasan % "naik"), GET .../list-date
-- (breakdown jumlah per nextDate — TIDAK disimpan di tabel sendiri,
-- bisa dihitung ulang dari snapshot per nextDate kalau perlu).
--
-- subdistId cocok dengan adp_code di master_data_adp (dikonfirmasi dari
-- capture: "100024"=ARMATURE INC.-MANILA, "200007"=PRONTO-CENTRAL
-- PANGASINAN, nama & kode sama persis kayak yang sudah ada di Master
-- Data). regionNm (GMA/NOL/dst) & areaNm (C2GMA/DISTRICT 2/dst) juga
-- konsisten sama kolom region_name/area_name yang sudah ada.
--
-- CATATAN: beberapa field (flagTrf, text5, color, totalDiffRekonsil,
-- hoVsConsol) maknanya BELUM dikonfirmasi user — disimpan apa adanya
-- (biar nggak hilang datanya) tapi belum ditonjolkan di UI sampai
-- dikonfirmasi artinya apa.
-- ============================================================
CREATE TABLE IF NOT EXISTS ho_transfer_snapshot (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date         date NOT NULL, -- tanggal sync dijalankan (bukan ext_date/next_date dari API)
  subdist_id            text NOT NULL,
  subdist_nm            text,
  sbd_add1              text,
  sbd_add2              text,
  region_id             text,
  region_nm             text,
  area_id               text,
  area_nm               text,
  ext_date              text, -- "06 OCT 2026" raw dari API (tanggal ekstrak terakhir)
  next_date             text, -- "07 OCT 2026" raw dari API (tanggal ekstrak berikutnya)
  flag_trf              text, -- makna belum dikonfirmasi
  text5                 text, -- makna belum dikonfirmasi
  terlambat             text, -- "T" = Telat (dikonfirmasi dari nama field), selain itu = tepat waktu
  total_diff            numeric,
  release               text,
  omzet_ho              numeric,
  omzet_pro             numeric,
  color                 text, -- kode warna status dari API, makna belum dikonfirmasi
  total_diff_rekonsil   numeric,
  ho_vs_consol          numeric,
  synced_at             timestamptz DEFAULT now(),
  UNIQUE (snapshot_date, subdist_id)
);

CREATE INDEX IF NOT EXISTS idx_ho_transfer_snapshot_date ON ho_transfer_snapshot (snapshot_date);

ALTER TABLE ho_transfer_snapshot DISABLE ROW LEVEL SECURITY;

-- Ringkasan "% naik" per tanggal sync, dari endpoint /percentage
-- ({"totalNaik":73,"total":85,"percentage":86}).
CREATE TABLE IF NOT EXISTS ho_transfer_summary (
  snapshot_date date PRIMARY KEY,
  total_naik    integer,
  total         integer,
  percentage    integer,
  synced_at     timestamptz DEFAULT now()
);

ALTER TABLE ho_transfer_summary DISABLE ROW LEVEL SECURITY;
