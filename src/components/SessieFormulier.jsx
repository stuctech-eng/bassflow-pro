import { useState } from "react";
import { PINK, DARK } from "../constants.js";

export default function SessieFormulier({ oefening, onSave, onClose }) {
  const [bpm, setBpm] = useState(oefening.bpm);
  const [notitie, setNotitie] = useState("");
  const maxBpm = (oefening.sessies || []).reduce(function(m, s) { return Math.max(m, s.bpm); }, 0);

  function handleSave() {
    onSave({ id: Date.now(), bpm: bpm, notitie: notitie, datum: new Date().toISOString() });
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "flex-end" }}
      onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: "18px 18px 0 0", width: "100%", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: DARK }}>Sessie loggen</div>
          <button onClick={onClose} style={{ background: "#f0f0f0", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>{oefening.titel}</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>TEMPO</label>
            <span style={{ fontWeight: 800, color: PINK, fontSize: 14 }}>{bpm} BPM</span>
          </div>
          <input type="range" min={40} max={240} value={bpm} onChange={function(e) { setBpm(Number(e.target.value)); }} style={{ width: "100%", accentColor: PINK }} />
          {maxBpm > 0 ? (
            <div style={{ fontSize: 10, color: "#999", marginTop: 3 }}>
              Max: <strong style={{ color: PINK }}>{maxBpm} BPM</strong>
              {bpm > maxBpm ? <span style={{ color: "#00B84C", marginLeft: 6 }}>Nieuw record!</span> : null}
            </div>
          ) : null}
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>NOTITIE</label>
          <textarea value={notitie} onChange={function(e) { setNotitie(e.target.value); }} placeholder="Wat ging goed?" rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 13, outline: "none", resize: "none", boxSizing: "border-box" }} />
        </div>
        <button onClick={handleSave} style={{ width: "100%", background: PINK, color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
          Sessie opslaan
        </button>
      </div>
    </div>
  );
}
