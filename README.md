# 🚀 Elite Global — Productivity Dashboard

Personal daily productivity dashboard untuk System Support Engineer.

## Fitur

| Halaman | Deskripsi |
|---|---|
| **Home** | Overview harian: KPI task, chart cashflow, pie status task |
| **Notulensi** | Buat & kelola notulensi rapat dengan peserta & action items |
| **Finance** | Catat pemasukan/pengeluaran, filter tanggal, chart tren |
| **Kanban Board** | Task board per tanggal, drag & drop, prioritas, tags |
| **User Flow** | Diagram editor dengan Excalidraw embed |

## Setup

### 1. Clone & Install
```bash
npm install
```

### 2. Setup Supabase
Buat project di [supabase.com](https://supabase.com), lalu jalankan SQL migration:
```
supabase/migrations/20260421_productivity_dashboard.sql
```

### 3. Environment Variables
Copy `.env.example` → `.env.local` dan isi:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

### 4. Jalankan
```bash
npm run dev
```
Buka http://localhost:3000

## Tech Stack
- **Next.js 15** (App Router)
- **Supabase** (PostgreSQL + Auth)
- **Recharts** (Charts)
- **Excalidraw** (User Flow diagrams)
- **Tailwind CSS** + Custom CSS Variables
- **TypeScript**
