import { useState, useEffect } from "react";

const PINK = "#FF2D7A";
const PINK_LIGHT = "#FFE0EE";
const DARK = "#1A1A1A";
const BG = "#F5F4F0";

const MODULES = [
  { id: "mod1", name: "Fundamenten", level: "Beginner", color: PINK },
  { id: "mod2", name: "Groove & Ritme", level: "Beginner", color: PINK },
  { id: "mod3", name: "Muting & Articulatie", level: "Intermediate", color: "#FF8C00" },
  { id: "mod4", name: "Slap Bass", level: "Advanced", color: "#8B2FC9" },
];

function Badge({ level }) {
  const colors = {
    Beginner: [PINK_LIGHT, PINK],
    Intermediate: ["#FFF0E0", "#FF8C00"],
    Advanced: ["#F0E8FF", "#8B2FC9"]
  };
  const c = colors[level] || colors.Beginner;
  return (
    <span style={{ background: c[0], color: c[1], fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, textTransform: "uppercase" }}>
      {level}
    </span>
  );
}

function DetailScherm({ oefening, onClose, onEdit }) {
  const mod = MODULES.find(function(m) { return m.id === oefening.moduleId; });

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 200, display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "13px 16px", borderBottom: "1px solid #eee", gap: 10 }}>
        <button onClick={onClose} style={{ background: "#f0f0f0", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontWeight: 800 }}>←</button>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 15, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{oefening.titel}</div>
        <button onClick={function() { onEdit(oefening); onClose(); }}
          style={{ background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 10, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          bewerk
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: 16, boxShadow: "0 1px 8px rgba(0,0,0,0.06)", marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            {mod ? <Badge level={mod.level} /> : null}
            <span style={{ fontSize: 12, color: "#999" }}>{mod ? mod.name : ""}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: BG, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: PINK }}>{oefening.bpm}</div>
              <div style={{ fontSize: 10, color: "#999" }}>BPM</div>
            </div>
            <div style={{ background: BG, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 22, color: PINK }}>{(oefening.sessies || []).length}</div>
              <div style={{ fontSize: 10, color: "#999" }}>Sessies</div>
            </div>
          </div>
        </div>

        <div style={{ fontWeight: 800, fontSize: 14, color: DARK, marginBottom: 10 }}>Sessies</div>
        {(oefening.sessies || []).length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 20px", background: "#fff", borderRadius: 14, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 32 }}>📋</div>
            <div style={{ color: "#bbb", marginTop: 8, fontSize: 12 }}>Nog geen sessies. Komt in stap 8!</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {oefening.sessies.map(function(s) {
              return (
                <div key={s.id} style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "#999" }}>{new Date(s.datum).toLocaleDateString("nl-NL")}</span>
                    <span style={{ fontWeight: 700, color: PINK, fontSize: 13 }}>{s.bpm} BPM</span>
                  </div>
                  {s.notitie ? <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>{s.notitie}</div> : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function OefeningFormulier({ oefening, onSave, onClose }) {
  const isNieuw = !oefening;
  const [titel, setTitel] = useState(oefening ? oefening.titel : "");
  const [moduleId, setModuleId] = useState(oefening ? oefening.moduleId : "mod1");
  const [bpm, setBpm] = useState(oefening ? oefening.bpm : 100);

  function handleSave() {
    if (!titel.trim()) return;
    const data = {
      id: oefening ? oefening.id : Date.now(),
      titel: titel,
      moduleId: moduleId,
      bpm: bpm,
      sessies: oefening ? oefening.sessies : [],
      datum: oefening ? oefening.datum : new Date().toISOString()
    };
    onSave(data);
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }}
      onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: "18px 18px 0 0", width: "100%", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: DARK }}>{isNieuw ? "Nieuwe oefening" : "Bewerken"}</div>
          <button onClick={onClose} style={{ background: "#f0f0f0", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer" }}>X</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>TITEL</label>
          <input value={titel} onChange={function(e) { setTitel(e.target.value); }}
            placeholder="Naam van de oefening"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>MODULE</label>
          <select value={moduleId} onChange={function(e) { setModuleId(e.target.value); }}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" }}>
            {MODULES.map(function(m) {
              return <option key={m.id} value={m.id}>{m.name}</option>;
            })}
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>TEMPO</label>
            <span style={{ fontWeight: 800, color: PINK, fontSize: 13 }}>{bpm} BPM</span>
          </div>
          <input type="range" min={40} max={240} value={bpm}
            onChange={function(e) { setBpm(Number(e.target.value)); }}
            style={{ width: "100%", accentColor: PINK }} />
        </div>

        <button onClick={handleSave}
          style={{ width: "100%", background: PINK, color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
          {isNieuw ? "Opslaan" : "Wijzigingen opslaan"}
        </button>
      </div>
    </div>
  );
}

function OefeningKaart({ oefening, onOpen, onEdit, onDelete }) {
  const mod = MODULES.find(function(m) { return m.id === oefening.moduleId; });
  const [bevestig, setBevestig] = useState(false);

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 13, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
      <div onClick={function() { onOpen(oefening); }} style={{ cursor: "pointer", marginBottom: 8 }}>
        <div style={{ fontWeight: 800, fontSize: 13, color: DARK, marginBottom: 4 }}>{oefening.titel}</div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {mod ? <Badge level={mod.level} /> : null}
          <span style={{ fontSize: 10, color: "#bbb" }}>{mod ? mod.name : ""}</span>
          <span style={{ fontSize: 10, color: PINK, fontWeight: 700, marginLeft: "auto" }}>{oefening.bpm} BPM</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
        <button onClick={function() { onOpen(oefening); }}
          style={{ flex: 1, background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          open
        </button>
        <button onClick={function() { onEdit(oefening); }}
          style={{ background: "#f4f4f4", color: "#666", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 11, cursor: "pointer" }}>
          bewerk
        </button>
        <button onClick={function() { setBevestig(true); }}
          style={{ background: "#FFF0F0", color: "#E53935", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 11, cursor: "pointer" }}>
          wis
        </button>
      </div>

      {bevestig ? (
        <div style={{ marginTop: 10, background: "#FFF5F5", borderRadius: 10, padding: 12, textAlign: "center", border: "1px solid #FFD0D0" }}>
          <div style={{ fontSize: 12, color: DARK, marginBottom: 8, fontWeight: 700 }}>Verwijderen?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={function() { setBevestig(false); }}
              style={{ flex: 1, background: "#eee", border: "none", borderRadius: 8, padding: "7px", fontSize: 12, cursor: "pointer" }}>
              Annuleren
            </button>
            <button onClick={function() { onDelete(oefening.id); }}
              style={{ flex: 1, background: "#E53935", color: "#fff", border: "none", borderRadius: 8, padding: "7px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              Verwijderen
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [oefeningen, setOefeningen] = useState(function() {
    try { return JSON.parse(localStorage.getItem("bf_oefeningen") || "[]"); } catch(e) { return []; }
  });
  const [showNieuw, setShowNieuw] = useState(false);
  const [bewerkOefening, setBewerkOefening] = useState(null);
  const [openOefening, setOpenOefening] = useState(null);
  const today = new Date().toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();

  useEffect(function() {
    localStorage.setItem("bf_oefeningen", JSON.stringify(oefeningen));
  }, [oefeningen]);

  function handleSave(data) {
    setOefeningen(function(prev) {
      const bestaat = prev.find(function(e) { return e.id === data.id; });
      if (bestaat) {
        return prev.map(function(e) { return e.id === data.id ? data : e; });
      }
      return [data].concat(prev);
    });
  }

  function handleDelete(id) {
    setOefeningen(function(prev) { return prev.filter(function(e) { return e.id !== id; }); });
  }

  function renderKaarten(lijst) {
    if (lijst.length === 0) {
      return (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 40 }}>🎸</div>
          <div style={{ color: "#bbb", marginTop: 8, fontSize: 11 }}>Nog geen oefeningen.</div>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {lijst.map(function(ex) {
          return <OefeningKaart key={ex.id} oefening={ex} onOpen={setOpenOefening} onEdit={setBewerkOefening} onDelete={handleDelete} />;
        })}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 390, margin: "0 auto", minHeight: "100vh", background: BG, fontFamily: "sans-serif" }}>

      <div style={{ background: "#fff", padding: "13px 16px 10px", borderBottom: "1px solid #f0f0f0", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ color: PINK, fontWeight: 800, fontSize: 19 }}>BASS</span>
            <span style={{ color: DARK, fontWeight: 800, fontSize: 19 }}>FLOW</span>
            <span style={{ fontSize: 9, color: "#ccc", marginLeft: 6 }}>PRO v0.7</span>
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
              {[["Oefeningen", oefeningen.length], ["Sessies", 0], ["Modules", 4]].map(function(item) {
                return (
                  <div key={item[0]} style={{ background: "#EDEDEB", borderRadius: 11, padding: "10px 6px", textAlign: "center" }}>
                    <div style={{ fontWeight: 800, fontSize: 22, color: PINK }}>{item[1]}</div>
                    <div style={{ fontSize: 9, color: "#999", fontWeight: 600 }}>{item[0]}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginBottom: 12, fontWeight: 800, fontSize: 14, color: DARK }}>Recente oefeningen</div>
            {renderKaarten(oefeningen.slice(0, 3))}
          </div>
        ) : null}

        {tab === "oefeningen" ? (
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: DARK, marginBottom: 16 }}>Oefeningen</div>
            {renderKaarten(oefeningen)}
          </div>
        ) : null}

        {tab === "modules" ? (
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: DARK, marginBottom: 16 }}>Modules</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {MODULES.map(function(m) {
                const cnt = oefeningen.filter(function(e) { return e.moduleId === m.id; }).length;
                return (
                  <div key={m.id} style={{ background: "#fff", borderRadius: 12, padding: 13, borderLeft: "4px solid " + m.color, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 13, color: DARK, marginBottom: 3 }}>{m.name}</div>
                        <Badge level={m.level} />
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 800, color: m.color, fontSize: 18 }}>{cnt}</div>
                        <div style={{ fontSize: 9, color: "#bbb" }}>oefeningen</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {tab === "voortgang" ? (
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: DARK, marginBottom: 16 }}>Voortgang</div>
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: 40 }}>📈</div>
              <div style={{ color: "#bbb", marginTop: 8, fontSize: 11 }}>Komt in stap 8!</div>
            </div>
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
            <button key={item.id} onClick={function() { if (item.isPlus) { setShowNieuw(true); } else { setTab(item.id); } }}
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

      {showNieuw ? <OefeningFormulier onSave={handleSave} onClose={function() { setShowNieuw(false); }} /> : null}
      {bewerkOefening ? <OefeningFormulier oefening={bewerkOefening} onSave={handleSave} onClose={function() { setBewerkOefening(null); }} /> : null}
      {openOefening ? <DetailScherm oefening={openOefening} onClose={function() { setOpenOefening(null); }} onEdit={setBewerkOefening} /> : null}

    </div>
  );
}
