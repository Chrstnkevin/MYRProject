"use client"

// Taruh di: src/components/layout/MotivationBanner.tsx

type PageType = "home" | "notulensi" | "finance" | "kanban" | "userflow" | "docreq" | "restore" | "master-data" | "ficom-password" | "data-transfer" | "productivity-compare"

const QUOTES: Record<PageType, string[]> = {
  home: [
    "Hari baru, kesempatan baru. Mulai dengan satu langkah kecil — sisanya akan mengikuti.",
    "Produktivitas bukan tentang sibuk, tapi tentang tepat sasaran.",
    "Setiap hari adalah halaman baru. Tulislah sesuatu yang layak dibaca.",
    "Kerja keras hari ini adalah ketenangan yang kamu rasakan besok.",
    "Fokus pada progres, bukan kesempurnaan.",
    "Kamu tidak harus hebat untuk memulai, tapi kamu harus memulai untuk jadi hebat.",
    "Satu tugas selesai lebih berharga dari sepuluh rencana yang tertunda.",
  ],
  notulensi: [
    "Orang yang mencatat adalah orang yang ingat. Orang yang ingat adalah orang yang memimpin.",
    "Notulensi yang baik adalah kontrak tak tertulis antara semua yang hadir.",
    "Rapat tanpa catatan adalah rapat yang dilupakan.",
    "Tuliskan, karena pikiranmu terlalu berharga untuk dilupakan begitu saja.",
    "Setiap keputusan besar dimulai dari catatan kecil yang tepat.",
    "Dokumentasi hari ini adalah penyelamat kamu di masa depan.",
    "Yang tidak dicatat, tidak ada. Yang dicatat, abadi.",
  ],
  finance: [
    "Bukan soal berapa banyak yang kamu hasilkan — tapi berapa banyak yang kamu jaga.",
    "Uang adalah alat. Kamu yang menentukan apakah ia bekerja untukmu atau melawanmu.",
    "Lacak pengeluaranmu, dan kamu akan tahu kemana mimpimu pergi.",
    "Kebebasan finansial dimulai dari satu keputusan sederhana: catat.",
    "Tabungan kecil hari ini adalah ketenangan besar di masa depan.",
    "Budget bukan tentang membatasi — tapi tentang memilih dengan sadar.",
    "Setiap rupiah yang kamu catat adalah satu langkah menuju kendali penuh.",
  ],
  kanban: [
    "Tugas yang selesai satu per satu lebih keren dari rencana seribu yang tak pernah dimulai.",
    "Done is better than perfect.",
    "Pindahkan satu kartu ke Done hari ini. Rasakan bedanya.",
    "Sistem yang sederhana dan dijalankan selalu mengalahkan sistem rumit yang diabaikan.",
    "Fokus itu bukan berarti banyak kerja — berarti kerja yang tepat.",
    "Setiap task yang selesai adalah kemenangan kecil yang layak dirayakan.",
    "Progress, bukan perfection. Gerak terus.",
  ],
  docreq: [
    "Dokumen yang baik adalah fondasi produk yang hebat.",
    "Requirement yang jelas = development yang lancar.",
    "Tulis sekarang, debug lebih sedikit nanti.",
    "Setiap fitur hebat dimulai dari requirement yang solid.",
    "AI membantu menulis, kamu yang menentukan arah.",
    "Dokumentasi bukan hambatan — ini investasi tim.",
    "Requirement yang detail menyelamatkan berjam-jam meeting.",
  ],
  userflow: [
    "Desain yang baik bukan soal indah — tapi soal seberapa mudah pengguna tidak tersesat.",
    "Alur yang jelas adalah kasih sayang kepada pengguna.",
    "Sebelum menulis kode, gambar jalannya. Sebelum gambar, pahami orangnya.",
    "UX terbaik adalah yang tidak terasa seperti UX sama sekali.",
    "Setiap panah di diagram adalah janji yang kamu buat kepada pengguna.",
    "Sederhanakan. Lalu sederhanakan lagi.",
    "User flow yang baik lahir dari empati, bukan asumsi.",
  ],
  restore: [
    "Backup itu janji. Restore itu bukti.",
    "Data yang direstore hari ini adalah bisnis yang selamat esok hari.",
    "Setiap restore sukses adalah satu ketenangan yang kamu berikan ke seluruh tim.",
    "DRP bukan sekadar prosedur — ini tameng terakhir yang kamu jaga.",
    "Konsistensi kecil hari ini mencegah bencana besar di masa depan.",
    "2x seminggu, 8x sebulan. Sederhana, tapi menyelamatkan.",
    "Yang kamu lakukan hari ini tidak terlihat — sampai hari di mana ia menyelamatkan segalanya.",
  ],
  "master-data": [
    "Data yang rapi adalah keputusan yang tepat.",
    "Satu referensi akurat lebih berharga dari seribu asumsi.",
    "Master data yang bersih adalah fondasi laporan yang bisa dipercaya.",
    "Akurasi data hari ini mencegah kebingungan tim besok.",
    "Data adalah aset. Jaga, rawat, dan jangan biarkan usang.",
    "Sistem yang kuat dimulai dari data referensi yang solid.",
    "Depot yang tercatat dengan baik adalah distribusi yang terkendali.",
  ],
  "ficom-password": [
    "Keamanan akun adalah tanggung jawab bersama.",
    "Password yang kuat adalah benteng pertama sebelum data bocor.",
    "Jaga akses, jaga kepercayaan.",
    "Akses yang terkontrol adalah organisasi yang profesional.",
    "Satu akun yang aman melindungi seluruh sistem.",
    "Kelola credential dengan cermat — itu adalah kepercayaan yang dititipkan.",
    "Keamanan bukan pilihan, itu kewajiban.",
  ],
  "data-transfer": [
    "Data yang naik tepat waktu adalah laporan yang bisa dipercaya.",
    "Transfer hari ini adalah ketenangan report esok hari.",
    "Monitor lebih awal, antisipasi lebih cepat.",
    "Satu distributor terlambat bisa membuat satu laporan tidak akurat.",
    "Konsistensi transfer data adalah fondasi analisis yang solid.",
    "Data tidak berbohong — tapi hanya jika sudah naik.",
    "Pantau, cek, pastikan — itu rutinitas yang melindungi tim.",
  ],
  "productivity-compare": [
    "Target tanpa realisasi cuma angka. Realisasi tanpa target tidak tahu arah.",
    "Setiap komponen yang tercapai adalah satu langkah lebih dekat ke target bulan ini.",
    "Data yang akurat adalah keputusan yang tidak salah arah.",
    "Bandingkan, verifikasi, percaya — begitu cara membangun laporan yang solid.",
    "Achievement 100% dimulai dari transparansi angka, bukan asumsi.",
    "Satu salesman yang aktif hari ini adalah satu target yang lebih dekat tercapai.",
    "Produktivitas terlihat dari angka — tapi lahir dari konsistensi harian.",
  ],
}

const CONFIG: Record<PageType, {
  label: string; emoji: string
  bg: string; border: string; labelColor: string; textColor: string
  primary: string; light: string
}> = {
  home:      { label: "Selamat datang, Pejuang!", emoji: "🌿", bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "#bbf7d0", labelColor: "#059669", textColor: "#065f46", primary: "#34d399", light: "#6ee7b7" },
  notulensi: { label: "Rapat Beres, Catatan Jelas",    emoji: "✍️",  bg: "linear-gradient(135deg,#fdf4ff,#fae8ff)", border: "#e9d5ff", labelColor: "#9333ea", textColor: "#581c87", primary: "#c084fc", light: "#e9d5ff" },
  finance:   { label: "Dompet Sehat, Pikiran Tenang",  emoji: "💰",  bg: "linear-gradient(135deg,#eff6ff,#dbeafe)", border: "#bfdbfe", labelColor: "#2563eb", textColor: "#1e3a8a", primary: "#3b82f6", light: "#93c5fd" },
  kanban:    { label: "Mode: Produktif Abis",          emoji: "🔥",  bg: "linear-gradient(135deg,#fffbeb,#fef3c7)", border: "#fde68a", labelColor: "#d97706", textColor: "#92400e", primary: "#f59e0b", light: "#fde68a" },
  docreq:    { label: "Requirement Engineer 📋",    emoji: "✍️",  bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "var(--accent-light)", labelColor: "var(--accent)", textColor: "var(--accent)", primary: "var(--accent)", light: "var(--accent-light)" },
  userflow:  { label: "Arsitek Alur Terbaik",          emoji: "🎨",  bg: "linear-gradient(135deg,#fff7ed,#ffedd5)", border: "#fed7aa", labelColor: "#ea580c", textColor: "#7c2d12", primary: "#fb923c", light: "#fdba74" },
  restore:   { label: "Guardian of Data",               emoji: "🛡️",  bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "#86efac", labelColor: "#16a34a", textColor: "#14532d", primary: "#22c55e", light: "#86efac" },
  "master-data":     { label: "Data Bersih, Keputusan Tepat", emoji: "🗂️",  bg: "linear-gradient(135deg,#eff6ff,#dbeafe)", border: "#bfdbfe", labelColor: "#0369A1", textColor: "#1e3a8a", primary: "#3b82f6", light: "#93c5fd" },
  "data-transfer":   { label: "Data Naik, Report Aman",          emoji: "📡",  bg: "linear-gradient(135deg,#ecfeff,#cffafe)", border: "#a5f3fc", labelColor: "#0891B2", textColor: "#164e63", primary: "#06b6d4", light: "#a5f3fc" },
  "ficom-password":  { label: "Jaga Akses, Jaga Kepercayaan",  emoji: "🔐",  bg: "linear-gradient(135deg,#fdf4ff,#fae8ff)", border: "#e9d5ff", labelColor: "#7C3AED", textColor: "#581c87", primary: "#a855f7", light: "#e9d5ff" },
  "productivity-compare": { label: "Target vs Realisasi, Jelas Tanpa Ragu", emoji: "📈", bg: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "#bbf7d0", labelColor: "#16A34A", textColor: "#14532d", primary: "#22c55e", light: "#86efac" },
}

function getDailyQuote(page: PageType): string {
  const idx = (new Date().getDay() + new Date().getDate()) % QUOTES[page].length
  return QUOTES[page][idx]
}

// ── Per-page SVG illustrations (pure CSS animation via style tag) ──────────
function HomeSVG({ p, l }: { p: string; l: string }) {
  return (
    <>
      <style>{`
        @keyframes eg-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes eg-wave { 0%,100%{transform:rotate(0deg) } 40%{transform:rotate(-25deg)} 60%{transform:rotate(-20deg)} }
        @keyframes eg-blink { 0%,90%,100%{opacity:1} 95%{opacity:0} }
        @keyframes eg-star { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.7)} }
        .eg-body { animation: eg-bob 2s ease-in-out infinite }
        .eg-arm  { transform-origin: 42px 33px; animation: eg-wave 0.7s ease-in-out infinite }
        .eg-eye  { animation: eg-blink 3s ease-in-out infinite }
        .eg-star { animation: eg-star 1.5s ease-in-out infinite }
        .eg-star2{ animation: eg-star 1.8s ease-in-out infinite 0.4s }
      `}</style>
      <svg width="72" height="72" viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
        <g className="eg-body">
          <circle cx="32" cy="20" r="12" fill={p} />
          <circle cx="28" cy="18" r="2" fill="#065f46" className="eg-eye" />
          <circle cx="36" cy="18" r="2" fill="#065f46" className="eg-eye" />
          <path d="M27 23 Q32 27 37 23" stroke="#065f46" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          <rect x="22" y="30" width="20" height="16" rx="6" fill={l} />
          <line x1="22" y1="35" x2="12" y2="42" stroke={p} strokeWidth="3" strokeLinecap="round" />
          <line x1="27" y1="46" x2="24" y2="58" stroke={p} strokeWidth="3" strokeLinecap="round" />
          <line x1="37" y1="46" x2="40" y2="58" stroke={p} strokeWidth="3" strokeLinecap="round" />
        </g>
        <line x1="42" y1="33" x2="54" y2="26" stroke={p} strokeWidth="3" strokeLinecap="round" className="eg-arm" />
        <circle cx="54" cy="12" r="3" fill="#fbbf24" className="eg-star" />
        <circle cx="10" cy="22" r="2" fill="#fbbf24" className="eg-star2" />
      </svg>
    </>
  )
}

function NotulensiSVG({ p, l }: { p: string; l: string }) {
  return (
    <>
      <style>{`
        @keyframes eg-write { 0%,100%{transform:translate(0,0)} 25%{transform:translate(4px,-2px)} 75%{transform:translate(8px,0)} }
        @keyframes eg-line1 { 0%{stroke-dashoffset:20} 40%,100%{stroke-dashoffset:0} }
        @keyframes eg-line2 { 0%,20%{stroke-dashoffset:16} 60%,100%{stroke-dashoffset:0} }
        @keyframes eg-line3 { 0%,40%{stroke-dashoffset:22} 80%,100%{stroke-dashoffset:0} }
        .eg-pencil { animation: eg-write 2s ease-in-out infinite }
        .eg-l1 { stroke-dasharray:20; animation: eg-line1 2.5s ease-out infinite }
        .eg-l2 { stroke-dasharray:16; animation: eg-line2 2.5s ease-out infinite }
        .eg-l3 { stroke-dasharray:22; animation: eg-line3 2.5s ease-out infinite }
      `}</style>
      <svg width="72" height="72" viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
        <rect x="12" y="6" width="40" height="52" rx="4" fill={l} />
        <rect x="12" y="6" width="40" height="52" rx="4" fill="none" stroke={p} strokeWidth="1.5" />
        <rect x="8" y="10" width="8" height="44" rx="2" fill={p} />
        <circle cx="12" cy="18" r="2.5" fill="white" />
        <circle cx="12" cy="28" r="2.5" fill="white" />
        <circle cx="12" cy="38" r="2.5" fill="white" />
        <circle cx="12" cy="48" r="2.5" fill="white" />
        <line x1="24" y1="22" x2="44" y2="22" stroke={p} strokeWidth="1.5" strokeLinecap="round" className="eg-l1" />
        <line x1="24" y1="30" x2="40" y2="30" stroke={p} strokeWidth="1.5" strokeLinecap="round" className="eg-l2" />
        <line x1="24" y1="38" x2="46" y2="38" stroke={p} strokeWidth="1.5" strokeLinecap="round" className="eg-l3" />
        <g className="eg-pencil">
          <rect x="36" y="44" width="4" height="10" rx="1" fill={p} transform="rotate(-40,38,49)" />
          <polygon points="36,44 40,44 38,48" fill="#fbbf24" transform="rotate(-40,38,49)" />
        </g>
      </svg>
    </>
  )
}

function FinanceSVG({ p, l }: { p: string; l: string }) {
  return (
    <>
      <style>{`
        @keyframes eg-rise { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keytml-sparkle { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes eg-sparkle { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes eg-sparkle2 { 0%,100%{opacity:0.2} 50%{opacity:1} }
        @keyframes eg-stack { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        .eg-rp   { animation: eg-rise 2s ease-in-out infinite }
        .eg-sp1  { animation: eg-sparkle 1.4s ease-in-out infinite }
        .eg-sp2  { animation: eg-sparkle2 1.7s ease-in-out infinite }
        .eg-coins{ animation: eg-stack 2.2s ease-in-out infinite }
      `}</style>
      <svg width="72" height="72" viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
        <g className="eg-coins">
          <ellipse cx="32" cy="54" rx="18" ry="5" fill={l} />
          <rect x="14" y="44" width="36" height="10" rx="3" fill={p} />
          <ellipse cx="32" cy="44" rx="18" ry="5" fill={l} />
          <rect x="14" y="34" width="36" height="10" rx="3" fill={p} />
          <ellipse cx="32" cy="34" rx="18" ry="5" fill={l} />
        </g>
        <text x="24" y="28" fontSize="13" fontWeight="bold" fill={p} className="eg-rp">Rp</text>
        <circle cx="52" cy="18" r="3" fill="#fbbf24" className="eg-sp1" />
        <circle cx="10" cy="30" r="2" fill="#fbbf24" className="eg-sp2" />
      </svg>
    </>
  )
}

function KanbanSVG({ p, l }: { p: string; l: string }) {
  return (
    <>
      <style>{`
        @keyframes eg-slide { 0%,30%{transform:translateX(0)} 60%,100%{transform:translateX(16px)} }
        @keyframes eg-check { 0%,40%{stroke-dashoffset:10} 80%,100%{stroke-dashoffset:0} }
        @keyframes eg-pop   { 0%,40%{r:0} 70%,100%{r:6} }
        .eg-card { animation: eg-slide 3s ease-in-out infinite }
        .eg-tick { stroke-dasharray:10; animation: eg-check 3s ease-in-out infinite }
        .eg-circ { animation: eg-pop 3s ease-in-out infinite }
      `}</style>
      <svg width="72" height="72" viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
        <rect x="6" y="10" width="52" height="44" rx="5" fill={l} />
        <rect x="10" y="14" width="13" height="5" rx="2" fill="#9ca3af" />
        <rect x="26" y="14" width="13" height="5" rx="2" fill={p} />
        <rect x="42" y="14" width="13" height="5" rx="2" fill="#34d399" />
        <rect x="10" y="22" width="13" height="8" rx="2" fill="white" opacity="0.85" />
        <rect x="10" y="32" width="13" height="8" rx="2" fill="white" opacity="0.85" />
        <rect x="26" y="22" width="13" height="8" rx="2" fill="white" opacity="0.85" className="eg-card" />
        <rect x="42" y="22" width="13" height="8" rx="2" fill="white" opacity="0.85" />
        <rect x="42" y="32" width="13" height="8" rx="2" fill="white" opacity="0.85" />
        <circle cx="48" cy="48" r="0" fill="#34d399" className="eg-circ" />
        <path d="M45 48 L47 50 L51 45" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" className="eg-tick" />
      </svg>
    </>
  )
}

function UserFlowSVG({ p, l }: { p: string; l: string }) {
  return (
    <>
      <style>{`
        @keyframes eg-dash { 0%{stroke-dashoffset:0} 100%{stroke-dashoffset:-12} }
        .eg-d1 { stroke-dasharray:4 2; animation: eg-dash 0.8s linear infinite }
        .eg-d2 { stroke-dasharray:4 2; animation: eg-dash 0.8s linear infinite 0.2s }
        .eg-d3 { stroke-dasharray:4 2; animation: eg-dash 0.8s linear infinite 0.4s }
        .eg-d4 { stroke-dasharray:4 2; animation: eg-dash 0.8s linear infinite 0.6s }
        @keyframes eg-pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .eg-node { animation: eg-pulse 2s ease-in-out infinite }
      `}</style>
      <svg width="72" height="72" viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
        <rect x="2" y="26" width="14" height="12" rx="3" fill={p} className="eg-node" />
        <rect x="25" y="10" width="14" height="12" rx="3" fill={l} />
        <rect x="25" y="42" width="14" height="12" rx="3" fill={l} />
        <rect x="48" y="26" width="14" height="12" rx="3" fill={p} className="eg-node" />
        <line x1="16" y1="30" x2="25" y2="19" stroke={p} strokeWidth="1.5" strokeLinecap="round" className="eg-d1" />
        <line x1="16" y1="34" x2="25" y2="48" stroke={p} strokeWidth="1.5" strokeLinecap="round" className="eg-d2" />
        <line x1="39" y1="16" x2="48" y2="28" stroke={p} strokeWidth="1.5" strokeLinecap="round" className="eg-d3" />
        <line x1="39" y1="48" x2="48" y2="36" stroke={p} strokeWidth="1.5" strokeLinecap="round" className="eg-d4" />
        <text x="9" y="34" textAnchor="middle" fontSize="6" fontWeight="bold" fill="white">IN</text>
        <text x="55" y="34" textAnchor="middle" fontSize="6" fontWeight="bold" fill="white">OUT</text>
      </svg>
    </>
  )
}


function DocReqSVG({ p, l }: { p: string; l: string }) {
  return (
    <svg width="80" height="70" viewBox="0 0 80 70" fill="none">
      <style>{`
        @keyframes dr-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        @keyframes dr-blink { 0%,90%,100%{opacity:1} 95%{opacity:0} }
        @keyframes dr-write { 0%{width:0} 100%{width:32px} }
        .dr-doc { animation: dr-float 3s ease-in-out infinite }
        .dr-cursor { animation: dr-blink 1.2s step-end infinite }
      `}</style>
      <g className="dr-doc">
        <rect x="10" y="8" width="44" height="54" rx="4" fill={l} stroke={p} strokeWidth="1.5"/>
        <rect x="16" y="18" width="32" height="3" rx="1.5" fill={p} opacity="0.4"/>
        <rect x="16" y="25" width="26" height="2.5" rx="1.25" fill={p} opacity="0.3"/>
        <rect x="16" y="31" width="30" height="2.5" rx="1.25" fill={p} opacity="0.3"/>
        <rect x="16" y="37" width="20" height="2.5" rx="1.25" fill={p} opacity="0.3"/>
        <rect x="16" y="44" width="28" height="2.5" rx="1.25" fill={p} opacity="0.2"/>
      </g>
      {/* Sparkle AI */}
      <circle cx="62" cy="20" r="12" fill={p} opacity="0.15"/>
      <text x="62" y="25" textAnchor="middle" fontSize="14">✨</text>
      {/* Cursor */}
      <rect className="dr-cursor" x="46" y="37" width="2" height="10" rx="1" fill={p}/>
    </svg>
  )
}


function RestoreSVG({ p, l }: { p: string; l: string }) {
  return (
    <>
      <style>{`
        @keyframes rs-spin  { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes rs-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.6;transform:scale(0.92)} }
        @keyframes rs-drop  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(4px)} }
        .rs-gear  { transform-origin:32px 30px; animation:rs-spin 4s linear infinite }
        .rs-pulse { animation:rs-pulse 2s ease-in-out infinite }
        .rs-drop  { animation:rs-drop 1.4s ease-in-out infinite }
      `}</style>
      <svg width="72" height="72" viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
        {/* Server stack */}
        <rect x="10" y="14" width="44" height="11" rx="3" fill={l} opacity="0.8"/>
        <rect x="10" y="14" width="44" height="11" rx="3" fill="none" stroke={p} strokeWidth="1.5"/>
        <circle cx="47" cy="19.5" r="2.5" fill={p} className="rs-pulse"/>
        <rect x="15" y="18" width="16" height="2" rx="1" fill={p} opacity="0.4"/>

        <rect x="10" y="28" width="44" height="11" rx="3" fill={l} opacity="0.5"/>
        <rect x="10" y="28" width="44" height="11" rx="3" fill="none" stroke={p} strokeWidth="1.5"/>
        <circle cx="47" cy="33.5" r="2.5" fill={p} opacity="0.5"/>
        <rect x="15" y="32" width="12" height="2" rx="1" fill={p} opacity="0.3"/>

        {/* Restore arrow */}
        <g className="rs-gear">
          <path d="M32 46 A8 8 0 0 1 24 54" fill="none" stroke={p} strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M22 51 L24 54 L27 51" fill="none" stroke={p} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </g>
        {/* Shield */}
        <path d="M32 42 L38 45 L38 51 Q38 55 32 57 Q26 55 26 51 L26 45 Z" fill={p} opacity="0.18"/>
        <path d="M32 42 L38 45 L38 51 Q38 55 32 57 Q26 55 26 51 L26 45 Z" fill="none" stroke={p} strokeWidth="1.5"/>
        <path d="M29 49.5 L31.5 52 L35.5 47" fill="none" stroke={p} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rs-drop"/>
      </svg>
    </>
  )
}

export default function MotivationBanner({ page }: { page: PageType }) {
  const c = CONFIG[page]
  const quote = getDailyQuote(page)
  const svgProps = { p: c.primary, l: c.light }

  return (
    <div style={{
      background: c.bg,
      border: `1px solid ${c.border}`,
      borderRadius: "var(--radius-lg)",
      padding: "14px 20px",
      display: "flex",
      alignItems: "center",
      gap: "16px",
      position: "relative",
      overflow: "hidden",
      marginBottom: "4px",
    }}>
      {/* Decorative circles */}
      <div style={{ position: "absolute", right: "-20px", top: "-20px", width: "100px", height: "100px", borderRadius: "50%", background: `${c.border}60`, pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: "60px", bottom: "-30px", width: "70px", height: "70px", borderRadius: "50%", background: `${c.border}40`, pointerEvents: "none" }} />

      {/* Animated SVG illustration */}
      {page === "home"      && <HomeSVG      {...svgProps} />}
      {page === "notulensi" && <NotulensiSVG {...svgProps} />}
      {page === "finance"   && <FinanceSVG   {...svgProps} />}
      {page === "kanban"    && <KanbanSVG    {...svgProps} />}
      {page === "userflow"  && <UserFlowSVG  {...svgProps} />}
      {page === "docreq"   && <DocReqSVG    p={c.primary} l={c.light} />}
      {page === "restore"  && <RestoreSVG   p={c.primary} l={c.light} />}

      {/* Text */}
      <div style={{ flex: 1, position: "relative" }}>
        <div style={{ fontSize: "10px", fontWeight: 700, color: c.labelColor, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "4px" }}>
          {c.label} {c.emoji}
        </div>
        <div style={{ fontSize: "13px", fontWeight: 600, color: c.textColor, lineHeight: 1.6, fontStyle: "italic" }}>
          "{quote}"
        </div>
      </div>
    </div>
  )
}