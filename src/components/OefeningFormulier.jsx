import { useState } from "react";
import { doc, updateDoc, addDoc, collection, deleteDoc } from "firebase/firestore";
import { db } from "../firebase.js";
import { PINK, PINK_LIGHT, DARK, MODULES } from "../constants.js";
import FotoScherm from "./FotoScherm.jsx";
import AudioScherm from "./AudioScherm.jsx";
import EditorScherm from "./EditorScherm.jsx";

export default function OefeningFormulier({ oefening, onSave, onClose }) {
  const isNieuw = !oefening;
  const [titel, setTitel] = useState(oefening ? oefening.titel : "");
  const [moduleId, setModuleId] = useState(oefening ? oefening.moduleId : "mod1");
  const [bpm, setBpm] = useState(oefening ? oefening.bpm : 100);
  const [opslaan, setOpslaan] = useState(false);
  const [conceptId, setConceptId] = useState(null);
  const [fotos, setFotos] = useState(oefening ? (oefening.fotos || []) : []);
  const [audioUrl, setAudioUrl] = useState(oefening ? (oefening.audioUrl || "") : "");
  const [info, setInfo] = useState(oefening ? (oefening.info || "") : "");
  const [scherm, setScherm] = useState(null); // "foto" | "audio" | "editor"

  function getOefeningId() {
    return oefening ? oefening.id : conceptId;
  }

  async function maakConceptAan() {
    if (oefening || conceptId) return oefening ? oefening.id : conceptId;
    const docRef = await addDoc(collection(db, "oefeningen"), {
      titel: titel || "Nieuw", moduleId, bpm,
      fotos: [], sessies: [], info: "", audioUrl: "",
      datum: new Date().toISOString(),
      bijgewerkt: new Date().toISOString(),
      concept: true
    });
    setConceptId(docRef.id);
    return docRef.id;
  }

  async function handleSave() {
    if (!titel.trim()) return;
    setOpslaan(true);
    const id = getOefeningId();
    const data = {
      titel, moduleId, bpm, fotos,
      sessies: oefening ? (oefening.sessies || []) : [],
      info, audioUrl,
      datum: oefening ? oefening.datum : new Date().toISOString(),
      bijgewerkt: new Date().toISOString(),
      concept: false
    };
    await onSave(id, data);
    setOpslaan(false);
    onClose();
  }

  async function handleAnnuleer() {
    if (conceptId) {
      try { await deleteDoc(doc(db, "oefeningen", conceptId)); } catch(e) {}
    }
    onClose();
  }

  // Foto scherm
  if (scherm === "foto") {
    return (
      <FotoScherm
        oefeningId={getOefeningId()}
        maakConceptAan={maakConceptAan}
        fotos={fotos}
        info={info}
        onFotosUpdate={setFotos}
        onInfoUpdate={setInfo}
        onTerug={function() { setScherm(null); }}
      />
    );
  }

  // Audio scherm
  if (scherm === "audio") {
    return (
      <AudioScherm
        oefeningId={getOefeningId()}
        maakConceptAan={maakConceptAan}
        audioUrl={audioUrl}
        onAudioUpdate={setAudioUrl}
        onTerug={function() { setScherm(null); }}
      />
    );
  }

  // Editor scherm
  if (scherm === "editor") {
    return (
      <EditorScherm
        oefeningId={getOefeningId()}
        maakConceptAan={maakConceptAan}
        fotos={fotos}
        onTerug={function() { setScherm(null); }}
      />
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "flex-end" }}
      onClick={function(e) { if (e.target === e.currentTarget) handleAnnuleer(); }}>
      <div style={{ background: "#fff", borderRadius: "18px 18px 0 0", width: "100%", maxHeight: "92vh", overflowY: "auto", padding: 20 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: DARK }}>{isNieuw ? "Nieuwe oefening" : "Bewerken"}</div>
          <button onClick={handleAnnuleer} style={{ background: "#f0f0f0", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer" }}>✕</button>
        </div>

        {/* Titel */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>TITEL</label>
          <input value={titel} onChange={function(e) { setTitel(e.target.value); }}
            placeholder="Naam van de oefening"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>

        {/* Module */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>MODULE</label>
          <select value={moduleId} onChange={function(e) { setModuleId(e.target.value); }}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" }}>
            {MODULES.map(function(m) { return <option key={m.id} value={m.id}>{m.name}</option>; })}
          </select>
        </div>

        {/* Tempo */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>TEMPO</label>
            <span style={{ fontWeight: 800, color: PINK, fontSize: 13 }}>{bpm} BPM</span>
          </div>
          <input type="range" min={40} max={240} value={bpm}
            onChange={function(e) { setBpm(Number(e.target.value)); }}
            style={{ width: "100%", accentColor: PINK }} />
        </div>

        {/* Drie knoppen */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>

          {/* Foto knop */}
          <button onClick={function() { setScherm("foto"); }}
            style={{ width: "100%", background: "#fff", border: "2px solid #eee", borderRadius: 12, padding: "14px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, color: DARK }}>
            <span style={{ fontSize: 22 }}>📸</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 800 }}>Foto</div>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>
                {fotos.length > 0 ? fotos.length + " foto's toegevoegd" : "Importeer en bewerk foto's"}
              </div>
            </div>
            <span style={{ marginLeft: "auto", color: "#ccc" }}>›</span>
          </button>

          {/* Audio knop */}
          <button onClick={function() { setScherm("audio"); }}
            style={{ width: "100%", background: "#fff", border: "2px solid #eee", borderRadius: 12, padding: "14px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, color: DARK }}>
            <span style={{ fontSize: 22 }}>🎵</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 800 }}>Audio</div>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>
                {audioUrl ? "Audio gekoppeld" : "Importeer audio"}
              </div>
            </div>
            <span style={{ marginLeft: "auto", color: "#ccc" }}>›</span>
          </button>

          {/* Noten Editor knop */}
          <button onClick={function() { setScherm("editor"); }}
            style={{ width: "100%", background: "#fff", border: "2px solid #eee", borderRadius: 12, padding: "14px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, color: DARK }}>
            <span style={{ fontSize: 22 }}>🎼</span>
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 800 }}>Noten Editor</div>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 400 }}>Maak en bewerk noten</div>
            </div>
            <span style={{ marginLeft: "auto", color: "#ccc" }}>›</span>
          </button>

        </div>
{/* Info / Notities */}
<div style={{ marginBottom: 20 }}>
  <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 8 }}>INFO / NOTITIES</label>
  <textarea value={info} onChange={function(e) { setInfo(e.target.value); }}
    placeholder="Voeg notities toe..."
    rows={4}
    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 13, outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.6, color: DARK }} />
</div>

        {/* Opslaan */}
        <button onClick={handleSave} disabled={opslaan}
          style={{ width: "100%", background: opslaan ? "#ccc" : PINK, color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 800, cursor: opslaan ? "default" : "pointer" }}>
          {opslaan ? "Opslaan..." : (isNieuw ? "Opslaan" : "Wijzigingen opslaan")}
        </button>

      </div>
    </div>
  );
}
