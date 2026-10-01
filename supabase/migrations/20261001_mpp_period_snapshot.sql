-- ============================================================
-- MPP PERIODE — trend BULANAN "Salesman Aktif" (omzet != 0) dari Ficom
-- EDI240136. BEDA dari mpp_compare_snapshot (harian, dari EDI260001
-- Hirarki) — EDI240136 ini satu-satunya sumber yang punya param
-- tahun+periode sehingga BISA ditarik mundur ke bulan lalu (Ficom Lite &
-- EDI260001 TIDAK punya histori sama sekali, selalu kondisi sekarang),
-- jadi tabel ini cuma nyimpen sisi EDI per bulan, tanpa angka Ficom Lite
-- per bulan (Ficom Lite cuma ada utk hari ini, di mpp_compare_snapshot).
-- ============================================================
CREATE TABLE IF NOT EXISTS mpp_period_snapshot (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tahun               int NOT NULL,
  periode             int NOT NULL,
  edi_active_salesman int NOT NULL DEFAULT 0,
  edi_by_rdm          jsonb DEFAULT '[]', -- [{empId, name, active}], digrup by grsm_id
  synced_at           timestamptz DEFAULT now(),
  UNIQUE (tahun, periode)
);

ALTER TABLE mpp_period_snapshot DISABLE ROW LEVEL SECURITY;
