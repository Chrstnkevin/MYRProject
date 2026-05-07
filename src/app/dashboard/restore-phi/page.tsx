"use client"

import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import {
  Database, CheckCircle2, Clock, AlertTriangle, X,
  ChevronRight, Bell, Calendar, Server, Search,
  Save, Image as ImageIcon, Trash2, FileSpreadsheet, FileText, Loader2
} from "lucide-react"
import ModalOverlay from "@/components/layout/ModalOverlay"
import MotivationBanner from "@/components/layout/MotivationBanner"

// ─── Types ────────────────────────────────────────────────────────────────────
interface RestoreEntry {
  id: string
  area: string
  server: string
  adp_code: string
  adp_name: string
  pic_phi: string
  month: number
  year: number
  restore_date: string | null
  trans_date: string | null
  backup_size: number | null
  backup_tools_version: string
  restore_status: string | null
  pic_restore: string | null
  done_restore: boolean
  screenshot_1: string | null
  screenshot_2: string | null
  screenshot_3: string | null
  created_at: string
}

// Master list dari Excel
const MASTER_DATA = [
  { area: "GMA", server: "138", adp_code: "100018", adp_name: "MAGIS I-RIZAL", pic_phi: "JC" },
  { area: "GMA", server: "138", adp_code: "100019", adp_name: "MAGIS II-PASIG", pic_phi: "JC" },
  { area: "GMA", server: "138", adp_code: "100020", adp_name: "MAGIS I-QUEZON CITY", pic_phi: "JC" },
  { area: "GMA", server: "138", adp_code: "100024", adp_name: "ARMATURE-MANILA", pic_phi: "Lindon" },
  { area: "GMA", server: "138", adp_code: "100025", adp_name: "ARMATURE-VALENZUELA", pic_phi: "Lindon" },
  { area: "NOL", server: "138", adp_code: "200012", adp_name: "BUY PINOY-ILOCOS NORTE", pic_phi: "Van" },
  { area: "NOL", server: "138", adp_code: "200018", adp_name: "GIALOGO-AURORA", pic_phi: "Van" },
  { area: "NOL", server: "138", adp_code: "200020", adp_name: "TRES MARIAS-LA UNION", pic_phi: "Van" },
  { area: "NOL", server: "138", adp_code: "200025", adp_name: "TPCI-BATAAN", pic_phi: "Van" },
  { area: "NOL", server: "138", adp_code: "200029", adp_name: "DRDI-NUEVA ECIJA", pic_phi: "Van" },
  { area: "NOL", server: "138", adp_code: "200030", adp_name: "MEN2-PANGASINAN", pic_phi: "Van" },
  { area: "SOL", server: "138", adp_code: "300005", adp_name: "SPARK-UPPER LAGUNA", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300013", adp_name: "ACC-CATANDUANES", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300015", adp_name: "SOLIDCORE-MASBATE", pic_phi: "Lindon" },
  { area: "GMA", server: "138", adp_code: "300016", adp_name: "TOP PERFORMANCE-PALAWAN", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300018", adp_name: "KIMLEDA-OCCIDENTAL MINDORO", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300020", adp_name: "CASCALLA-ROMBLON", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300021", adp_name: "PEARL GAB-MARINDUQUE", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300022", adp_name: "SPARK-LOWER LAGUNA", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300023", adp_name: "TOP PERFORMANCE-ORIENTAL MINDORO", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300025", adp_name: "CHASE-SORSOGON", pic_phi: "Lindon" },
  { area: "SOL", server: "138", adp_code: "300027", adp_name: "AIMRAM-EASTERN QUEZON", pic_phi: "Lindon" },
  { area: "VIS", server: "138", adp_code: "400016", adp_name: "BERTAHAN-CALBAYOG", pic_phi: "Darren" },
  { area: "VIS", server: "138", adp_code: "400017", adp_name: "BERTAHAN-BORONGAN", pic_phi: "Darren" },
  { area: "VIS", server: "138", adp_code: "400018", adp_name: "BERTAHAN-TACLOBAN", pic_phi: "Darren" },
  { area: "VIS", server: "138", adp_code: "400019", adp_name: "TRIPLE FIVE-ILOILO", pic_phi: "Darren" },
  { area: "VIS", server: "138", adp_code: "400025", adp_name: "APEX FOODS-SAN FERNANDO", pic_phi: "Darren" },
  { area: "VIS", server: "138", adp_code: "400027", adp_name: "TRIPLE FIVE-SAN JOSE", pic_phi: "Darren" },
  { area: "MIN", server: "138", adp_code: "500017", adp_name: "NS DISTRIBUTION-TANDAG", pic_phi: "JC" },
  { area: "NOL", server: "228", adp_code: "200003", adp_name: "TPCI-PAMPANGA", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200005", adp_name: "TPCI-ZAMBALES", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200006", adp_name: "TPCI-BULACAN", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200007", adp_name: "PRONTO-CENTRAL PANGASINAN", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200008", adp_name: "NL AZAP-CAR", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200009", adp_name: "NCT-ABRA", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200011", adp_name: "JEZREEL-WEST PANGASINAN", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200013", adp_name: "BUY PINOY-ILOCOS SUR", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200014", adp_name: "SOARINGHIGH-LAL-LO", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200015", adp_name: "STARCHIME-ISABELA", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200027", adp_name: "COMLAI-NUEVA VIZCAYA", pic_phi: "Van" },
  { area: "NOL", server: "228", adp_code: "200028", adp_name: "DRDI-TARLAC", pic_phi: "Van" },
  { area: "SOL", server: "228", adp_code: "300007", adp_name: "STANCE-CAMSUR", pic_phi: "Lindon" },
  { area: "SOL", server: "228", adp_code: "300008", adp_name: "STANCE-CAMNORTE", pic_phi: "Lindon" },
  { area: "SOL", server: "228", adp_code: "300010", adp_name: "MSA-EAST BATANGAS", pic_phi: "Lindon" },
  { area: "SOL", server: "228", adp_code: "300011", adp_name: "CHASE-ALBAY", pic_phi: "Lindon" },
  { area: "SOL", server: "228", adp_code: "300012", adp_name: "MSA-UPPER QUEZON", pic_phi: "Lindon" },
  { area: "VIS", server: "228", adp_code: "400010", adp_name: "APEX FOODS-BOGO", pic_phi: "Darren" },
  { area: "VIS", server: "228", adp_code: "400014", adp_name: "BERTAHAN-SOGOD", pic_phi: "Darren" },
  { area: "VIS", server: "228", adp_code: "400015", adp_name: "BERTAHAN-ORMOC", pic_phi: "Darren" },
  { area: "VIS", server: "228", adp_code: "400021", adp_name: "XCEED GLOBAL-KALIBO", pic_phi: "Darren" },
  { area: "VIS", server: "228", adp_code: "400023", adp_name: "TRIPLE FIVE-GUIMARAS", pic_phi: "Darren" },
  { area: "VIS", server: "228", adp_code: "400026", adp_name: "XCEED GLOBAL-ESTANCIA", pic_phi: "Darren" },
  { area: "MIN", server: "228", adp_code: "500010", adp_name: "CIMEM-TAGUM", pic_phi: "JC" },
  { area: "MIN", server: "228", adp_code: "500011", adp_name: "DAVAO REACH-KIDAPAWAN", pic_phi: "JC" },
  { area: "MIN", server: "228", adp_code: "500013", adp_name: "GDMC-ZAMBOANGA", pic_phi: "JC" },
  { area: "MIN", server: "228", adp_code: "500014", adp_name: "888 SOCSARGEN-DIGOS", pic_phi: "JC" },
  { area: "MIN", server: "228", adp_code: "500015", adp_name: "GDMC-IPIL", pic_phi: "JC" },
  { area: "MIN", server: "228", adp_code: "500028", adp_name: "KGD-OZAMIS", pic_phi: "JC" },
  { area: "MIN", server: "228", adp_code: "500030", adp_name: "EIGHTCHAMS-SAN FRANCISCO", pic_phi: "JC" },
  { area: "GMA", server: "252", adp_code: "100021", adp_name: "MAGIS II-PARANAQUE", pic_phi: "JC" },
  { area: "NOL", server: "252", adp_code: "200024", adp_name: "COMLAI-TUGUEGARAO", pic_phi: "Van" },
  { area: "SOL", server: "252", adp_code: "300001", adp_name: "MSA-LOWER CAVITE", pic_phi: "Lindon" },
  { area: "SOL", server: "252", adp_code: "300002", adp_name: "TOPTRADER-UPPER CAVITE", pic_phi: "Lindon" },
  { area: "SOL", server: "252", adp_code: "300006", adp_name: "CONSUMERPLUS-WEST BATANGAS", pic_phi: "Lindon" },
  { area: "SOL", server: "252", adp_code: "300009", adp_name: "PAKYAHDA-LOWER QUEZON", pic_phi: "Lindon" },
  { area: "VIS", server: "252", adp_code: "400001", adp_name: "APEX FOODS-CEBU", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400002", adp_name: "CGM-BACOLOD", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400003", adp_name: "BROLLEE-CEBU", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400005", adp_name: "SEMIGI-DUMAGUETE", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400006", adp_name: "CGM-CADIZ", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400007", adp_name: "CGM-KABANKALAN", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400020", adp_name: "XCEED GLOBAL-ROXAS", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400024", adp_name: "XCEED GLOBAL-BORACAY", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400028", adp_name: "NETMAN-TAGBILARAN", pic_phi: "Darren" },
  { area: "VIS", server: "252", adp_code: "400029", adp_name: "NETMAN-UBAY", pic_phi: "Darren" },
  { area: "MIN", server: "252", adp_code: "500007", adp_name: "CIMEM-MATI", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500008", adp_name: "DAVAO REACH-GENSAN", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500009", adp_name: "SOUTHMIN-DAVAO", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500020", adp_name: "JOSCHAM-CDO", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500021", adp_name: "JOSCHAM-ILIGAN", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500022", adp_name: "EIGHTCHAMS-SURIGAO", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500023", adp_name: "EIGHTCHAMS-BUTUAN", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500024", adp_name: "EIGHTCHAMS-BUKIDNON", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500025", adp_name: "JOSCHAM-PAGADIAN", pic_phi: "JC" },
  { area: "MIN", server: "252", adp_code: "500027", adp_name: "KGD-DIPOLOG", pic_phi: "JC" },
]

const TOTAL_MASTER = MASTER_DATA.length
const MONTHLY_TARGET = 8
const WEEKLY_TARGET = 2
const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]
const PAGE_SIZE = 20

// ─── Export Helpers ────────────────────────────────────────────────────────────

/** Build flat export rows from merged list + current month/year */
function buildExportRows(
  mergedList: Array<{ master: typeof MASTER_DATA[0]; entry: RestoreEntry | null }>,
  selectedMonth: number,
  selectedYear: number
) {
  return mergedList.map(({ master, entry }) => ({
    "Area":                 master.area,
    "Server":               master.server,
    "ADP Code":             master.adp_code,
    "ADP Name":             master.adp_name,
    "PIC PHI":              master.pic_phi,
    "Month":                entry ? MONTHS[(entry.month ?? 1) - 1] : "",
    "Year":                 selectedYear,
    "Restore Date":         entry?.restore_date ?? "",
    "Trans Date":           entry?.trans_date ?? "",
    "Backup Size":          entry?.backup_size ?? "",
    "Tools Version":        entry?.backup_tools_version ?? "",
    "Restore Status":       entry?.restore_status ?? "",
    "PIC Restore":          entry?.pic_restore ?? "",
    "Done Restore":         entry?.done_restore ? "Yes" : "No",
  }))
}

/** Export to Excel (.xlsx) — pakai xlsx npm package */
async function exportToExcel(
  rows: ReturnType<typeof buildExportRows>,
  filename: string
) {
  const XLSX = await import("xlsx")
  const ws = XLSX.utils.json_to_sheet(rows)
  ws["!cols"] = [
    { wch: 6 }, { wch: 8 }, { wch: 10 }, { wch: 36 }, { wch: 8 },
    { wch: 6 }, { wch: 6 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Restore PHI")
  XLSX.writeFile(wb, filename)
}

/** Export to PDF — pakai jspdf + jspdf-autotable npm package */
async function exportToPDF(
  mergedList: Array<{ master: typeof MASTER_DATA[0]; entry: RestoreEntry | null }>,
  filename: string,
  title: string,
  onProgress: (step: string, pct: number) => void
) {
  onProgress("Loading PDF engine...", 5)

  const { jsPDF } = await import("jspdf")
  // ✅ Correct pattern for Next.js: import autoTable as default, call it as a function
  // Do NOT use (autoTableMod as any).default(jsPDF) — that patches prototype which fails
  const { default: autoTable } = await import("jspdf-autotable")

  onProgress("Preparing data...", 15)

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const PW  = doc.internal.pageSize.getWidth()
  const PH  = doc.internal.pageSize.getHeight()

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFontSize(16); doc.setFont("helvetica", "bold"); doc.setTextColor(232, 56, 26)
  doc.text("Restore DB PHI — Report", 14, 16)
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 80)
  doc.text(title, 14, 22)
  doc.text(`Generated: ${new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`, 14, 27)

  onProgress("Building summary table...", 30)

  const rows = mergedList.map(({ master, entry }) => [
    master.area, master.server, master.adp_code, master.adp_name, master.pic_phi,
    entry?.restore_date ? new Date(entry.restore_date).toLocaleDateString("id-ID") : "—",
    entry?.trans_date   ? new Date(entry.trans_date).toLocaleDateString("id-ID")   : "—",
    entry?.backup_size?.toLocaleString() ?? "—",
    entry?.restore_status ?? "—",
    entry?.pic_restore    ?? "—",
    entry?.done_restore   ? "Yes" : "No",
  ])

  const headers = ["Area","Server","ADP Code","ADP Name","PIC PHI","Restore Date","Trans Date","Backup Size","Status","PIC Restore","Done"]

  // ✅ autoTable(doc, options) — the correct functional API for jspdf-autotable v3+
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 32,
    styles:             { fontSize: 6.5, cellPadding: 1.8, overflow: "linebreak" },
    headStyles:         { fillColor: [232, 56, 26], textColor: 255, fontStyle: "bold", fontSize: 7 },
    alternateRowStyles: { fillColor: [255, 247, 245] },
    columnStyles:       { 3: { cellWidth: 38 }, 10: { halign: "center" } },
    didDrawCell: (data: any) => {
      if (data.section !== "body" || data.column.index !== 10) return
      const val = String(data.cell.raw ?? "")
      const { x, y, width: w, height: h } = data.cell
      if (val === "Yes") {
        doc.setFillColor(220, 252, 231); doc.rect(x, y, w, h, "F")
        doc.setTextColor(22, 163, 74); doc.setFontSize(6.5)
        doc.text("✓ Yes", x + w / 2, y + h / 2 + 1, { align: "center" })
      } else if (val === "No") {
        doc.setFillColor(254, 242, 242); doc.rect(x, y, w, h, "F")
        doc.setTextColor(220, 38, 38); doc.setFontSize(6.5)
        doc.text("✗ No", x + w / 2, y + h / 2 + 1, { align: "center" })
      }
    },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 10)
        data.cell.styles.textColor = [255, 255, 255]
    },
  })

  // ── Screenshot pages: 2 entries per page, max 3 screenshots each ────────────
  // Layout per page (landscape A4):
  //   ┌─────────────────────── ENTRY 1 ───────────────────────┐  ← top half
  //   │ [mini header bar]  name · area · server · code        │
  //   │ [meta: PIC, date, status]                             │
  //   │ [ shot 1 ]   [ shot 2 ]   [ shot 3 ]                  │
  //   ├─────────────────────── ENTRY 2 ───────────────────────┤  ← bottom half
  //   │ ...same structure...                                  │
  //   └───────────────────────────────────────────────────────┘
  //
  // Each "row" height = (PH - top margin - gap - bottom margin) / 2
  // Header bar = 7mm, meta line = 5mm, images fill remaining row height

  const withShots = mergedList.filter(({ entry }) =>
    entry && (entry.screenshot_1 || entry.screenshot_2 || entry.screenshot_3)
  )

  // Helper: load image → { dataUrl, natW, natH }
  const loadImg = (src: string): Promise<{ dataUrl: string; natW: number; natH: number }> =>
    new Promise((res, rej) => {
      const img = new window.Image()
      img.onload = () => {
        const c = document.createElement("canvas")
        c.width = img.naturalWidth; c.height = img.naturalHeight
        c.getContext("2d")!.drawImage(img, 0, 0)
        res({ dataUrl: c.toDataURL("image/png"), natW: img.naturalWidth, natH: img.naturalHeight })
      }
      img.onerror = rej
      img.src = src
    })

  // Helper: draw one entry block at a given Y origin
  const drawEntryBlock = async (
    { master, entry }: typeof withShots[0],
    blockX: number, blockY: number, blockW: number, blockH: number,
    entryGlobalIdx: number
  ) => {
    if (!entry) return
    const shots = [entry.screenshot_1, entry.screenshot_2, entry.screenshot_3].filter(Boolean) as string[]

    const headerH = 7
    const metaH   = 5
    const labelH  = 4
    const imgAreaY = blockY + headerH + metaH + 1
    const imgAreaH = blockH - headerH - metaH - labelH - 2

    // Mini header bar
    doc.setFillColor(232, 56, 26)
    doc.rect(blockX, blockY, blockW, headerH, "F")
    doc.setFontSize(7); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255)
    // Truncate name if too long
    const nameText = `${master.adp_name}  ·  ${master.area}  ·  Svr ${master.server}  ·  ${master.adp_code}`
    doc.text(nameText, blockX + 3, blockY + headerH - 2, { maxWidth: blockW - 6 })

    // Meta line
    doc.setFontSize(6); doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 60)
    const meta = [
      master.pic_phi ? `PIC: ${master.pic_phi}` : "",
      entry.restore_date   ? `Restore: ${new Date(entry.restore_date).toLocaleDateString("id-ID")}` : "",
      entry.restore_status ? `Status: ${entry.restore_status}` : "",
      entry.pic_restore    ? `PIC Restore: ${entry.pic_restore}` : "",
    ].filter(Boolean).join("  |  ")
    doc.text(meta, blockX + 3, blockY + headerH + metaH - 1, { maxWidth: blockW - 6 })

    // Screenshots
    const cols  = shots.length === 1 ? 1 : shots.length === 2 ? 2 : 3
    const gap   = 2
    const slotW = (blockW - gap * (cols - 1)) / cols

    for (let s = 0; s < shots.length; s++) {
      const slotX = blockX + s * (slotW + gap)
      try {
        const { dataUrl, natW, natH } = await loadImg(shots[s])
        const ratio = natW / natH
        let dW = slotW, dH = slotW / ratio
        if (dH > imgAreaH) { dH = imgAreaH; dW = imgAreaH * ratio }
        const dX = slotX + (slotW - dW) / 2
        const dY = imgAreaY + (imgAreaH - dH) / 2
        doc.addImage(dataUrl, "PNG", dX, dY, dW, dH, `e${entryGlobalIdx}s${s}`, "NONE")
      } catch {
        doc.setDrawColor(200); doc.setFillColor(248, 248, 248)
        doc.rect(slotX, imgAreaY, slotW, imgAreaH, "FD")
        doc.setFontSize(6); doc.setTextColor(180)
        doc.text("unavailable", slotX + slotW / 2, imgAreaY + imgAreaH / 2, { align: "center" })
      }
      // Screenshot label
      doc.setFontSize(5.5); doc.setTextColor(140)
      doc.text(`SS ${s + 1}`, slotX + slotW / 2, imgAreaY + imgAreaH + labelH - 1, { align: "center" })
    }

    // Separator line at bottom of block (skip for last block on page)
    doc.setDrawColor(220); doc.setLineWidth(0.3)
    doc.line(blockX, blockY + blockH - 0.5, blockX + blockW, blockY + blockH - 0.5)
  }

  const pageMargin = 6
  const pageGap    = 3   // gap between the 2 entry rows
  const usableW    = PW - pageMargin * 2
  const usableH    = PH - pageMargin * 2
  const blockH     = (usableH - pageGap) / 2  // half page per entry

  for (let i = 0; i < withShots.length; i += 2) {
    doc.addPage("a4", "landscape")
    onProgress(`Screenshots page ${Math.floor(i / 2) + 1}/${Math.ceil(withShots.length / 2)}...`,
      50 + Math.round((i / withShots.length) * 40))

    // Top entry
    await drawEntryBlock(withShots[i], pageMargin, pageMargin, usableW, blockH, i)

    // Bottom entry (if exists)
    if (withShots[i + 1]) {
      await drawEntryBlock(withShots[i + 1], pageMargin, pageMargin + blockH + pageGap, usableW, blockH, i + 1)
    }
  }

  onProgress("Finalizing...", 95)
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i); doc.setFontSize(6.5); doc.setTextColor(180)
    doc.text(`Page ${i} / ${pageCount}`, PW - 14, PH - 4, { align: "right" })
  }

  doc.save(filename)
  onProgress("Done!", 100)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}

function ProgressRing({ value, max, size = 72, color = "var(--accent)" }: { value: number; max: number; size?: number; color?: string }) {
  const pct = max === 0 ? 0 : Math.min(value / max, 1)
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
    </svg>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RestorePhiPage() {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const currentWeek = getWeekNumber(now)

  const [entries, setEntries] = useState<RestoreEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterArea, setFilterArea] = useState("all")
  const [filterServer, setFilterServer] = useState("all")
  const [filterDone, setFilterDone] = useState("all")
  const [selectedMonth, setSelectedMonth] = useState<string>(String(currentMonth))
  const [selectedYear,  setSelectedYear]  = useState(currentYear)
  const [page, setPage] = useState(1)

  // ── Export state ──────────────────────────────────────────────────────────
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null)
  const [exportProgress, setExportProgress] = useState({ step: "", pct: 0 })

  // Paste screenshot handler
  const handlePaste = (idx: number, e: React.ClipboardEvent) => {
    const item = Array.from(e.clipboardData.items).find(i => i.type.startsWith("image/"))
    if (!item) return
    e.preventDefault()
    const file = item.getAsFile()
    if (file) fileToBase64(file).then(b64 => setScreenshots(prev => { const n = [...prev]; n[idx] = b64; return n }))
  }

  // Detail modal
  const [detailItem, setDetailItem] = useState<{ master: typeof MASTER_DATA[0]; entry: RestoreEntry | null; done: boolean } | null>(null)
  const [picPopup, setPicPopup] = useState<string | null>(null)  // PIC name for popup

  // Form state
  const [form, setForm] = useState({
    restore_date: new Date().toISOString().split("T")[0],  // manual — bisa diubah
    trans_date: "",
    backup_size: "",
    backup_tools_version: "24.05.00",
    restore_status: "Success",
    pic_restore: "Kevin",
  })
  const [screenshots, setScreenshots] = useState<(string | null)[]>([null, null, null])
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    // Exclude screenshot columns — bisa sangat berat (base64 images)
    // Screenshot di-load on-demand saat buka detail
    const { data } = await supabase
      .from("restore_phi")
      .select("id, area, server, adp_code, adp_name, pic_phi, month, year, restore_date, trans_date, backup_size, backup_tools_version, restore_status, pic_restore, done_restore")
      .eq("year", selectedYear)
    if (data) setEntries(data as RestoreEntry[])
    setLoading(false)
  }

  useEffect(() => { load() }, [selectedYear])  // only reload when year changes

  // Build merged list: master + entry data
  // Entry = latest restore per ADP dalam tahun ini (tidak per bulan)
  // Filter bulan hanya untuk tampilan kolom Month & Restore Date
  const mergedList = useMemo(() => {
    return MASTER_DATA.map(m => {
      // Ambil semua entries untuk ADP ini dalam tahun ini
      const adpEntries = entries.filter(e => e.adp_code === m.adp_code)
      // Ambil yang paling baru (latest restore_date)
      const latestEntry = adpEntries.length > 0
        ? adpEntries.sort((a, b) =>
            (b.restore_date ?? "").localeCompare(a.restore_date ?? "")
          )[0]
        : null
      // Filter entry untuk tampilan bulan (jika filter bulan aktif)
      const displayEntry = selectedMonth === "all"
        ? latestEntry
        : adpEntries.find(e => e.month === Number(selectedMonth)) ?? latestEntry
      return { master: m, entry: displayEntry || null, done: latestEntry?.done_restore ?? false }
    })
  }, [entries, selectedMonth])

  // ── handleExport — must be after mergedList ────────────────────────────────
  const handleExport = useCallback(async (type: "excel" | "pdf") => {
    setExporting(type)
    setExportProgress({ step: "Mempersiapkan data...", pct: 0 })
    try {
      const monthLabel = selectedMonth === "all" ? "Semua_Bulan" : MONTHS[Number(selectedMonth) - 1]
      const base = `Restore_PHI_${monthLabel}_${selectedYear}`
      if (type === "excel") {
        setExportProgress({ step: "Menyusun spreadsheet...", pct: 30 })
        const rows = buildExportRows(mergedList, selectedMonth === "all" ? currentMonth : Number(selectedMonth), selectedYear)
        await exportToExcel(rows, `${base}.xlsx`)
        setExportProgress({ step: "Selesai!", pct: 100 })
      } else {
        const title = `${monthLabel} ${selectedYear}  ·  ${mergedList.filter(m => m.done).length}/${mergedList.length} Done`
        await exportToPDF(
          mergedList,
          `${base}.pdf`,
          title,
          (step, pct) => setExportProgress({ step, pct })
        )
      }
    } catch (err) {
      console.error("Export error:", err)
      alert(`Export gagal: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTimeout(() => {
        setExporting(null)
        setExportProgress({ step: "", pct: 0 })
      }, 800)
    }
  }, [mergedList, selectedMonth, selectedYear])

  // Stats
  const doneThisMonth = selectedMonth === "all"
    ? mergedList.filter(m => m.done).length
    : entries.filter(e => e.done_restore && e.month === Number(selectedMonth)).length
  const doneThisWeek = entries.filter(e => {
    if (!e.done_restore || !e.restore_date) return false
    return getWeekNumber(new Date(e.restore_date)) === currentWeek && new Date(e.restore_date).getFullYear() === currentYear
  }).length

  // Annual: count by month
  const annualData = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      return entries.filter(e => e.done_restore && e.month === m).length
    })
  }, [entries])
  // Unique ADPs restored this year (bukan total restore events)
  const doneThisYear = mergedList.filter(m => m.done).length

  // Reminder logic
  const monthlyOk = doneThisMonth >= MONTHLY_TARGET
  const weeklyOk = doneThisWeek >= WEEKLY_TARGET
  const showReminder = !monthlyOk || !weeklyOk

  // Filtered list
  const filtered = useMemo(() => {
    return mergedList.filter(({ master }) => {
      if (filterArea !== "all" && master.area !== filterArea) return false
      if (filterServer !== "all" && master.server !== filterServer) return false
      if (filterDone === "yes" && !mergedList.find(m => m.master.adp_code === master.adp_code)?.done) return false
      if (filterDone === "no" && mergedList.find(m => m.master.adp_code === master.adp_code)?.done) return false
      if (search && !master.adp_name.toLowerCase().includes(search.toLowerCase()) && !master.adp_code.includes(search)) return false
      return true
    })
  }, [mergedList, filterArea, filterServer, filterDone, search, entries])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [filterArea, filterServer, filterDone, search, selectedMonth])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Open detail
  const openDetail = (item: typeof mergedList[0]) => {
    setDetailItem(item)
    if (item.entry) {
      setForm({
        restore_date: item.entry.restore_date || new Date().toISOString().split("T")[0],
        trans_date: item.entry.trans_date || "",
        backup_size: item.entry.backup_size?.toString() || "",
        backup_tools_version: item.entry.backup_tools_version || "24.05.00",
        restore_status: item.entry.restore_status || "Success",
        pic_restore: item.entry.pic_restore || "Kevin",
      })
      // Load screenshots on-demand — tidak ikut main list query
      setScreenshots([null, null, null])
      supabase.from("restore_phi")
        .select("screenshot_1, screenshot_2, screenshot_3")
        .eq("id", item.entry.id)
        .single()
        .then(({ data }) => {
          if (data) setScreenshots([data.screenshot_1 || null, data.screenshot_2 || null, data.screenshot_3 || null])
        })
    } else {
      setForm({ restore_date: new Date().toISOString().split("T")[0], trans_date: "", backup_size: "", backup_tools_version: "24.05.00", restore_status: "Success", pic_restore: "Kevin" })
      setScreenshots([null, null, null])
    }
  }

  const handleSave = async () => {
    if (!detailItem) return
    setSaving(true)
    // Month dan year diambil dari restore_date yang diisi manual
    const restoreDateObj = form.restore_date ? new Date(form.restore_date) : new Date()
    const entryMonth = restoreDateObj.getMonth() + 1
    const entryYear  = restoreDateObj.getFullYear()
    const payload = {
      area: detailItem.master.area,
      server: detailItem.master.server,
      adp_code: detailItem.master.adp_code,
      adp_name: detailItem.master.adp_name,
      pic_phi: detailItem.master.pic_phi,
      month: entryMonth,
      year: entryYear,
      restore_date: form.restore_date || null,
      trans_date: form.trans_date || null,
      backup_size: form.backup_size ? Number(form.backup_size) : null,
      backup_tools_version: form.backup_tools_version,
      restore_status: form.restore_status,
      pic_restore: form.pic_restore,
      done_restore: true,
      screenshot_1: screenshots[0] || null,
      screenshot_2: screenshots[1] || null,
      screenshot_3: screenshots[2] || null,
    }

    if (detailItem.entry) {
      await supabase.from("restore_phi").update(payload).eq("id", detailItem.entry.id)
    } else {
      await supabase.from("restore_phi").insert([payload])
    }
    setSaving(false)
    setDetailItem(null)
    load()
  }

  const areas = [...new Set(MASTER_DATA.map(m => m.area))].sort()
  const servers = [...new Set(MASTER_DATA.map(m => m.server))].sort()

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }} className="animate-fade">
      <MotivationBanner page="restore" />
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
        </div>
      </div>

      {/* Reminder Banner */}
      {showReminder && (
        <div style={{ background: "var(--warning-bg)", border: "1px solid #fcd34d", borderRadius: "var(--radius)", padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
          <Bell size={18} color="var(--warning)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--warning)" }}>Reminder Restore</div>
            <div style={{ fontSize: 12, color: "var(--warning)", marginTop: 2 }}>
              {!monthlyOk && `Bulan ini baru ${doneThisMonth}/${MONTHLY_TARGET} restore (target 8x/bulan). `}
              {!weeklyOk && `Minggu ini baru ${doneThisWeek}/${WEEKLY_TARGET} restore (target 2x/minggu).`}
            </div>
          </div>
        </div>
      )}

      {/* Progress Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 22 }} className="stagger progress-cards">
        {/* Yearly */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Progress Tahunan</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <ProgressRing value={doneThisYear} max={TOTAL_MASTER} size={72} color="var(--accent)" />
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.04em", lineHeight: 1 }}>{doneThisYear}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>dari {TOTAL_MASTER} total ADP</div>
              <div style={{ fontSize: 11, marginTop: 6, color: "var(--accent)", fontWeight: 600 }}>{Math.round(doneThisYear / TOTAL_MASTER * 100)}% selesai</div>
            </div>
          </div>
          {/* Mini bar per bulan */}
          <div style={{ marginTop: 14, display: "flex", gap: 3, alignItems: "flex-end" }}>
            {annualData.map((v, i) => (
              <div key={i} title={`${MONTHS[i]}: ${v}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ width: "100%", background: i + 1 === Number(selectedMonth) ? "var(--accent)" : v > 0 ? "var(--accent3)" : "var(--surface3)", borderRadius: 3, height: Math.max(4, v * 3), transition: "height 0.3s" }} />
                <div style={{ fontSize: 8, color: "var(--text3)" }}>{MONTHS[i].slice(0,1)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly */}
        <div className="card" style={{ padding: 20, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Progress Bulanan</div>
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="input" style={{ width: "auto", padding: "3px 8px", fontSize: 11 }}>
              {MONTHS.map((m, i) => <option key={i} value={String(i + 1)}>{m}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <ProgressRing value={doneThisMonth} max={MONTHLY_TARGET} size={72} color={monthlyOk ? "var(--success)" : "var(--warning)"} />
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.04em", lineHeight: 1 }}>{doneThisMonth}</div>
              <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 2 }}>dari {MONTHLY_TARGET} target</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 6, background: monthlyOk ? "var(--success-bg)" : "var(--warning-bg)", color: monthlyOk ? "var(--success)" : "var(--warning)", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                {monthlyOk ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                {monthlyOk ? "Target terpenuhi" : `Kurang ${MONTHLY_TARGET - doneThisMonth}x lagi`}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 5 }}>Sisa restore bulan ini</div>
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: MONTHLY_TARGET }, (_, i) => (
                <div key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: i < doneThisMonth ? "var(--accent)" : "var(--surface3)", transition: "background 0.3s" }} />
              ))}
            </div>
          </div>
        </div>

        {/* Kontribusi Per Orang */}
        <div className="card" style={{ padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>Kontribusi Per Orang</div>
          {(() => {
            const PICs = [
              { name: "Kevin", target: 43, color: "var(--accent)" },
              { name: "Risky",  target: 42, color: "#F97316" },
            ]
            const total = TOTAL_MASTER // 85

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {PICs.map(({ name, target, color }) => {
                  // Count actual done restores by this PIC this year
                  const done = entries.filter(e =>
                    e.done_restore &&
                    e.pic_restore?.toLowerCase().includes(name.toLowerCase())
                  ).length
                  const pct = Math.round(target / total * 100)
                  return (
                    <div key={name}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${color}20`, border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color }}>
                            {name[0]}
                          </div>
                          <span onClick={() => setPicPopup(name)}
                            style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 3 }}>
                            {name}
                          </span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: 11, color: "var(--text3)" }}>target </span>
                          <span style={{ fontSize: 20, fontWeight: 900, color, fontFamily: "var(--font-display,sans-serif)", lineHeight: 1 }}>{target}</span>
                          <span style={{ fontSize: 11, color: "var(--text3)", marginLeft: 4 }}>ADP</span>
                        </div>
                      </div>
                      {/* Progress: done vs target */}
                      <div style={{ height: 8, background: "var(--surface3)", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(done / target * 100, 100)}%`, background: color, borderRadius: 99, transition: "width 0.6s cubic-bezier(0.4,0,0.2,1)" }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text3)", marginTop: 3 }}>
                        <span>{done} sudah selesai</span>
                        <span>{done > 0 ? Math.round(done / target * 100) : 0}% dari target</span>
                      </div>
                    </div>
                  )
                })}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "var(--text3)" }}>Total {selectedYear}</span>
                  <span style={{ fontWeight: 700, color: "var(--text)" }}>{total} ADP</span>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text3)", pointerEvents: "none" }} />
            <input className="input" placeholder="Cari ADP Name / ADP Code..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 32 }} />
          </div>

          {/* Month + Year selector */}
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}
              className="input" style={{ width: "auto", fontSize: 12, fontWeight: 600 }}>
              <option value="all">Semua Bulan</option>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
              className="input" style={{ width: "auto", fontSize: 12, fontWeight: 600 }}>
              {[currentYear - 1, currentYear, currentYear + 1].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>

          <div className="filter-toggles" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 0, border: "1.5px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden", background: "var(--surface)" }}>
              {["all",...areas].map((a, i) => (
                <button key={a} onClick={() => setFilterArea(a)}
                  style={{ padding: "7px 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: filterArea === a ? 700 : 500,
                    background: filterArea === a ? "var(--accent)" : "transparent",
                    color: filterArea === a ? "white" : "var(--text2)",
                    borderRight: i < areas.length ? "1px solid var(--border)" : "none",
                    transition: "all 0.15s" }}>
                  {a === "all" ? "Semua" : a}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 0, border: "1.5px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden", background: "var(--surface)" }}>
              {["all",...servers].map((s, i) => (
                <button key={s} onClick={() => setFilterServer(s)}
                  style={{ padding: "7px 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: filterServer === s ? 700 : 500,
                    background: filterServer === s ? "var(--accent)" : "transparent",
                    color: filterServer === s ? "white" : "var(--text2)",
                    borderRight: i < servers.length ? "1px solid var(--border)" : "none",
                    transition: "all 0.15s" }}>
                  {s === "all" ? "All Server" : `SRV ${s}`}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 0, border: "1.5px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden", background: "var(--surface)" }}>
              {[{v:"all",l:"Semua"},{v:"yes",l:"✓ Done"},{v:"no",l:"Belum"}].map(({v,l},i) => (
                <button key={v} onClick={() => setFilterDone(v)}
                  style={{ padding: "7px 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: filterDone === v ? 700 : 500,
                    background: filterDone === v ? (v === "yes" ? "var(--success)" : v === "no" ? "var(--danger)" : "var(--accent)") : "transparent",
                    color: filterDone === v ? "white" : "var(--text2)",
                    borderRight: i < 2 ? "1px solid var(--border)" : "none",
                    transition: "all 0.15s" }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 12, color: "var(--text3)", whiteSpace: "nowrap", background: "var(--surface3)", padding: "6px 12px", borderRadius: "var(--radius-sm)" }}>
            {filtered.length} / {TOTAL_MASTER} entries
          </div>

          {/* ── Export Buttons ── */}
          <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
            <button
              onClick={() => handleExport("excel")}
              disabled={!!exporting}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: "var(--radius-sm)", border: "1.5px solid #16a34a40", background: exporting === "excel" ? "#16a34a" : "#f0fdf4", color: exporting === "excel" ? "white" : "#16a34a", cursor: exporting ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s", whiteSpace: "nowrap", opacity: exporting && exporting !== "excel" ? 0.5 : 1 }}
              onMouseEnter={e => { if (!exporting) { e.currentTarget.style.background = "#16a34a"; e.currentTarget.style.color = "white" } }}
              onMouseLeave={e => { if (!exporting) { e.currentTarget.style.background = "#f0fdf4"; e.currentTarget.style.color = "#16a34a" } }}
            >
              {exporting === "excel"
                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Exporting...</>
                : <><FileSpreadsheet size={13} /> Export Excel</>
              }
            </button>
            <button
              onClick={() => handleExport("pdf")}
              disabled={!!exporting}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: "var(--radius-sm)", border: "1.5px solid #dc262640", background: exporting === "pdf" ? "#dc2626" : "#fff5f5", color: exporting === "pdf" ? "white" : "#dc2626", cursor: exporting ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, fontFamily: "inherit", transition: "all 0.2s", whiteSpace: "nowrap", opacity: exporting && exporting !== "pdf" ? 0.5 : 1 }}
              onMouseEnter={e => { if (!exporting) { e.currentTarget.style.background = "#dc2626"; e.currentTarget.style.color = "white" } }}
              onMouseLeave={e => { if (!exporting) { e.currentTarget.style.background = "#fff5f5"; e.currentTarget.style.color = "#dc2626" } }}
            >
              {exporting === "pdf"
                ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Exporting...</>
                : <><FileText size={13} /> Export PDF</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)" }}>
                {["AREA","SERVER","ADP CODE","ADP NAME","MONTH","RESTORE DATE","DONE RESTORE",""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "var(--text3)", textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>Tidak ada data</td></tr>
              ) : filtered.map(({ master, entry, done }) => {
                return (
                  <tr key={master.adp_code} style={{ borderBottom: "1px solid var(--border)", transition: "background 0.15s", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--surface2)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    onClick={() => openDetail({ master, entry, done })}>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: "var(--accent-muted)", color: "var(--accent)", padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{master.area}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--text2)", fontWeight: 500 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Server size={12} color="var(--text3)" />
                        {master.server}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "var(--font-mono, monospace)", color: "var(--text2)" }}>{master.adp_code}</td>
                    <td style={{ padding: "10px 14px", fontSize: 13, color: "var(--text)", fontWeight: 500, maxWidth: 220 }}>{master.adp_name}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text3)" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <Calendar size={12} />
                        {entry ? `${MONTHS[(entry.month ?? 1) - 1]} ${entry.year}` : "—"}
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text2)" }}>
                      {entry?.restore_date ? new Date(entry.restore_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : <span style={{ color: "var(--text3)" }}>—</span>}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span className={`badge ${done ? "badge-done" : "badge-todo"}`}>
                        {done ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                        {done ? "Yes" : "No"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <ChevronRight size={16} color="var(--text3)" />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, padding: "0 4px" }}>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>
            Halaman {page} dari {totalPages} · {filtered.length} entries
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn btn-ghost" onClick={() => setPage(1)} disabled={page === 1} style={{ padding: "6px 10px", fontSize: 12, opacity: page === 1 ? 0.4 : 1 }}>«</button>
            <button className="btn btn-ghost" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "6px 12px", fontSize: 12, opacity: page === 1 ? 0.4 : 1 }}>‹ Prev</button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 3, totalPages - 6))
              const p = start + i
              return (
                <button key={p} onClick={() => setPage(p)}
                  style={{ padding: "6px 11px", borderRadius: "var(--radius-xs)", fontSize: 12, fontWeight: p === page ? 700 : 500, border: "1.5px solid",
                    background: p === page ? "var(--accent)" : "transparent",
                    color: p === page ? "white" : "var(--text2)",
                    borderColor: p === page ? "var(--accent)" : "var(--border)", cursor: "pointer" }}>
                  {p}
                </button>
              )
            })}
            <button className="btn btn-ghost" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "6px 12px", fontSize: 12, opacity: page === totalPages ? 0.4 : 1 }}>Next ›</button>
            <button className="btn btn-ghost" onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: "6px 10px", fontSize: 12, opacity: page === totalPages ? 0.4 : 1 }}>»</button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailItem && (
        <ModalOverlay onClose={() => setDetailItem(null)}>
          <div className="modal" style={{ maxWidth: 700, width: "100%", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.02em" }}>{detailItem.master.adp_name}</div>
                <div style={{ fontSize: 12, color: "var(--text3)", marginTop: 3, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ background: "var(--accent-muted)", color: "var(--accent)", padding: "1px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>{detailItem.master.area}</span>
                  <span>Server {detailItem.master.server}</span>
                  <span style={{ fontFamily: "monospace" }}>{detailItem.master.adp_code}</span>
                  <span>· PIC PHI: <strong>{detailItem.master.pic_phi}</strong></span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span className={`badge ${detailItem.entry?.done_restore ? "badge-done" : "badge-todo"}`}>
                  {detailItem.entry?.done_restore ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                  {detailItem.entry?.done_restore ? "Done" : "Belum"}
                </span>
                <button onClick={() => setDetailItem(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 6, borderRadius: "var(--radius-xs)" }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body — 2 column layout */}
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Left column */}
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div className="label">Detail Restore — {selectedMonth === "all" ? "Semua Bulan" : MONTHS[Number(selectedMonth) - 1]} {selectedYear}</div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 5 }}>
                      Restore Date <span style={{ color: "var(--danger)", fontWeight: 400 }}>*</span>
                    </label>
                    <input type="date" className="input" value={form.restore_date}
                      onChange={e => setForm(f => ({ ...f, restore_date: e.target.value }))} />
                    <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 4 }}>
                      Bulan &amp; tahun data akan mengikuti tanggal restore ini
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 5 }}>Trans Date</label>
                    <input type="date" className="input" value={form.trans_date} onChange={e => setForm(f => ({ ...f, trans_date: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 5 }}>Backup Size</label>
                    <input type="number" className="input" placeholder="e.g. 634739" value={form.backup_size} onChange={e => setForm(f => ({ ...f, backup_size: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 5 }}>Backup Tools Version</label>
                    <input className="input" value={form.backup_tools_version} onChange={e => setForm(f => ({ ...f, backup_tools_version: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 5 }}>Restore Status</label>
                    <select className="input" value={form.restore_status} onChange={e => setForm(f => ({ ...f, restore_status: e.target.value }))}>
                      <option value="Success">Success</option>
                      <option value="Failed">Failed</option>
                      <option value="Pending">Pending</option>
                      <option value="In Progress">In Progress</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)", display: "block", marginBottom: 5 }}>PIC Restore</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {["Kevin", "Risky"].map(p => (
                        <button key={p} type="button" onClick={() => setForm(f => ({ ...f, pic_restore: p }))}
                          style={{ flex: 1, padding: "8px", borderRadius: "var(--radius-sm)", border: "1.5px solid", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all 0.15s",
                            background: form.pic_restore === p ? "var(--accent)" : "transparent",
                            color: form.pic_restore === p ? "white" : "var(--text2)",
                            borderColor: form.pic_restore === p ? "var(--accent)" : "var(--border2)" }}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right column — Screenshots */}
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="label">Screenshot</div>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginTop: -4, marginBottom: 2, lineHeight: 1.5 }}>
                    Klik salah satu kotak di bawah, lalu tekan{" "}
                    <kbd style={{ background: "var(--surface3)", border: "1px solid var(--border2)", borderRadius: 4, padding: "1px 6px", fontFamily: "monospace", fontSize: 11 }}>Ctrl+V</kbd>{" "}
                    untuk paste langsung dari Snipping Tool.
                  </div>
                  {[0, 1, 2].map(idx => (
                    <div key={idx}>
                      {screenshots[idx] ? (
                        /* ── Image preview ── */
                        <div style={{ position: "relative", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border)" }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={screenshots[idx]!} alt={`Screenshot ${idx + 1}`} style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
                          {/* Only show delete — no upload button */}
                          <button
                            onClick={() => setScreenshots(prev => { const n = [...prev]; n[idx] = null; return n })}
                            title="Hapus screenshot"
                            style={{ position: "absolute", top: 6, right: 6, background: "rgba(192,57,43,0.85)", border: "none", borderRadius: 6, padding: "4px 8px", color: "white", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                            <Trash2 size={11} /> Hapus
                          </button>
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.45)", padding: "4px 10px", fontSize: 10, color: "white" }}>
                            Screenshot {idx + 1}
                          </div>
                        </div>
                      ) : (
                        /* ── Paste zone — click to focus, then Ctrl+V ── */
                        <div
                          tabIndex={0}
                          onPaste={e => handlePaste(idx, e)}
                          style={{ width: "100%", height: 100, border: "2px dashed var(--border2)", borderRadius: "var(--radius-sm)", background: "var(--surface2)", cursor: "text", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, color: "var(--text3)", transition: "border-color 0.15s, background 0.15s, color 0.15s", outline: "none" }}
                          onFocus={e => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--accent-muted)"; e.currentTarget.style.color = "var(--accent)" }}
                          onBlur={e => { e.currentTarget.style.borderColor = "var(--border2)"; e.currentTarget.style.background = "var(--surface2)"; e.currentTarget.style.color = "var(--text3)" }}>
                          <ImageIcon size={16} />
                          <span style={{ fontSize: 11, fontWeight: 700 }}>Screenshot {idx + 1}</span>
                          <span style={{ fontSize: 10 }}>Klik di sini → Ctrl+V</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Info box */}
              <div style={{ background: "var(--accent-muted)", border: "1px solid var(--accent-light)", borderRadius: "var(--radius-xs)", padding: "10px 14px", marginTop: 18, fontSize: 12, color: "var(--accent2)" }}>
                💾 Saat disimpan, <strong>Done Restore</strong> akan otomatis menjadi <strong>Yes</strong> dan tanggal restore dicatat sebagai hari ini.
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border)", display: "flex", gap: 10, justifyContent: "flex-end", flexShrink: 0 }}>
              <button className="btn btn-ghost" onClick={() => setDetailItem(null)}>Batal</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={15} />
                {saving ? "Menyimpan..." : "Simpan & Mark Done"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {/* ── Export Loading Modal ── */}
      {exporting && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--card)", borderRadius: 20, padding: "36px 40px", minWidth: 320, maxWidth: 400, width: "90%", boxShadow: "0 32px 80px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", alignItems: "center", gap: 20, animation: "modal-pop 0.25s cubic-bezier(0.34,1.56,0.64,1)" }}>

            {/* Icon */}
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: exporting === "pdf" ? "#fef2f2" : "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
              {exporting === "pdf"
                ? <FileText size={28} color="#dc2626" />
                : <FileSpreadsheet size={28} color="#16a34a" />
              }
              {/* Spinning ring */}
              <svg style={{ position: "absolute", inset: 0, animation: "spin 1.2s linear infinite" }} width={64} height={64} viewBox="0 0 64 64">
                <circle cx={32} cy={32} r={28} fill="none" strokeWidth={3}
                  stroke={exporting === "pdf" ? "#dc2626" : "#16a34a"}
                  strokeDasharray="44 132" strokeLinecap="round" />
              </svg>
            </div>

            {/* Title */}
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)", marginBottom: 4 }}>
                {exporting === "pdf" ? "Generating PDF..." : "Generating Excel..."}
              </div>
              <div style={{ fontSize: 12, color: "var(--text3)", minHeight: 18 }}>
                {exportProgress.step}
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ width: "100%", height: 8, background: "var(--surface3)", borderRadius: 99, overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 99,
                background: exporting === "pdf"
                  ? "linear-gradient(90deg,#dc2626,#f87171)"
                  : "linear-gradient(90deg,#16a34a,#4ade80)",
                width: `${exportProgress.pct}%`,
                transition: "width 0.4s cubic-bezier(0.4,0,0.2,1)",
              }} />
            </div>

            {/* Percentage */}
            <div style={{ fontSize: 24, fontWeight: 900, color: exporting === "pdf" ? "#dc2626" : "#16a34a", letterSpacing: "-0.04em" }}>
              {exportProgress.pct}%
            </div>

            {exporting === "pdf" && (
              <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "center", lineHeight: 1.5 }}>
                PDF mencakup tabel ringkasan + halaman screenshot<br />per entry yang sudah Done
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes modal-pop {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
        @media (max-width: 768px) {
          .progress-cards {
            grid-template-columns: 1fr !important;
          }
          .filter-toggles {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 4px;
          }
        }
        @media (max-width: 480px) {
          .progress-cards {
            grid-template-columns: 1fr !important;
          }
        }
      `}
      {/* PIC Detail Popup */}
      {picPopup && (() => {
        const picEntries = entries.filter(e =>
          e.done_restore && e.pic_restore?.toLowerCase().includes(picPopup.toLowerCase())
        ).sort((a, b) => (b.restore_date ?? "").localeCompare(a.restore_date ?? ""))
        const PIC_COLOR = picPopup === "Kevin" ? "var(--accent)" : "#F97316"
        return (
          <ModalOverlay onClose={() => setPicPopup(null)}>
            <div style={{ background: "var(--surface)", borderRadius: "var(--radius)", padding: 24, width: "min(540px, 95vw)", maxHeight: "80vh", display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${PIC_COLOR}20`, border: `2px solid ${PIC_COLOR}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 800, color: PIC_COLOR }}>{picPopup[0]}</div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "var(--text)" }}>{picPopup}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{picEntries.length} ADP sudah di-restore · {selectedYear}</div>
                  </div>
                </div>
                <button onClick={() => setPicPopup(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 6, borderRadius: 6 }}>✕</button>
              </div>
              <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                {picEntries.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "24px 0" }}>Belum ada restore yang selesai</div>
                ) : picEntries.map((e, i) => {
                  const master = MASTER_DATA.find(m => m.adp_code === e.adp_code)
                  return (
                    <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--surface2)", borderRadius: "var(--radius-xs)", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text3)", minWidth: 24, textAlign: "center" }}>{i + 1}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{master?.adp_name ?? e.adp_code}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2, display: "flex", gap: 10 }}>
                          <span>{e.adp_code}</span>
                          {master?.area && <span style={{ background: "var(--accent-muted)", color: "var(--accent)", padding: "0 6px", borderRadius: 99, fontWeight: 600 }}>{master.area}</span>}
                          {master?.server && <span>SRV {master.server}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text2)" }}>{e.restore_date ? new Date(e.restore_date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—"}</div>
                        <div style={{ fontSize: 10, color: "var(--text3)", marginTop: 1 }}>{MONTHS[(e.month ?? 1) - 1]} {e.year}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </ModalOverlay>
        )
      })()}
</style>
    </div>
  )
}