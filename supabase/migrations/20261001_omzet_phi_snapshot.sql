-- ============================================================
-- OMZET PHI — snapshot omset vs target per ADP (distributor) per bulan,
-- dari Ficom EDI200001 "EDI OMSET DASHBOARD" (field nilai_omset/
-- target_omset, dikonfirmasi dari capture user — field ini TERNYATA ada
-- di raw response EDI200001, cuma nggak ditampilkan di tabel halaman
-- Data Transfer yang sudah ada, yang cuma pakai tgl_gudang/hka_hke/release).
--
-- 1 baris per (period_month, distributor_id). Field spv/rsm/grsm/nsm/sd
-- di EDI ini formatnya "WFCODE-Nama" digabung 1 string — di-split code/
-- name pas sync, disimpan terpisah di sini biar gampang query/group.
-- Pemetaan level (dikonfirmasi dari capture EDI260001 sebelumnya, pola
-- hirarki sama): spv=ADS, rsm=ADM, grsm=RDM, nsm=SD (scope kita), sd=akar
-- perusahaan (di atas SD).
-- ============================================================
CREATE TABLE IF NOT EXISTS omzet_phi_snapshot (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  period_month    text NOT NULL, -- 'YYYY-MM'
  distributor_id  text NOT NULL,
  distributor_nm  text,
  kota            text,
  spv_code        text, spv_name  text, -- ADS
  rsm_code        text, rsm_name  text, -- ADM
  grsm_code       text, grsm_name text, -- RDM
  nsm_code        text, nsm_name  text, -- SD (scope kita)
  sd_code         text, sd_name   text, -- akar perusahaan
  nilai_omset         numeric, target_omset         numeric, perc_omset         numeric,
  nilai_cbcover       numeric, target_cbcover       numeric, perc_cbcover       numeric,
  nilai_hhtkpl        numeric, target_hhtkpl        numeric, perc_hhtkpl        numeric,
  nilai_hht           numeric, target_hht           numeric,
  nilai_ipt           numeric, target_ipt           numeric,
  nilai_sbpt          numeric, target_sbpt          numeric,
  nilai_ec_std_mtd    numeric, target_ec_std_mtd    numeric,
  release         text,
  cutoff_date     text, -- tanggal V06 (maks date) yang dipakai pas narik — buat audit/debug
  synced_at       timestamptz DEFAULT now(),
  UNIQUE (period_month, distributor_id)
);

CREATE INDEX IF NOT EXISTS idx_omzet_phi_snapshot_period ON omzet_phi_snapshot (period_month);

ALTER TABLE omzet_phi_snapshot DISABLE ROW LEVEL SECURITY;

-- Angka pembanding "Ficom Lite Monthly" (componentId C12, endpoint
-- missions, level SD) — SATU angka nasional per bulan, BUKAN per ADP.
-- Cuma ke-isi buat bulan BERJALAN (endpoint ini nggak punya histori,
-- sama kayak di Compare MPP).
CREATE TABLE IF NOT EXISTS omzet_phi_ficomlite_ref (
  period_month text PRIMARY KEY,
  target       numeric,
  value        numeric,
  synced_at    timestamptz DEFAULT now()
);

ALTER TABLE omzet_phi_ficomlite_ref DISABLE ROW LEVEL SECURITY;
