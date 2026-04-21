"use client"

import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { FinanceTransaction } from "@/lib/types"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"
import { Plus, TrendingUp, TrendingDown, Wallet, Trash2, X, Filter, Settings } from "lucide-react"
import MotivationBanner from "@/components/layout/MotivationBanner"

const CATEGORIES_INCOME  = ["Gaji", "Freelance", "Bonus", "Investasi", "Lainnya"]
const CATEGORIES_EXPENSE = ["Makan", "Transport", "Belanja", "Kesehatan", "Hiburan", "Tagihan", "Lainnya"]
const SALDO_KEY = "elite_global_saldo_awal"

// Explicit type — fixes TS2345 / TS2367 inference errors
type TxType = "income" | "expense"
interface FormState {
  date: string
  type: TxType
  category: string
  description: string
  amount: string
}
const makeEmpty = (): FormState => ({
  date: new Date().toISOString().split("T")[0],
  type: "expense",
  category: "Makan",
  description: "",
  amount: "",
})

export default function FinancePage() {
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([])
  const [modal, setModal]           = useState(false)
  const [saldoModal, setSaldoModal] = useState(false)
  const [form, setForm]             = useState<FormState>(makeEmpty())
  const [saving, setSaving]         = useState(false)
  const [filterFrom, setFilterFrom] = useState("")
  const [filterTo, setFilterTo]     = useState("")
  const [filterType, setFilterType] = useState<"all" | TxType>("all")
  const [saldoAwal, setSaldoAwal]   = useState(0)
  const [saldoInput, setSaldoInput] = useState("")

  const load = async () => {
    const { data } = await supabase.from("finance_transactions").select("*").order("date", { ascending: false })
    if (data) setTransactions(data)
  }

  useEffect(() => {
    load()
    const saved = localStorage.getItem(SALDO_KEY)
    if (saved) setSaldoAwal(Number(saved))
  }, [])

  const saveSaldoAwal = () => {
    const val = Number(saldoInput)
    if (isNaN(val)) return
    setSaldoAwal(val)
    localStorage.setItem(SALDO_KEY, String(val))
    setSaldoModal(false)
  }

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (filterType !== "all" && t.type !== filterType) return false
      if (filterFrom && t.date < filterFrom) return false
      if (filterTo && t.date > filterTo) return false
      return true
    })
  }, [transactions, filterType, filterFrom, filterTo])

  const totalIncome  = filtered.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0)
  const totalExpense = filtered.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0)
  const balance      = saldoAwal + totalIncome - totalExpense

  const chartData = useMemo(() => {
    const byDate: Record<string, { date: string; income: number; expense: number }> = {}
    filtered.forEach(t => {
      if (!byDate[t.date]) byDate[t.date] = { date: t.date, income: 0, expense: 0 }
      if (t.type === "income") byDate[t.date].income += t.amount
      else byDate[t.date].expense += t.amount
    })
    return Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)
      .map(d => ({
        ...d,
        label: new Date(d.date).toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        income: d.income / 1000,
        expense: d.expense / 1000,
      }))
  }, [filtered])

  const save = async () => {
    if (!form.description || !form.amount || Number(form.amount) <= 0) return
    setSaving(true)
    await supabase.from("finance_transactions").insert([{ ...form, amount: Number(form.amount) }])
    setModal(false)
    setForm(makeEmpty())
    setSaving(false)
    load()
  }

  const del = async (id: string) => {
    if (!confirm("Hapus transaksi ini?")) return
    await supabase.from("finance_transactions").delete().eq("id", id)
    load()
  }

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n))

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="card" style={{ padding: "10px 14px", fontSize: "12px" }}>
        <div style={{ fontWeight: 700, marginBottom: "6px" }}>{label}</div>
        {payload.map((p: any) => (
          <div key={p.name} style={{ color: p.stroke, display: "flex", gap: "8px", justifyContent: "space-between" }}>
            <span>{p.name}</span><span style={{ fontWeight: 600 }}>Rp {p.value}k</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} className="animate-fade">

      <MotivationBanner page="finance" />

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "18px", fontWeight: 800 }}>Finance Tracker</h2>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="btn btn-ghost" onClick={() => { setSaldoInput(String(saldoAwal)); setSaldoModal(true) }}>
            <Settings size={15} /> Saldo Awal
          </button>
          <button className="btn btn-primary" onClick={() => setModal(true)}>
            <Plus size={16} /> Tambah
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
        {([
          { label: "Saldo Saat Ini",   val: balance,       icon: Wallet,       color: balance >= 0 ? "#2d6a4f" : "#c0392b", bg: balance >= 0 ? "#d8f3dc" : "#fde8e8", sub: `Saldo awal: Rp ${fmt(saldoAwal)}` },
          { label: "Total Pemasukan",  val: totalIncome,   icon: TrendingUp,   color: "#2d6a4f", bg: "#d8f3dc", sub: `${filtered.filter(t => t.type === "income").length} transaksi` },
          { label: "Total Pengeluaran",val: totalExpense,  icon: TrendingDown, color: "#c0392b", bg: "#fde8e8", sub: `${filtered.filter(t => t.type === "expense").length} transaksi` },
        ] as const).map(({ label, val, icon: Icon, color, bg, sub }) => (
          <div key={label} className="card" style={{ padding: "18px 16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div className="label" style={{ marginBottom: "6px" }}>{label}</div>
                <div className="mono" style={{ fontSize: "20px", fontWeight: 800, color, letterSpacing: "-0.02em" }}>
                  Rp {fmt(Math.abs(val))}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text3)", marginTop: "4px" }}>{sub}</div>
              </div>
              <div style={{ width: "34px", height: "34px", borderRadius: "9px", background: bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={17} color={color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="card" style={{ padding: "20px" }}>
          <div className="label" style={{ marginBottom: "4px" }}>Tren</div>
          <div style={{ fontSize: "15px", fontWeight: 800, marginBottom: "16px" }}>Cashflow 14 Hari (ribuan Rp)</div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2d6a4f" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2d6a4f" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c0392b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#c0392b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="income"  stroke="#2d6a4f" fill="url(#inc)" strokeWidth={2} name="Pemasukan" />
              <Area type="monotone" dataKey="expense" stroke="#c0392b" fill="url(#exp)" strokeWidth={2} name="Pengeluaran" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Filter bar */}
      <div className="card" style={{ padding: "12px 16px" }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          <Filter size={14} color="var(--text3)" />
          <div style={{ display: "flex", gap: "6px" }}>
            {(["all", "income", "expense"] as const).map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                style={{
                  padding: "5px 12px", borderRadius: "99px", fontSize: "12px", cursor: "pointer",
                  border: "1.5px solid", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600,
                  borderColor: filterType === t ? "var(--accent)" : "var(--border)",
                  background: filterType === t ? "var(--accent-muted)" : "transparent",
                  color: filterType === t ? "var(--accent)" : "var(--text3)",
                }}>
                {t === "all" ? "Semua" : t === "income" ? "Pemasukan" : "Pengeluaran"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", marginLeft: "auto" }}>
            <input className="input" type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} style={{ width: "140px" }} />
            <span style={{ color: "var(--text3)", fontSize: "12px" }}>—</span>
            <input className="input" type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} style={{ width: "140px" }} />
            {(filterFrom || filterTo) && (
              <button className="btn btn-ghost" style={{ padding: "6px 8px" }} onClick={() => { setFilterFrom(""); setFilterTo("") }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Transaction list */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ borderBottom: "1px solid var(--border)", padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="label">Riwayat</div>
            <div style={{ fontSize: "15px", fontWeight: 800, marginTop: "1px" }}>Transaksi ({filtered.length})</div>
          </div>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", color: "var(--text3)", fontSize: "13px" }}>
            Tidak ada transaksi ditemukan.
          </div>
        ) : (
          filtered.map((t, i) => (
            <div key={t.id}
              style={{
                display: "flex", alignItems: "center", gap: "14px", padding: "13px 20px",
                borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none",
                transition: "background 0.15s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
            >
              <div style={{
                width: "34px", height: "34px", borderRadius: "9px", flexShrink: 0,
                background: t.type === "income" ? "#d8f3dc" : "#fde8e8",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {t.type === "income"
                  ? <TrendingUp size={15} color="#2d6a4f" />
                  : <TrendingDown size={15} color="#c0392b" />
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t.description}
                </div>
                <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text3)", background: "var(--bg)", padding: "1px 7px", borderRadius: "99px", border: "1px solid var(--border)" }}>
                    {t.category}
                  </span>
                  <span className="mono" style={{ fontSize: "11px", color: "var(--text3)" }}>
                    {new Date(t.date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
              <div className="mono" style={{ fontSize: "14px", fontWeight: 800, color: t.type === "income" ? "#2d6a4f" : "#c0392b", whiteSpace: "nowrap" }}>
                {t.type === "income" ? "+" : "−"} Rp {fmt(t.amount)}
              </div>
              <button onClick={() => del(t.id)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: "4px" }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Modal Tambah Transaksi */}
      {modal && (
        <div className="modal-overlay" onClick={() => setModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 800, fontSize: "16px" }}>Tambah Transaksi</span>
              <button onClick={() => setModal(false)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Type toggle */}
              <div style={{ display: "flex", gap: "8px" }}>
                {(["income", "expense"] as const).map(t => (
                  <button key={t}
                    onClick={() => setForm(f => ({ ...f, type: t, category: t === "income" ? "Gaji" : "Makan" }))}
                    style={{
                      flex: 1, padding: "10px", borderRadius: "var(--radius-sm)", cursor: "pointer",
                      border: "1.5px solid", fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: "13px", fontWeight: 700,
                      borderColor: form.type === t ? (t === "income" ? "#2d6a4f" : "#c0392b") : "var(--border)",
                      background: form.type === t ? (t === "income" ? "#d8f3dc" : "#fde8e8") : "transparent",
                      color: form.type === t ? (t === "income" ? "#2d6a4f" : "#c0392b") : "var(--text3)",
                    }}>
                    {t === "income" ? "↑ Pemasukan" : "↓ Pengeluaran"}
                  </button>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <div className="label" style={{ marginBottom: "6px" }}>Tanggal</div>
                  <input className="input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
                </div>
                <div>
                  <div className="label" style={{ marginBottom: "6px" }}>Kategori</div>
                  <select className="input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                    {(form.type === "income" ? CATEGORIES_INCOME : CATEGORIES_EXPENSE).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <div className="label" style={{ marginBottom: "6px" }}>Keterangan</div>
                <input className="input" placeholder="Contoh: Makan siang kantor" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <div className="label" style={{ marginBottom: "6px" }}>Jumlah (Rp)</div>
                <input className="input mono" type="number" placeholder="0" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="btn btn-ghost" onClick={() => setModal(false)} style={{ flex: 1 }}>Batal</button>
                <button className="btn btn-primary" onClick={save} disabled={saving} style={{ flex: 2 }}>
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Saldo Awal */}
      {saldoModal && (
        <div className="modal-overlay" onClick={() => setSaldoModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: "380px" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 800, fontSize: "16px" }}>Atur Saldo Awal</span>
              <button onClick={() => setSaldoModal(false)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ fontSize: "13px", color: "var(--text2)", lineHeight: 1.6 }}>
                Saldo awal adalah uang yang kamu miliki sebelum transaksi pertama dicatat. Nilai ini akan ditambahkan ke total pemasukan untuk menghitung saldo saat ini.
              </p>
              <div>
                <div className="label" style={{ marginBottom: "6px" }}>Saldo Awal (Rp)</div>
                <input className="input mono" type="number" placeholder="Contoh: 5000000"
                  value={saldoInput} onChange={e => setSaldoInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveSaldoAwal()} autoFocus />
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className="btn btn-ghost" onClick={() => setSaldoModal(false)} style={{ flex: 1 }}>Batal</button>
                <button className="btn btn-primary" onClick={saveSaldoAwal} style={{ flex: 2 }}>Simpan</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}