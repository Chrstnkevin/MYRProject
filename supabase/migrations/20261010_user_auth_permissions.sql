-- ============================================================
-- Sistem Auth & Permission baru — register pakai email, admin
-- verifikasi (approve/reject), lalu admin tentuin fitur apa yang
-- boleh diakses tiap user. PAKAI Supabase Auth asli (bukan cookie
-- manual kayak sebelumnya) — tabel di sini nempel ke auth.users
-- lewat trigger otomatis tiap ada signup baru.
--
-- Login lama (admin123/kevin123, cookie "sb-session-manual")
-- SENGAJA dipertahankan sebagai fallback super-admin selama masa
-- transisi (lihat src/app/login/page.tsx) — nggak lewat Supabase
-- Auth sama sekali, jadi nggak butuh baris di tabel profiles ini
-- buat tetap bisa login & akses semua fitur.
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  full_name   text,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  is_admin    boolean NOT NULL DEFAULT false,
  created_at  timestamptz DEFAULT now(),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz
);

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Auto-insert baris profiles tiap kali ada signup baru di auth.users,
-- status default 'pending' sampai di-approve admin dari halaman
-- /dashboard/user-management.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Permission per fitur — ADA baris = user itu diizinkan akses
-- feature_key tsb (deny-by-default kalau nggak ada baris). feature_key
-- cocok sama path segment setelah /dashboard/ (mis. "logix-tickets"
-- buat /dashboard/logix-tickets) — daftar lengkapnya di
-- src/lib/features.ts. User dengan profiles.is_admin=true SELALU full
-- access ke semua fitur, baris di tabel ini diabaikan buat mereka.
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  granted_by  uuid REFERENCES auth.users(id),
  granted_at  timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, feature_key)
);

ALTER TABLE user_permissions DISABLE ROW LEVEL SECURITY;
