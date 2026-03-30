import { useState, useEffect, useRef } from “react”;

const PINK = “#FF2D7A”;
const PINK_LIGHT = “#FFE0EE”;
const DARK = “#1A1A1A”;
const BG = “#F5F4F0”;

const MODULES = [
{ id: “mod1”, name: “Fundamenten”, level: “Beginner”, color: PINK },
{ id: “mod2”, name: “Groove & Ritme”, level: “Beginner”, color: PINK },
{ id: “mod3”, name: “Muting & Articulatie”, level: “Intermediate”, color: “#FF8C00” },
{ id: “mod4”, name: “Slap Bass”, level: “Advanced”, color: “#8B2FC9” },
];

function Badge({ level }) {
const colors = {
Beginner: [PINK_LIGHT, PINK],
Intermediate: [”#FFF0E0”, “#FF8C00”],
Advanced: [”#F0E8FF”, “#8B2FC9”]
};
const c = colors[level] || colors.Beginner;
return (
<span style={{ background: c[0], color: c[1], fontSize: 9, fontWeight: 700, padding: “2px 7px”, borderRadius: 20, textTransform: “uppercase” }}>
{level}
</span>
);
}

function BpmGrafiek({ sessies }) {
if (!sessies || sessies.length < 2) return null;
const bpms = sessies.map(function(s) { return s.bpm; });
const max = Math.max.apply(null, bpms);
const min = Math.min.apply(null, bpms);
const range = max - min || 1;
const hoogte = 50;
const breedte = 260;
const stap = breedte / (bpms.length - 1);
const punten = bpms.map(function(b, i) {
const x = i * stap;
const y = hoogte - ((b - min) / range) * (hoogte - 8);
return x + “,” + y;
}).join(” “);
return (
<div style={{ marginTop: 10 }}>
<div style={{ fontSize: 9, color: “#bbb”, marginBottom: 4 }}>BPM PROGRESSIE</div>
<svg width={breedte} height={hoogte} style={{ overflow: “visible” }}>
<polyline points={punten} fill="none" stroke={PINK} strokeWidth="2" strokeLinejoin="round" />
{bpms.map(function(b, i) {
const x = i * stap;
const y = hoogte - ((b - min) / range) * (hoogte - 8);
return <circle key={i} cx={x} cy={y} r="3" fill={PINK} />;
})}
</svg>
</div>
);
}

function FotoGalerij({ fotos, onFotoToevoegen }) {
const [pagina, setPagina] = useState(0);
const touchStart = useRef(null);
const invoerRef = useRef();

function handleTouch(e) { touchStart.current = e.touches[0].clientX; }
function handleTouchEnd(e) {
if (!touchStart.current) return;
const diff = touchStart.current - e.changedTouches[0].clientX;
if (diff > 50 && pagina < fotos.length - 1) setPagina(function(p) { return p + 1; });
if (diff < -50 && pagina > 0) setPagina(function(p) { return p - 1; });
touchStart.current = null;
}

function handleNieuweFoto(e) {
const bestanden = Array.from(e.target.files);
bestanden.forEach(function(f) {
const r = new FileReader();
r.onload = function(ev) { onFotoToevoegen(ev.target.result); };
r.readAsDataURL(f);
});
}

if (fotos.length === 0) {
return (
<div>
<div onClick={function() { invoerRef.current.click(); }}
style={{ border: “2px dashed #ddd”, borderRadius: 12, padding: 32, textAlign: “center”, cursor: “pointer”, background: “#fafafa”, marginBottom: 16 }}>
<div style={{ fontSize: 32, marginBottom: 6 }}>foto</div>
<div style={{ fontSize: 13, color: “#999” }}>Tik om foto toe te voegen</div>
</div>
<input ref={invoerRef} type=“file” accept=“image/*” multiple style={{ display: “none” }} onChange={handleNieuweFoto} />
</div>
);
}

return (
<div style={{ marginBottom: 16 }}>
<div onTouchStart={handleTouch} onTouchEnd={handleTouchEnd} style={{ position: “relative”, borderRadius: 12, overflow: “hidden” }}>
<img src={fotos[pagina]} alt={“foto “ + (pagina + 1)} style={{ width: “100%”, display: “block”, borderRadius: 12 }} />
<div style={{ position: “absolute”, top: 8, right: 8, background: “rgba(0,0,0,0.5)”, color: “#fff”, fontSize: 11, fontWeight: 700, padding: “3px 8px”, borderRadius: 12 }}>
{pagina + 1}/{fotos.length}
</div>
</div>
<div style={{ display: “flex”, justifyContent: “center”, gap: 5, marginTop: 8, alignItems: “center” }}>
<button onClick={function() { setPagina(function(p) { return Math.max(0, p - 1); }); }}
disabled={pagina === 0}
style={{ background: pagina === 0 ? “#eee” : PINK, color: pagina === 0 ? “#bbb” : “#fff”, border: “none”, borderRadius: 8, padding: “4px 10px”, fontSize: 12, cursor: pagina === 0 ? “default” : “pointer” }}>
links
</button>
{fotos.map(function(_, i) {
return (
<div key={i} onClick={function() { setPagina(i); }}
style={{ width: i === pagina ? 18 : 7, height: 7, borderRadius: 4, background: i === pagina ? PINK : “#ddd”, cursor: “pointer”, transition: “all .2s” }} />
);
})}
<button onClick={function() { setPagina(function(p) { return Math.min(fotos.length - 1, p + 1); }); }}
disabled={pagina === fotos.length - 1}
style={{ background: pagina === fotos.length - 1 ? “#eee” : PINK, color: pagina === fotos.length - 1 ? “#bbb” : “#fff”, border: “none”, borderRadius: 8, padding: “4px 10px”, fontSize: 12, cursor: pagina === fotos.length - 1 ? “default” : “pointer” }}>
rechts
</button>
<button onClick={function() { invoerRef.current.click(); }}
style={{ background: PINK_LIGHT, color: PINK, border: “none”, borderRadius: 8, padding: “4px 10px”, fontSize: 11, fontWeight: 700, cursor: “pointer”, marginLeft: 4 }}>
plus foto
</button>
<input ref={invoerRef} type=“file” accept=“image/*” multiple style={{ display: “none” }} onChange={handleNieuweFoto} />
</div>
</div>
);
}

function SessieFormulier({ oefening, onSave, onClose }) {
const [bpm, setBpm] = useState(oefening.bpm);
const [notitie, setNotitie] = useState(””);
const maxBpm = (oefening.sessies || []).reduce(function(m, s) { return Math.max(m, s.bpm); }, 0);

function handleSave() {
onSave({ id: Date.now(), bpm: bpm, notitie: notitie, datum: new Date().toISOString() });
onClose();
}

return (
<div style={{ position: “fixed”, inset: 0, background: “rgba(0,0,0,0.5)”, zIndex: 300, display: “flex”, alignItems: “flex-end” }}
onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
<div style={{ background: “#fff”, borderRadius: “18px 18px 0 0”, width: “100%”, padding: 20 }}>
<div style={{ display: “flex”, justifyContent: “space-between”, alignItems: “center”, marginBottom: 16 }}>
<div style={{ fontWeight: 800, fontSize: 17, color: DARK }}>Sessie loggen</div>
<button onClick={onClose} style={{ background: “#f0f0f0”, border: “none”, borderRadius: “50%”, width: 30, height: 30, cursor: “pointer” }}>X</button>
</div>
<div style={{ fontSize: 12, color: “#999”, marginBottom: 16 }}>{oefening.titel}</div>
<div style={{ marginBottom: 16 }}>
<div style={{ display: “flex”, justifyContent: “space-between”, marginBottom: 4 }}>
<label style={{ fontSize: 11, fontWeight: 700, color: “#888” }}>TEMPO</label>
<span style={{ fontWeight: 800, color: PINK, fontSize: 14 }}>{bpm} BPM</span>
</div>
<input type=“range” min={40} max={240} value={bpm} onChange={function(e) { setBpm(Number(e.target.value)); }} style={{ width: “100%”, accentColor: PINK }} />
{maxBpm > 0 ? (
<div style={{ fontSize: 10, color: “#999”, marginTop: 3 }}>
Max: <strong style={{ color: PINK }}>{maxBpm} BPM</strong>
{bpm > maxBpm ? <span style={{ color: “#00B84C”, marginLeft: 6 }}>Nieuw record!</span> : null}
</div>
) : null}
</div>
<div style={{ marginBottom: 20 }}>
<label style={{ fontSize: 11, fontWeight: 700, color: “#888”, display: “block”, marginBottom: 4 }}>NOTITIE</label>
<textarea value={notitie} onChange={function(e) { setNotitie(e.target.value); }} placeholder=“Wat ging goed?” rows={3}
style={{ width: “100%”, padding: “10px 12px”, borderRadius: 10, border: “1.5px solid #eee”, fontSize: 13, outline: “none”, resize: “none”, boxSizing: “border-box” }} />
</div>
<button onClick={handleSave} style={{ width: “100%”, background: PINK, color: “#fff”, border: “none”, borderRadius: 12, padding: “13px”, fontSize: 14, fontWeight: 800, cursor: “pointer” }}>
Sessie opslaan
</button>
</div>
</div>
);
}

function DetailScherm({ oefening, onClose, onEdit, onSessieAdd, onFotoToevoegen }) {
const mod = MODULES.find(function(m) { return m.id === oefening.moduleId; });
const [showSessie, setShowSessie] = useState(false);
const maxBpm = (oefening.sessies || []).reduce(function(m, s) { return Math.max(m, s.bpm); }, 0);
const fotos = oefening.fotos || (oefening.foto ? [oefening.foto] : []);

return (
<div style={{ position: “fixed”, inset: 0, background: “#fff”, zIndex: 200, display: “flex”, flexDirection: “column”, fontFamily: “sans-serif” }}>
<div style={{ display: “flex”, alignItems: “center”, padding: “13px 16px”, borderBottom: “1px solid #eee”, gap: 10 }}>
<button onClick={onClose} style={{ background: “#f0f0f0”, border: “none”, borderRadius: “50%”, width: 32, height: 32, cursor: “pointer”, fontWeight: 800 }}>terug</button>
<div style={{ flex: 1, fontWeight: 800, fontSize: 15, color: DARK, overflow: “hidden”, textOverflow: “ellipsis”, whiteSpace: “nowrap” }}>{oefening.titel}</div>
<button onClick={function() { onEdit(oefening); onClose(); }}
style={{ background: PINK_LIGHT, color: PINK, border: “none”, borderRadius: 10, padding: “6px 12px”, fontSize: 12, fontWeight: 700, cursor: “pointer” }}>
bewerk
</button>
</div>
<div style={{ flex: 1, overflowY: “auto”, padding: 16 }}>
<FotoGalerij fotos={fotos} onFotoToevoegen={function(dataUrl) { onFotoToevoegen(oefening.id, dataUrl); }} />
<div style={{ background: “#fff”, borderRadius: 14, padding: 16, boxShadow: “0 1px 8px rgba(0,0,0,0.06)”, marginBottom: 16 }}>
<div style={{ display: “flex”, gap: 8, alignItems: “center”, marginBottom: 12 }}>
{mod ? <Badge level={mod.level} /> : null}
<span style={{ fontSize: 12, color: “#999” }}>{mod ? mod.name : “”}</span>
</div>
<div style={{ display: “grid”, gridTemplateColumns: “1fr 1fr 1fr”, gap: 10 }}>
<div style={{ background: BG, borderRadius: 10, padding: “10px 8px”, textAlign: “center” }}>
<div style={{ fontWeight: 800, fontSize: 20, color: PINK }}>{oefening.bpm}</div>
<div style={{ fontSize: 10, color: “#999” }}>Doel BPM</div>
</div>
<div style={{ background: BG, borderRadius: 10, padding: “10px 8px”, textAlign: “center” }}>
<div style={{ fontWeight: 800, fontSize: 20, color: PINK }}>{maxBpm || “-”}</div>
<div style={{ fontSize: 10, color: “#999” }}>Max BPM</div>
</div>
<div style={{ background: BG, borderRadius: 10, padding: “10px 8px”, textAlign: “center” }}>
<div style={{ fontWeight: 800, fontSize: 20, color: PINK }}>{(oefening.sessies || []).length}</div>
<div style={{ fontSize: 10, color: “#999” }}>Sessies</div>
</div>
</div>
<BpmGrafiek sessies={oefening.sessies} />
</div>
<div style={{ display: “flex”, justifyContent: “space-between”, alignItems: “center”, marginBottom: 10 }}>
<div style={{ fontWeight: 800, fontSize: 14, color: DARK }}>Sessies</div>
<button onClick={function() { setShowSessie(true); }}
style={{ background: PINK, color: “#fff”, border: “none”, borderRadius: 10, padding: “6px 12px”, fontSize: 12, fontWeight: 700, cursor: “pointer” }}>
plus Sessie
</button>
</div>
{(oefening.sessies || []).length === 0 ? (
<div style={{ textAlign: “center”, padding: “30px 20px”, background: “#fff”, borderRadius: 14, boxShadow: “0 1px 8px rgba(0,0,0,0.06)” }}>
<div style={{ fontSize: 32 }}>lijst</div>
<div style={{ color: “#bbb”, marginTop: 8, fontSize: 12 }}>Nog geen sessies.</div>
</div>
) : (
<div style={{ display: “flex”, flexDirection: “column”, gap: 8 }}>
{oefening.sessies.slice().reverse().map(function(s) {
return (
<div key={s.id} style={{ background: “#fff”, borderRadius: 12, padding: 12, boxShadow: “0 1px 6px rgba(0,0,0,0.05)” }}>
<div style={{ display: “flex”, justifyContent: “space-between”, alignItems: “center” }}>
<span style={{ fontSize: 12, color: “#999” }}>{new Date(s.datum).toLocaleDateString(“nl-NL”)}</span>
<span style={{ fontWeight: 700, color: PINK, fontSize: 14 }}>{s.bpm} BPM</span>
</div>
{s.notitie ? <div style={{ fontSize: 12, color: “#666”, marginTop: 6 }}>{s.notitie}</div> : null}
</div>
);
})}
</div>
)}
</div>
{showSessie ? (
<SessieFormulier oefening={oefening} onSave={function(sessie) { onSessieAdd(oefening.id, sessie); }} onClose={function() { setShowSessie(false); }} />
) : null}
</div>
);
}

function ModuleScherm({ module, oefeningen, onClose, onOpen, onEdit, onDelete }) {
return (
<div style={{ position: “fixed”, inset: 0, background: “#fff”, zIndex: 150, display: “flex”, flexDirection: “column”, fontFamily: “sans-serif” }}>
<div style={{ display: “flex”, alignItems: “center”, padding: “13px 16px”, borderBottom: “1px solid #eee”, gap: 10, borderTop: “3px solid “ + module.color }}>
<button onClick={onClose} style={{ background: “#f0f0f0”, border: “none”, borderRadius: “50%”, width: 32, height: 32, cursor: “pointer”, fontWeight: 800 }}>terug</button>
<div style={{ flex: 1 }}>
<div style={{ fontWeight: 800, fontSize: 15, color: DARK }}>{module.name}</div>
<Badge level={module.level} />
</div>
<div style={{ fontWeight: 800, color: module.color, fontSize: 18 }}>{oefeningen.length}</div>
</div>
<div style={{ flex: 1, overflowY: “auto”, padding: 16 }}>
{oefeningen.length === 0 ? (
<div style={{ textAlign: “center”, padding: “40px 20px” }}>
<div style={{ fontSize: 40 }}>bas</div>
<div style={{ color: “#bbb”, marginTop: 8, fontSize: 12 }}>Geen oefeningen in deze module.</div>
</div>
) : (
<div style={{ display: “flex”, flexDirection: “column”, gap: 9 }}>
{oefeningen.map(function(ex) {
return <OefeningKaart key={ex.id} oefening={ex} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />;
})}
</div>
)}
</div>
</div>
);
}

function OefeningFormulier({ oefening, onSave, onClose }) {
const isNieuw = !oefening;
const [titel, setTitel] = useState(oefening ? oefening.titel : “”);
const [moduleId, setModuleId] = useState(oefening ? oefening.moduleId : “mod1”);
const [bpm, setBpm] = useState(oefening ? oefening.bpm : 100);
const [fotos, setFotos] = useState(oefening ? (oefening.fotos || (oefening.foto ? [oefening.foto] : [])) : []);
const invoerRef = useRef();

function handleFotos(e) {
const bestanden = Array.from(e.target.files);
bestanden.forEach(function(f) {
const r = new FileReader();
r.onload = function(ev) {
setFotos(function(prev) { return prev.concat([ev.target.result]); });
};
r.readAsDataURL(f);
});
}

function handleSave() {
if (!titel.trim()) return;
const data = {
id: oefening ? oefening.id : Date.now(),
titel: titel,
moduleId: moduleId,
bpm: bpm,
fotos: fotos,
foto: fotos[0] || null,
sessies: oefening ? oefening.sessies : [],
datum: oefening ? oefening.datum : new Date().toISOString()
};
onSave(data);
onClose();
}

return (
<div style={{ position: “fixed”, inset: 0, background: “rgba(0,0,0,0.5)”, zIndex: 300, display: “flex”, alignItems: “flex-end” }}
onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
<div style={{ background: “#fff”, borderRadius: “18px 18px 0 0”, width: “100%”, maxHeight: “90vh”, overflowY: “auto”, padding: 20 }}>
<div style={{ display: “flex”, justifyContent: “space-between”, alignItems: “center”, marginBottom: 16 }}>
<div style={{ fontWeight: 800, fontSize: 17, color: DARK }}>{isNieuw ? “Nieuwe oefening” : “Bewerken”}</div>
<button onClick={onClose} style={{ background: “#f0f0f0”, border: “none”, borderRadius: “50%”, width: 30, height: 30, cursor: “pointer” }}>X</button>
</div>
<div style={{ marginBottom: 12 }}>
<label style={{ fontSize: 11, fontWeight: 700, color: “#888”, display: “block”, marginBottom: 4 }}>FOTOS</label>
<div onClick={function() { invoerRef.current.click(); }}
style={{ border: “2px dashed “ + (fotos.length > 0 ? PINK : “#ddd”), borderRadius: 12, padding: fotos.length > 0 ? 8 : 20, textAlign: “center”, cursor: “pointer”, background: fotos.length > 0 ? PINK_LIGHT : “#fafafa”, marginBottom: 6 }}>
{fotos.length > 0 ? (
<div>
<div style={{ display: “flex”, gap: 6, overflowX: “auto”, paddingBottom: 4 }}>
{fotos.map(function(f, i) {
return <img key={i} src={f} alt={“foto “ + (i+1)} style={{ height: 70, borderRadius: 8, flexShrink: 0 }} />;
})}
</div>
<div style={{ fontSize: 11, color: PINK, fontWeight: 700, marginTop: 6 }}>{fotos.length} fotos - tik voor meer</div>
</div>
) : (
<div>
<div style={{ fontSize: 24, marginBottom: 4 }}>foto</div>
<div style={{ fontSize: 12, color: “#999” }}>Tik om fotos te kiezen</div>
</div>
)}
</div>
<input ref={invoerRef} type=“file” accept=“image/*” multiple style={{ display: “none” }} onChange={handleFotos} />
</div>
<div style={{ marginBottom: 12 }}>
<label style={{ fontSize: 11, fontWeight: 700, color: “#888”, display: “block”, marginBottom: 4 }}>TITEL</label>
<input value={titel} onChange={function(e) { setTitel(e.target.value); }} placeholder=“Naam van de oefening”
style={{ width: “100%”, padding: “10px 12px”, borderRadius: 10, border: “1.5px solid #eee”, fontSize: 13, outline: “none”, boxSizing: “border-box” }} />
</div>
<div style={{ marginBottom: 12 }}>
<label style={{ fontSize: 11, fontWeight: 700, color: “#888”, display: “block”, marginBottom: 4 }}>MODULE</label>
<select value={moduleId} onChange={function(e) { setModuleId(e.target.value); }}
style={{ width: “100%”, padding: “10px 12px”, borderRadius: 10, border: “1.5px solid #eee”, fontSize: 13, outline: “none”, background: “#fff”, boxSizing: “border-box” }}>
{MODULES.map(function(m) { return <option key={m.id} value={m.id}>{m.name}</option>; })}
</select>
</div>
<div style={{ marginBottom: 20 }}>
<div style={{ display: “flex”, justifyContent: “space-between”, marginBottom: 4 }}>
<label style={{ fontSize: 11, fontWeight: 700, color: “#888” }}>TEMPO</label>
<span style={{ fontWeight: 800, color: PINK, fontSize: 13 }}>{bpm} BPM</span>
</div>
<input type=“range” min={40} max={240} value={bpm} onChange={function(e) { setBpm(Number(e.target.value)); }} style={{ width: “100%”, accentColor: PINK }} />
</div>
<button onClick={handleSave} style={{ width: “100%”, background: PINK, color: “#fff”, border: “none”, borderRadius: 12, padding: “13px”, fontSize: 14, fontWeight: 800, cursor: “pointer” }}>
{isNieuw ? “Opslaan” : “Wijzigingen opslaan”}
</button>
</div>
</div>
);
}

function OefeningKaart({ oefening, onOpen, onEdit, onDelete }) {
const mod = MODULES.find(function(m) { return m.id === oefening.moduleId; });
const fotos = oefening.fotos || (oefening.foto ? [oefening.foto] : []);
const [bevestig, setBevestig] = useState(false);

return (
<div style={{ background: “#fff”, borderRadius: 14, boxShadow: “0 1px 8px rgba(0,0,0,0.06)”, overflow: “hidden” }}>
{fotos.length > 0 ? (
<img src={fotos[0]} alt=“tab” onClick={function() { onOpen(oefening); }}
style={{ width: “100%”, height: 100, objectFit: “cover”, cursor: “pointer”, display: “block” }} />
) : null}
<div style={{ padding: 13 }}>
<div onClick={function() { onOpen(oefening); }} style={{ cursor: “pointer”, marginBottom: 8 }}>
<div style={{ fontWeight: 800, fontSize: 13, color: DARK, marginBottom: 4 }}>
{oefening.titel}
{fotos.length > 1 ? <span style={{ fontSize: 10, color: PINK, fontWeight: 700, marginLeft: 6, background: PINK_LIGHT, padding: “1px 6px”, borderRadius: 8 }}>{fotos.length} fotos</span> : null}
</div>
<div style={{ display: “flex”, gap: 6, alignItems: “center” }}>
{mod ? <Badge level={mod.level} /> : null}
<span style={{ fontSize: 10, color: “#bbb” }}>{mod ? mod.name : “”}</span>
<span style={{ fontSize: 10, color: PINK, fontWeight: 700, marginLeft: “auto” }}>{oefening.bpm} BPM</span>
</div>
</div>
<div style={{ display: “flex”, gap: 6, borderTop: “1px solid #f0f0f0”, paddingTop: 8 }}>
<button onClick={function() { onOpen(oefening); }} style={{ flex: 1, background: PINK_LIGHT, color: PINK, border: “none”, borderRadius: 8, padding: “7px”, fontSize: 11, fontWeight: 700, cursor: “pointer” }}>open</button>
<button onClick={function() { onEdit(oefening); }} style={{ background: “#f4f4f4”, color: “#666”, border: “none”, borderRadius: 8, padding: “7px 10px”, fontSize: 11, cursor: “pointer” }}>bewerk</button>
<button onClick={function() { setBevestig(true); }} style={{ background: “#FFF0F0”, color: “#E53935”, border: “none”, borderRadius: 8, padding: “7px 10px”, fontSize: 11, cursor: “pointer” }}>wis</button>
</div>
{bevestig ? (
<div style={{ marginTop: 10, background: “#FFF5F5”, borderRadius: 10, padding: 12, textAlign: “center”, border: “1px solid #FFD0D0” }}>
<div style={{ fontSize: 12, color: DARK, marginBottom: 8, fontWeight: 700 }}>Verwijderen?</div>
<div style={{ display: “flex”, gap: 8 }}>
<button onClick={function() { setBevestig(false); }} style={{ flex: 1, background: “#eee”, border: “none”, borderRadius: 8, padding: “7px”, fontSize: 12, cursor: “pointer” }}>Annuleren</button>
<button onClick={function() { onDelete(oefening.id); }} style={{ flex: 1, background: “#E53935”, color: “#fff”, border: “none”, borderRadius: 8, padding: “7px”, fontSize: 12, fontWeight: 700, cursor: “pointer” }}>Verwijderen</button>
</div>
</div>
) : null}
</div>
</div>
);
}

export default function App() {
const [tab, setTab] = useState(“home”);
const [oefeningen, setOefeningen] = useState(function() {
try { return JSON.parse(localStorage.getItem(“bf_oefeningen”) || “[]”); } catch(e) { return []; }
});
const [showNieuw, setShowNieuw] = useState(false);
const [bewerkOefening, setBewerkOefening] = useState(null);
const [openOefening, setOpenOefening] = useState(null);
const [openModule, setOpenModule] = useState(null);
const today = new Date().toLocaleDateString(“nl-NL”, { weekday: “short”, day: “numeric”, month: “short” }).toUpperCase();

useEffect(function() {
localStorage.setItem(“bf_oefeningen”, JSON.stringify(oefeningen));
}, [oefeningen]);

function handleSave(data) {
setOefeningen(function(prev) {
const bestaat = prev.find(function(e) { return e.id === data.id; });
if (bestaat) return prev.map(function(e) { return e.id === data.id ? data : e; });
return [data].concat(prev);
});
}

function handleDelete(id) {
setOefeningen(function(prev) { return prev.filter(function(e) { return e.id !== id; }); });
}

function handleSessieAdd(oefeningId, sessie) {
setOefeningen(function(prev) {
return prev.map(function(e) {
if (e.id !== oefeningId) return e;
return Object.assign({}, e, { sessies: (e.sessies || []).concat([sessie]) });
});
});
setOpenOefening(function(prev) {
if (!prev || prev.id !== oefeningId) return prev;
return Object.assign({}, prev, { sessies: (prev.sessies || []).concat([sessie]) });
});
}

function handleFotoToevoegen(oefeningId, dataUrl) {
setOefeningen(function(prev) {
return prev.map(function(e) {
if (e.id !== oefeningId) return e;
const oudeFotos = e.fotos || (e.foto ? [e.foto] : []);
const nieuweFotos = oudeFotos.concat([dataUrl]);
return Object.assign({}, e, { fotos: nieuweFotos, foto: nieuweFotos[0] });
});
});
setOpenOefening(function(prev) {
if (!prev || prev.id !== oefeningId) return prev;
const oudeFotos = prev.fotos || (prev.foto ? [prev.foto] : []);
const nieuweFotos = oudeFotos.concat([dataUrl]);
return Object.assign({}, prev, { fotos: nieuweFotos });
});
}

const totalSessies = oefeningen.reduce(function(a, e) { return a + (e.sessies || []).length; }, 0);

function renderKaarten(lijst) {
if (lijst.length === 0) {
return (
<div style={{ textAlign: “center”, padding: “40px 20px” }}>
<div style={{ fontSize: 40 }}>bas</div>
<div style={{ color: “#bbb”, marginTop: 8, fontSize: 11 }}>Nog geen oefeningen.</div>
</div>
);
}
return (
<div style={{ display: “flex”, flexDirection: “column”, gap: 9 }}>
{lijst.map(function(ex) {
return <OefeningKaart key={ex.id} oefening={ex} onOpen={setOpenOefening} onEdit={setBewerkOefening} onDelete={handleDelete} />;
})}
</div>
);
}

return (
<div style={{ maxWidth: 390, margin: “0 auto”, minHeight: “100vh”, background: BG, fontFamily: “sans-serif” }}>
<div style={{ background: “#fff”, padding: “13px 16px 10px”, borderBottom: “1px solid #f0f0f0”, position: “sticky”, top: 0, zIndex: 10 }}>
<div style={{ display: “flex”, justifyContent: “space-between”, alignItems: “center” }}>
<div>
<span style={{ color: PINK, fontWeight: 800, fontSize: 19 }}>BASS</span>
<span style={{ color: DARK, fontWeight: 800, fontSize: 19 }}>FLOW</span>
<span style={{ fontSize: 9, color: “#ccc”, marginLeft: 6 }}>PRO v0.11</span>
</div>
<div style={{ fontSize: 9, color: “#bbb”, fontWeight: 700 }}>{today}</div>
</div>
</div>

```
  <div style={{ padding: 14, paddingBottom: 80 }}>
    {tab === "home" ? (
      <div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: PINK, fontWeight: 700, letterSpacing: ".15em", marginBottom: 2 }}>JOUW PERSOONLIJKE BIBLIOTHEEK</div>
          <div style={{ fontWeight: 800, fontSize: 24, color: DARK, lineHeight: 1.1 }}>WELKOM</div>
          <div style={{ fontWeight: 800, fontSize: 24, color: PINK, lineHeight: 1.1, marginBottom: 5 }}>BASSIST</div>
          <div style={{ fontSize: 11, color: "#bbb" }}>Importeer je eigen oefeningen en houd je voortgang bij.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 20 }}>
          {[["Oefeningen", oefeningen.length], ["Sessies", totalSessies], ["Modules", 4]].map(function(item) {
            return (
              <div key={item[0]} style={{ background: "#EDEDEB", borderRadius: 11, padding: "10px 6px", textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 22, color: PINK }}>{item[1]}</div>
                <div style={{ fontSize: 9, color: "#999", fontWeight: 600 }}>{item[0]}</div>
              </div>
            );
          })}
        </div>
        <div style={{ marginBottom: 12, fontWeight: 800, fontSize: 14, color: DARK }}>Recente oefeningen</div>
        {renderKaarten(oefeningen.slice(0, 3))}
      </div>
    ) : null}

    {tab === "oefeningen" ? (
      <div>
        <div style={{ fontWeight: 800, fontSize: 17, color: DARK, marginBottom: 16 }}>Oefeningen</div>
        {renderKaarten(oefeningen)}
      </div>
    ) : null}

    {tab === "modules" ? (
      <div>
        <div style={{ fontWeight: 800, fontSize: 17, color: DARK, marginBottom: 16 }}>Modules</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {MODULES.map(function(m) {
            const cnt = oefeningen.filter(function(e) { return e.moduleId === m.id; }).length;
            return (
              <div key={m.id} onClick={function() { setOpenModule(m); }}
                style={{ background: "#fff", borderRadius: 12, padding: 13, borderLeft: "4px solid " + m.color, boxShadow: "0 1px 6px rgba(0,0,0,0.05)", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: DARK, marginBottom: 3 }}>{m.name}</div>
                    <Badge level={m.level} />
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, color: m.color, fontSize: 18 }}>{cnt}</div>
                    <div style={{ fontSize: 9, color: "#bbb" }}>oefeningen</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null}

    {tab === "voortgang" ? (
      <div>
        <div style={{ fontWeight: 800, fontSize: 17, color: DARK, marginBottom: 16 }}>Voortgang</div>
        {oefeningen.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 40 }}>grafiek</div>
            <div style={{ color: "#bbb", marginTop: 8, fontSize: 11 }}>Nog geen data.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {oefeningen.map(function(ex) {
              const maxBpm = (ex.sessies || []).reduce(function(m, s) { return Math.max(m, s.bpm); }, 0);
              return (
                <div key={ex.id} onClick={function() { setOpenOefening(ex); }}
                  style={{ background: "#fff", borderRadius: 12, padding: 13, boxShadow: "0 1px 6px rgba(0,0,0,0.05)", cursor: "pointer" }}>
                  <div style={{ fontWeight: 800, fontSize: 12, color: DARK, marginBottom: 8 }}>{ex.titel}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 8 }}>
                    {[["Doel", ex.bpm, PINK], ["Max", maxBpm || "-", "#00B84C"], ["Sessies", (ex.sessies || []).length, "#FF8C00"]].map(function(item) {
                      return (
                        <div key={item[0]} style={{ background: BG, borderRadius: 8, padding: "7px 5px", textAlign: "center" }}>
                          <div style={{ fontWeight: 800, fontSize: 15, color: item[2] }}>{item[1]}</div>
                          <div style={{ fontSize: 9, color: "#bbb" }}>{item[0]}</div>
                        </div>
                      );
                    })}
                  </div>
                  <BpmGrafiek sessies={ex.sessies} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    ) : null}
  </div>

  <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, background: "#fff", borderTop: "1px solid #f0f0f0", display: "flex", padding: "6px 0 12px", zIndex: 20 }}>
    {[
      { id: "home", label: "Home" },
      { id: "oefeningen", label: "Oefeningen" },
      { id: "import", label: "+", isPlus: true },
      { id: "modules", label: "Modules" },
      { id: "voortgang", label: "Voortgang" }
    ].map(function(item) {
      return (
        <button key={item.id} onClick={function() { if (item.isPlus) { setShowNieuw(true); } else { setTab(item.id); } }}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", color: tab === item.id ? PINK : "#bbb" }}>
          {item.isPlus ? (
            <div style={{ width: 38, height: 38, background: PINK, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", marginTop: -13 }}>+</div>
          ) : (
            <span style={{ fontSize: 17 }}>o</span>
          )}
          <span style={{ fontSize: 9, fontWeight: 700 }}>{item.label}</span>
        </button>
      );
    })}
  </div>

  {showNieuw ? <OefeningFormulier onSave={handleSave} onClose={function() { setShowNieuw(false); }} /> : null}
  {bewerkOefening ? <OefeningFormulier oefening={bewerkOefening} onSave={handleSave} onClose={function() { setBewerkOefening(null); }} /> : null}
  {openOefening ? <DetailScherm oefening={openOefening} onClose={function() { setOpenOefening(null); }} onEdit={setBewerkOefening} onSessieAdd={handleSessieAdd} onFotoToevoegen={handleFotoToevoegen} /> : null}
  {openModule ? <ModuleScherm module={openModule} oefeningen={oefeningen.filter(function(e) { return e.moduleId === openModule.id; })} onClose={function() { setOpenModule(null); }} onOpen={setOpenOefening} onEdit={setBewerkOefening} onDelete={handleDelete} /> : null}
</div>
```

);
}
