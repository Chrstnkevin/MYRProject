-- ============================================================
-- PRODUCTIVITY DASHBOARD - Personal Daily Productivity
-- Untuk System Support Engineer
-- ============================================================

-- 1. NOTULENSI (Meeting Notes)
CREATE TABLE IF NOT EXISTS notulensi (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text NOT NULL,
  date        date NOT NULL DEFAULT CURRENT_DATE,
  location    text,
  attendees   text[],
  agenda      text,
  notes       text,
  action_items jsonb DEFAULT '[]',
  tags        text[],
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 2. FINANCE TRACKER
CREATE TABLE IF NOT EXISTS finance_transactions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date        date NOT NULL DEFAULT CURRENT_DATE,
  type        text NOT NULL CHECK (type IN ('income', 'expense')),
  category    text NOT NULL,
  description text NOT NULL,
  amount      numeric NOT NULL,
  created_at  timestamptz DEFAULT now()
);

-- 3. KANBAN TASKS
CREATE TABLE IF NOT EXISTS kanban_tasks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'inprogress', 'done', 'blocked')),
  priority    text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  date        date NOT NULL DEFAULT CURRENT_DATE,
  tags        text[],
  due_date    date,
  order_index int DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 4. USER FLOWS / DIAGRAMS
CREATE TABLE IF NOT EXISTS user_flows (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text NOT NULL,
  description text,
  content     text, -- Excalidraw JSON
  thumbnail   text,
  tags        text[],
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- DISABLE RLS (sesuaikan dengan policy kamu)
ALTER TABLE notulensi             DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions  DISABLE ROW LEVEL SECURITY;
ALTER TABLE kanban_tasks          DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_flows            DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- SEED DATA CONTOH
-- ============================================================
INSERT INTO kanban_tasks (title, description, status, priority, date) VALUES
  ('Setup monitoring server', 'Install & configure Grafana on prod', 'todo', 'high', CURRENT_DATE),
  ('Review ticket #2431', 'Bug pada login module aplikasi HR', 'inprogress', 'critical', CURRENT_DATE),
  ('Update dokumentasi API', 'Update Swagger docs v2', 'done', 'medium', CURRENT_DATE),
  ('Koordinasi dengan tim Dev', 'Meeting weekly sprint review', 'todo', 'medium', CURRENT_DATE);

INSERT INTO finance_transactions (date, type, category, description, amount) VALUES
  (CURRENT_DATE, 'income', 'Gaji', 'Gaji Bulanan', 8500000),
  (CURRENT_DATE, 'expense', 'Makan', 'Makan siang kantor', 35000),
  (CURRENT_DATE, 'expense', 'Transport', 'Grab ke kantor', 28000);
