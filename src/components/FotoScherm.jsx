import { useState, useRef } from "react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { db, storage } from "../firebase.js";
import { PINK, PINK_LIGHT, DARK } from "../constants.js";
import { verwerkFoto } from "../utils.js";

const ANALYSE_URL = "https://analyseertablature-dia7q5dlaq-uc.a.run.app";
const HANDLE_SIZE = 24;

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
const [cropRect, setCropRect] = useState({ x: 5, y: 5, w: 90, h: 90 });
const [dragHandle, setDragHandle] = useState(null);
const [dragStart, setDragStart] = useState(null);
const [dragStartRect, setDragStartRect] = useState(null);
const [fotoFit, setFotoFit] = useState("contain");

const invoerRef = useRef();
const imgRef = useRef();
const vensterRef = useRef();
const touchStartX = useRef(null);
const tabs = ["foto", "notatie", "info"];

// ─── Swipe navigatie tussen tabs ───────────────────────────────────────────
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

// ─── Undo foto ──────────────────────────────────────────────────────────────
function undoFoto() {
if (fotoHistory.length <= 1) return;
const h = fotoHistory.slice();
h.pop();
setFotoHistory(h);
const v = h[h.length - 1];
setLocalFotos(v);
onFotosUpdate(v);
if (oefeningId) updateDoc(doc(db, "oefeningen", oefeningId), { fotos: v });
}

// ─── Undo info ──────────────────────────────────────────────────────────────
function undoInfo() {
if (infoHistory.length <= 1) return;
const h = infoHistory.slice();
h.pop();
setInfoHistory(h);
const v = h[h.length - 1];
setLocalInfo(v);
onInfoUpdate(v);
if (oefeningId) updateDoc(doc(db, "oefeningen", oefeningId), { info: v });
}

// ─── Foto importeren ────────────────────────────────────────────────────────
async function handleFotoKies(e) {
const bestanden = Array.from(e.target.files);
if (bestanden.length === 0) return;
setUploading(true);
const id = await maakConceptAan();
const nieuweFotos = localFotos.slice();
for (var i = 0; i < bestanden.length; i++) {
var pad = "fotos/" + id + "/" + Date.now() + "_" + i + ".jpg";
var storageRef = ref(storage, pad);
await uploadBytes(storageRef, bestanden[i]);
var url = await getDownloadURL(storageRef);
nieuweFotos.push(url);
}
setFotoHistory(function (p) { return p.concat([nieuweFotos]); });
setLocalFotos(nieuweFotos);
onFotosUpdate(nieuweFotos);
await updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
// Selecteer de eerste nieuw geïmporteerde foto
setActiveFotoIndex(nieuweFotos.length - bestanden.length);
setUploading(false);
}

// ─── Foto verwijderen ───────────────────────────────────────────────────────
function handleVerwijder(index) {
const nieuweFotos = localFotos.filter(function (_, i) { return i !== index; });
setFotoHistory(function (p) { return p.concat([nieuweFotos]); });
setLocalFotos(nieuweFotos);
onFotosUpdate(nieuweFotos);
if (oefeningId) updateDoc(doc(db, "oefeningen", oefeningId), { fotos: nieuweFotos });
if (activeFotoIndex >= nieuweFotos.length) {
setActiveFotoIndex(Math.max(0, nieuweFotos.length - 1));
}
}

// ─── Foto volgorde wijzigen ─────────────────────────────────────────────────
function handleVerschuif(index, richting) {
const nieuweFotos = localFotos.slice();
const naar = index + richting;
if (naar < 0 || naar >= nieuweFotos.length) return;
[nieuweFotos[index], nieuweFotos[naar]] = [nieuweFotos[naar], nieuweFotos[index]];
setFotoHistory(function (p) { return p.concat([nieuweFotos]); });
setLocalFotos(nieuweFotos);
onFotosUpdate(nieuweFotos);
// Volg de verschoven foto mee
setActiveFotoIndex(naar);
if (oefeningId) updateDoc(doc(db, "oefeningen", oefeningId), { fotos: nieuweFotos });
}

// ─── Clean (contrast verwerking) ────────────────────────────────────────────
async function handleVerwerk(index) {
const id = oefeningId;
if (!id) return;
setVerwerkStatus(function (p) { return Object.assign({}, p, { [index]: "bezig" }); });
try {
const response = await fetch(localFotos[index]);
const blob = await response.blob();
const file = new File([blob], "foto.jpg", { type: "image/jpeg" });
const verwerktBlob = await verwerkFoto(file, drempel);
const pad = "fotos/" + id + "/clean_" + Date.now() + ".jpg";
const storageRef = ref(storage, pad);
await uploadBytes(storageRef, verwerktBlob);
const nieuweUrl = await getDownloadURL(storageRef);
const nieuweFotos = localFotos.map(function (f, i) { return i === index ? nieuweUrl : f; });
setFotoHistory(function (p) { return p.concat([nieuweFotos]); });
setLocalFotos(nieuweFotos);
onFotosUpdate(nieuweFotos);
await updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
setVerwerkStatus(function (p) { return Object.assign({}, p, { [index]: "klaar" }); });
} catch (err) {
setVerwerkStatus(function (p) { return Object.assign({}, p, { [index]: "fout" }); });
}
}

// ─── Bijsnijden starten ─────────────────────────────────────────────────────
function startBijsnijden() {
setCropRect({ x: 5, y: 5, w: 90, h: 90 });
setFotoFit("contain");
setBijsnijdActief(true);
}

// ─── Touch/muis positie ophalen ─────────────────────────────────────────────
function getPos(e) {
const t = e.touches ? e.touches[0] : e;
return { x: t.clientX, y: t.clientY };
}

// ─── Handgreep slepen starten ───────────────────────────────────────────────
function handleHandleDown(e, handle) {
e.preventDefault();
e.stopPropagation();
setDragHandle(handle);
setDragStart(getPos(e));
setDragStartRect(Object.assign({}, cropRect));
}

// ─── Handgreep slepen (move) ────────────────────────────────────────────────
function handleVensterMove(e) {
if (!dragHandle || !vensterRef.current) return;
e.preventDefault();
const pos = getPos(e);
const rect = vensterRef.current.getBoundingClientRect();
const dx = ((pos.x - dragStart.x) / rect.width) * 100;
const dy = ((pos.y - dragStart.y) / rect.height) * 100;
const r = Object.assign({}, dragStartRect);

```
if (dragHandle === "tl") {
  r.x = Math.max(0, r.x + dx);
  r.y = Math.max(0, r.y + dy);
  r.w = Math.max(10, dragStartRect.w - dx);
  r.h = Math.max(10, dragStartRect.h - dy);
} else if (dragHandle === "tr") {
  r.y = Math.max(0, r.y + dy);
  r.w = Math.max(10, Math.min(100 - r.x, dragStartRect.w + dx));
  r.h = Math.max(10, dragStartRect.h - dy);
} else if (dragHandle === "bl") {
  r.x = Math.max(0, r.x + dx);
  r.w = Math.max(10, dragStartRect.w - dx);
  r.h = Math.max(10, Math.min(100 - r.y, dragStartRect.h + dy));
} else if (dragHandle === "br") {
  r.w = Math.max(10, Math.min(100 - r.x, dragStartRect.w + dx));
  r.h = Math.max(10, Math.min(100 - r.y, dragStartRect.h + dy));
}

// Zorg dat crop binnen venster blijft
r.x = Math.min(r.x, 100 - r.w);
r.y = Math.min(r.y, 100 - r.h);

setCropRect(r);
```

}

function handleVensterUp() {
setDragHandle(null);
}

// ─── Bijsnijden bevestigen (FIXED) ──────────────────────────────────────────
async function bevestigBijsnijden() {
const img = imgRef.current;
if (!img || !img.complete) return;
const vensterRect = vensterRef.current.getBoundingClientRect();
const imgRect = img.getBoundingClientRect();
const cropPxX = (cropRect.x / 100) * vensterRect.width;
const cropPxY = (cropRect.y / 100) * vensterRect.height;
const cropPxW = (cropRect.w / 100) * vensterRect.width;
const cropPxH = (cropRect.h / 100) * vensterRect.height;
const offsetX = imgRect.left - vensterRect.left;
const offsetY = imgRect.top - vensterRect.top;
const scaleX = img.naturalWidth / imgRect.width;
const scaleY = img.naturalHeight / imgRect.height;
const sx = Math.max(0, (cropPxX - offsetX) * scaleX);
const sy = Math.max(0, (cropPxY - offsetY) * scaleY);
const sw = Math.min(img.naturalWidth - sx, cropPxW * scaleX);
const sh = Math.min(img.naturalHeight - sy, cropPxH * scaleY);
if (sw <= 0 || sh <= 0) return;
try {
const response = await fetch(localFotos[activeFotoIndex]);
const blob = await response.blob();
const bitmap = await createImageBitmap(blob);
const offscreen = document.createElement("canvas");
offscreen.width = Math.round(sw);
offscreen.height = Math.round(sh);
offscreen.getContext("2d").drawImage(bitmap, Math.round(sx), Math.round(sy), Math.round(sw), Math.round(sh), 0, 0, Math.round(sw), Math.round(sh));
offscreen.toBlob(async function(blob) {
const id = oefeningId;
if (!id) return;
const storageRef = ref(storage, "fotos/" + id + "/crop_" + Date.now() + ".jpg");
await uploadBytes(storageRef, blob);
const nieuweUrl = await getDownloadURL(storageRef);
const nieuweFotos = localFotos.map(function(f, i) { return i === activeFotoIndex ? nieuweUrl : f; });
setFotoHistory(function(p) { return p.concat([nieuweFotos]); });
setLocalFotos(nieuweFotos);
onFotosUpdate(nieuweFotos);
await updateDoc(doc(db, "oefeningen", id), { fotos: nieuweFotos });
setBijsnijdActief(false);
setFotoFit("contain");
}, "image/jpeg", 0.92);
} catch(err) {
console.error("Bijsnijden fout:", err);
setBijsnijdActief(false);
}


// ─── AI Analyseer ───────────────────────────────────────────────────────────
async function handleAnalyseer() {
const id = oefeningId;
if (!id || localFotos.length === 0) return;
setAnalyseBezig(true);
setAnalyseStatus("🤖 Analyseren…");
try {
const response = await fetch(ANALYSE_URL, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ fotoUrls: localFotos, modus: "analyse" })
});
const data = await response.json();
if (data.success) {
setInfoHistory(function (p) { return p.concat([data.analyse]); });
setLocalInfo(data.analyse);
onInfoUpdate(data.analyse);
if (id) await updateDoc(doc(db, "oefeningen", id), { info: data.analyse });
setAnalyseStatus("✓ Klaar!");
setTimeout(function () {
setAnalyseStatus("");
setActieveTab("info");
}, 1000);
} else {
setAnalyseStatus("Fout.");
}
} catch (err) {
setAnalyseStatus("Fout.");
}
setAnalyseBezig(false);
}

// ─── Render ─────────────────────────────────────────────────────────────────
return (
<div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 400, display: "flex", flexDirection: "column" }}>

```
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
    ].map(function (tab) {
      return (
        <button key={tab.id} onClick={function () { setActieveTab(tab.id); }}
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

  {/* Foto venster */}
  <div ref={vensterRef}
    style={{ height: 220, flexShrink: 0, background: "#f5f5f5", borderBottom: "1px solid #eee", position: "relative", overflow: "hidden" }}
    onTouchStart={handleSwipeTouchStart}
    onTouchEnd={handleSwipeTouchEnd}
    onMouseMove={handleVensterMove}
    onTouchMove={handleVensterMove}
    onMouseUp={handleVensterUp}
    onTouchEndCapture={handleVensterUp}>

    {actieveTab === "foto" && (
      <>
        {localFotos.length > 0 ? (
          <>
            <img ref={imgRef}
              src={localFotos[activeFotoIndex]}
              alt="Foto"
              crossOrigin="anonymous"
              style={{
                width: "100%", height: "100%",
                objectFit: fotoFit,
                userSelect: "none",
                pointerEvents: bijsnijdActief ? "none" : "auto"
              }} />

            {bijsnijdActief && (
              <div style={{ position: "absolute", inset: 0, zIndex: 5 }}>
                <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
                  <defs>
                    <mask id="cm">
                      <rect width="100%" height="100%" fill="white" />
                      <rect
                        x={cropRect.x + "%"} y={cropRect.y + "%"}
                        width={cropRect.w + "%"} height={cropRect.h + "%"}
                        fill="black" />
                    </mask>
                  </defs>
                  <rect width="100%" height="100%" fill="rgba(0,0,0,0.5)" mask="url(#cm)" />
                  <rect
                    x={cropRect.x + "%"} y={cropRect.y + "%"}
                    width={cropRect.w + "%"} height={cropRect.h + "%"}
                    fill="none" stroke={PINK} strokeWidth="2" />
                </svg>

                {[
                  { pos: "tl", left: cropRect.x + "%", top: cropRect.y + "%" },
                  { pos: "tr", left: (cropRect.x + cropRect.w) + "%", top: cropRect.y + "%" },
                  { pos: "bl", left: cropRect.x + "%", top: (cropRect.y + cropRect.h) + "%" },
                  { pos: "br", left: (cropRect.x + cropRect.w) + "%", top: (cropRect.y + cropRect.h) + "%" },
                ].map(function (h) {
                  return (
                    <div key={h.pos}
                      style={{
                        position: "absolute",
                        width: HANDLE_SIZE, height: HANDLE_SIZE,
                        background: "#fff",
                        border: "3px solid " + PINK,
                        borderRadius: 4,
                        left: h.left, top: h.top,
                        transform: "translate(-50%,-50%)",
                        zIndex: 10,
                        touchAction: "none",
                        cursor: "pointer"
                      }}
                      onMouseDown={function (e) { handleHandleDown(e, h.pos); }}
                      onTouchStart={function (e) { handleHandleDown(e, h.pos); }}
                    />
                  );
                })}
              </div>
            )}

            {fotoHistory.length > 1 && !bijsnijdActief && (
              <button onClick={undoFoto}
                style={{ position: "absolute", top: 8, right: 8, background: "rgba(0,0,0,0.45)", color: "#fff", border: "none", borderRadius: 16, padding: "4px 10px", fontSize: 11, cursor: "pointer", zIndex: 10 }}>
                ↩ Undo
              </button>
            )}
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 40 }}>📸</div>
            <div style={{ color: "#ccc", fontSize: 13 }}>Nog geen foto</div>
          </div>
        )}
      </>
    )}

    {actieveTab === "notatie" && (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 40 }}>🎼</div>
        <div style={{ color: "#ccc", fontSize: 13 }}>Notatie komt hier</div>
      </div>
    )}

    {actieveTab === "info" && (
      <div style={{ height: "100%", position: "relative" }}>
        <textarea
          value={localInfo}
          onChange={function (e) {
            setInfoHistory(function (p) { return p.concat([e.target.value]); });
            setLocalInfo(e.target.value);
            onInfoUpdate(e.target.value);
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
  </div>

  {/* Knoppen + lijst */}
  <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>

    {actieveTab === "foto" && (
      <>
        <button onClick={function () { invoerRef.current.click(); }}
          style={{ width: "100%", background: PINK, color: "#fff", border: "none", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
          {uploading ? "Uploaden..." : "📸 Foto importeren"}
        </button>
        <input ref={invoerRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFotoKies} />

        <button onClick={handleAnalyseer} disabled={analyseBezig || localFotos.length === 0}
          style={{ width: "100%", background: analyseBezig ? "#eee" : "#8B2FC9", color: analyseBezig ? "#bbb" : "#fff", border: "none", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 700, cursor: analyseBezig ? "default" : "pointer", marginBottom: 8 }}>
          {analyseBezig ? "🤖 Analyseren..." : "🤖 AI Analyseer"}
        </button>

        {analyseStatus ? (
          <div style={{ marginBottom: 8, fontSize: 12, color: analyseStatus.startsWith("✓") ? "#00B84C" : "#888", textAlign: "center", fontWeight: 700 }}>
            {analyseStatus}
          </div>
        ) : null}

        {localFotos.length > 0 && (
          <>
            <div style={{ background: "#fafafa", borderRadius: 10, padding: "8px 12px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: "#888" }}>CONTRAST</label>
                <span style={{ fontSize: 10, fontWeight: 800, color: PINK }}>{drempel}</span>
              </div>
              <input type="range" min={50} max={220} value={drempel}
                onChange={function (e) { setDrempel(Number(e.target.value)); }}
                style={{ width: "100%", accentColor: PINK }} />
            </div>

            {bijsnijdActief ? (
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button onClick={bevestigBijsnijden}
                  style={{ flex: 1, background: "#00B84C", color: "#fff", border: "none", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  ✓ Bevestig
                </button>
                <button onClick={function () { setBijsnijdActief(false); }}
                  style={{ flex: 1, background: "#f0f0f0", color: DARK, border: "none", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  ✗ Annuleer
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <button onClick={startBijsnijden}
                  style={{ flex: 1, background: "#f0f0f0", color: DARK, border: "none", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  ✂️ Bijsnijden
                </button>
                <button
                  onClick={function () { handleVerwerk(activeFotoIndex); }}
                  disabled={verwerkStatus[activeFotoIndex] === "bezig"}
                  style={{
                    flex: 1,
                    background: verwerkStatus[activeFotoIndex] === "klaar" ? "#00B84C" : PINK_LIGHT,
                    color: verwerkStatus[activeFotoIndex] === "klaar" ? "#fff" : PINK,
                    border: "none", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 700,
                    cursor: verwerkStatus[activeFotoIndex] === "bezig" ? "default" : "pointer"
                  }}>
                  {verwerkStatus[activeFotoIndex] === "bezig" ? "Bezig..." : verwerkStatus[activeFotoIndex] === "klaar" ? "✓ Clean" : "🪄 Clean"}
                </button>
              </div>
            )}

            {/* Foto lijst */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {localFotos.map(function (foto, i) {
                return (
                  <div key={i}
                    style={{
                      background: i === activeFotoIndex ? "#fff0f5" : "#fafafa",
                      borderRadius: 10, padding: 8,
                      border: i === activeFotoIndex ? "1.5px solid " + PINK : "1.5px solid transparent",
                      cursor: "pointer"
                    }}
                    onClick={function () {
                      setActiveFotoIndex(i);
                      setBijsnijdActief(false);
                      setFotoFit("contain");
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <img src={foto} alt={"foto " + (i + 1)}
                        style={{ width: 56, height: 40, objectFit: "cover", borderRadius: 7, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, color: "#999" }}>Foto {i + 1}</div>
                        {i === activeFotoIndex && (
                          <div style={{ fontSize: 9, color: PINK, fontWeight: 600 }}>Actief</div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={function (e) { e.stopPropagation(); handleVerschuif(i, -1); }}
                          disabled={i === 0}
                          style={{ background: i === 0 ? "#eee" : "#f0f0f0", border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 12, cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#ccc" : "#666" }}>
                          ↑
                        </button>
                        <button
                          onClick={function (e) { e.stopPropagation(); handleVerschuif(i, 1); }}
                          disabled={i === localFotos.length - 1}
                          style={{ background: i === localFotos.length - 1 ? "#eee" : "#f0f0f0", border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 12, cursor: i === localFotos.length - 1 ? "default" : "pointer", color: i === localFotos.length - 1 ? "#ccc" : "#666" }}>
                          ↓
                        </button>
                        <button
                          onClick={function (e) { e.stopPropagation(); handleVerwijder(i); }}
                          style={{ background: "#FFF0F0", color: "#E53935", border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 12, cursor: "pointer" }}>
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </>
    )}

    {actieveTab === "notatie" && (
      <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, paddingTop: 20 }}>
        Notatie editor komt binnenkort
      </div>
    )}

    {actieveTab === "info" && (
      <>
        <button
          style={{ width: "100%", background: "#E8F4FD", color: "#1976D2", border: "none", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 8 }}>
          🌐 Vertaal naar Nederlands
        </button>
        <button onClick={handleAnalyseer} disabled={analyseBezig || localFotos.length === 0}
          style={{ width: "100%", background: analyseBezig ? "#eee" : "#8B2FC9", color: analyseBezig ? "#bbb" : "#fff", border: "none", borderRadius: 10, padding: "9px", fontSize: 13, fontWeight: 700, cursor: analyseBezig ? "default" : "pointer" }}>
          {analyseBezig ? "🤖 Analyseren..." : "🤖 AI Analyseer"}
        </button>
      </>
    )}
  </div>
</div>
);
}