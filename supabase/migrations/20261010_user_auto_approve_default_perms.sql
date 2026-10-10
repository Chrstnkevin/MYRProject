-- ============================================================
-- Simplifikasi dari migration sebelumnya (20261010_user_auth_
-- permissions.sql): approval manual admin SEBELUM user pertama kali
-- bisa login dirasa kebanyakan ribet. Sekarang user baru LANGSUNG
-- 'approved' begitu daftar (bisa langsung login), dan otomatis dikasih
-- akses default ke grup "Support PHI" (termasuk sub-item Data
-- Transfer: Web Ficom & Matrix HO) + fitur "Master Data" saja.
-- Admin tetap bisa atur-atur (cabut/tambah fitur, atau nonaktifkan
-- user) belakangan dari /dashboard/user-management.
--
-- "Master Data" doang (BUKAN seluruh grup Master) yang di-default —
-- "Ficom Password" & "Master Utilisasi" SENGAJA tidak ikut default
-- karena lebih sensitif (Ficom Password nyimpen kredensial login),
-- biar nggak otomatis kebuka ke sembarang orang yang baru daftar
-- tanpa review admin dulu.
-- ============================================================

ALTER TABLE profiles ALTER COLUMN status SET DEFAULT 'approved';

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  default_features text[] := ARRAY[
    'logix-tickets', 'target-compare', 'mpp-compare', 'mpp-health',
    'omzet-phi', 'landing-admin', 'backlog-phi',
    'data-transfer', 'ho-transfer',
    'master-data'
  ];
  f text;
BEGIN
  INSERT INTO public.profiles (id, email, full_name, status)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'approved')
  ON CONFLICT (id) DO NOTHING;

  FOREACH f IN ARRAY default_features LOOP
    INSERT INTO public.user_permissions (user_id, feature_key)
    VALUES (NEW.id, f)
    ON CONFLICT (user_id, feature_key) DO NOTHING;
  END LOOP;

  RETURN NEW;
END;
$$;
