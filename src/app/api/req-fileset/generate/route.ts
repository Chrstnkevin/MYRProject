import { NextRequest, NextResponse } from "next/server"
import {
  parseMainTxt, parseTambahanTxt, parseVanTxt,
  matchMain, matchTambahan, matchKanvas,
  buildWorkbook,
  type ClassifiedRow, type ReqHeader,
} from "@/lib/reqFileSet"

interface Body {
  header: ReqHeader
  rows: ClassifiedRow[]
  mainTxt: string
  tambahanTxt: string
  vanTxt: string
}

export async function POST(req: NextRequest) {
  const body: Body = await req.json()
  const { header, rows, mainTxt, tambahanTxt, vanTxt } = body
  if (!header || !rows || mainTxt === undefined || tambahanTxt === undefined || vanTxt === undefined) {
    return NextResponse.json({ error: "Missing data" }, { status: 400 })
  }

  const mainData = parseMainTxt(mainTxt)
  const tambahanData = parseTambahanTxt(tambahanTxt)
  const vanData = parseVanTxt(vanTxt)

  const mainMatches = matchMain(rows, mainData)
  const tambahanMatches = matchTambahan(rows, tambahanData)
  const kanvasMatches = matchKanvas(rows, vanData)

  const buffer = await buildWorkbook(header, mainMatches, tambahanMatches, kanvasMatches)

  const fname = `Form_Request_Fileset_${(header.kodeSubdist || "ADP").toString().trim()}_${(header.tanggalGudang || "").replaceAll("-", "")}`.replace(/[\\/:*?"<>|]/g, "_")

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fname}.xlsx"`,
    },
  })
}
