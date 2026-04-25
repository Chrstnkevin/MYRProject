export default function Footer() {
  return (
    <footer style={{
      background: "#1a1a1a", color: "white", padding: "48px 5% 32px",
    }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "40px", flexWrap: "wrap", gap: "32px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <div style={{
                width: "34px", height: "34px", borderRadius: "10px",
                background: "linear-gradient(135deg, #FF4B26, #FF8C42)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><span style={{ fontSize: "16px" }}>🍃</span></div>
              <div>
                <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: "15px" }}>PHI Support</div>
                <div style={{ fontSize: "10px", color: "#666", letterSpacing: "0.1em", textTransform: "uppercase" }}>Mayora Indah</div>
              </div>
            </div>
            <p style={{ fontSize: "13px", color: "#888", maxWidth: "260px", lineHeight: 1.6 }}>
              Digital hub for the Philippines Support Team — SFA, Ficom & Ficom Lite, all in one place.
            </p>
          </div>
          <div style={{ display: "flex", gap: "60px", flexWrap: "wrap" }}>
            {[
              { title: "Platform", links: ["SFA", "Ficom", "Ficom Lite"] },
              { title: "Resources", links: ["Infographics", "Tutorials", "Updates"] },
              { title: "Company", links: ["About", "Contact", "Admin Login"] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#666", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "14px" }}>{col.title}</div>
                {col.links.map(l => (
                  <div key={l} style={{ fontSize: "13px", color: "#999", marginBottom: "8px", cursor: "pointer", transition: "color 0.2s" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#FF8C42")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#999")}
                  >{l}</div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: "1px solid #2a2a2a", paddingTop: "24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ fontSize: "12px", color: "#555" }}>© 2026 Mayora Indah · PHI Support Team. All rights reserved.</div>
          <div style={{ fontSize: "12px", color: "#555" }}>Built with ❤️ for the Philippines team</div>
        </div>
      </div>
    </footer>
  )
}