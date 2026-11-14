// Nyuntik comment Word ASLI (bukan teks biasa) ke sebuah .docx tanpa
// ngubah format/isi aslinya — buat fitur "Review Document". Pendekatan:
// manipulasi string LANGSUNG di word/document.xml (bukan parse+rebuild
// penuh pakai XML parser), biar bagian yang NGGAK disentuh dijamin
// identik persis sama aslinya (minim resiko ngerusak formatting lain).
//
// Dua cara anchor, PRESISI diutamakan:
// 1. tryPreciseMatch — cari 1 run <w:r>(rPr)?<w:t>...</w:t></w:r> yang
//    teksnya MENGANDUNG anchorText, split run itu jadi before|match|after
//    biar comment range cuma mbungkus kata/frasa yang di-select user —
//    BUKAN satu paragraf penuh (itu bug yang kejadian: user comment di 1
//    kata, hasilnya di Word malah nge-block satu section).
// 2. Fallback level paragraf (behavior lama) — dipakai kalau anchorText
//    nyebrang lebih dari 1 run (misal beda formatting di tengah kalimat)
//    jadi nggak ketemu di satu run manapun.
// Comment-nya sendiri disimpen di part terpisah word/comments.xml (bikin
// baru kalau belum ada, atau nambahin ke yang udah ada).
import JSZip from "jszip"

export interface DocCommentInput { anchorText: string; author: string; text: string }
export interface InjectResult { buffer: Buffer; applied: string[]; notFound: string[] }

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}
function unescapeXml(s: string): string {
  return s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")
}

function paragraphPlainText(pXml: string): string {
  const matches = [...pXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
  return matches.map(m => unescapeXml(m[1])).join("")
}

// Run "simple": persis 1 <w:t>, nggak ada <w:tab/>/<w:br/>/run lain
// nyempil — satu-satunya bentuk yang aman buat di-split presisi.
const RUN_REGEX = /<w:r(?:\s[^>]*)?>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t([^>]*)>([^<]*)<\/w:t><\/w:r>/g

const CONTENT_TYPE_OVERRIDE = '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>'
const RELATIONSHIP = '<Relationship Id="rIdReviewDocComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>'

function commentRefRun(id: number): string {
  return `<w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${id}"/></w:r>`
}

function commentXml(id: number, author: string, text: string, date: string): string {
  return `<w:comment w:id="${id}" w:author="${escapeXml(author)}" w:date="${date}" w:initials="${escapeXml(author.slice(0, 2).toUpperCase())}"><w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p></w:comment>`
}

// Cari run pertama yang teksnya mengandung `target`, split jadi
// before|match|after, bungkus match-nya doang dengan comment range.
// Balikin docXml baru, atau null kalau nggak ketemu di satu run manapun
// (caller fallback ke level paragraf).
function tryPreciseMatch(docXml: string, target: string, id: number): string | null {
  const lowerTarget = target.toLowerCase()
  RUN_REGEX.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = RUN_REGEX.exec(docXml))) {
    const full = m[0]
    const tAttrs = m[1]
    const decoded = unescapeXml(m[2])
    const idx = decoded.toLowerCase().indexOf(lowerTarget)
    if (idx === -1) continue

    const rPrMatch = full.match(/^<w:r(?:\s[^>]*)?>(<w:rPr>[\s\S]*?<\/w:rPr>)?/)
    const rPr = rPrMatch?.[1] || ""
    const before = decoded.slice(0, idx)
    const mid = decoded.slice(idx, idx + target.length)
    const after = decoded.slice(idx + target.length)
    // Paksa xml:space="preserve" di semua fragment biar spasi di
    // pinggir before/after nggak collapse abis di-split.
    const attrs = /xml:space=/.test(tAttrs) ? tAttrs : ` xml:space="preserve"${tAttrs}`
    const run = (t: string) => `<w:r>${rPr}<w:t${attrs}>${escapeXml(t)}</w:t></w:r>`

    const injected =
      (before ? run(before) : "") +
      `<w:commentRangeStart w:id="${id}"/>${run(mid)}<w:commentRangeEnd w:id="${id}"/>${commentRefRun(id)}` +
      (after ? run(after) : "")

    return docXml.slice(0, m.index) + injected + docXml.slice(m.index + full.length)
  }
  return null
}

export async function addCommentsToDocx(fileBuffer: Buffer, comments: DocCommentInput[]): Promise<InjectResult> {
  const zip = await JSZip.loadAsync(fileBuffer)
  const docXmlFile = zip.file("word/document.xml")
  if (!docXmlFile) throw new Error("word/document.xml nggak ketemu — file ini kemungkinan bukan .docx yang valid")
  let docXml = await docXmlFile.async("string")

  const paraRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g

  const commentsXmlParts: string[] = []
  const applied: string[] = []
  const notFound: string[] = []
  let nextId = 1
  const now = new Date().toISOString()

  for (const c of comments) {
    const target = c.anchorText.trim()
    if (!target) { notFound.push(c.anchorText); continue }
    const id = nextId

    const precise = tryPreciseMatch(docXml, target, id)
    if (precise) {
      docXml = precise
      nextId++
      commentsXmlParts.push(commentXml(id, c.author, c.text, now))
      applied.push(c.anchorText)
      continue
    }

    // Fallback: level paragraf (behavior lama) — target nggak ketemu
    // utuh di satu run manapun (nyebrang 2 run beda formatting, dst).
    const lowerTarget = target.toLowerCase()
    const paragraphs = docXml.match(paraRegex) || []
    let idx = paragraphs.findIndex(p => paragraphPlainText(p).trim().toLowerCase() === lowerTarget)
    if (idx === -1) idx = paragraphs.findIndex(p => paragraphPlainText(p).trim().toLowerCase().includes(lowerTarget))
    if (idx === -1) { notFound.push(c.anchorText); continue }

    const original = paragraphs[idx]
    const pPrMatch = original.match(/^(<w:p\b[^>]*>(?:<w:pPr>[\s\S]*?<\/w:pPr>)?)/)
    const headLen = pPrMatch ? pPrMatch[1].length : original.indexOf(">") + 1
    const head = original.slice(0, headLen)
    const bodyWithoutClose = original.slice(headLen).replace(/<\/w:p>$/, "")
    const injected = `${head}<w:commentRangeStart w:id="${id}"/>${bodyWithoutClose}<w:commentRangeEnd w:id="${id}"/>${commentRefRun(id)}</w:p>`

    docXml = docXml.replace(original, injected)
    nextId++
    commentsXmlParts.push(commentXml(id, c.author, c.text, now))
    applied.push(c.anchorText)
  }

  if (commentsXmlParts.length === 0) {
    return { buffer: fileBuffer, applied, notFound }
  }

  zip.file("word/document.xml", docXml)

  const existingCommentsFile = zip.file("word/comments.xml")
  let commentsXml: string
  if (existingCommentsFile) {
    const existing = await existingCommentsFile.async("string")
    commentsXml = existing.replace("</w:comments>", commentsXmlParts.join("") + "</w:comments>")
  } else {
    commentsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${commentsXmlParts.join("")}</w:comments>`
  }
  zip.file("word/comments.xml", commentsXml)

  const contentTypesFile = zip.file("[Content_Types].xml")
  if (contentTypesFile) {
    let ct = await contentTypesFile.async("string")
    if (!ct.includes("/word/comments.xml")) {
      ct = ct.replace("</Types>", `${CONTENT_TYPE_OVERRIDE}</Types>`)
      zip.file("[Content_Types].xml", ct)
    }
  }

  const relsFile = zip.file("word/_rels/document.xml.rels")
  if (relsFile) {
    let rels = await relsFile.async("string")
    if (!rels.includes("comments.xml")) {
      rels = rels.replace("</Relationships>", `${RELATIONSHIP}</Relationships>`)
      zip.file("word/_rels/document.xml.rels", rels)
    }
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" })
  return { buffer, applied, notFound }
}
