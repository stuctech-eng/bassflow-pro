import { useState, useRef } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db, storage } from "../firebase.js";
import { PINK, PINK_LIGHT, DARK, MODULES } from "../constants.js";

import { verwerkFoto } from "../utils.js";
import FotoBijsnijden from "./FotoBijsnijden.jsx";

export default function OefeningFormulier({ oefening, onSave, onClose }) {
  const isNieuw = !oefening;
  const [titel, setTitel] = useState(oefening ? oefening.titel : "");
  const [moduleId, setModuleId] = useState(oefening ? oefening.moduleId : "mod1");
  const [bpm, setBpm] = useState(oefening ? oefening.bpm : 100);
  const [opslaan, setOpslaan] = useState(false);
  const [fotos, setFotos] = useState(oefening ? (oefening.fotos || []) : []);
  const [uploading, setUploading] = useState(false);
  const [verwerkStatus, setVerwerkStatus] = useState({});
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(oefening ? (oefening.audioUrl || "") : "");
  const [drempel, setDrempel] = useState(160);
  const [analyseBezig, setAnalyseBezig] = useState(false);
  const [analyseStatus, setAnalyseStatus] = useState("");
  const invoerRef = useRef();
  const audioRef = useRef();

  async function handleFotoKies(e) {
    if (!oefening) return;
    const bestanden = Array.from(e.target.files);
    setUploading(true);
    const nieuweFotos = [...fotos];
    for (var i = 0; i < bestanden.length; i++) {
      var pad = "fotos/" + oefening.id + "/" + Date.now() + "_" + i + ".jpg";
      var storageRef = ref(storage, pad);
      await uploadBytes(storageRef, bestanden[i]);
      var url = await getDownloadURL(storageRef);
      nieuweFotos.push(url);
    }
    setFotos(nieuweFotos);
    await updateDoc(doc(db, "oefeningen", oefening.id), { fotos: nieuweFotos });
    setUploading(false);
  }

  async function handleVerwerk(index) {
    if (!oefening) return;
    setVerwerkStatus(function(prev) { return Object.assign({}, prev, { [index]: "bezig" }); });
    try {
      const response = await fetch(fotos[index]);
      const blob = await response.blob();
      const file = new File([blob], "foto.jpg", { type: "image/jpeg" });
      const verwerktBlob = await verwerkFoto(file, drempel);
      const pad = "fotos/" + oefening.id + "/clean_" + Date.now() + "_" + index + ".jpg";
      const storageRef = ref(storage, pad);
      await uploadBytes(storageRef, verwerktBlob);
      const nieuweUrl = await getDownloadURL(storageRef);
      const nieuweFotos = fotos.map(function(f, i) { return i === index ? nieuweUrl : f; });
      setFotos(nieuweFotos);
      await updateDoc(doc(db, "oefeningen", oefening.id), { fotos: nieuweFotos });
      setVerwerkStatus(function(prev) { return Object.assign({}, prev, { [index]: "klaar" }); });
    } catch (err) {
      setVerwerkStatus(function(prev) { return Object.assign({}, prev, { [index]: "fout" }); });
    }
  }

  function handleVerwijder(index) {
    const nieuweFotos = fotos.filter(function(_, i) { return i !== index; });
    setFotos(nieuweFotos);
    if (oefening) updateDoc(doc(db, "oefeningen", oefening.id), { fotos: nieuweFotos });
  }

  function handleVerschuif(index, richting) {
    const nieuweFotos = [...fotos];
    const naar = index + richting;
    if (naar < 0 || naar >= nieuweFotos.length) return;
    [nieuweFotos[index], nieuweFotos[naar]] = [nieuweFotos[naar], nieuweFotos[index]];
    setFotos(nieuweFotos);
    if (oefening) updateDoc(doc(db, "oefeningen", oefening.id), { fotos: nieuweFotos });
  }

  async function handleAudioKies(e) {
    if (!oefening) return;
    const bestand = e.target.files[0];
    if (!bestand) return;
    setAudioUploading(true);
    const pad = "audio/" + oefening.id + "/" + Date.now() + "_" + bestand.name;
    const storageRef = ref(storage, pad);
    await uploadBytes(storageRef, bestand);
    const url = await getDownloadURL(storageRef);
    setAudioUrl(url);
    await updateDoc(doc(db, "oefeningen", oefening.id), { audioUrl: url });
    setAudioUploading(false);
  }

  async function handleSave() {
    if (!titel.trim()) return;
    setOpslaan(true);
    const data = {
      titel, moduleId, bpm, fotos,
      sessies: oefening ? (oefening.sessies || []) : [],
      info: oefening ? (oefening.info || "") : "",
      audioUrl,
      datum: oefening ? oefening.datum : new Date().toISOString(),
      bijgewerkt: new Date().toISOString()
    };
    await onSave(oefening ? oefening.id : null, data);
    setOpslaan(false);
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "flex-end" }}
      onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: "18px 18px 0 0", width: "100%", maxHeight: "92vh", overflowY: "auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: DARK }}>{isNieuw ? "Nieuwe oefening" : "Bewerken"}</div>
          <button onClick={onClose} style={{ background: "#f0f0f0", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>TITEL</label>
          <input value={titel} onChange={function(e) { setTitel(e.target.value); }} placeholder="Naam van de oefening"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>MODULE</label>
          <select value={moduleId} onChange={function(e) { setModuleId(e.target.value); }}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" }}>
            {MODULES.map(function(m) { return <option key={m.id} value={m.id}>{m.name}</option>; })}
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>TEMPO</label>
            <span style={{ fontWeight: 800, color: PINK, fontSize: 13 }}>{bpm} BPM</span>
          </div>
          <input type="range" min={40} max={240} value={bpm} onChange={function(e) { setBpm(Number(e.target.value)); }} style={{ width: "100%", accentColor: PINK }} />
        </div>

        {!isNieuw ? (
          <>
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>TABLATURE FOTO'S</label>
                <button onClick={function() { invoerRef.current.click(); }}
                  style={{ background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {uploading ? "Uploaden..." : "+ Foto"}
                </button>
                <input ref={invoerRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFotoKies} />
              </div>

              {fotos.length > 0 ? (
                <div style={{ marginBottom: 10, background: "#fafafa", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#888" }}>CONTRAST DREMPEL</label>
                    <span style={{ fontSize: 10, fontWeight: 800, color: PINK }}>{drempel}</span>
                  </div>
                  <input type="range" min={50} max={220} value={drempel}
                    onChange={function(e) { setDrempel(Number(e.target.value)); }}
                    style={{ width: "100%", accentColor: PINK }} />
                  <div style={{ fontSize: 9, color: "#bbb", marginTop: 2 }}>Lager = meer zwart · Hoger = meer wit</div>
                </div>
              ) : null}

              {fotos.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, background: "#fafafa", borderRadius: 10, border: "2px dashed #eee", color: "#bbb", fontSize: 12 }}>
                  Nog geen foto's
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {fotos.map(function(foto, i) {
                    const status = verwerkStatus[i];
                    return (
                      <div key={i} style={{ background: "#fafafa", borderRadius: 10, padding: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <img src={foto} alt={"foto " + (i + 1)} style={{ width: 56, height: 40, objectFit: "cover", borderRadius: 7, flexShrink: 0 }} />
                          <div style={{ flex: 1, fontSize: 11, color: "#999" }}>Foto {i + 1}</div>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={function() { handleVerschuif(i, -1); }} disabled={i === 0}
                              style={{ background: i === 0 ? "#eee" : "#f0f0f0", border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 12, cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#ccc" : "#666" }}>↑</button>
                            <button onClick={function() { handleVerschuif(i, 1); }} disabled={i === fotos.length - 1}
                              style={{ background: i === fotos.length - 1 ? "#eee" : "#f0f0f0", border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 12, cursor: i === fotos.length - 1 ? "default" : "pointer", color: i === fotos.length - 1 ? "#ccc" : "#666" }}>↓</button>
                            <button onClick={function() { handleVerwijder(i); }}
                              style={{ background: "#FFF0F0", color: "#E53935", border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 12, cursor: "pointer" }}>✕</button>
                          </div>
                        </div>
                        <button onClick={function() { handleVerwerk(i); }} disabled={status === "bezig"}
                          style={{ marginTop: 6, width: "100%", background: status === "klaar" ? "#00B84C" : status === "bezig" ? "#eee" : PINK_LIGHT, color: status === "klaar" ? "#fff" : status === "bezig" ? "#bbb" : PINK, border: "none", borderRadius: 8, padding: "6px", fontSize: 11, fontWeight: 700, cursor: status === "bezig" ? "default" : "pointer" }}>
                          {status === "bezig" ? "Bezig..." : status === "klaar" ? "✓ Clean gemaakt" : status === "fout" ? "Fout -- opnieuw?" : "🪄 Maak clean"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>AUDIO</label>
                <button onClick={function() { audioRef.current.click(); }}
                  style={{ background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {audioUploading ? "Uploaden..." : audioUrl ? "Vervang" : "+ Audio"}
                </button>
                <input ref={audioRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={handleAudioKies} />
              </div>
              {audioUrl ? (
                <div style={{ background: "#fafafa", borderRadius: 10, padding: 10 }}>
                  <audio controls src={audioUrl} style={{ width: "100%", height: 32 }} />
                  <button onClick={function() { setAudioUrl(""); updateDoc(doc(db, "oefeningen", oefening.id), { audioUrl: "" }); }}
                    style={{ marginTop: 6, background: "#FFF0F0", color: "#E53935", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer", width: "100%" }}>
                    Audio verwijderen
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 16, background: "#fafafa", borderRadius: 10, border: "2px dashed #eee", color: "#bbb", fontSize: 12 }}>
                  Geen audio gekoppeld
                </div>
              )}
            </div>
          </>
        ) : null}

        <button onClick={handleSave} disabled={opslaan}
          style={{ width: "100%", background: opslaan ? "#ccc" : PINK, color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 800, cursor: opslaan ? "default" : "pointer" }}>
          {opslaan ? "Opslaan..." : (isNieuw ? "Opslaan" : "Wijzigingen opslaan")}
        </button>
      </div>
    </div>
  );
}
