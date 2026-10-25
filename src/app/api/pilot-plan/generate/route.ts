import { NextRequest, NextResponse } from "next/server"
import { buildPilotPlanWorkbook, type PilotPlanSubdistRow, type PilotPlanDocRow } from "@/lib/pilotPlan"

interface Body {
  planName: string
  subdist: PilotPlanSubdistRow[]
  docs: PilotPlanDocRow[]
}

export async function POST(req: NextRequest) {
  try {
    const body: Body = await req.json()
    if (!body.planName) return NextResponse.json({ error: "planName wajib diisi" }, { status: 400 })

    const buffer = await buildPilotPlanWorkbook(body.planName, body.subdist || [], body.docs || [])
    const fname = `Form_Detail_PILOT_${body.planName}`.replace(/[\\/:*?"<>|]/g, "_")

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fname}.xlsx"`,
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Gagal generate Excel: ${msg}` }, { status: 500 })
  }
}
