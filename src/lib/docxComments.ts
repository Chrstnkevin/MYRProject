// Nyuntik comment Word ASLI (bukan teks biasa) ke sebuah .docx tanpa
// ngubah format/isi aslinya — buat fitur "Review Document". Pendekatan:
// manipulasi string LANGSUNG di word/document.xml (bukan parse+rebuild
// penuh pakai XML parser), biar bagian yang NGGAK disentuh dijamin
// identik persis sama aslinya (minim resiko ngerusak formatting lain).
//
// Cara kerja tiap comment: cari paragraf yang teksnya PERSIS/mengandung
// `anchorText` (biasanya judul section kayak "Background"), terus
// bungkus ISI paragraf itu dengan <w:commentRangeStart>...
// <w:commentRangeEnd/><w:commentReference/>. Comment-nya sendiri
// disimpen di part terpisah word/comments.xml (bikin baru kalau belum
// ada, atau nambahin ke yang udah ada).
import JSZip from "jszip"

export interface DocCommentInput { anchorText: string; author: string; text: string }
export interface InjectResult { buffer: Buffer; applied: string[]; notFound: string[] }

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;")
}

function paragraphPlainText(pXml: string): string {
  const matches = [...pXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
  return matches.map(m => m[1]).join("")
}

const CONTENT_TYPE_OVERRIDE = '<Override PartName="/word/comments.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml"/>'
const RELATIONSHIP = '<Relationship Id="rIdReviewDocComments" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments" Target="comments.xml"/>'

export async function addCommentsToDocx(fileBuffer: Buffer, comments: DocCommentInput[]): Promise<InjectResult> {
  const zip = await JSZip.loadAsync(fileBuffer)
  const docXmlFile = zip.file("word/document.xml")
  if (!docXmlFile) throw new Error("word/document.xml nggak ketemu — file ini kemungkinan bukan .docx yang valid")
  let docXml = await docXmlFile.async("string")

  const paraRegex = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g
  let paragraphs = docXml.match(paraRegex) || []

  const commentsXmlParts: string[] = []
  const applied: string[] = []
  const notFound: string[] = []
  let nextId = 1
  const now = new Date().toISOString()

  for (const c of comments) {
    const target = c.anchorText.trim().toLowerCase()
    if (!target) { notFound.push(c.anchorText); continue }
    // Prioritaskan match PERSIS (trim+lowercase) biar nggak salah nangkep
    // paragraf lain yang kebetulan nyebut kata yang sama; fallback ke
    // "mengandung" kalau nggak ada yang persis pas.
    let idx = paragraphs.findIndex(p => paragraphPlainText(p).trim().toLowerCase() === target)
    if (idx === -1) idx = paragraphs.findIndex(p => paragraphPlainText(p).trim().toLowerCase().includes(target))
    if (idx === -1) { notFound.push(c.anchorText); continue }

    const id = nextId++
    const original = paragraphs[idx]
    const pPrMatch = original.match(/^(<w:p\b[^>]*>(?:<w:pPr>[\s\S]*?<\/w:pPr>)?)/)
    const headLen = pPrMatch ? pPrMatch[1].length : original.indexOf(">") + 1
    const head = original.slice(0, headLen)
    const bodyWithoutClose = original.slice(headLen).replace(/<\/w:p>$/, "")
    const injected = `${head}<w:commentRangeStart w:id="${id}"/>${bodyWithoutClose}<w:commentRangeEnd w:id="${id}"/><w:r><w:rPr><w:rStyle w:val="CommentReference"/></w:rPr><w:commentReference w:id="${id}"/></w:r></w:p>`

    docXml = docXml.replace(original, injected)
    // Paragraph list di-refresh biar index selanjutnya tetep akurat
    // (soalnya docXml berubah, & isi "original" yg sama persis bisa
    // aja ganda kalau 2 comment nempel paragraf identik — jarang tapi
    // dijaga).
    paragraphs = docXml.match(paraRegex) || []

    commentsXmlParts.push(
      `<w:comment w:id="${id}" w:author="${escapeXml(c.author)}" w:date="${now}" w:initials="${escapeXml(c.author.slice(0, 2).toUpperCase())}"><w:p><w:r><w:t xml:space="preserve">${escapeXml(c.text)}</w:t></w:r></w:p></w:comment>`
    )
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
