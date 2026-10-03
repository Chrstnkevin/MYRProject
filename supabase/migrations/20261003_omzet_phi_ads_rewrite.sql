-- ============================================================
-- Omzet PHI — REWRITE TOTAL sumber data (dari EDI200001 ke endpoint
-- "Main" Ficom detilChange, atas permintaan user: EDI200001 butuh trik
-- V06 yang nggak pernah tervalidasi + ada bug dedupe "release" yang
-- sempat bikin angka target meleset). Tabel lama (grain per distributor_
-- id dari EDI) DIBUANG, diganti grain per-ADS (1 baris = 1 ADS/node
-- level "ADS" di hirarki Ficom, dipakai sbg proxy "ADP" buat Pareto
-- sesuai kesepakatan user — detilChange nggak expose kode ADP/
-- distributor sama sekali, cuma sampai level Salesman/orang).
--
-- Wilayah sekarang diturunkan LANGSUNG dari nama RDM (sub-AOR, mis.
-- "SGMA"), BUKAN dari join ke master_data_adp lagi — jadi nggak ada lagi
-- masalah ADP yang ke-skip ke bucket "Lainnya".
-- ============================================================
DROP TABLE IF EXISTS omzet_phi_snapshot;

CREATE TABLE omzet_phi_snapshot (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  period_month  text NOT NULL, -- 'YYYY-MM'
  emp_id        text NOT NULL, -- WF-code level ADS (proxy "ADP" di Pareto)
  emp_name      text,
  rdm_emp_id    text,
  rdm_name      text,
  sub_aor       text,          -- kode sub-area dari nama RDM, mis. "SGMA"
  wilayah       text,          -- wilayah makro, 3 huruf terakhir sub_aor: GMA/NOL/SOL/VIS/MIN
  target        numeric,
  nilai         numeric,
  persen        numeric,
  period_date   text,          -- updDate yg dipakai di request detilChange (akhir bulan / hari ini)
  synced_at     timestamptz DEFAULT now(),
  UNIQUE (period_month, emp_id)
);

CREATE INDEX IF NOT EXISTS idx_omzet_phi_snapshot_period ON omzet_phi_snapshot (period_month);
CREATE INDEX IF NOT EXISTS idx_omzet_phi_snapshot_wilayah ON omzet_phi_snapshot (wilayah);

ALTER TABLE omzet_phi_snapshot DISABLE ROW LEVEL SECURITY;

-- omzet_phi_ficomlite_ref TIDAK berubah (tabel pembanding Ficom Lite
-- Monthly, masih dipakai sama persis seperti sebelumnya).
