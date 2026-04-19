import { useState, useRef, useEffect } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db, storage } from "../firebase.js";
import { PINK, PINK_LIGHT, DARK } from "../constants.js";
import { verwerkFoto } from "../utils.js";

const ANALYSE_URL = "https://analyseertablature-dia7q5dlaq-uc.a.run.app";

export default function FotoScherm({ oefeningId, maakConceptAan, fotos, info, onFotosUpdate, onInfoUpdate, onTerug }) {

  // State
  const [actieveTab, setActieveTab] = useState("foto");
  const [localFotos, setLocalFotos] = useState(fotos || []);
  const [localInfo, setLocalInfo] = useState(info || "");
  const [uploading, setUploading] = useState(false);
  const [analyseBezig, setAnalyseBezig] = useState(false);
  const [analyseStatus, setAnalyseStatus] = useState("");
  const [drempel, setDrempel] = useState(160);
  const [bijsnijdActief, setBijsnijdActief] = useState(false);
  const [verwerkStatus, setVerwerkStatus] = useState({});

  // Undo stacks
  const [fotoHistory, setFotoHistory] = useState([fotos || []]);
  const [infoHistory, setInfoHistory] = useState([info || ""]);

  // Swipe
  const touchStartX = useRef(null);
  const tabs = ["foto", "notatie", "info"];

  // Refs
  const invoerRef = useRef();
  const canvasRef = useRef();
  const imgRef = useRef();

  // Bijsnijden state
  const [bijsnijdStart, setBijsnijdStart] = useState(null);
  const [bijsnijdRect, setBijsnijdRect] = useState(null);
  const [activeFotoIndex, setActiveFotoIndex] = useState(0);

  function saveToHistory(nieuweUrl) {
    const nieuweFotos = [...localFotos];
    nieuweFotos[activeFotoIndex] = nieuweUrl;
    setFotoHistory(function(prev) { return [...prev, nieuweFotos]; });
  }

  function undoFoto() {
    if (fotoHistory.length <= 1) return;
    const nieuwHistory = [...fotoHistory];
    nieuwHistory.pop();
    const vorigeState = nieuwHistory[nieuwHistory.length - 1];
    setFotoHistory(nieuwHistory);
    setLocalFotos(vorigeState);
    onFotosUpdate(vorigeState);
    if (oefeningId) updateDoc(doc(db, "oefeningen", oefeningId), { fotos: vorigeState });
  }

  function undoInfo() {
    if (infoHistory.length <= 1) return;
    const nieuwHistory = [...infoHistory];
    nieuwHistory.pop();
    const vorigeInfo = nieuwHistory[nieuwHistory.length - 1];
    setInfoHistory(nieuwHistory);
    setLocalInfo(vorigeInfo);
    onInfoUpdate(vorigeInfo);
    if (oefeningId) updateDoc(doc(db, "oefeningen", oefeningId), { info: vorigeInfo });
  }

  // Swipe handlers
  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e) {
    if (bijsnijdActief) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    const huidigIndex = tabs.indexOf(actieveTab);
    if (diff > 60 && huidigIndex < tabs.length - 1) {
      setActieveTab(tabs[huidigIndex + 1]);
    } else if (diff < -60 && huidigIndex > 0) {
      setActieveTab(tabs[huidigIndex - 1]);
    }
  }

  // Foto uploaden
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
    setFotoHistory(function(prev) { return [...prev, nieuweFotos]; });
    setLocalFotos(nieuweFotos);
    onFotosUpdate(nieuweFotos);
    await updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
    setUploading(false);
  }

  // Clean maken
  async function handleVerwerk(index) {
    const id = oefeningId;
    if (!id) return;
    setVerwerkStatus(function(prev) { return Object.assign({}, prev, { [index]: "bezig" }); });
    try {
      const response = await fetch(localFotos[index]);
      const blob = await response.blob();
      const file = new File([blob], "foto.jpg", { type: "image/jpeg" });
      const verwerktBlob = await verwerkFoto(file, drempel);
      const pad = "fotos/" + id + "/clean_" + Date.now() + ".jpg";
      const storageRef = ref(storage, pad);
      await uploadBytes(storageRef, verwerktBlob);
      const nieuweUrl = await getDownloadURL(storageRef);
      const nieuweFotos = localFotos.map(function(f, i) { return i === index ? nieuweUrl : f; });
      setFotoHistory(function(prev) { return [...prev, nieuweFotos]; });
      setLocalFotos(nieuweFotos);
      onFotosUpdate(nieuweFotos);
      await updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
      setVerwerkStatus(function(prev) { return Object.assign({}, prev, { [index]: "klaar" }); });
    } catch (err) {
      setVerwerkStatus(function(prev) { return Object.assign({}, prev, { [index]: "fout" }); });
    }
  }

  // Bijsnijden op canvas
  function handleCanvasDown(e) {
    if (!bijsnijdActief) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    setBijsnijdStart({ x, y });
    setBijsnijdRect(null);
  }

  function handleCanvasMove(e) {
    if (!bijsnijdActief || !bijsnijdStart) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
    setBijsnijdRect({
      x: Math.min(bijsnijdStart.x, x),
      y: Math.min(bijsnijdStart.y, y),
      w: Math.abs(x - bijsnijdStart.x),
      h: Math.abs(y - bijsnijdStart.y)
    });
  }

  async function handleCanvasUp() {
    if (!bijsnijdActief || !bijsnijdRect || bijsnijdRect.w < 10) {
      setBijsnijdStart(null);
      return;
    }
    // Bijsnijden uitvoeren
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!img) return;

    const scaleX = img.naturalWidth / canvas.offsetWidth;
    const scaleY = img.naturalHeight / canvas.offsetHeight;

    const offscreen = document.createElement("canvas");
    offscreen.width = bijsnijdRect.w * scaleX;
    offscreen.height = bijsnijdRect.h * scaleY;
    const ctx = offscreen.getContext("2d");
    ctx.drawImage(img,
      bijsnijdRect.x * scaleX, bijsnijdRect.y * scaleY,
      bijsnijdRect.w * scaleX, bijsnijdRect.h * scaleY,
      0, 0, offscreen.width, offscreen.height
    );

    offscreen.toBlob(async function(blob) {
      const id = oefeningId;
      if (!id) return;
      const pad = "fotos/" + id + "/crop_" + Date.now() + ".jpg";
      const storageRef = ref(storage, pad);
      await uploadBytes(storageRef, blob);
      const nieuweUrl = await getDownloadURL(storageRef);
      const nieuweFotos = localFotos.map(function(f, i) { return i === activeFotoIndex ? nieuweUrl : f; });
      setFotoHistory(function(prev) { return [...prev, nieuweFotos]; });
      setLocalFotos(nieuweFotos);
      onFotosUpdate(nieuweFotos);
      await updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
      setBijsnijdActief(false);
      setBijsnijdStart(null);
      setBijsnijdRect(null);
    }, "image/jpeg", 0.92);
  }

  // AI analyse
  async function handleAnalyseer() {
    const id = oefeningId;
    if (!id || localFotos.length === 0) return;
    setAnalyseBezig(true);
    setAnalyseStatus("🤖 AI analyseert...");
    try {
      const response = await fetch(ANALYSE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotoUrls: localFotos, modus: "analyse" })
      });
      const data = await response.json();
      if (data.success) {
        setInfoHistory(function(prev) { return [...prev, data.analyse]; });
        setLocalInfo(data.analyse);
        onInfoUpdate(data.analyse);
        if (id) await updateDoc(doc(db, "oefeningen", id), { info: data.analyse });
        setAnalyseStatus("✓ Klaar!");
        setTimeout(function() {
          setAnalyseStatus("");
          setActieveTab("info");
        }, 1000);
      } else {
        setAnalyseStatus("Fout bij analyse.");
      }
    } catch (err) {
      setAnalyseStatus("Fout bij analyse.");
    }
    setAnalyseBezig(false);
  }

  const huidigeTab = tabs.indexOf(actieveTab);

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 400, display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #eee", flexShrink: 0 }}>
        <button onClick={onTerug}
          style={{ background: "#f0f0f0", color: DARK, border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          ← Terug
        </button>
        <div style={{ fontWeight: 800, fontSize: 15, color: DARK }}>📸 Foto & Notatie</div>
        <button onClick={onTerug}
          style={{ background: PINK, color: "#fff", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          Opslaan
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #eee", flexShrink: 0 }}>
        {[
          { id: "foto", label: "📸 Foto", heeft: localFotos.length > 0 },
          { id: "notatie", label: "🎼 Notatie", heeft: false },
          { id: "info", label: "📝 Info", heeft: localInfo.length > 0 }
        ].map(function(tab) {
          return (
            <button key={tab.id} onClick={function() { setActieveTab(tab.id); }}
              style={{
                flex: 1, padding: "10px 4px", border: "none", background: "none",
                borderBottom: actieveTab === tab.id ? "2.5px solid " + PINK : "2.5px solid transparent",
                color: actieveTab === tab.id ? PINK : "#999",
                fontWeight: actieveTab === tab.id ? 800 : 600,
                fontSize: 12, cursor: "pointer", position: "relative"
              }}>
              {tab.label}
              {tab.heeft && (
                <span style={{ position: "absolute", top: 6, right: 8, width: 6, height: 6, borderRadius: "50%", background: "#00B84C" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Bovenste venster -- swipeable */}
      <div style={{ height: 220, flexShrink: 0, background: "#fafafa", borderBottom: "1px solid #eee", position: "relative", overflow: "hidden" }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}>

        {/* Foto tab */}
        {actieveTab === "foto" && (
          <div style={{ width: "100%", height: "100%", position: "relative" }}>
            {localFotos.length > 0 ? (
              <>
                <img ref={imgRef} src={localFotos[activeFotoIndex]} alt="Foto"
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />

                {/* Canvas overlay voor bijsnijden */}
                {bijsnijdActief && (
                  <canvas ref={canvasRef}
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "crosshair" }}
                    onMouseDown={handleCanvasDown}
                    onMouseMove={handleCanvasMove}
                    onMouseUp={handleCanvasUp}
                    onTouchStart={handleCanvasDown}
                    onTouchMove={handleCanvasMove}
                    onTouchEnd={handleCanvasUp}
                  />
                )}

                {/* Bijsnijden selectie rechthoek */}
                {bijsnijdActief && bijsnijdRect && (
                  <div style={{
                    position: "absolute",
                    left: bijsnijdRect.x, top: bijsnijdRect.y,
                    width: bijsnijdRect.w, height: bijsnijdRect.h,
                    border: "2px dashed " + PINK,
                    background: "rgba(255,45,122,0.1)",
                    pointerEvents: "none"
                  }} />
                )}

                {/* Bijsnijden instructie */}
                {bijsnijdActief && (
                  <div style={{ position: "absolute", bottom: 8, left: 0, right: 0, textAlign: "center", fontSize: 11, color: PINK, fontWeight: 700 }}>
                    Sleep om bij te snijden
                  </div>
                )}

                {/* Undo knop */}
                {fotoHistory.length > 1 && (
                  <button onClick={undoFoto}
                    style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: 20, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
                    ↩ Undo
                  </button>
                )}

                {/* Foto selector */}
                {localFotos.length > 1 && (
                  <div style={{ position: "absolute", bottom: 8, right: 8, display: "flex", gap: 4 }}>
                    {localFotos.map(function(_, i) {
                      return (
                        <button key={i} onClick={function() { setActiveFotoIndex(i); }}
                          style={{ width: 8, height: 8, borderRadius: "50%", border: "none", background: i === activeFotoIndex ? PINK : "#ddd", cursor: "pointer", padding: 0 }} />
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 40 }}>📸</div>
                <div style={{ color: "#ccc", fontSize: 13 }}>Nog geen foto</div>
              </div>
            )}
          </div>
        )}

        {/* Notatie tab */}
        {actieveTab === "notatie" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 40 }}>🎼</div>
            <div style={{ color: "#ccc", fontSize: 13 }}>Notatie komt hier</div>
            <div style={{ color: "#ddd", fontSize: 11 }}>Druk AI om noten te herkennen</div>
          </div>
        )}

        {/* Info tab */}
        {actieveTab === "info" && (
          <div style={{ height: "100%", overflow: "hidden", position: "relative" }}>
            <textarea value={localInfo}
              onChange={function(e) {
                setInfoHistory(function(prev) { return [...prev, e.target.value]; });
                setLocalInfo(e.target.value);
                onInfoUpdate(e.target.value);
              }}
              placeholder="Info verschijnt hier na AI analyse..."
              style={{ width: "100%", height: "100%", padding: 12, border: "none", outline: "none", resize: "none", fontSize: 12, lineHeight: 1.6, color: DARK, background: "#fafafa", boxSizing: "border-box" }} />
            {infoHistory.length > 1 && (
              <button onClick={undoInfo}
                style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: 20, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
                ↩ Undo
              </button>
            )}
          </div>
        )}

        {/* Swipe indicator */}
        <div style={{ position: "absolute", bottom: 4, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 4 }}>
          {tabs.map(function(t) {
            return <div key={t} style={{ width: 6, height: 6, borderRadius: "50%", background: actieveTab === t ? PINK : "#ddd" }} />;
          })}
        </div>
      </div>

      {/* Scrollbare knoppen onderaan */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

        {/* AI status */}
        {analyseStatus ? (
          <div style={{ marginBottom: 12, fontSize: 12, color: analyseStatus.startsWith("✓") ? "#00B84C" : "#888", textAlign: "center", fontWeight: 700 }}>
            {analyseStatus}
          </div>
        ) : null}

        {/* Foto tab knoppen */}
        {actieveTab === "foto" && (
          <>
            <button onClick={function() { invoerRef.current.click(); }}
              style={{ width: "100%", background: PINK, color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer", marginBottom: 10 }}>
              {uploading ? "Uploaden..." : localFotos.length > 0 ? "+ Nog een foto" : "📸 Importeer foto"}
            </button>
            <input ref={invoerRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFotoKies} />

            {localFotos.length > 0 && (
              <>
                {/* Contrast */}
                <div style={{ background: "#fafafa", borderRadius: 10, padding: "10px 12px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#888" }}>CONTRAST</label>
                    <span style={{ fontSize: 10, fontWeight: 800, color: PINK }}>{drempel}</span>
                  </div>
                  <input type="range" min={50} max={220} value={drempel}
                    onChange={function(e) { setDrempel(Number(e.target.value)); }}
                    style={{ width: "100%", accentColor: PINK }} />
                </div>

                {/* Acties */}
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <button onClick={function() { setBijsnijdActief(!bijsnijdActief); }}
                    style={{ flex: 1, background: bijsnijdActief ? PINK : "#f0f0f0", color: bijsnijdActief ? "#fff" : DARK, border: "none", borderRadius: 10, padding: "11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {bijsnijdActief ? "✓ Bijsnijden aan" : "✂️ Bijsnijden"}
                  </button>
                  <button onClick={function() { handleVerwerk(activeFotoIndex); }}
                    disabled={verwerkStatus[activeFotoIndex] === "bezig"}
                    style={{ flex: 1, background: verwerkStatus[activeFotoIndex] === "klaar" ? "#00B84C" : PINK_LIGHT, color: verwerkStatus[activeFotoIndex] === "klaar" ? "#fff" : PINK, border: "none", borderRadius: 10, padding: "11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    {verwerkStatus[activeFotoIndex] === "bezig" ? "Bezig..." : verwerkStatus[activeFotoIndex] === "klaar" ? "✓ Clean" : "🪄 Clean"}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {/* Notatie tab knoppen */}
        {actieveTab === "notatie" && (
          <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, paddingTop: 20 }}>
            Notatie editor komt binnenkort
          </div>
        )}

        {/* Info tab knoppen */}
        {actieveTab === "info" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              style={{ flex: 1, background: "#E8F4FD", color: "#1976D2", border: "none", borderRadius: 10, padding: "11px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              🌐 Vertaal
            </button>
          </div>
        )}

        {/* AI knop -- altijd zichtbaar */}
        <button onClick={handleAnalyseer} disabled={analyseBezig || localFotos.length === 0}
          style={{ width: "100%", background: analyseBezig ? "#eee" : "#8B2FC9", color: analyseBezig ? "#bbb" : "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 800, cursor: analyseBezig ? "default" : "pointer", marginTop: 10 }}>
          {analyseBezig ? "🤖 Analyseren..." : "🤖 AI Analyseer"}
        </button>

      </div>
    </div>
  );
}
