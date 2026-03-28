import { useState } from "react";

const PINK = "#FF2D7A";
const DARK = "#1A1A1A";
const BG = "#F5F4F0";

export default function App() {
  const [tab, setTab] = useState("home");
  const today = new Date().toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();

  return (
    <div style={{ maxWidth: 390, margin: "0 auto", minHeight: "100vh", background: BG, fontFamily: "sans-serif" }}>

      <div style={{ background: "#fff", padding: "13px 16px 10px", borderBottom: "1px solid #f0f0f0", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ color: PINK, fontWeight: 800, fontSize: 19 }}>BASS</span>
            <span style={{ color: DARK, fontWeight: 800, fontSize: 19 }}>FLOW</span>
            <span style={{ fontSize: 9, color: "#ccc", marginLeft: 6 }}>PRO</span>
          </div>
          <div style={{ fontSize: 9, color: "#bbb", fontWeight: 700 }}>{today}</div>
        </div>
      </div>

      <div style={{ padding: 14, paddingBottom: 80 }}>

        {tab === "home" ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 9, color: PINK, fontWeight: 700, letterSpacing: ".15em", marginBottom: 2 }}>JOUW PERSOONLIJKE BIBLIOTHEEK</div>
              <div style={{ fontWeight: 800, fontSize: 24, color: DARK, lineHeight: 1.1 }}>WELKOM</div>
              <div style={{ fontWeight: 800, fontSize: 24, color: PINK, lineHeight: 1.1, marginBottom: 5 }}>BASSIST</div>
              <div style={{ fontSize: 11, color: "#bbb" }}>Importeer je eigen oefeningen en houd je voortgang bij.</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 20 }}>
              {[["Oefeningen", 0], ["Sessies", 0], ["Modules", 4]].map(function(item) {
                return (
                  <div key={item[0]} style={{ background: "#EDEDEB", borderRadius: 11, padding: "10px 6px", textAlign: "center" }}>
                    <div style={{ fontWeight: 800, fontSize: 22, color: PINK }}>{item[1]}</div>
                    <div style={{ fontSize: 9, color: "#999", fontWeight: 600 }}>{item[0]}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 40 }}>🎸</div>
              <div style={{ color: "#bbb", marginTop: 8, fontSize: 11 }}>Nog geen oefeningen.</div>
            </div>
          </div>
        ) : null}

        {tab === "oefeningen" ? (
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: DARK, marginBottom: 16 }}>Oefeningen</div>
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 40 }}>🎸</div>
              <div style={{ color: "#bbb", marginTop: 8, fontSize: 11 }}>Nog geen oefeningen.</div>
            </div>
          </div>
        ) : null}

        {tab === "modules" ? (
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: DARK, marginBottom: 16 }}>Modules</div>
            <div style={{ color: "#bbb", fontSize: 12 }}>Komt binnenkort...</div>
          </div>
        ) : null}

        {tab === "voortgang" ? (
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: DARK, marginBottom: 16 }}>Voortgang</div>
            <div style={{ color: "#bbb", fontSize: 12 }}>Komt binnenkort...</div>
          </div>
        ) : null}

      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, background: "#fff", borderTop: "1px solid #f0f0f0", display: "flex", padding: "6px 0 12px", zIndex: 20 }}>
        {[
          { id: "home", label: "Home" },
          { id: "oefeningen", label: "Oefeningen" },
          { id: "import", label: "+", isPlus: true },
          { id: "modules", label: "Modules" },
          { id: "voortgang", label: "Voortgang" }
        ].map(function(item) {
          return (
            <button key={item.id} onClick={function() { if (!item.isPlus) setTab(item.id); }}
              style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", color: tab === item.id ? PINK : "#bbb" }}>
              {item.isPlus ? (
                <div style={{ width: 38, height: 38, background: PINK, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", marginTop: -13 }}>+</div>
              ) : (
                <span style={{ fontSize: 17 }}>o</span>
              )}
              <span style={{ fontSize: 9, fontWeight: 700 }}>{item.label}</span>
            </button>
          );
        })}
      </div>

    </div>
  );
}
