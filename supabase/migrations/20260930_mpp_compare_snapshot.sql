-- ============================================================
-- COMPARE MPP — bandingkan MPP aktif per hari: Ficom Lite (SFA) vs
-- Ficom EDI240136 "EDI Salesman Aktif" (salesman dengan omzet != 0
-- bulan berjalan). 1 baris per tanggal, ditimpa tiap sync di hari
-- yang sama (upsert on conflict snapshot_date) supaya selalu kondisi
-- terbaru hari itu.
-- ============================================================
CREATE TABLE IF NOT EXISTS mpp_compare_snapshot (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date       date NOT NULL UNIQUE,
  tahun               int NOT NULL,
  periode             int NOT NULL,
  ficom_lite_active   int NOT NULL DEFAULT 0,
  ficom_lite_total    int NOT NULL DEFAULT 0,
  edi_active_salesman int NOT NULL DEFAULT 0,
  ficom_lite_by_rdm   jsonb DEFAULT '[]', -- [{name, active, total}]
  edi_by_nsm          jsonb DEFAULT '[]', -- [{name, active}]
  synced_at           timestamptz DEFAULT now()
);

ALTER TABLE mpp_compare_snapshot DISABLE ROW LEVEL SECURITY;
