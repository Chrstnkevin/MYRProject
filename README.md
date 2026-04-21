<div align="center">

# ✦ Elite Global
### Personal Productivity Dashboard untuk System Support Engineer

<br/>

![Next.js](https://img.shields.io/badge/Next.js_15-black?style=for-the-badge&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)

<br/>

> *"Produktivitas bukan tentang sibuk, tapi tentang tepat sasaran."*

<br/>

</div>

---

## 📸 Preview

| Home Dashboard | Kanban Board |
|:-:|:-:|
| Overview harian dengan charts & KPI | Board + Calendar view dengan drag & drop |

| Finance Tracker | Notulensi |
|:-:|:-:|
| Cashflow, saldo, filter tanggal | Format terstruktur 5 seksi + action items |

---

## ✨ Fitur

### 🏠 Home Dashboard
- Greeting banner dinamis sesuai waktu
- KPI cards — To Do, In Progress, Done, Blocked
- Bar chart cashflow 7 hari
- Pie chart status tugas
- Progress bar kategori pengeluaran
- Ringkasan keuangan real-time

### 📋 Notulensi Rapat
- Form 2 langkah: Info Rapat → Pencatatan
- Format terstruktur 5 seksi:
  1. Ringkasan Diskusi (latar belakang + tujuan)
  2. Poin Utama & Analisis
  3. Kendala & Risiko
  4. Keputusan & Tindak Lanjut (tabel action items + PIC + deadline)
  5. Catatan Tambahan
- Checklist action items dengan toggle status
- Detail view per notulensi
- Daftar hadir peserta

### 💰 Finance Tracker
- Tambah pemasukan & pengeluaran
- **Saldo awal** yang bisa dikonfigurasi
- Filter berdasarkan tanggal & jenis transaksi
- Area chart tren cashflow 14 hari
- Kategori pengeluaran otomatis
- Saldo real-time = saldo awal + pemasukan − pengeluaran

### 🗂️ Kanban Board
- **2 tampilan:** Board view & Calendar view
- Kolom **To Do** tanpa filter tanggal (backlog global)
- Kolom lain (In Progress, Done, Blocked) filter per tanggal
- Drag & drop antar kolom
- Quick move dengan tombol per kartu
- Prioritas: Low / Medium / High / Critical 🔥
- Tags & deadline per task
- Calendar: klik tanggal → lihat semua task

### 🔀 User Flow
- Daftar flow diagram per project
- Embed **Excalidraw** langsung di dashboard
- Rename, hapus, tambah tags
- Buka fullscreen di Excalidraw

### 🎯 Bonus
- **Motivation banner** animasi SVG per halaman dengan 35+ kutipan motivasi
- Quote berganti setiap hari
- Responsif — bisa dipakai di HP
- Sidebar auto-hide di mobile, toggle manual di desktop
- Login dengan kredensial (cookie-based session)

---

## 🛠️ Tech Stack

| Teknologi | Kegunaan |
|---|---|
| **Next.js 15** (App Router) | Framework utama |
| **React 19** | UI library |
| **TypeScript** | Type safety |
| **Supabase** | Database PostgreSQL + Auth |
| **Recharts** | Charts & visualisasi data |
| **Tailwind CSS** | Styling utility |
| **Lucide React** | Icon library |
| **Excalidraw** | Diagram editor (embedded) |

---

## 🗄️ Struktur Database

```sql
-- Notulensi rapat dengan format terstruktur
notulensi (id, title, date, time, location, attendees[], 
           topic, background, tujuan, main_points[], 
           kendala[], action_items[], catatan_tambahan)

-- Transaksi keuangan
finance_transactions (id, date, type, category, description, amount)

-- Task kanban
kanban_tasks (id, title, description, status, priority, 
              date, tags[], due_date, order_index)

-- User flow / diagram
user_flows (id, title, description, tags[], content)
```

---

## 🚀 Setup & Instalasi

### Prerequisites
- Node.js 18+
- Akun [Supabase](https://supabase.com)

### 1. Clone repository

```bash
git clone https://github.com/USERNAME/elite-global.git
cd elite-global
```

### 2. Install dependencies

```bash
npm install --legacy-peer-deps
```

### 3. Setup Supabase

Buka project Supabase kamu → **SQL Editor** → jalankan migration:

```bash
# File ada di:
supabase/migrations/20260421_productivity_dashboard.sql
```

Untuk update schema notulensi (jika sudah punya tabel lama):
```bash
supabase/migrations/migration-notulensi-update.sql
```

### 4. Environment variables

```bash
cp .env.example .env.local
```

Isi `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxxxxxxxxxxxxxxxxxxxxxx
```

> 💡 Dapatkan nilai ini dari Supabase → Settings → API Keys → tab "Legacy anon, service_role API keys"

### 5. Jalankan

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

## 🔐 Login

```
Username : admin123
Password : kevin123
```

> ⚠️ Ganti kredensial di `src/app/login/page.tsx` sebelum deploy ke production.

---

## 📁 Struktur Folder

```
elite-global/
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   │   ├── page.tsx              ← Home dashboard
│   │   │   ├── layout.tsx            ← Sidebar + Header wrapper
│   │   │   ├── finance/page.tsx      ← Finance tracker
│   │   │   ├── kanban/page.tsx       ← Kanban + Calendar
│   │   │   ├── notulensi/page.tsx    ← Notulensi rapat
│   │   │   └── userflow/page.tsx     ← User flow diagram
│   │   ├── login/page.tsx            ← Halaman login
│   │   ├── globals.css               ← Design system & tokens
│   │   └── layout.tsx                ← Root layout
│   ├── components/
│   │   └── layout/
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── MotivationBanner.tsx  ← Animated motivasi
│   └── lib/
│       ├── supabase.ts               ← Supabase client
│       └── types.ts                  ← TypeScript interfaces
├── supabase/
│   └── migrations/                   ← SQL schema
├── middleware.ts                      ← Auth guard
├── .env.example
└── package.json
```

---

## 🎨 Design System

Tema **Clean Light** dengan aksen hijau earthy:

| Token | Nilai |
|---|---|
| Accent | `#2d6a4f` (hijau forest) |
| Background | `#f5f5f2` (warm white) |
| Surface | `#ffffff` |
| Font | Plus Jakarta Sans + Instrument Serif |
| Border radius | 14px (card), 10px (element) |

---

## 📱 Responsif

| Breakpoint | Behavior |
|---|---|
| Desktop (≥768px) | Sidebar selalu visible, toggle via hamburger |
| Mobile (<768px) | Sidebar hidden by default, slide-in overlay |

---

## 🔮 Roadmap

- [ ] Export notulensi ke PDF
- [ ] Notifikasi deadline task
- [ ] Dark mode toggle
- [ ] Export laporan keuangan ke Excel
- [ ] Multi-user / team support

---

## 📄 License

Private project — All rights reserved © 2026 Elite Global

---

<div align="center">

Made with ☕ + 💚 for productivity

*"Yang tidak dicatat, tidak ada. Yang dicatat, abadi."*

</div>
