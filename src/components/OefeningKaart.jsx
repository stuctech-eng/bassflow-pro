import { useState } from "react";
import { PINK, PINK_LIGHT, DARK } from "../constants.js";
import Badge from "./Badge.jsx";
import { MODULES } from "../constants.js";

export default function OefeningKaart({ oefening, onOpen, onEdit, onDelete }) {
  const mod = MODULES.find(function(m) { return m.id === oefening.moduleId; });
  const fotos = oefening.fotos || [];
  const [bevestig, setBevestig] = useState(false);

  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
      {fotos.length > 0 ? (
        <img src={fotos[0]} alt="tab" onClick={function() { onOpen(oefening); }}
          style={{ width: "100%", height: 100, objectFit: "cover", cursor: "pointer", display: "block" }} />
      ) : null}
      <div style={{ padding: 13 }}>
        <div onClick={function() { onOpen(oefening); }} style={{ cursor: "pointer", marginBottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: DARK, marginBottom: 4 }}>
            {oefening.titel}
            {fotos.length > 1 ? <span style={{ fontSize: 10, color: PINK, fontWeight: 700, marginLeft: 6, background: PINK_LIGHT, padding: "1px 6px", borderRadius: 8 }}>{fotos.length} fotos</span> : null}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {mod ? <Badge level={mod.level} /> : null}
            <span style={{ fontSize: 10, color: "#bbb" }}>{mod ? mod.name : ""}</span>
            <span style={{ fontSize: 10, color: PINK, fontWeight: 700, marginLeft: "auto" }}>{oefening.bpm} BPM</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
          <button onClick={function() { onOpen(oefening); }} style={{ flex: 1, background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>open</button>
          <button onClick={function() { onEdit(oefening); }} style={{ background: "#f4f4f4", color: "#666", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 11, cursor: "pointer" }}>bewerk</button>
          <button onClick={function() { setBevestig(true); }} style={{ background: "#FFF0F0", color: "#E53935", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 11, cursor: "pointer" }}>wis</button>
        </div>
        {bevestig ? (
          <div style={{ marginTop: 10, background: "#FFF5F5", borderRadius: 10, padding: 12, textAlign: "center", border: "1px solid #FFD0D0" }}>
            <div style={{ fontSize: 12, color: DARK, marginBottom: 8, fontWeight: 700 }}>Verwijderen?</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={function() { setBevestig(false); }} style={{ flex: 1, background: "#eee", border: "none", borderRadius: 8, padding: "7px", fontSize: 12, cursor: "pointer" }}>Annuleren</button>
              <button onClick={function() { onDelete(oefening.id); }} style={{ flex: 1, background: "#E53935", color: "#fff", border: "none", borderRadius: 8, padding: "7px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Verwijderen</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
