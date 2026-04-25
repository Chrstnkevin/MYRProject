import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { docContent, fileBase64, fileType, fileName, orientation, style } = body

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: "GROQ_API_KEY belum diset" }, { status: 500 })

  // ── Extract text ────────────────────────────────────────────
  let extractedText = docContent || ""
  if (fileBase64) {
    if (fileType === "application/pdf") {
      try {
        const m  = await import("pdf-parse")
        const fn = (m as { default?:(b:Buffer)=>Promise<{text:string}> }).default ?? (m as unknown as (b:Buffer)=>Promise<{text:string}>)
        extractedText = (await fn(Buffer.from(fileBase64,"base64"))).text + (docContent?`\n${docContent}`:"")
      } catch { extractedText = docContent||`File: ${fileName}` }
    } else if (fileType?.includes("wordprocessing")||fileType?.includes("msword")) {
      try {
        const JSZip = (await import("jszip")).default
        const zip   = await JSZip.loadAsync(Buffer.from(fileBase64,"base64"))
        const xml   = await zip.files["word/document.xml"]?.async("string")||""
        extractedText = xml.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()+(docContent?`\n${docContent}`:"")
      } catch { extractedText = docContent||`File: ${fileName}` }
    } else if (fileType?.includes("text")) {
      extractedText = Buffer.from(fileBase64,"base64").toString("utf-8")
    }
  }
  extractedText = extractedText.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g," ").replace(/\s{3,}/g," ").trim().slice(0,3000)
  if (!extractedText) extractedText = "Professional infographic poster."

  // ── Groq: extract structured info + illustration prompt ─────
  let info = {
    title: "Document", subtitle: "", points: [] as string[],
    stats: [] as {num:string;label:string}[], footer: "",
    illustrationPrompt: "abstract colorful geometric shapes, modern, vibrant"
  }
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type":"application/json", "Authorization":`Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile", max_tokens: 700,
        messages: [
          { role: "system", content: `Extract from document. Return ONLY valid JSON:
{
  "title": "catchy short title max 5 words",
  "subtitle": "engaging one-line description max 12 words",
  "points": ["point 1 max 8 words","point 2","point 3","point 4","point 5","point 6"],
  "stats": [{"num":"number or emoji","label":"short label"},{"num":"value","label":"label"},{"num":"value","label":"label"}],
  "footer": "author, date, project name",
  "illustrationPrompt": "describe a beautiful illustration for this document topic in 15 words, NO text, artistic, colorful, flat design style"
}` },
          { role: "user", content: extractedText }
        ]
      })
    })
    const d   = await r.json()
    const raw = d.choices?.[0]?.message?.content?.trim()||"{}"
    info = { ...info, ...JSON.parse(raw.replace(/```json|```/g,"").trim()) }
  } catch {
    info.title = (fileName||"Document").replace(/\.[^.]+$/,"")
    info.points = ["Key information from document"]
  }

  // ── Generate illustration URL via Pollinations ──────────────
  const STYLE_SUFFIX: Record<string,string> = {
    minimalist: "minimalist flat design, white background, clean lines, pastel colors",
    corporate:  "professional corporate illustration, blue tones, geometric, modern",
    bold:       "vibrant neon colors, dark background, bold graphic art, energetic",
    editorial:  "warm earthy tones, artistic illustration, magazine style, elegant",
  }
  const illuPrompt = `${info.illustrationPrompt}, ${STYLE_SUFFIX[style]||STYLE_SUFFIX.corporate}, no text, no letters, illustration only, high quality`
  const seed       = Math.floor(Math.random() * 999999)

  // Illustration size — top portion of poster
  const ORI: Record<string,{w:number,h:number,illuH:number}> = {
    portrait:  { w:794,  h:1123, illuH:280 },
    landscape: { w:1280, h:720,  illuH:200 },
    square:    { w:1080, h:1080, illuH:300 },
  }
  const {w,h,illuH} = ORI[orientation]||ORI.portrait
  const isLS = orientation === "landscape"

  const illuUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(illuPrompt.slice(0,300))}?width=${w}&height=${illuH}&nologo=true&seed=${seed}`

  // ── Color palettes ──────────────────────────────────────────
  type P = {bg:string;c1:string;c2:string;c3:string;c4:string;c5:string;dark:string;card:string}
  const PALETTES: Record<string,P> = {
    minimalist: {bg:"#F7F8FA",c1:"#1a1a2e",c2:"#16213e",c3:"#0f3460",c4:"#e94560",c5:"#533483",dark:"#1a1a2e",card:"#ffffff"},
    corporate:  {bg:"#EEF4FF",c1:"#003566",c2:"#0077B6",c3:"#00B4D8",c4:"#FFB703",c5:"#FB8500",dark:"#003566",card:"#ffffff"},
    bold:       {bg:"#0d0d0d",c1:"#FF006E",c2:"#FB5607",c3:"#FFBE0B",c4:"#8338EC",c5:"#3A86FF",dark:"#ffffff",card:"#1a1a1a"},
    editorial:  {bg:"#FFF8F0",c1:"#2D6A4F",c2:"#40916C",c3:"#F4A261",c4:"#E76F51",c5:"#264653",dark:"#264653",card:"#ffffff"},
  }
  const pl   = PALETTES[style]||PALETTES.corporate
  const isDark = style === "bold"
  const COLORS = [pl.c1,pl.c2,pl.c3,pl.c4,pl.c5,"#8338EC","#06D6A0"]
  const pts  = info.points.slice(0, isLS?4:6)
  const sts  = (info.stats||[]).slice(0,3)
  const EMOJIS = ["🎯","⚡","💡","🚀","🔑","📊","✨","🎪","💥","🌟"]

  // ── HTML with illustration as hero image ────────────────────
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${w}px;height:${h}px;overflow:hidden;background:${pl.bg};font-family:'Plus Jakarta Sans',Arial,sans-serif;color:${pl.dark};position:relative}

  /* Illustration hero */
  .hero{
    width:100%;height:${illuH}px;position:relative;overflow:hidden;
    background:linear-gradient(135deg,${pl.c1},${pl.c2},${pl.c3});
  }
  .hero img{width:100%;height:100%;object-fit:cover;display:block;opacity:0.92}
  .hero-overlay{
    position:absolute;inset:0;
    background:linear-gradient(to bottom, transparent 40%, ${pl.bg} 100%);
  }
  .hero-badge{
    position:absolute;top:16px;left:${isLS?"60px":"52px"};
    background:rgba(255,255,255,0.2);backdrop-filter:blur(8px);
    color:#fff;font-size:10px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;
    padding:6px 16px;border-radius:99px;border:1px solid rgba(255,255,255,0.35);
  }
  .hero-tag{
    position:absolute;top:16px;right:${isLS?"60px":"52px"};
    background:${pl.c4};color:#fff;
    font-size:10px;font-weight:900;padding:6px 14px;border-radius:99px;
    box-shadow:0 4px 14px ${pl.c4}60;
  }

  /* Title block */
  .title-block{
    padding:${isLS?"16px 60px 12px":"16px 52px 14px"};
    ${isLS?"display:grid;grid-template-columns:1fr auto;align-items:center;gap:32px":""}
  }
  .title{font-size:${isLS?"32px":"36px"};font-weight:900;line-height:1.05;letter-spacing:-0.03em;color:${pl.c1};margin-bottom:5px}
  .subtitle{font-size:${isLS?"12px":"13px"};color:${isDark?"#94A3B8":"#64748b"};font-weight:500;line-height:1.5}

  /* Stats */
  .stats{display:${isLS?"flex":"grid"};${isLS?"gap:12px":"grid-template-columns:repeat(3,1fr);gap:10px"};padding:${isLS?"0":"0 52px 14px"}}
  .stat{
    background:${pl.card};border-radius:14px;padding:${isLS?"12px 16px":"14px"};
    text-align:center;
    box-shadow:0 2px 12px rgba(0,0,0,${isDark?"0.4":"0.08"});
    border-top:3px solid ${pl.c4};
  }
  .stat-n{font-size:${isLS?"20px":"24px"};font-weight:900;color:${pl.c1};line-height:1;margin-bottom:3px}
  .stat-l{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:${pl.c3}}

  /* Points */
  .body{padding:${isLS?"0 60px 68px":"0 52px 72px"};${isLS?"display:grid;grid-template-columns:1fr 1fr;gap:24px":""}}
  .sec-lbl{font-size:9px;font-weight:900;letter-spacing:0.2em;text-transform:uppercase;color:${pl.c2};margin-bottom:10px;display:flex;align-items:center;gap:8px}
  .sec-lbl::after{content:'';flex:1;height:2px;background:linear-gradient(to right,${pl.c2}50,transparent)}
  .pts{display:flex;flex-direction:column;gap:8px}
  .pt{
    background:${pl.card};border-radius:14px;padding:${isLS?"10px 14px":"12px 16px"};
    display:flex;align-items:center;gap:12px;
    box-shadow:0 2px 10px rgba(0,0,0,${isDark?"0.35":"0.06"});
    border-left:4px solid var(--c);position:relative;overflow:hidden;
  }
  .pt::after{content:'';position:absolute;right:0;top:0;bottom:0;width:50px;background:linear-gradient(to left,var(--c)12,transparent)}
  .ico{font-size:18px;width:38px;height:38px;background:var(--c)22;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .pt-n{font-size:8px;font-weight:900;color:var(--c);letter-spacing:0.15em;text-transform:uppercase;margin-bottom:1px}
  .pt-t{font-size:${isLS?"12px":"13px"};font-weight:700;color:${isDark?"#f1f5f9":pl.dark};line-height:1.35}

  /* Footer */
  .footer{
    position:absolute;bottom:0;left:0;right:0;
    padding:${isLS?"13px 60px":"14px 52px"};
    background:linear-gradient(90deg,${pl.c1},${pl.c2});
    display:flex;align-items:center;justify-content:space-between;
  }
  .f-l{font-size:10px;color:rgba(255,255,255,0.7);font-weight:600}
  .f-r{background:rgba(255,255,255,0.18);color:#fff;border:1px solid rgba(255,255,255,0.3);font-size:9px;font-weight:900;padding:5px 14px;border-radius:99px;letter-spacing:0.12em}
</style>
</head>
<body>

  <!-- Hero illustration from Pollinations -->
  <div class="hero">
    <img src="${illuUrl}" alt="illustration" loading="eager"
      onerror="this.style.display='none';this.parentElement.style.background='linear-gradient(135deg,${pl.c1},${pl.c2},${pl.c3})'"/>
    <div class="hero-overlay"></div>
    <div class="hero-badge">✨ Infografis AI</div>
    <div class="hero-tag">📋 Doc</div>
  </div>

  <!-- Title -->
  <div class="title-block">
    <div>
      <div class="title">${info.title}</div>
      ${info.subtitle?`<div class="subtitle">${info.subtitle}</div>`:""}
    </div>
    ${isLS?`<div class="stats">
      ${sts.length>0?sts.map((s:{num:string,label:string})=>`<div class="stat"><div class="stat-n">${s.num}</div><div class="stat-l">${s.label}</div></div>`).join(""):`
        <div class="stat"><div class="stat-n">${pts.length}</div><div class="stat-l">Points</div></div>
        <div class="stat"><div class="stat-n">✅</div><div class="stat-l">Ready</div></div>
      `}
    </div>`:""}
  </div>

  <!-- Stats (portrait/square only) -->
  ${!isLS?`<div class="stats">
    ${sts.length>0?sts.map((s:{num:string,label:string})=>`<div class="stat"><div class="stat-n">${s.num}</div><div class="stat-l">${s.label}</div></div>`).join(""):`
      <div class="stat"><div class="stat-n">${pts.length}</div><div class="stat-l">Key Points</div></div>
      <div class="stat"><div class="stat-n">📄</div><div class="stat-l">Dokumen</div></div>
      <div class="stat"><div class="stat-n">✅</div><div class="stat-l">Siap</div></div>
    `}
  </div>`:""}

  <!-- Points -->
  <div class="body">
    ${isLS?`
    <div>
      <div class="sec-lbl">Key Points</div>
      <div class="pts">
        ${pts.slice(0,2).map((pt:string,i:number)=>`<div class="pt" style="--c:${COLORS[i]}"><div class="ico">${EMOJIS[i]}</div><div><div class="pt-n">Point ${i+1}</div><div class="pt-t">${pt}</div></div></div>`).join("")}
      </div>
    </div>
    <div>
      <div class="sec-lbl">Lanjutan</div>
      <div class="pts">
        ${pts.slice(2,4).map((pt:string,i:number)=>`<div class="pt" style="--c:${COLORS[i+2]}"><div class="ico">${EMOJIS[i+2]}</div><div><div class="pt-n">Point ${i+3}</div><div class="pt-t">${pt}</div></div></div>`).join("")}
      </div>
    </div>
    `:`
    <div>
      <div class="sec-lbl">📌 Poin Utama</div>
      <div class="pts">
        ${pts.map((pt:string,i:number)=>`<div class="pt" style="--c:${COLORS[i%7]}"><div class="ico">${EMOJIS[i]}</div><div><div class="pt-n">Point ${i+1}</div><div class="pt-t">${pt}</div></div></div>`).join("")}
      </div>
    </div>`}
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="f-l">${info.footer||new Date().toLocaleDateString("id-ID",{day:"numeric",month:"long",year:"numeric"})}</div>
    <div class="f-r">🌟 Elite Global</div>
  </div>

</body></html>`

  return NextResponse.json({ html, title: info.title, illustrationUrl: illuUrl })
}