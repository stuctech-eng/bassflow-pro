import { useState, useRef } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc, addDoc, collection, deleteDoc } from "firebase/firestore";
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
  const [bijsnijdFoto, setBijsnijdFoto] = useState(null);
  const [bijsnijdIndex, setBijsnijdIndex] = useState(null);
  const [analyseBezig, setAnalyseBezig] = useState(false);
  const [analyseStatus, setAnalyseStatus] = useState("");
  const [conceptId, setConceptId] = useState(null);
  const [info, setInfo] = useState(oefening ? (oefening.info || "") : "");
  const [infoFotoBezig, setInfoFotoBezig] = useState(false);
  const invoerRef = useRef();
  const audioRef = useRef();
  const infoFotoRef = useRef();

  const ANALYSE_URL = "https://analyseertablature-dia7q5dlaq-uc.a.run.app";

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

  async function handleFotoKies(e) {
    const bestanden = Array.from(e.target.files);
    setUploading(true);
    const id = await maakConceptAan();
    const nieuweFotos = [...fotos];
    for (var i = 0; i < bestanden.length; i++) {
      var pad = "fotos/" + id + "/" + Date.now() + "_" + i + ".jpg";
      var storageRef = ref(storage, pad);
      await uploadBytes(storageRef, bestanden[i]);
      var url = await getDownloadURL(storageRef);
      nieuweFotos.push(url);
    }
    setFotos(nieuweFotos);
    await updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
    setUploading(false);
  }

  async function handleVerwerk(index) {
    const id = getOefeningId();
    if (!id) return;
    setVerwerkStatus(function(prev) { return Object.assign({}, prev, { [index]: "bezig" }); });
    try {
      const response = await fetch(fotos[index]);
      const blob = await response.blob();
      const file = new File([blob], "foto.jpg", { type: "image/jpeg" });
      const verwerktBlob = await verwerkFoto(file, drempel);
      const pad = "fotos/" + id + "/clean_" + Date.now() + "_" + index + ".jpg";
      const storageRef = ref(storage, pad);
      await uploadBytes(storageRef, verwerktBlob);
      const nieuweUrl = await getDownloadURL(storageRef);
      const nieuweFotos = fotos.map(function(f, i) { return i === index ? nieuweUrl : f; });
      setFotos(nieuweFotos);
      await updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
      setVerwerkStatus(function(prev) { return Object.assign({}, prev, { [index]: "klaar" }); });
    } catch (err) {
      setVerwerkStatus(function(prev) { return Object.assign({}, prev, { [index]: "fout" }); });
    }
  }

  function handleVerwijder(index) {
    const id = getOefeningId();
    const nieuweFotos = fotos.filter(function(_, i) { return i !== index; });
    setFotos(nieuweFotos);
    if (id) updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
  }

  function handleVerschuif(index, richting) {
    const id = getOefeningId();
    const nieuweFotos = [...fotos];
    const naar = index + richting;
    if (naar < 0 || naar >= nieuweFotos.length) return;
    [nieuweFotos[index], nieuweFotos[naar]] = [nieuweFotos[naar], nieuweFotos[index]];
    setFotos(nieuweFotos);
    if (id) updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
  }

  async function handleBijsnijdOpslaan(blob) {
    const id = getOefeningId();
    try {
      const pad = "fotos/" + id + "/crop_" + Date.now() + ".jpg";
      const storageRef = ref(storage, pad);
      await uploadBytes(storageRef, blob);
      const nieuweUrl = await getDownloadURL(storageRef);
      const nieuweFotos = fotos.map(function(f, i) { return i === bijsnijdIndex ? nieuweUrl : f; });
      setFotos(nieuweFotos);
      await updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
    } catch (err) {
      console.error("Upload fout:", err);
    } finally {
      setBijsnijdFoto(null);
      setBijsnijdIndex(null);
    }
  }

  async function handleAnalyseer() {
    const id = getOefeningId();
    if (!id || fotos.length === 0) return;
    setAnalyseBezig(true);
    setAnalyseStatus("Bezig met analyseren...");
    try {
      const response = await fetch(ANALYSE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotoUrls: fotos, titel: titel, modus: "analyse" })
      });
      const data = await response.json();
      if (data.success) {
        setInfo(data.analyse);
        if (id) await updateDoc(doc(db, "oefeningen", id), { info: data.analyse });
        setAnalyseStatus("✓ Analyse opgeslagen!");
        setTimeout(function() { setAnalyseStatus(""); }, 3000);
      } else {
        setAnalyseStatus("Fout bij analyse. Probeer opnieuw.");
      }
    } catch (err) {
      setAnalyseStatus("Fout bij analyse. Probeer opnieuw.");
    }
    setAnalyseBezig(false);
  }

  async function handleInfoFotoKies(e) {
    const bestand = e.target.files[0];
    if (!bestand) return;
    setInfoFotoBezig(true);
    setAnalyseStatus("Foto analyseren...");
    try {
      const id = await maakConceptAan();
      const pad = "fotos/" + id + "/info_" + Date.now() + ".jpg";
      const storageRef = ref(storage, pad);
      await uploadBytes(storageRef, bestand);
      const fotoUrl = await getDownloadURL(storageRef);
      const response = await fetch(ANALYSE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotoUrls: [fotoUrl], modus: "infofoto" })
      });
      const data = await response.json();
      if (data.success) {
        const nieuweInfo = info ? info + "\n\n" + data.analyse : data.analyse;
        setInfo(nieuweInfo);
        if (id) await updateDoc(doc(db, "oefeningen", id), { info: nieuweInfo });
        setAnalyseStatus("✓ Tekst geïmporteerd!");
        setTimeout(function() { setAnalyseStatus(""); }, 3000);
      } else {
        setAnalyseStatus("Fout. Probeer opnieuw.");
      }
    } catch (err) {
      setAnalyseStatus("Fout. Probeer opnieuw.");
    }
    setInfoFotoBezig(false);
  }

  async function handleVertaalInfo() {
    if (!info.trim()) return;
    setInfoFotoBezig(true);
    setAnalyseStatus("Vertalen...");
    try {
      const response = await fetch(ANALYSE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tekst: info, modus: "vertaal" })
      });
      const data = await response.json();
      if (data.success) {
        const id = getOefeningId();
        setInfo(data.analyse);
        if (id) await updateDoc(doc(db, "oefeningen", id), { info: data.analyse });
        setAnalyseStatus("✓ Vertaald!");
        setTimeout(function() { setAnalyseStatus(""); }, 3000);
      } else {
        setAnalyseStatus("Fout. Probeer opnieuw.");
      }
    } catch (err) {
      setAnalyseStatus("Fout. Probeer opnieuw.");
    }
    setInfoFotoBezig(false);
  }

  async function handleAudioKies(e) {
    const id = await maakConceptAan();
    const bestand = e.target.files[0];
    if (!bestand) return;
    setAudioUploading(true);
    const pad = "audio/" + id + "/" + Date.now() + "_" + bestand.name;
    const storageRef = ref(storage, pad);
    await uploadBytes(storageRef, bestand);
    const url = await getDownloadURL(storageRef);
    setAudioUrl(url);
    await updateDoc(doc(db, "oefeningen", id), { audioUrl: url });
    setAudioUploading(false);
  }

  async function handleSave() {
    if (!titel.trim()) return;
    setOpslaan(true);
    const id = getOefeningId();
    const data = {
      titel, moduleId, bpm, fotos,
      sessies: oefening ? (oefening.sessies || []) : [],
      info: info,
      audioUrl,
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

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "flex-end" }}
      onClick={function(e) { if (e.target === e.currentTarget) handleAnnuleer(); }}>
      <div style={{ background: "#fff", borderRadius: "18px 18px 0 0", width: "100%", maxHeight: "92vh", overflowY: "auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: DARK }}>{isNieuw ? "Nieuwe oefening" : "Bewerken"}</div>
          <button onClick={handleAnnuleer} style={{ background: "#f0f0f0", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer" }}>✕</button>
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

          {fotos.length > 0 ? (
            <div style={{ marginBottom: 10 }}>
              <button onClick={handleAnalyseer} disabled={analyseBezig}
                style={{ width: "100%", background: analyseBezig ? "#eee" : "#8B2FC9", color: analyseBezig ? "#bbb" : "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 12, fontWeight: 800, cursor: analyseBezig ? "default" : "pointer" }}>
                {analyseBezig ? "🤖 Analyseren..." : "🤖 Analyseer tablature foto's met AI"}
              </button>
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
                      <img src={foto} alt={"foto " + (i + 1)}
                        onClick={function() { setBijsnijdFoto(foto); setBijsnijdIndex(i); }}
                        style={{ width: 56, height: 40, objectFit: "cover", borderRadius: 7, flexShrink: 0, cursor: "pointer", border: "2px solid " + PINK_LIGHT }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "#999" }}>Foto {i + 1}</div>
                        <div style={{ fontSize: 9, color: PINK, fontWeight: 600 }}>Tik om bij te snijden</div>
                      </div>
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
              <button onClick={function() { setAudioUrl(""); const id = getOefeningId(); if (id) updateDoc(doc(db, "oefeningen", id), { audioUrl: "" }); }}
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

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>INFO / NOTITIES</label>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={function() { infoFotoRef.current.click(); }} disabled={infoFotoBezig}
                style={{ background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                📸 Foto
              </button>
              <button onClick={handleVertaalInfo} disabled={infoFotoBezig || !info.trim()}
                style={{ background: "#E8F4FD", color: "#1976D2", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                🌐 Vertaal
              </button>
            </div>
            <input ref={infoFotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleInfoFotoKies} />
          </div>
          {analyseStatus ? (
            <div style={{ marginBottom: 6, fontSize: 11, color: analyseStatus.startsWith("✓") ? "#00B84C" : analyseStatus.startsWith("Fout") ? "#E53935" : "#888", textAlign: "center", fontWeight: 600 }}>
              {analyseStatus}
            </div>
          ) : null}
          <textarea value={info} onChange={function(e) { setInfo(e.target.value); }}
            placeholder="Voeg notities toe, importeer via foto of vertaal tekst..."
            rows={5}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 13, outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.6, color: DARK }} />
        </div>

        <button onClick={handleSave} disabled={opslaan}
          style={{ width: "100%", background: opslaan ? "#ccc" : PINK, color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 800, cursor: opslaan ? "default" : "pointer" }}>
          {opslaan ? "Opslaan..." : (isNieuw ? "Opslaan" : "Wijzigingen opslaan")}
        </button>
      </div>

      {bijsnijdFoto ? (
        <FotoBijsnijden
          fotoUrl={bijsnijdFoto}
          onOpslaan={handleBijsnijdOpslaan}
          onSluiten={function() { setBijsnijdFoto(null); setBijsnijdIndex(null); }}
        />
      ) : null}
    </div>
  );
}
