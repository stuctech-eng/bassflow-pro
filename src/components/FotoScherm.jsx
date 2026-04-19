import { useState, useRef, useCallback } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db, storage } from "../firebase.js";
import { PINK, PINK_LIGHT, DARK } from "../constants.js";
import { verwerkFoto } from "../utils.js";

const ANALYSE_URL = "https://analyseertablature-dia7q5dlaq-uc.a.run.app";
const HANDLE_SIZE = 22;

export default function FotoScherm({ oefeningId, maakConceptAan, fotos, info, onFotosUpdate, onInfoUpdate, onTerug }) {
  const [actieveTab, setActieveTab] = useState("foto");
  const [localFotos, setLocalFotos] = useState(fotos || []);
  const [localInfo, setLocalInfo] = useState(info || "");
  const [uploading, setUploading] = useState(false);
  const [analyseBezig, setAnalyseBezig] = useState(false);
  const [analyseStatus, setAnalyseStatus] = useState("");
  const [drempel, setDrempel] = useState(160);
  const [bijsnijdActief, setBijsnijdActief] = useState(false);
  const [verwerkStatus, setVerwerkStatus] = useState({});
  const [activeFotoIndex, setActiveFotoIndex] = useState(0);
  const [fotoHistory, setFotoHistory] = useState([fotos || []]);
  const [infoHistory, setInfoHistory] = useState([info || ""]);

  // Bijsnijden staat
  const [cropRect, setCropRect] = useState({ x: 10, y: 10, w: 80, h: 80 }); // percentages
  const [dragHandle, setDragHandle] = useState(null);
  const [dragStart, setDragStart] = useState(null);
  const [dragStartRect, setDragStartRect] = useState(null);

  const invoerRef = useRef();
  const imgRef = useRef();
  const overlayRef = useRef();
  const touchStartX = useRef(null);
  const tabs = ["foto", "notatie", "info"];

  // Swipe
  function handleSwipeTouchStart(e) {
    if (bijsnijdActief) return;
    touchStartX.current = e.touches[0].clientX;
  }
  function handleSwipeTouchEnd(e) {
    if (bijsnijdActief) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    const idx = tabs.indexOf(actieveTab);
    if (diff > 60 && idx < tabs.length - 1) setActieveTab(tabs[idx + 1]);
    else if (diff < -60 && idx > 0) setActieveTab(tabs[idx - 1]);
  }

  // Undo
  function undoFoto() {
    if (fotoHistory.length <= 1) return;
    const h = [...fotoHistory]; h.pop();
    setFotoHistory(h);
    const v = h[h.length - 1];
    setLocalFotos(v); onFotosUpdate(v);
    if (oefeningId) updateDoc(doc(db, "oefeningen", oefeningId), { fotos: v });
  }
  function undoInfo() {
    if (infoHistory.length <= 1) return;
    const h = [...infoHistory]; h.pop();
    setInfoHistory(h);
    const v = h[h.length - 1];
    setLocalInfo(v); onInfoUpdate(v);
    if (oefeningId) updateDoc(doc(db, "oefeningen", oefeningId), { info: v });
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
    setLocalFotos(nieuweFotos); onFotosUpdate(nieuweFotos);
    await updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
    setUploading(false);
  }

  // Clean maken
  async function handleVerwerk(index) {
    const id = oefeningId; if (!id) return;
    setVerwerkStatus(function(p) { return Object.assign({}, p, { [index]: "bezig" }); });
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
      setFotoHistory(function(p) { return [...p, nieuweFotos]; });
      setLocalFotos(nieuweFotos); onFotosUpdate(nieuweFotos);
      await updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
      setVerwerkStatus(function(p) { return Object.assign({}, p, { [index]: "klaar" }); });
    } catch (err) {
      setVerwerkStatus(function(p) { return Object.assign({}, p, { [index]: "fout" }); });
    }
  }

  // Bijsnijden handgrepen
  function startBijsnijden() {
    setCropRect({ x: 10, y: 10, w: 80, h: 80 });
    setBijsnijdActief(true);
  }

  function getClientPos(e) {
    if (e.touches) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    return { x: e.clientX, y: e.clientY };
  }

  function handleHandleDown(e, handle) {
    e.preventDefault(); e.stopPropagation();
    const pos = getClientPos(e);
    setDragHandle(handle);
    setDragStart(pos);
    setDragStartRect({ ...cropRect });
  }

  function handleOverlayMove(e) {
    if (!dragHandle || !dragStart || !overlayRef.current) return;
    e.preventDefault();
    const pos = getClientPos(e);
    const rect = overlayRef.current.getBoundingClientRect();
    const dx = ((pos.x - dragStart.x) / rect.width) * 100;
    const dy = ((pos.y - dragStart.y) / rect.height) * 100;
    const r = { ...dragStartRect };

    if (dragHandle === "move") {
      r.x = Math.max(0, Math.min(100 - r.w, r.x + dx));
      r.y = Math.max(0, Math.min(100 - r.h, r.y + dy));
    } else {
      if (dragHandle.includes("l")) { const nw = r.w - dx; if (nw > 5) { r.x = r.x + dx; r.w = nw; } }
      if (dragHandle.includes("r")) { r.w = Math.min(100 - r.x, Math.max(5, r.w + dx)); }
      if (dragHandle.includes("t")) { const nh = r.h - dy; if (nh > 5) { r.y = r.y + dy; r.h = nh; } }
      if (dragHandle.includes("b")) { r.h = Math.min(100 - r.y, Math.max(5, r.h + dy)); }
      r.x = Math.max(0, r.x); r.y = Math.max(0, r.y);
      r.w = Math.min(100 - r.x, r.w); r.h = Math.min(100 - r.y, r.h);
    }
    setCropRect(r);
  }

  function handleOverlayUp() { setDragHandle(null); }

  async function bevestigBijsnijden() {
    const img = imgRef.current; if (!img) return;
    const offscreen = document.createElement("canvas");
    const sx = (cropRect.x / 100) * img.naturalWidth;
    const sy = (cropRect.y / 100) * img.naturalHeight;
    const sw = (cropRect.w / 100) * img.naturalWidth;
    const sh = (cropRect.h / 100) * img.naturalHeight;
    offscreen.width = sw; offscreen.height = sh;
    offscreen.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    offscreen.toBlob(async function(blob) {
      const id = oefeningId; if (!id) return;
      const pad = "fotos/" + id + "/crop_" + Date.now() + ".jpg";
      const storageRef = ref(storage, pad);
      await uploadBytes(storageRef, blob);
      const nieuweUrl = await getDownloadURL(storageRef);
      const nieuweFotos = localFotos.map(function(f, i) { return i === activeFotoIndex ? nieuweUrl : f; });
      setFotoHistory(function(p) { return [...p, nieuweFotos]; });
      setLocalFotos(nieuweFotos); onFotosUpdate(nieuweFotos);
      await updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
      setBijsnijdActief(false);
    }, "image/jpeg", 0.92);
  }

  // AI
  async function handleAnalyseer() {
    const id = oefeningId;
    if (!id || localFotos.length === 0) return;
    setAnalyseBezig(true); setAnalyseStatus("🤖 Analyseren...");
    try {
      const response = await fetch(ANALYSE_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fotoUrls: localFotos, modus: "analyse" })
      });
      const data = await response.json();
      if (data.success) {
        setInfoHistory(function(p) { return [...p, data.analyse]; });
        setLocalInfo(data.analyse); onInfoUpdate(data.analyse);
        if (id) await updateDoc(doc(db, "oefeningen", id), { info: data.analyse });
        setAnalyseStatus("✓ Klaar!");
        setTimeout(function() { setAnalyseStatus(""); setActieveTab("info"); }, 1000);
      } else { setAnalyseStatus("Fout."); }
    } catch(err) { setAnalyseStatus("Fout."); }
    setAnalyseBezig(false);
  }

  // Handgreep component
  function Handle({ pos, handle }) {
    const stijl = {
      position: "absolute", width: HANDLE_SIZE, height: HANDLE_SIZE,
      background: "#fff", border: "2.5px solid " + PINK,
      borderRadius: 4, cursor: "pointer", zIndex: 10,
      touchAction: "none",
    };
    const pct = cropRect;
    if (pos === "tl") { stijl.left = pct.x + "%"; stijl.top = pct.y + "%"; stijl.transform = "translate(-50%,-50%)"; }
    if (pos === "tr") { stijl.left = (pct.x + pct.w) + "%"; stijl.top = pct.y + "%"; stijl.transform = "translate(-50%,-50%)"; }
    if (pos === "bl") { stijl.left = pct.x + "%"; stijl.top = (pct.y + pct.h) + "%"; stijl.transform = "translate(-50%,-50%)"; }
    if (pos === "br") { stijl.left = (pct.x + pct.w) + "%"; stijl.top = (pct.y + pct.h) + "%"; stijl.transform = "translate(-50%,-50%)"; }
    if (pos === "tm") { stijl.left = (pct.x + pct.w/2) + "%"; stijl.top = pct.y + "%"; stijl.transform = "translate(-50%,-50%)"; stijl.borderRadius = 12; }
    if (pos === "bm") { stijl.left = (pct.x + pct.w/2) + "%"; stijl.top = (pct.y + pct.h) + "%"; stijl.transform = "translate(-50%,-50%)"; stijl.borderRadius = 12; }
    if (pos === "lm") { stijl.left = pct.x + "%"; stijl.top = (pct.y + pct.h/2) + "%"; stijl.transform = "translate(-50%,-50%)"; stijl.borderRadius = 12; }
    if (pos === "rm") { stijl.left = (pct.x + pct.w) + "%"; stijl.top = (pct.y + pct.h/2) + "%"; stijl.transform = "translate(-50%,-50%)"; stijl.borderRadius = 12; }
    return (
      <div style={stijl}
        onMouseDown={function(e) { handleHandleDown(e, handle); }}
        onTouchStart={function(e) { handleHandleDown(e, handle); }}
      />
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 400, display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid #eee", flexShrink: 0 }}>
        <button onClick={onTerug}
          style={{ background: "#f0f0f0", color: DARK, border: "none", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          ← Terug
        </button>
        <div style={{ fontWeight: 800, fontSize: 14, color: DARK }}>Foto & Notatie</div>
        <button onClick={onTerug}
          style={{ background: PINK, color: "#fff", border: "none", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
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
                flex: 1, padding: "9px 4px", border: "none", background: "none",
                borderBottom: actieveTab === tab.id ? "2.5px solid " + PINK : "2.5px solid transparent",
                color: actieveTab === tab.id ? PINK : "#999",
                fontWeight: actieveTab === tab.id ? 800 : 600,
                fontSize: 12, cursor: "pointer", position: "relative"
              }}>
              {tab.label}
              {tab.heeft && (
                <span style={{ position: "absolute", top: 5, right: 10, width: 8, height: 8, borderRadius: "50%", background: "#00B84C" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Foto venster -- groter in portrait */}
      <div style={{ height: 300, flexShrink: 0, background: "#f5f5f5", borderBottom: "1px solid #eee", position: "relative", overflow: "hidden" }}
        onTouchStart={handleSwipeTouchStart}
        onTouchEnd={handleSwipeTouchEnd}
        onMouseMove={handleOverlayMove}
        onTouchMove={handleOverlayMove}
        onMouseUp={handleOverlayUp}
        onTouchEnd={function(e) { handleOverlayUp(); handleSwipeTouchEnd(e); }}
        ref={overlayRef}>

        {/* Foto tab */}
        {actieveTab === "foto" && (
          <>
            {localFotos.length > 0 ? (
              <>
                <img ref={imgRef} src={localFotos[activeFotoIndex]} alt="Foto"
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", userSelect: "none" }} />

                {/* Bijsnijden overlay */}
                {bijsnijdActief && (
                  <div style={{ position: "absolute", inset: 0, zIndex: 5 }}>
                    {/* Donkere overlay buiten selectie */}
                    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                      <defs>
                        <mask id="cropMask">
                          <rect width="100%" height="100%" fill="white" />
                          <rect
                            x={cropRect.x + "%"} y={cropRect.y + "%"}
                            width={cropRect.w + "%"} height={cropRect.h + "%"}
                            fill="black" />
                        </mask>
                      </defs>
                      <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#cropMask)" />
                      <rect
                        x={cropRect.x + "%"} y={cropRect.y + "%"}
                        width={cropRect.w + "%"} height={cropRect.h + "%"}
                        fill="none" stroke={PINK} strokeWidth="2" strokeDasharray="6,3" />
                    </svg>

                    {/* Verplaats heel gebied */}
                    <div style={{
                      position: "absolute",
                      left: cropRect.x + "%", top: cropRect.y + "%",
                      width: cropRect.w + "%", height: cropRect.h + "%",
                      cursor: "move", zIndex: 6
                    }}
                      onMouseDown={function(e) { handleHandleDown(e, "move"); }}
                      onTouchStart={function(e) { handleHandleDown(e, "move"); }}
                    />

                    {/* 8 handgrepen */}
                    <Handle pos="tl" handle="tl" />
                    <Handle pos="tr" handle="tr" />
                    <Handle pos="bl" handle="bl" />
                    <Handle pos="br" handle="br" />
                    <Handle pos="tm" handle="t" />
                    <Handle pos="bm" handle="b" />
                    <Handle pos="lm" handle="l" />
                    <Handle pos="rm" handle="r" />
                  </div>
                )}

                {/* Undo */}
                {fotoHistory.length > 1 && !bijsnijdActief && (
                  <button onClick={undoFoto}
                    style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.45)", color: "#fff", border: "none", borderRadius: 16, padding: "4px 10px", fontSize: 11, cursor: "pointer", zIndex: 10 }}>
                    ↩ Undo
                  </button>
                )}

                {/* Foto dots */}
                {localFotos.length > 1 && !bijsnijdActief && (
                  <div style={{ position: "absolute", bottom: 10, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
                    {localFotos.map(function(_, i) {
                      return (
                        <button key={i} onClick={function() { setActiveFotoIndex(i); }}
                          style={{ width: 10, height: 10, borderRadius: "50%", border: "none", background: i === activeFotoIndex ? PINK : "#ddd", cursor: "pointer", padding: 0 }} />
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 48 }}>📸</div>
                <div style={{ color: "#ccc", fontSize: 13 }}>Nog geen foto</div>
              </div>
            )}
          </>
        )}

        {/* Notatie tab */}
        {actieveTab === "notatie" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 48 }}>🎼</div>
            <div style={{ color: "#ccc", fontSize: 13 }}>Notatie komt hier</div>
          </div>
        )}

        {/* Info tab */}
        {actieveTab === "info" && (
          <div style={{ height: "100%", position: "relative" }}>
            <textarea value={localInfo}
              onChange={function(e) {
                setInfoHistory(function(p) { return [...p, e.target.value]; });
                setLocalInfo(e.target.value); onInfoUpdate(e.target.value);
              }}
              placeholder="Info verschijnt hier na AI analyse..."
              style={{ width: "100%", height: "100%", padding: 12, border: "none", outline: "none", resize: "none", fontSize: 12, lineHeight: 1.6, color: DARK, background: "#f5f5f5", boxSizing: "border-box" }} />
            {infoHistory.length > 1 && (
              <button onClick={undoInfo}
                style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.45)", color: "#fff", border: "none", borderRadius: 16, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>
                ↩ Undo
              </button>
            )}
          </div>
        )}

        {/* Swipe dots */}
        <div style={{ position: "absolute", bottom: 6, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 5, pointerEvents: "none" }}>
          {tabs.map(function(t) {
            return <div key={t} style={{ width: 8, height: 8, borderRadius: "50%", background: actieveTab === t ? PINK : "#ddd" }} />;
          })}
        </div>
      </div>

      {/* Knoppen onderaan */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>

        {analyseStatus ? (
          <div style={{ marginBottom: 10, fontSize: 12, color: analyseStatus.startsWith("✓") ? "#00B84C" : "#888", textAlign: "center", fontWeight: 700 }}>
            {analyseStatus}
          </div>
        ) : null}

        {/* Foto knoppen */}
        {actieveTab === "foto" && (
          <>
            <button onClick={function() { invoerRef.current.click(); }}
              style={{ width: "100%", background: PINK, color: "#fff", border: "none", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
              {uploading ? "Uploaden..." : localFotos.length > 0 ? "+ Foto toevoegen" : "📸 Importeer foto"}
            </button>
            <input ref={invoerRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFotoKies} />

            {localFotos.length > 0 && (
              <>
                <div style={{ background: "#fafafa", borderRadius: 10, padding: "8px 12px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#888" }}>CONTRAST</label>
                    <span style={{ fontSize: 10, fontWeight: 800, color: PINK }}>{drempel}</span>
                  </div>
                  <input type="range" min={50} max={220} value={drempel}
                    onChange={function(e) { setDrempel(Number(e.target.value)); }}
                    style={{ width: "100%", accentColor: PINK }} />
                </div>

                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  {bijsnijdActief ? (
                    <>
                      <button onClick={bevestigBijsnijden}
                        style={{ flex: 1, background: "#00B84C", color: "#fff", border: "none", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        ✓ Bevestig
                      </button>
                      <button onClick={function() { setBijsnijdActief(false); }}
                        style={{ flex: 1, background: "#f0f0f0", color: DARK, border: "none", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        ✗ Annuleer
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={startBijsnijden}
                        style={{ flex: 1, background: "#f0f0f0", color: DARK, border: "none", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        ✂️ Bijsnijden
                      </button>
                      <button onClick={function() { handleVerwerk(activeFotoIndex); }}
                        disabled={verwerkStatus[activeFotoIndex] === "bezig"}
                        style={{ flex: 1, background: verwerkStatus[activeFotoIndex] === "klaar" ? "#00B84C" : PINK_LIGHT, color: verwerkStatus[activeFotoIndex] === "klaar" ? "#fff" : PINK, border: "none", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                        {verwerkStatus[activeFotoIndex] === "bezig" ? "Bezig..." : verwerkStatus[activeFotoIndex] === "klaar" ? "✓ Clean" : "🪄 Clean"}
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Info knoppen */}
        {actieveTab === "info" && (
          <button
            style={{ width: "100%", background: "#E8F4FD", color: "#1976D2", border: "none", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
            🌐 Vertaal naar Nederlands
          </button>
        )}

        {/* AI knop -- altijd */}
        <button onClick={handleAnalyseer} disabled={analyseBezig || localFotos.length === 0}
          style={{ width: "100%", background: analyseBezig ? "#eee" : "#8B2FC9", color: analyseBezig ? "#bbb" : "#fff", border: "none", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 700, cursor: analyseBezig ? "default" : "pointer" }}>
          {analyseBezig ? "🤖 Analyseren..." : "🤖 AI Analyseer alles"}
        </button>

      </div>
    </div>
  );
}
