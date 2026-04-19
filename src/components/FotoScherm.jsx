import { useState, useRef } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db, storage } from "../firebase.js";
import { PINK, PINK_LIGHT, DARK } from "../constants.js";
import { verwerkFoto } from "../utils.js";
import FotoBijsnijden from "./FotoBijsnijden.jsx";

export default function FotoScherm({ oefeningId, maakConceptAan, fotos, info, onFotosUpdate, onInfoUpdate, onTerug }) {
  const [localFotos, setLocalFotos] = useState(fotos || []);
  const [localInfo, setLocalInfo] = useState(info || "");
  const [uploading, setUploading] = useState(false);
  const [verwerkStatus, setVerwerkStatus] = useState({});
  const [bijsnijdFoto, setBijsnijdFoto] = useState(null);
  const [bijsnijdIndex, setBijsnijdIndex] = useState(null);
  const [analyseBezig, setAnalyseBezig] = useState(false);
  const [analyseStatus, setAnalyseStatus] = useState("");
  const [drempel, setDrempel] = useState(160);
  const invoerRef = useRef();
  const infoFotoRef = useRef();

  const ANALYSE_URL = "https://analyseertablature-dia7q5dlaq-uc.a.run.app";

  async function handleFotoKies(e) {
    const bestanden = Array.from(e.target.files);
    setUploading(true);
    const id = await maakConceptAan();
    const nieuweFotos = [...localFotos];
    for (var i = 0; i < bestanden.length; i++) {
      var pad = "fotos/" + id + "/" + Date.now() + "_" + i + ".jpg";
      var storageRef = ref(storage, pad);
      await uploadBytes(storageRef, bestanden[i]);
      var url = await getDownloadURL(storageRef);
      nieuweFotos.push(url);
    }
    setLocalFotos(nieuweFotos);
    onFotosUpdate(nieuweFotos);
    await updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
    setUploading(false);
  }

  async function handleVerwerk(index) {
    const id = oefeningId;
    if (!id) return;
    setVerwerkStatus(function(prev) { return Object.assign({}, prev, { [index]: "bezig" }); });
    try {
      const response = await fetch(localFotos[index]);
      const blob = await response.blob();
      const file = new File([blob], "foto.jpg", { type: "image/jpeg" });
      const verwerktBlob = await verwerkFoto(file, drempel);
      const pad = "fotos/" + id + "/clean_" + Date.now() + "_" + index + ".jpg";
      const storageRef = ref(storage, pad);
      await uploadBytes(storageRef, verwerktBlob);
      const nieuweUrl = await getDownloadURL(storageRef);
      const nieuweFotos = localFotos.map(function(f, i) { return i === index ? nieuweUrl : f; });
      setLocalFotos(nieuweFotos);
      onFotosUpdate(nieuweFotos);
      await updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
      setVerwerkStatus(function(prev) { return Object.assign({}, prev, { [index]: "klaar" }); });
    } catch (err) {
      setVerwerkStatus(function(prev) { return Object.assign({}, prev, { [index]: "fout" }); });
    }
  }

  function handleVerwijder(index) {
    const nieuweFotos = localFotos.filter(function(_, i) { return i !== index; });
    setLocalFotos(nieuweFotos);
    onFotosUpdate(nieuweFotos);
    if (oefeningId) updateDoc(doc(db, "oefeningen", oefeningId), { fotos: nieuweFotos });
  }

  function handleVerschuif(index, richting) {
    const nieuweFotos = [...localFotos];
    const naar = index + richting;
    if (naar < 0 || naar >= nieuweFotos.length) return;
    [nieuweFotos[index], nieuweFotos[naar]] = [nieuweFotos[naar], nieuweFotos[index]];
    setLocalFotos(nieuweFotos);
    onFotosUpdate(nieuweFotos);
    if (oefeningId) updateDoc(doc(db, "oefeningen", oefeningId), { fotos: nieuweFotos });
  }

  async function handleBijsnijdOpslaan(blob) {
    const id = oefeningId;
    try {
      const pad = "fotos/" + id + "/crop_" + Date.now() + ".jpg";
      const storageRef = ref(storage, pad);
      await uploadBytes(storageRef, blob);
      const nieuweUrl = await getDownloadURL(storageRef);
      const nieuweFotos = localFotos.map(function(f, i) { return i === bijsnijdIndex ? nieuweUrl : f; });
      setLocalFotos(nieuweFotos);
      onFotosUpdate(nieuweFotos);
      await updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
    } catch (err) {
      console.error("Upload fout:", err);
    } finally {
      setBijsnijdFoto(null);
      setBijsnijdIndex(null);
    }
  }

  async function handleAnalyseer() {
    const id = oefeningId;
    if (!id || localFotos.length === 0) return;
    setAnalyseBezig(true);
    setAnalyseStatus("Bezig met analyseren...");
    try {
      const response = await fetch(ANALYSE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotoUrls: localFotos, modus: "analyse" })
      });
      const data = await response.json();
      if (data.success) {
        setLocalInfo(data.analyse);
        onInfoUpdate(data.analyse);
        if (id) await updateDoc(doc(db, "oefeningen", id), { info: data.analyse });
        setAnalyseStatus("✓ Analyse klaar!");
        setTimeout(function() { setAnalyseStatus(""); }, 3000);
      } else {
        setAnalyseStatus("Fout bij analyse.");
      }
    } catch (err) {
      setAnalyseStatus("Fout bij analyse.");
    }
    setAnalyseBezig(false);
  }

  async function handleInfoFotoKies(e) {
    const bestand = e.target.files[0];
    if (!bestand) return;
    setAnalyseBezig(true);
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
        const nieuweInfo = localInfo ? localInfo + "\n\n" + data.analyse : data.analyse;
        setLocalInfo(nieuweInfo);
        onInfoUpdate(nieuweInfo);
        if (id) await updateDoc(doc(db, "oefeningen", id), { info: nieuweInfo });
        setAnalyseStatus("✓ Tekst geïmporteerd!");
        setTimeout(function() { setAnalyseStatus(""); }, 3000);
      } else {
        setAnalyseStatus("Fout. Probeer opnieuw.");
      }
    } catch (err) {
      setAnalyseStatus("Fout. Probeer opnieuw.");
    }
    setAnalyseBezig(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 400, display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #eee", flexShrink: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: DARK }}>📸 Foto</div>
        <button onClick={onTerug}
          style={{ background: PINK, color: "#fff", border: "none", borderRadius: 20, padding: "6px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          ← Opslaan
        </button>
      </div>

      {/* Foto preview bovenaan -- vaste plek */}
      <div style={{ height: 200, background: "#fafafa", borderBottom: "1px solid #eee", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
        {localFotos.length > 0 ? (
          <img src={localFotos[0]} alt="Foto"
            style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <div style={{ color: "#ccc", fontSize: 13, textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📸</div>
            <div>Nog geen foto</div>
          </div>
        )}
      </div>

      {/* Scrollbare inhoud */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

        {/* Import knop */}
        <button onClick={function() { invoerRef.current.click(); }}
          style={{ width: "100%", background: PINK, color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer", marginBottom: 12 }}>
          {uploading ? "Uploaden..." : localFotos.length > 0 ? "+ Nog een foto" : "📸 Importeer foto"}
        </button>
        <input ref={invoerRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFotoKies} />

        {/* Contrast drempel */}
        {localFotos.length > 0 && (
          <div style={{ background: "#fafafa", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#888" }}>CONTRAST DREMPEL</label>
              <span style={{ fontSize: 10, fontWeight: 800, color: PINK }}>{drempel}</span>
            </div>
            <input type="range" min={50} max={220} value={drempel}
              onChange={function(e) { setDrempel(Number(e.target.value)); }}
              style={{ width: "100%", accentColor: PINK }} />
          </div>
        )}

        {/* AI knoppen */}
        {localFotos.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button onClick={handleAnalyseer} disabled={analyseBezig}
              style={{ flex: 1, background: analyseBezig ? "#eee" : "#8B2FC9", color: analyseBezig ? "#bbb" : "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 12, fontWeight: 800, cursor: analyseBezig ? "default" : "pointer" }}>
              {analyseBezig ? "🤖 Bezig..." : "🤖 AI Analyse"}
            </button>
            <button onClick={function() { infoFotoRef.current.click(); }} disabled={analyseBezig}
              style={{ flex: 1, background: "#E8F4FD", color: "#1976D2", border: "none", borderRadius: 10, padding: "11px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
              📸 Info foto
            </button>
            <input ref={infoFotoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleInfoFotoKies} />
          </div>
        )}

        {/* Analyse status */}
        {analyseStatus ? (
          <div style={{ marginBottom: 12, fontSize: 11, color: analyseStatus.startsWith("✓") ? "#00B84C" : "#888", textAlign: "center", fontWeight: 600 }}>
            {analyseStatus}
          </div>
        ) : null}

        {/* AI bevindingen */}
        {localInfo ? (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 6 }}>AI BEVINDINGEN</label>
            <textarea value={localInfo} onChange={function(e) { setLocalInfo(e.target.value); onInfoUpdate(e.target.value); }}
              rows={4}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 12, outline: "none", resize: "none", boxSizing: "border-box", lineHeight: 1.6, color: DARK }} />
          </div>
        ) : null}

        {/* Foto lijst */}
        {localFotos.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 8 }}>FOTO'S</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {localFotos.map(function(foto, i) {
                const status = verwerkStatus[i];
                return (
                  <div key={i} style={{ background: "#fafafa", borderRadius: 10, padding: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <img src={foto} alt={"foto " + (i+1)}
                        onClick={function() { setBijsnijdFoto(foto); setBijsnijdIndex(i); }}
                        style={{ width: 56, height: 40, objectFit: "cover", borderRadius: 7, flexShrink: 0, cursor: "pointer", border: "2px solid " + PINK_LIGHT }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "#999" }}>Foto {i+1}</div>
                        <div style={{ fontSize: 9, color: PINK, fontWeight: 600 }}>Tik om bij te snijden</div>
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={function() { handleVerschuif(i, -1); }} disabled={i === 0}
                          style={{ background: i === 0 ? "#eee" : "#f0f0f0", border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 12, cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#ccc" : "#666" }}>↑</button>
                        <button onClick={function() { handleVerschuif(i, 1); }} disabled={i === localFotos.length - 1}
                          style={{ background: i === localFotos.length - 1 ? "#eee" : "#f0f0f0", border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 12, cursor: i === localFotos.length - 1 ? "default" : "pointer", color: i === localFotos.length - 1 ? "#ccc" : "#666" }}>↓</button>
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
          </div>
        )}
      </div>

      {/* Bijsnijden overlay */}
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
