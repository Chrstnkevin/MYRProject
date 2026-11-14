import { NextRequest, NextResponse } from "next/server"
import { buildPlanPilotReportWorkbook, type PlanPilotReportData } from "@/lib/planPilotExcelTemplate"

// Generate file .xlsx "Form Detail RELEASE" dari data yang udah
// divalidasi/diedit user di popup (lihat PlanPilotReportModal di
// src/app/dashboard/coda/page.tsx). Jalan di server karena styling
// Excel lengkap (font/fill/border/merge) lebih berat buat di-bundle
// ke browser.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PlanPilotReportData
    if (!body.releaseName) return NextResponse.json({ error: "releaseName wajib diisi" }, { status: 400 })
    const wb = buildPlanPilotReportWorkbook(body)
    const buf = await wb.xlsx.writeBuffer()
    const safeName = body.releaseName.replace(/[^\w.-]+/g, "_")
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Form_Request_Pilot_${safeName}.xlsx"`,
      },
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
