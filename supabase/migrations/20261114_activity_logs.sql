-- ============================================================
-- Log aktivitas user — tanggal, jam, user siapa, fitur apa yang
-- dilihat, dan berapa lama (diminta user buat bisa "ditarik"/
-- di-export). 1 baris = 1 kunjungan ke 1 halaman dashboard;
-- started_at diisi pas halaman dibuka, ended_at+duration_seconds
-- diisi belakangan pas user pindah halaman/tutup tab (lewat
-- navigator.sendBeacon, lihat src/components/layout/ActivityTracker.tsx
-- & src/app/api/activity-log/end/route.ts).
--
-- user_id NULLABLE karena ada 2 jalur login (lihat
-- src/app/login/page.tsx): Supabase Auth asli (user_id keisi) dan
-- fallback admin lama "admin123" (SAMA SEKALI nggak lewat Supabase
-- Auth, jadi nggak punya auth.users.id). user_label SELALU keisi
-- (email user asli, atau "admin123 (fallback)") biar log tetap
-- kebaca tanpa perlu join ke tabel lain.
-- ============================================================

CREATE TABLE IF NOT EXISTS activity_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_label        text NOT NULL,
  feature_key       text,
  path              text NOT NULL,
  started_at        timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  duration_seconds  integer
);

ALTER TABLE activity_logs DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_activity_logs_started_at ON activity_logs (started_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id    ON activity_logs (user_id);
