-- ============================================================
-- LOG PERUBAHAN MPP — nyatet SIAPA nambah/ilang di hirarki EDI
-- (EDI260001) tiap kali mpp-compare-sync jalan, dibandingkan ke sync
-- SEBELUMNYA (bukan cuma per-hari) — jadi kalau pagi 985 terus siang
-- 989, 4 orang yang nambah itu kecatat nama + jam ketauannya, bukan
-- cuma angka akhir hari doang (snapshot harian cuma nyimpen kondisi
-- TERAKHIR per tanggal, histori perubahan dalam hari yang sama butuh
-- tabel terpisah ini).
-- ============================================================
CREATE TABLE IF NOT EXISTS mpp_salesman_change_log (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  changed_at    timestamptz NOT NULL DEFAULT now(),
  change_type   text NOT NULL CHECK (change_type IN ('added', 'removed')),
  sls_id        text NOT NULL,
  distributor_id text,
  name          text,
  rdm_id        text,
  rdm_name      text,
  prev_total    int, -- total EDI Hirarki sebelum perubahan ini
  new_total     int  -- total EDI Hirarki sesudah perubahan ini
);

CREATE INDEX IF NOT EXISTS idx_mpp_salesman_change_log_changed_at ON mpp_salesman_change_log (changed_at DESC);

ALTER TABLE mpp_salesman_change_log DISABLE ROW LEVEL SECURITY;
