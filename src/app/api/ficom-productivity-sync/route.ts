import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { parseEdiText } from "@/lib/parseEdiText"

// Sync "EDI FICOM LITE PRODUCTIVITY" (EDI2600006) — sumber data Target vs
// Realisasi per komponen (C1, C3, C4, C7, C12, C16, C17, C22, C25, C36, C37,
// dst.), breakdown hierarki SD→RDM→ADM→ADS→Salesman, dipakai halaman
// Productivity Compare. Query Ficom-nya BEDA dari EDI200001 (OMSET
// Dashboard) — cuma filter tanggal (V01 Date From, V02 Date To), TIDAK
// butuh kode SD (V01 di EDI200001), jadi satu tarikan langsung dapat semua
// SD/hierarki nasional sekaligus (dikonfirmasi dari capture template
// GET /api/edi/EDI2600006 user).
//
// Mapping field Ficom → level hierarki yang diminta user: nsm_id/nsm_nm →
// SD, grsm_id/grsm_nm → RDM, rsm_id/rsm_nm → ADM, ss_id/ss_nm → ADS,
// sls_id/sls_nm → Salesman. Field sd_id/sd_nm paling luar (isinya "CHIEF
// OPERATING OFFICER") disimpan tapi tidak dipakai sebagai level manapun.
const FICOM_BASE = "https://ficom-phi.mayora.co.id/web/phi"
const EDI_ID = "EDI2600006" // "EDI FICOM LITE PRODUCTIVITY"

interface EdiParam { var: string; label: string; placeholder: string; maxLength: number }
interface EdiTemplate { ediId: string; ediNm: string; query: string; params: EdiParam[] }

// Format persis contoh placeholder Ficom buat V01/V02: "1 OCT 2025" — D(tanpa
// leading zero) MON(inggris,upper) YYYY. BEDA dari V06 di EDI200001 yang
// zero-padded ("26 AUG 2026") — dua template ini pakai konvensi placeholder
// yang berbeda, jadi formatter-nya sengaja dipisah, bukan reuse todayMaksDate.
function ficomDateNoPad(d: Date): string {
  const month = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()
  return `${d.getDate()} ${month} ${d.getFullYear()}`
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function periodMonthOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

async function ficomLogin(username: string, password: string): Promise<string> {
  const res = await fetch(`${FICOM_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error(`Login Ficom gagal (HTTP ${res.status}) — cek akun SD di Master Data → Ficom Password`)
  const data = await res.json()
  if (!data?.token) throw new Error("Login Ficom gagal: response tidak ada token")
  return data.token as string
}

async function fetchEdiText(token: string, dateFrom: string, dateTo: string): Promise<string> {
  const tplRes = await fetch(`${FICOM_BASE}/api/edi/${EDI_ID}`, {
    headers: { Authorization: `F1C0m ${token}` },
  })
  if (!tplRes.ok) throw new Error(`Gagal ambil template EDI (HTTP ${tplRes.status})`)
  const tpl = await tplRes.json() as EdiTemplate

  // V01 = Date From, V02 = Date To — dua-duanya wajib diisi, tidak ada slot
  // lain di template ini (dikonfirmasi dari capture template user).
  const filledParams = tpl.params.map(p => ({
    ...p,
    placeholder: p.var === "V01" ? dateFrom : p.var === "V02" ? dateTo : "-",
  }))

  const extractRes = await fetch(`${FICOM_BASE}/api/edi/ekstrak/brt`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `F1C0m ${token}` },
    body: JSON.stringify({ ...tpl, params: filledParams }),
  })
  if (!extractRes.ok) throw new Error(`Gagal ekstrak EDI (HTTP ${extractRes.status})`)
  return extractRes.text()
}

// Endpoint dashboard RESMI Ficom Lite (BUKAN EDI export) — beda jalur dari
// EDI2600006 di atas, kasih rollup Target/Realisasi per RDM langsung dari
// Ficom sendiri (bukan hasil agregasi kita), scope-nya SELALU "hari ini/
// bulan berjalan" (tidak ada param tanggal, tidak per-periode kayak
// EDI2600006). Dipakai user buat validasi silang: userId di sini match
// PERSIS ke grsm_id (RDM) kita, jadi dicocokkan by ID langsung — tidak
// perlu name-matching kayak target-compare. "user-id" query param-nya =
// emp_id akun SD (posisi "SD" di Master Data → Ficom Password, sama
// dengan yang dipakai target-compare buat crawl hierarki/produk), BUKAN
// akun posisi "EDI" yang dipakai buat extract EDI2600006 di atas — jadi
// login-nya terpisah pakai kredensial SD.
interface FicomLiteCard {
  label: string; value: number; target: number; percent: number
  componentId: string; targetExcluded?: number; percentExcluded?: number
}
interface FicomLiteTeamRow { userId: string; name: string; cards: FicomLiteCard[] }
interface FicomLiteTeam { daily: FicomLiteTeamRow[]; monthly: FicomLiteTeamRow[] }

async function fetchFicomLiteTeam(token: string, sdEmpId: string): Promise<FicomLiteTeam> {
  const res = await fetch(`${FICOM_BASE}/api/ficom-lite-dashboard/team?user-id=${sdEmpId}`, {
    headers: { Authorization: `F1C0m ${token}` },
  })
  if (!res.ok) throw new Error(`Gagal ambil Ficom Lite Team (HTTP ${res.status})`)
  return res.json()
}

async function runSync() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseAnonKey)

  // Akun login sama dengan EDI200001 (posisi "EDI" di Master Data → Ficom
  // Password) — akun fungsional yang sama juga punya akses ke template
  // EDI2600006 ini (satu sistem Ficom, satu login).
  const { data: cred, error: credErr } = await supabase
    .from("ficom_passwords")
    .select("user_login,password")
    .eq("position", "EDI")
    .limit(1)
    .maybeSingle()

  if (credErr) return NextResponse.json({ error: `Gagal ambil kredensial: ${credErr.message}` }, { status: 500 })
  if (!cred?.user_login || !cred?.password) {
    return NextResponse.json({ error: 'Belum ada akun posisi "EDI" di Master Data → Ficom Password' }, { status: 400 })
  }

  const now = new Date()
  const dateFrom = ficomDateNoPad(startOfMonth(now))
  const dateTo = ficomDateNoPad(now)
  const periodMonth = periodMonthOf(now)

  try {
    const token = await ficomLogin(cred.user_login, cred.password)
    const text = await fetchEdiText(token, dateFrom, dateTo)
    const parsed = parseEdiText(text)

    if (!parsed.length) {
      return NextResponse.json({
        error: "Ekstrak Ficom sukses tapi 0 baris data — staging periode ini tidak diubah",
        dateFrom, dateTo,
        rawPreview: text.slice(0, 1500),
      }, { status: 502 })
    }

    const num = (v: string) => v === "" || v == null ? null : Number(v)

    // Response mentah dari Ficom itu granular per (salesman × hari × pcode ×
    // komponen) — bisa RATUSAN RIBU baris buat sebulan penuh skala nasional.
    // Halaman Productivity Compare cuma butuh angka per (Salesman, Komponen)
    // — jadi diagregasi DI SINI dulu sebelum insert, bukan simpan mentah:
    //   - component_realisasi: SUM (additive per event/pcode/hari, valid dijumlah)
    //   - component_target: diambil SEKALI per (sls_id, component_id, tipe_id)
    //     — nilainya konstan/berulang di tiap baris detail, kalau ikut di-SUM
    //     akan overcount berkali-kali lipat (persis kasus di halaman, lihat
    //     buildTree di productivity-compare/page.tsx).
    // Efeknya: dari kemungkinan ratusan ribu baris jadi paling banyak
    // (jumlah salesman × komponen per orang) — biasanya cuma ribuan baris,
    // sync & load halaman jadi jauh lebih cepat.
    interface AggRow {
      nsm_id: string | null; nsm_nm: string | null
      grsm_id: string | null; grsm_nm: string | null
      rsm_id: string | null; rsm_nm: string | null
      ss_id: string | null; ss_nm: string | null
      distributor_id: string | null
      sls_id: string | null; sls_nm: string | null
      tipe_id: string | null
      component_id: string | null
      component_target: number | null
      component_realisasi: number
    }
    const agg = new Map<string, AggRow>()
    for (const r of parsed) {
      const key = `${r.sls_id}|${r.component_id}|${r.tipe_id}`
      let a = agg.get(key)
      if (!a) {
        a = {
          nsm_id: r.nsm_id || null, nsm_nm: r.nsm_nm || null,
          grsm_id: r.grsm_id || null, grsm_nm: r.grsm_nm || null,
          rsm_id: r.rsm_id || null, rsm_nm: r.rsm_nm || null,
          ss_id: r.ss_id || null, ss_nm: r.ss_nm || null,
          distributor_id: r.distributor_id || null,
          sls_id: r.sls_id || null, sls_nm: r.sls_nm || null,
          tipe_id: r.tipe_id || null,
          component_id: r.component_id || null,
          component_target: num(r.component_target),
          component_realisasi: 0,
        }
        agg.set(key, a)
      }
      a.component_realisasi += num(r.component_realisasi) || 0
    }
    const rows = Array.from(agg.values()).map(a => ({ period_month: periodMonth, ...a }))

    const { error: delErr } = await supabase
      .from("ficom_productivity_staging")
      .delete()
      .eq("period_month", periodMonth)
    if (delErr) throw new Error(`Gagal hapus staging periode lama: ${delErr.message}`)

    const chunk = 1000
    for (let i = 0; i < rows.length; i += chunk) {
      const { error: insErr } = await supabase.from("ficom_productivity_staging").insert(rows.slice(i, i + chunk))
      if (insErr) throw new Error(`Gagal insert staging: ${insErr.message}`)
    }

    // Validasi silang: tarik juga rollup resmi Ficom Lite (per RDM, live
    // hari ini) — TIDAK disimpan ke tabel (bukan data historis per-periode),
    // cuma dikembalikan apa adanya di response biar halaman bisa tampilkan
    // sbg kolom pembanding. Non-fatal kalau gagal — sync utama (EDI2600006)
    // di atas sudah berhasil, jangan sampai gagal cuma gara-gara validasi
    // tambahan ini (mis. akun SD belum diisi).
    let ficomLiteTeam: FicomLiteTeam | null = null
    try {
      const { data: sdCred } = await supabase
        .from("ficom_passwords")
        .select("user_login,password")
        .eq("position", "SD")
        .limit(1)
        .maybeSingle()
      if (sdCred?.user_login && sdCred?.password) {
        const sdToken = await ficomLogin(sdCred.user_login, sdCred.password)
        ficomLiteTeam = await fetchFicomLiteTeam(sdToken, sdCred.user_login)
      }
    } catch (e) {
      console.error("Gagal ambil Ficom Lite Team (non-fatal):", e)
    }

    return NextResponse.json({ success: true, rows: rows.length, rawRows: parsed.length, periodMonth, dateFrom, dateTo, syncedAt: new Date().toISOString(), ficomLiteTeam })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const cause = e instanceof Error && e.cause ? String((e.cause as { message?: string; code?: string }).code || e.cause) : undefined
    return NextResponse.json({ error: `Gagal sync Ficom Productivity: ${msg}${cause ? ` (cause: ${cause})` : ""}` }, { status: 500 })
  }
}

// Dipanggil Vercel Cron (lihat vercel.json).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return runSync()
}

// Dipanggil tombol "Tarik dari Ficom" di halaman Productivity Compare.
export async function POST() {
  return runSync()
}
