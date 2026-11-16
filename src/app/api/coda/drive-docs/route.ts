import { NextResponse } from "next/server"
import { getCompanyDriveFiles } from "@/lib/googleDrive"

export async function GET() {
  try {
    const files = await getCompanyDriveFiles()
    return NextResponse.json({ files })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gagal ambil data Drive" }, { status: 500 })
  }
}
