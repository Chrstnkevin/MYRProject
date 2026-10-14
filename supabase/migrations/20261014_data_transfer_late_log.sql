-- ============================================================
-- Log "ADP telat" per trigger — user bakal triger endpoint
-- /api/data-transfer-late-log?slot=pagi|siang|sore 3x sehari (06:00,
-- 12:00, 17:00) lewat scheduler eksternal (cron-job.org/dsb, BUKAN
-- Vercel Cron bawaan project ini — nggak ada vercel.json di repo, jadi
-- triggernya di luar kendali kode). Tiap kali di-trigger, endpoint itu
-- hitung ulang ADP mana yang "telat" (lama > 0, sama persis logic di
-- data-transfer/page.tsx) terus simpen 1 baris per ADP telat ke sini —
-- dipakai buat nampilin pola "ADP X sering telat jam sore" di card
-- "Ketepatan Waktu per Trigger" halaman Web Ficom.
-- ============================================================
CREATE TABLE IF NOT EXISTS data_transfer_late_log (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  log_date       date NOT NULL,
  time_slot      text NOT NULL CHECK (time_slot IN ('pagi','siang','sore')),
  distributor_id text NOT NULL,
  distributor_nm text,
  aor            text,
  tas            text,
  lama           integer,
  logged_at      timestamptz DEFAULT now(),
  UNIQUE (log_date, time_slot, distributor_id)
);

CREATE INDEX IF NOT EXISTS idx_data_transfer_late_log_date ON data_transfer_late_log (log_date);

ALTER TABLE data_transfer_late_log DISABLE ROW LEVEL SECURITY;
