-- ============================================================
-- Tambah kolom pic_tas & schema_name ke master_data_adp supaya bisa
-- di-EDIT PER-DEPOT lewat tab "Tabel Depot" (sebelumnya dua-duanya
-- cuma turunan otomatis & read-only: PIC TAS dari TAS_MAP[region_name]
-- hardcoded di kode, SCHEMA dari tabel master_data_schema_ref yang
-- cuma bisa di-update lewat bulk "Upload Schema Referensi" — replace
-- total, bukan per-baris).
--
-- Kolom ini DIPAKAI SEBAGAI OVERRIDE, bukan ganti total mekanisme lama:
-- - pic_tas: kalau diisi manual, dipakai. Kalau NULL, fallback ke
--   TAS_MAP[region_name] seperti sebelumnya (lihat tasFor() di
--   page.tsx) — jadi depot yang belum pernah di-edit tetap kebaca PIC
--   TAS otomatisnya seperti biasa.
-- - schema_name: kalau diisi manual, dipakai. Kalau NULL, fallback ke
--   master_data_schema_ref (hasil upload bulk) seperti sebelumnya.
-- ============================================================
ALTER TABLE master_data_adp ADD COLUMN IF NOT EXISTS pic_tas text;
ALTER TABLE master_data_adp ADD COLUMN IF NOT EXISTS schema_name text;
