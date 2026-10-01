-- ============================================================
-- COMPARE MPP — bandingkan jumlah salesman per hari: Ficom Lite (SFA)
-- vs Ficom EDI260001 "EDI Hirarki SD - Salesman" (daftar mentah seluruh
-- salesman di hirarki, tanpa filter omzet/aktivitas). 1 baris per
-- tanggal, ditimpa tiap sync di hari yang sama (upsert on conflict
-- snapshot_date) supaya selalu kondisi terbaru hari itu.
-- ============================================================
CREATE TABLE IF NOT EXISTS mpp_compare_snapshot (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date       date NOT NULL UNIQUE,
  tahun               int NOT NULL,
  periode             int NOT NULL,
  ficom_lite_active   int NOT NULL DEFAULT 0,
  ficom_lite_total    int NOT NULL DEFAULT 0,
  edi_active_salesman int NOT NULL DEFAULT 0,
  ficom_lite_by_rdm   jsonb DEFAULT '[]', -- [{empId, name, active, total}]
  edi_by_rdm          jsonb DEFAULT '[]', -- [{empId, name, active}] — digrup by grsm_id, match 1:1 ke empId RDM Ficom Lite
  synced_at           timestamptz DEFAULT now()
);

ALTER TABLE mpp_compare_snapshot DISABLE ROW LEVEL SECURITY;

-- Kalau migration versi lama (kolom edi_by_nsm) udah pernah dijalanin
-- sebelumnya, jalanin rename ini manual:
-- ALTER TABLE mpp_compare_snapshot RENAME COLUMN edi_by_nsm TO edi_by_rdm;
