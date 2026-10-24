import { NextRequest, NextResponse } from "next/server"
import { callSuperhumanDocsApi, SuperhumanDocsError } from "@/lib/superhumanDocs"

interface DocItem { id: string; name: string; ownerName?: string; updatedAt?: string; browserLink?: string }
interface DocList { items: DocItem[] }

// Dipanggil halaman /dashboard/superhuman-docs buat isi dropdown "pilih Doc".
export async function GET(req: NextRequest) {
  try {
    const query = req.nextUrl.searchParams.get("query") || undefined
    const data = await callSuperhumanDocsApi<DocList>("/docs", { query, limit: 50 })
    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof SuperhumanDocsError || e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}