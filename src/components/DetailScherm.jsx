import { useState } from "react";
import { PINK, PINK_LIGHT, DARK, BG, MODULES } from "../constants.js";
import { useOrientation } from "../hooks.js";
import Badge from "./Badge.jsx";
import BpmGrafiek from "./BpmGrafiek.jsx";
import SessieRij from "./SessieRij.jsx";
import SessieFormulier from "./SessieFormulier.jsx";
import TablatureViewer from "./TablatureViewer.jsx";

export default function DetailScherm({ oefening, onClose, onEdit, onSessieAdd, onSessieUpdate, onSessieVerwijder, onInfoUpdate }) {
  const mod = MODULES.find(function(m) { return m.id === oefening.moduleId; });
  const [showSessie, setShowSessie] = useState(false);
  const [sessiesUitgeklapt, setSessiesUitgeklapt] = useState(false);
  const [fotoIndex, setFotoIndex] = useState(0);
  const [tempo, setTempo] = useState(oefening.bpm);
  const [info, setInfo] = useState(oefening.info || "");
  const [infoOpslaan, setInfoOpslaan] = useState(false);
  const landscape = useOrientation();
  const maxBpm = (oefening.sessies || []).reduce(function(m, s) { return Math.max(m, s.bpm); }, 0);
  const fotos = oefening.fotos || [];
  const aantalSessies = (oefening.sessies || []).length;
  const audioUrl = oefening.audioUrl || null;

  async function handleInfoOpslaan() {
    setInfoOpslaan(true);
    await onInfoUpdate(oefening.id, info);
    setInfoOpslaan(false);
  }

  if (landscape) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 200, display: "flex", flexDirection: "column", fontFamily: "sans-serif", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <TablatureViewer fotos={fotos} fotoIndex={fotoIndex} setFotoIndex={setFotoIndex} />
        </div>
        <div style={{ background: "#f2f2f2", borderTop: "1px solid #ddd", padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", minWidth: 36 }}>
            <span style={{ fontSize: 18 }}>❓</span>
            <span style={{ fontSize: 8, color: "#666", fontWeight: 600 }}>Help</span>
          </div>
          <div style={{ width: 1, height: 32, background: "#ddd" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", minWidth: 52 }}>
            <span style={{ fontSize: 16 }}>🎵</span>
            <span style={{ fontSize: 8, color: "#666", fontWeight: 600 }}>Audio</span>
          </div>
          <div style={{ flex: 1 }} />
          <button style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#555", padding: "0 6px" }}>◀</button>
          <button style={{ width: 44, height: 44, background: PINK, border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <span style={{ color: "#fff", fontSize: 18, marginLeft: 3 }}>▶</span>
          </button>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", minWidth: 44 }}>
            <span style={{ fontSize: 18 }}>🎙</span>
            <span style={{ fontSize: 8, color: "#666", fontWeight: 600 }}>Record</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 36 }}>
            <span style={{ fontSize: 16 }}>🎚</span>
            <span style={{ fontSize: 8, color: "#666", fontWeight: 600 }}>Tempo</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={function() { setTempo(function(t) { return Math.max(40, t - 1); }); }}
              style={{ background: "none", border: "none", color: "#333", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>−</button>
            <span style={{ color: PINK, fontWeight: 800, fontSize: 17, minWidth: 42, textAlign: "center" }}>{tempo}</span>
            <button onClick={function() { setTempo(function(t) { return Math.min(240, t + 1); }); }}
              style={{ background: "none", border: "none", color: "#333", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>+</button>
          </div>
          <div style={{ width: 1, height: 32, background: "#ddd" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", minWidth: 36 }}>
            <span style={{ fontSize: 18 }}>↩</span>
            <span style={{ fontSize: 8, color: "#666", fontWeight: 600 }}>Loop</span>
          </div>
          <div style={{ width: 1, height: 32, background: "#ddd" }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>✕</button>
          <button onClick={function() { onEdit(oefening); onClose(); }}
            style={{ background: PINK, border: "none", borderRadius: 16, padding: "5px 12px", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            bewerk
          </button>
        </div>
        {showSessie ? <SessieFormulier oefening={oefening} onSave={function(s) { onSessieAdd(oefening.id, s); }} onClose={function() { setShowSessie(false); }} /> : null}
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 200, display: "flex", flexDirection: "column", fontFamily: "sans-serif", overflow: "hidden" }}>

      <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", gap: 10, background: "#fff", borderBottom: "1px solid #eee", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "#f0f0f0", border: "none", borderRadius: 20, padding: "5px 12px", color: DARK, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>← terug</button>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 14, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{oefening.titel}</div>
        <button onClick={function() { onEdit(oefening); onClose(); }}
          style={{ background: PINK, color: "#fff", border: "none", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          bewerk
        </button>
      </div>

      <div style={{ width: "100%", aspectRatio: "3/1", flexShrink: 0, borderBottom: "1px solid #eee", display: "flex", maxHeight: "30vh" }}>
        <TablatureViewer fotos={fotos} fotoIndex={fotoIndex} setFotoIndex={setFotoIndex} />
      </div>

      {audioUrl ? (
        <div style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "8px 14px", flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#999", marginBottom: 4 }}>AUDIO</div>
          <audio controls src={audioUrl} style={{ width: "100%", height: 32 }} />
        </div>
      ) : null}

      <div style={{ flex: 1, overflowY: "auto", background: BG }}>
        <div style={{ padding: "12px 14px 0" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            {mod ? <Badge level={mod.level} /> : null}
            <span style={{ fontSize: 11, color: "#999" }}>{mod ? mod.name : ""}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[["Doel BPM", oefening.bpm, PINK], ["Max BPM", maxBpm || "-", "#00B84C"], ["Sessies", aantalSessies, "#FF8C00"]].map(function(item) {
              return (
                <div key={item[0]} style={{ background: "#fff", borderRadius: 10, padding: "10px 6px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontWeight: 800, fontSize: 20, color: item[2] }}>{item[1]}</div>
                  <div style={{ fontSize: 9, color: "#999" }}>{item[0]}</div>
                </div>
              );
            })}
          </div>
          <BpmGrafiek sessies={oefening.sessies} />
        </div>

        <div style={{ padding: "12px 14px 0" }}>
          <div onClick={function() { setSessiesUitgeklapt(function(v) { return !v; }); }}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", borderRadius: sessiesUitgeklapt ? "12px 12px 0 0" : 12, padding: "12px 14px", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: DARK }}>
              Sessies
              {aantalSessies > 0 ? <span style={{ marginLeft: 8, background: PINK_LIGHT, color: PINK, fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10 }}>{aantalSessies}</span> : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={function(e) { e.stopPropagation(); setShowSessie(true); }}
                style={{ background: PINK, color: "#fff", border: "none", borderRadius: 10, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                + Sessie
              </button>
              <span style={{ color: "#bbb", fontSize: 14 }}>{sessiesUitgeklapt ? "▲" : "▼"}</span>
            </div>
          </div>
          {sessiesUitgeklapt ? (
            <div style={{ background: BG, borderRadius: "0 0 12px 12px", padding: "8px 0 4px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
              {aantalSessies === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: "#bbb", fontSize: 12 }}>Nog geen sessies.</div>
              ) : (
                oefening.sessies.slice().reverse().map(function(s) {
                  return <SessieRij key={s.id} sessie={s}
                    onVerwijder={function(id) { onSessieVerwijder(oefening.id, id); }}
                    onBewerk={function(id, data) { onSessieUpdate(oefening.id, id, data); }} />;
                })
              )}
            </div>
          ) : null}
        </div>

        <div style={{ padding: "12px 14px 24px" }}>
          <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ padding: "12px 14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: DARK }}>Info</div>
              {info !== (oefening.info || "") ? (
                <button onClick={handleInfoOpslaan}
                  style={{ background: PINK, color: "#fff", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {infoOpslaan ? "..." : "Opslaan"}
                </button>
              ) : null}
            </div>
            <textarea value={info} onChange={function(e) { setInfo(e.target.value); }}
              placeholder="Voeg notities toe..."
              rows={6}
              style={{ width: "100%", padding: "0 14px 14px", border: "none", outline: "none", fontSize: 13, color: DARK, resize: "none", boxSizing: "border-box", background: "transparent", lineHeight: 1.6 }} />
          </div>
        </div>
      </div>

      {showSessie ? <SessieFormulier oefening={oefening} onSave={function(s) { onSessieAdd(oefening.id, s); }} onClose={function() { setShowSessie(false); }} /> : null}
    </div>
  );
}
