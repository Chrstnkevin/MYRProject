-- ============================================================
-- ROLLBACK — balikin Omzet PHI ke sumber data EDI200001 (seperti
-- sebelum migration 20261003_omzet_phi_ads_rewrite.sql).
--
-- User minta rollback: rombakan ke Ficom Main (detilChange, level ADS)
-- ternyata bikin data makin nggak jelas (2 dari 5 wilayah hilang di 1
-- bulan backfill, target ADS ada yang 1478% achievement, Jan-Jun flat
-- 0 — kemungkinan Ficom throttle request pas crawl panjang terus-
-- menerus, dan belum sempat tervalidasi lebih lanjut). EDI200001 sudah
-- lebih stabil setelah fix dedupe-sum sebelumnya (target Sep yang
-- sempat meleset udah dikoreksi, selisih ke Ficom Lite Monthly cuma
-- ~0,2%), jadi balik ke situ dulu.
--
-- Skema di bawah ini SAMA PERSIS dengan 20261001_omzet_phi_snapshot.sql
-- (grain per period_month+distributor_id, field2 EDI200001) — tabel
-- lama (grain per ADS dari rombakan detilChange) di-drop, histori ADS
-- yang sempat ke-sync TIDAK dipertahankan (beda struktur total, nggak
-- ada cara migrasi datanya 1:1).
-- ============================================================
DROP TABLE IF EXISTS omzet_phi_snapshot;

CREATE TABLE omzet_phi_snapshot (
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

-- omzet_phi_ficomlite_ref TIDAK berubah (schema-nya sama dari awal,
-- cuma struktur omzet_phi_snapshot yang balik).
