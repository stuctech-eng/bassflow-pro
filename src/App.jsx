import { useState, useRef, useEffect } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "./firebase.js";

const PINK = "#FF2D7A";
const PINK_LIGHT = "#FFE0EE";
const BG = "#F5F4F0";
const DARK = "#1A1A1A";
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const MODULES_DEFAULT = [
{ id: "mod1", name: "Fundamenten", level: "Beginner", color: PINK },
{ id: "mod2", name: "Groove & Ritme", level: "Beginner", color: PINK },
{ id: "mod3", name: "Muting & Articulatie", level: "Intermediate", color: "#FF8C00" },
{ id: "mod4", name: "Slap Bass", level: "Advanced", color: "#8B2FC9" },
];

function StarRating({ value, onChange, size }) {
const sz = size || 16;
const [hover, setHover] = useState(0);
return (
<div style={{ display: "flex", gap: 1 }}>
{[1,2,3,4,5].map(function(s) {
return (
<span key={s}
onMouseEnter={function() { if (onChange) setHover(s); }}
onMouseLeave={function() { if (onChange) setHover(0); }}
onClick={function() { if (onChange) onChange(s); }}
style={{ cursor: onChange ? "pointer" : "default", fontSize: sz, color: s <= (hover || value) ? "#FFB800" : "#DDD", transition: "color .12s" }}
>*</span>
);
})}
</div>
);
}

function Badge({ level }) {
const colors = {
Beginner: [PINK_LIGHT, PINK],
Intermediate: ["#FFF0E0", "#FF8C00"],
Advanced: ["#F0E8FF", "#8B2FC9"]
};
const c = colors[level] || colors.Beginner;
return (
<span style={{ background: c[0], color: c[1], fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, letterSpacing: ".05em", textTransform: "uppercase" }}>
{level}
</span>
);
}

function UploadBar({ progress, label }) {
return (
<div style={{ marginTop: 8 }}>
<div style={{ fontSize: 10, color: "#999", marginBottom: 3 }}>{label || "Uploaden…"} {Math.round(progress)}%</div>
<div style={{ height: 4, background: "#eee", borderRadius: 4 }}>
<div style={{ width: progress + "%", height: "100%", background: PINK, borderRadius: 4, transition: "width .2s" }} />
</div>
</div>
);
}

async function analyzeImage(dataUrl, mimeType) {
const base64 = dataUrl.split(",")[1];
const body = {
model: "claude-sonnet-4-20250514",
max_tokens: 1000,
messages: [{
role: "user",
content: [
{ type: "image", source: { type: "base64", media_type: mimeType || "image/jpeg", data: base64 } },
{ type: "text", text: "Analyseer deze basgitaar bladmuziek. Geef ALLEEN JSON: {"title":"titel","tabText":"ASCII tab","bpm":120,"notes":"analyse NL"}" }
]
}]
};
const res = await fetch("https://api.anthropic.com/v1/messages", {
method: "POST",
headers: {
"Content-Type": "application/json",
"x-api-key": API_KEY,
"anthropic-version": "2023-06-01",
"anthropic-dangerous-direct-browser-access": "true"
},
body: JSON.stringify(body)
});
const data = await res.json();
const txt = (data.content || []).find(function(b) { return b.type === "text"; });
const raw = txt ? txt.text : "{}";
return JSON.parse(raw.replace(/`json|`/g, "").trim());
}

function TabView({ ex, onClose, onAddMp3 }) {
const mp3Ref = useRef();
const [playing, setPlaying] = useState(false);
const [uploadProg, setUploadProg] = useState(null);
const audioRef = useRef(null);

function togglePlay() {
if (!ex.mp3Url) return;
if (!audioRef.current) {
audioRef.current = new Audio(ex.mp3Url);
}
if (playing) {
audioRef.current.pause();
setPlaying(false);
} else {
audioRef.current.play();
setPlaying(true);
}
}

async function handleMp3(file) {
if (!file) return;
setUploadProg(0);
const storageRef = ref(storage, "mp3/" + ex.id + "/" + file.name);
const task = uploadBytesResumable(storageRef, file);
task.on("state_changed",
function(snap) { setUploadProg((snap.bytesTransferred / snap.totalBytes) * 100); },
function(err) { console.error(err); setUploadProg(null); },
async function() {
const url = await getDownloadURL(task.snapshot.ref);
onAddMp3(url);
setUploadProg(null);
}
);
}

return (
<div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 200, display: "flex", flexDirection: "column", fontFamily: "‘Syne’, sans-serif" }}>
<div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #eee", gap: 10 }}>
<button onClick={onClose} style={{ background: "#f0f0f0", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 13 }}>X</button>
<div style={{ flex: 1, fontWeight: 800, fontSize: 14, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.title}</div>
<div style={{ background: PINK_LIGHT, color: PINK, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>Tab</div>
</div>
<div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
{ex.imageUrl ? (
<img src={ex.imageUrl} alt="tab" style={{ width: "100%", borderRadius: 10 }} />
) : (
<div style={{ background: BG, borderRadius: 12, padding: 32, textAlign: "center", color: "#bbb", fontSize: 13 }}>
Geen foto beschikbaar
</div>
)}
{ex.tabText ? (
<div style={{ marginTop: 12, background: BG, borderRadius: 10, padding: 14, fontFamily: "monospace", fontSize: 11, lineHeight: 1.9, whiteSpace: "pre-wrap", color: DARK }}>
{ex.tabText}
</div>
) : null}
{ex.aiNotes ? (
<div style={{ marginTop: 10, background: PINK_LIGHT, borderRadius: 10, padding: 12, borderLeft: "3px solid " + PINK }}>
<div style={{ fontWeight: 700, color: PINK, fontSize: 11, marginBottom: 4 }}>AI Analyse</div>
<div style={{ fontSize: 12, color: DARK, lineHeight: 1.6 }}>{ex.aiNotes}</div>
</div>
) : null}
{uploadProg !== null ? <UploadBar progress={uploadProg} label="MP3 uploaden..." /> : null}
</div>
<div style={{ borderTop: "1px solid #eee", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, background: "#fafafa" }}>
<button
onClick={ex.mp3Url ? togglePlay : function() { mp3Ref.current.click(); }}
style={{ background: PINK, color: "#fff", border: "none", borderRadius: "50%", width: 46, height: 46, fontSize: ex.mp3Url ? 18 : 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 3px 12px " + PINK + "44", flexShrink: 0 }}
>
{ex.mp3Url ? (playing ? "||" : ">") : "MP3"}
</button>
<input ref={mp3Ref} type="file" accept="audio/*" style={{ display: "none" }} onChange={function(e) { handleMp3(e.target.files[0]); }} />
<div style={{ flex: 1 }}>
<div style={{ fontSize: 10, color: "#999" }}>{ex.mp3Url ? "MP3 gekoppeld" : "Tik om MP3 toe te voegen"}</div>
<div style={{ fontWeight: 800, color: PINK, fontSize: 15 }}>{ex.bpm} BPM</div>
</div>
</div>
</div>
);
}

function EditModal({ exercise, modules, onClose }) {
const isNew = !exercise;
const [step, setStep] = useState("form");
const [imageFile, setImageFile] = useState(null);
const [imagePreview, setImagePreview] = useState(exercise ? exercise.imageUrl : null);
const [mp3File, setMp3File] = useState(null);
const [title, setTitle] = useState(exercise ? exercise.title : "");
const [moduleId, setModuleId] = useState(exercise ? exercise.moduleId : (modules[0] ? modules[0].id : "mod1"));
const [bpm, setBpm] = useState(exercise ? exercise.bpm : 100);
const [uploadProg, setUploadProg] = useState(0);
const [uploadLabel, setUploadLabel] = useState("");
const fileRef = useRef();
const mp3Ref = useRef();

function handleImage(e) {
const f = e.target.files[0];
if (!f) return;
setImageFile(f);
const r = new FileReader();
r.onload = function(ev) { setImagePreview(ev.target.result); };
r.readAsDataURL(f);
}

async function handleSave() {
setStep("uploading");
let imageUrl = exercise ? exercise.imageUrl : null;
let mp3Url = exercise ? exercise.mp3Url : null;
let tabText = exercise ? exercise.tabText : "";
let aiNotes = exercise ? exercise.aiNotes : "";
let finalBpm = bpm;
let finalTitle = title;

```
if (imageFile) {
  setUploadLabel("Foto uploaden...");
  setUploadProg(0);
  const imgRef = ref(storage, "tabs/" + Date.now() + "_" + imageFile.name);
  const task = uploadBytesResumable(imgRef, imageFile);
  imageUrl = await new Promise(function(resolve, reject) {
    task.on("state_changed",
      function(snap) { setUploadProg((snap.bytesTransferred / snap.totalBytes) * 50); },
      reject,
      async function() { resolve(await getDownloadURL(task.snapshot.ref)); }
    );
  });
  setUploadLabel("AI analyseert...");
  setUploadProg(60);
  try {
    const result = await analyzeImage(imagePreview, imageFile.type);
    tabText = result.tabText || "";
    aiNotes = result.notes || "";
    if (result.bpm) finalBpm = result.bpm;
    if (result.title && !title) finalTitle = result.title;
  } catch(e) {
    console.error(e);
  }
}

if (mp3File) {
  setUploadLabel("MP3 uploaden...");
  setUploadProg(70);
  const mp3StorageRef = ref(storage, "mp3/" + Date.now() + "_" + mp3File.name);
  const task = uploadBytesResumable(mp3StorageRef, mp3File);
  mp3Url = await new Promise(function(resolve, reject) {
    task.on("state_changed",
      function(snap) { setUploadProg(70 + (snap.bytesTransferred / snap.totalBytes) * 30); },
      reject,
      async function() { resolve(await getDownloadURL(task.snapshot.ref)); }
    );
  });
}

const exData = {
  title: finalTitle || "Naamloze oefening",
  moduleId: moduleId,
  bpm: finalBpm,
  imageUrl: imageUrl,
  tabText: tabText,
  aiNotes: aiNotes,
  mp3Url: mp3Url,
  sessions: exercise ? exercise.sessions : [],
  updatedAt: new Date().toISOString()
};

if (isNew) {
  exData.createdAt = new Date().toISOString();
  await addDoc(collection(db, "exercises"), exData);
} else {
  await updateDoc(doc(db, "exercises", exercise.id), exData);
}
onClose();
```

}

const inp = { width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 13, outline: "none", fontFamily: "‘Syne’, sans-serif", boxSizing: "border-box" };
const btn = { width: "100%", background: PINK, color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "‘Syne’, sans-serif" };

return (
<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }}
onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
<div style={{ background: "#fff", borderRadius: "18px 18px 0 0", width: "100%", maxHeight: "92vh", overflowY: "auto", padding: 20, fontFamily: "‘Syne’, sans-serif" }}>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
<div style={{ fontWeight: 800, fontSize: 17, color: DARK }}>{isNew ? "Importeren" : "Bewerken"}</div>
<button onClick={onClose} style={{ background: "#f0f0f0", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", fontSize: 12 }}>X</button>
</div>

```
    {step === "uploading" ? (
      <div style={{ textAlign: "center", padding: "40px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>upload</div>
        <div style={{ fontWeight: 800, fontSize: 15, color: DARK, marginBottom: 12 }}>{uploadLabel}</div>
        <UploadBar progress={uploadProg} />
      </div>
    ) : (
      <div>
        <div onClick={function() { fileRef.current.click(); }} style={{ border: "2px dashed " + (imagePreview ? PINK : "#ddd"), borderRadius: 12, padding: imagePreview ? 8 : 24, textAlign: "center", cursor: "pointer", marginBottom: 12, background: imagePreview ? PINK_LIGHT : "#fafafa" }}>
          {imagePreview ? (
            <img src={imagePreview} alt="preview" style={{ maxHeight: 140, borderRadius: 8 }} />
          ) : (
            <div>
              <div style={{ fontSize: 30, marginBottom: 6 }}>foto</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>Foto van bladmuziek</div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>Tik om te selecteren</div>
            </div>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImage} />

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>TITEL</label>
          <input value={title} onChange={function(e) { setTitle(e.target.value); }} placeholder="Naam van de oefening" style={inp} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>MODULE</label>
          <select value={moduleId} onChange={function(e) { setModuleId(e.target.value); }} style={Object.assign({}, inp, { background: "#fff" })}>
            {modules.map(function(m) { return <option key={m.id} value={m.id}>{m.name}</option>; })}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>TEMPO</label>
            <span style={{ fontWeight: 800, color: PINK, fontSize: 13 }}>{bpm} BPM</span>
          </div>
          <input type="range" min={40} max={240} value={bpm} onChange={function(e) { setBpm(Number(e.target.value)); }} style={{ width: "100%", accentColor: PINK }} />
        </div>

        <div onClick={function() { mp3Ref.current.click(); }} style={{ border: "2px dashed " + (mp3File || (exercise && exercise.mp3Url) ? PINK : "#ddd"), borderRadius: 10, padding: 12, textAlign: "center", cursor: "pointer", marginBottom: 16, background: mp3File || (exercise && exercise.mp3Url) ? PINK_LIGHT : "#fafafa" }}>
          <div style={{ color: mp3File || (exercise && exercise.mp3Url) ? PINK : "#999", fontWeight: 600, fontSize: 12 }}>
            {mp3File ? "MP3: " + mp3File.name : (exercise && exercise.mp3Url) ? "MP3 gekoppeld (vervangen)" : "MP3 koppelen (optioneel)"}
          </div>
        </div>
        <input ref={mp3Ref} type="file" accept="audio/*" style={{ display: "none" }} onChange={function(e) { setMp3File(e.target.files[0]); }} />

        <button onClick={handleSave} style={btn}>
          {isNew ? "Opslaan in bibliotheek" : "Wijzigingen opslaan"}
        </button>
      </div>
    )}
  </div>
</div>
```

);
}

function SessionModal({ exercise, onClose }) {
const [bpm, setBpm] = useState(exercise.bpm || 100);
const [stars, setStars] = useState(0);
const [note, setNote] = useState("");
const maxBpm = (exercise.sessions || []).reduce(function(m, s) { return Math.max(m, s.bpm); }, 0);

async function handleSave() {
const session = { id: Date.now(), date: new Date().toISOString(), bpm: bpm, stars: stars, note: note };
const sessions = (exercise.sessions || []).concat([session]);
await updateDoc(doc(db, "exercises", exercise.id), { sessions: sessions });
onClose();
}

return (
<div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }}
onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
<div style={{ background: "#fff", borderRadius: "18px 18px 0 0", width: "100%", padding: 20, fontFamily: "‘Syne’, sans-serif" }}>
<div style={{ fontWeight: 800, fontSize: 16, color: DARK, marginBottom: 2 }}>Sessie loggen</div>
<div style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>{exercise.title}</div>

```
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

    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 6 }}>BEOORDELING</label>
      <StarRating value={stars} onChange={setStars} size={22} />
    </div>

    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>NOTITIE</label>
      <textarea value={note} onChange={function(e) { setNote(e.target.value); }} placeholder="Wat ging goed?" rows={2}
        style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 13, outline: "none", fontFamily: "'Syne', sans-serif", resize: "none", boxSizing: "border-box" }} />
    </div>

    <button onClick={handleSave} style={{ width: "100%", background: PINK, color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "'Syne', sans-serif" }}>
      Sessie opslaan
    </button>
  </div>
</div>
```

);
}

function ExerciseCard({ ex, modules, onSession, onView, onEdit, onDelete }) {
const mod = modules.find(function(m) { return m.id === ex.moduleId; });
const maxBpm = (ex.sessions || []).reduce(function(m, s) { return Math.max(m, s.bpm); }, 0);
const lastSession = ex.sessions && ex.sessions.length ? ex.sessions[ex.sessions.length - 1] : null;
const avgStars = ex.sessions && ex.sessions.length ? (ex.sessions.reduce(function(a, s) { return a + s.stars; }, 0) / ex.sessions.length).toFixed(1) : 0;
const incomplete = !ex.imageUrl || !ex.mp3Url;
const [confirm, setConfirm] = useState(false);

return (
<div style={{ background: "#fff", borderRadius: 14, padding: 13, boxShadow: "0 1px 8px rgba(0,0,0,0.06)", fontFamily: "‘Syne’, sans-serif" }}>
<div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
{ex.imageUrl ? (
<img src={ex.imageUrl} alt="tab" onClick={function() { onView(ex); }} style={{ width: 50, height: 50, borderRadius: 9, objectFit: "cover", border: "2px solid " + PINK_LIGHT, cursor: "pointer", flexShrink: 0 }} />
) : (
<div onClick={function() { onView(ex); }} style={{ width: 50, height: 50, borderRadius: 9, background: PINK_LIGHT, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0, cursor: "pointer" }}>
bas
</div>
)}
<div style={{ flex: 1, minWidth: 0 }}>
<div style={{ fontWeight: 800, fontSize: 13, color: DARK, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.title}</div>
<div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 4 }}>
{mod ? <Badge level={mod.level} /> : null}
<span style={{ fontSize: 10, color: "#bbb" }}>{mod ? mod.name : ""}</span>
</div>
<div style={{ display: "flex", gap: 10, fontSize: 11, color: "#bbb" }}>
<span><span style={{ color: PINK, fontWeight: 700 }}>{maxBpm || ex.bpm}</span> BPM</span>
<span><span style={{ color: PINK, fontWeight: 700 }}>{(ex.sessions || []).length}</span> sessies</span>
{avgStars > 0 ? <span>ster {avgStars}</span> : null}
</div>
</div>
<div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
<button onClick={function() { onEdit(ex); }} style={{ background: "#f4f4f4", color: "#666", border: "none", borderRadius: 7, padding: "5px 8px", fontSize: 12, cursor: "pointer" }}>edit</button>
<button onClick={function() { setConfirm(true); }} style={{ background: "#FFF0F0", color: "#E53935", border: "none", borderRadius: 7, padding: "5px 8px", fontSize: 12, cursor: "pointer" }}>del</button>
</div>
</div>

```
  {incomplete ? (
    <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
      {!ex.imageUrl ? <span style={{ fontSize: 9, color: "#B8860B", background: "#FFF8E1", padding: "2px 7px", borderRadius: 8, fontWeight: 700 }}>geen foto</span> : null}
      {!ex.mp3Url ? <span style={{ fontSize: 9, color: "#B8860B", background: "#FFF8E1", padding: "2px 7px", borderRadius: 8, fontWeight: 700 }}>geen MP3</span> : null}
    </div>
  ) : null}

  {lastSession ? (
    <div style={{ marginTop: 8, padding: "5px 10px", background: BG, borderRadius: 8, fontSize: 10, color: "#aaa", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span>{new Date(lastSession.date).toLocaleDateString("nl-NL")}</span>
      <StarRating value={lastSession.stars} size={11} />
    </div>
  ) : null}

  <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
    <button onClick={function() { onView(ex); }} style={{ flex: 1, background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Tab bekijken</button>
    <button onClick={function() { onSession(ex); }} style={{ flex: 1, background: PINK, color: "#fff", border: "none", borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Sessie</button>
  </div>

  {confirm ? (
    <div style={{ marginTop: 10, background: "#FFF5F5", borderRadius: 10, padding: 12, textAlign: "center", border: "1px solid #FFD0D0" }}>
      <div style={{ fontSize: 12, color: DARK, marginBottom: 8, fontWeight: 700 }}>Verwijderen?</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={function() { setConfirm(false); }} style={{ flex: 1, background: "#eee", border: "none", borderRadius: 8, padding: "7px", fontSize: 12, cursor: "pointer" }}>Annuleren</button>
        <button onClick={function() { onDelete(ex); }} style={{ flex: 1, background: "#E53935", color: "#fff", border: "none", borderRadius: 8, padding: "7px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Verwijderen</button>
      </div>
    </div>
  ) : null}
</div>
```

);
}

export default function App() {
const [tab, setTab] = useState("home");
const [exercises, setExercises] = useState([]);
const [modules] = useState(MODULES_DEFAULT);
const [loading, setLoading] = useState(true);
const [showImport, setShowImport] = useState(false);
const [editEx, setEditEx] = useState(null);
const [sessionEx, setSessionEx] = useState(null);
const [viewEx, setViewEx] = useState(null);
const [filterModule, setFilterModule] = useState(null);

useEffect(function() {
const q = query(collection(db, "exercises"), orderBy("createdAt", "desc"));
const unsub = onSnapshot(q, function(snap) {
setExercises(snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); }));
setLoading(false);
});
return unsub;
}, []);

async function handleDelete(ex) {
if (ex.imageUrl) { try { await deleteObject(ref(storage, ex.imageUrl)); } catch(e) {} }
if (ex.mp3Url) { try { await deleteObject(ref(storage, ex.mp3Url)); } catch(e) {} }
await deleteDoc(doc(db, "exercises", ex.id));
}

async function handleAddMp3(exId, url) {
await updateDoc(doc(db, "exercises", exId), { mp3Url: url });
if (viewEx && viewEx.id === exId) setViewEx(function(v) { return Object.assign({}, v, { mp3Url: url }); });
}

const totalSessions = exercises.reduce(function(a, e) { return a + (e.sessions || []).length; }, 0);
const filtered = filterModule ? exercises.filter(function(e) { return e.moduleId === filterModule; }) : exercises;
const today = new Date().toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();

const navItems = [
{ id: "home", label: "Home" },
{ id: "exercises", label: "Oefeningen" },
{ id: "import_btn", label: "Importeren", action: function() { setShowImport(true); } },
{ id: "modules", label: "Modules" },
{ id: "progress", label: "Voortgang" }
];

return (
<div style={{ maxWidth: 390, margin: "0 auto", minHeight: "100vh", background: BG, fontFamily: "‘Syne’, sans-serif" }}>
<style>{"@import url(‘https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap’);*{box-sizing:border-box;margin:0;padding:0}input,select,textarea,button{font-family:‘Syne’,sans-serif}::-webkit-scrollbar{width:0}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}"}</style>

```
  <div style={{ background: "#fff", padding: "13px 16px 10px", borderBottom: "1px solid #f0f0f0", position: "sticky", top: 0, zIndex: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <div>
        <span style={{ color: PINK, fontWeight: 800, fontSize: 19, letterSpacing: "-.5px" }}>BASS</span>
        <span style={{ color: DARK, fontWeight: 800, fontSize: 19, letterSpacing: "-.5px" }}>FLOW</span>
        <span style={{ fontSize: 9, color: "#ccc", marginLeft: 6, fontWeight: 600 }}>PRO</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {loading ? <div style={{ width: 8, height: 8, borderRadius: "50%", background: PINK, animation: "pulse 1s infinite" }} /> : null}
        <div style={{ fontSize: 9, color: "#bbb", fontWeight: 700, letterSpacing: ".08em" }}>{today}</div>
      </div>
    </div>
  </div>

  <div style={{ paddingBottom: 70, overflowY: "auto", height: "calc(100vh - 105px)" }}>

    {tab === "home" ? (
      <div style={{ padding: 14 }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: PINK, fontWeight: 700, letterSpacing: ".15em", marginBottom: 2 }}>JOUW PERSOONLIJKE BIBLIOTHEEK</div>
          <div style={{ fontWeight: 800, fontSize: 24, color: DARK, lineHeight: 1.1 }}>WELKOM</div>
          <div style={{ fontWeight: 800, fontSize: 24, color: PINK, lineHeight: 1.1, marginBottom: 5 }}>BASSIST</div>
          <div style={{ fontSize: 11, color: "#bbb" }}>Importeer je eigen oefeningen en houd je voortgang bij.</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 20 }}>
          {[["Oefeningen", exercises.length], ["Sessies", totalSessions], ["Modules", modules.length]].map(function(item) {
            return (
              <div key={item[0]} style={{ background: "#EDEDEB", borderRadius: 11, padding: "10px 6px", textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 22, color: PINK }}>{item[1]}</div>
                <div style={{ fontSize: 9, color: "#999", fontWeight: 600 }}>{item[0]}</div>
              </div>
            );
          })}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: DARK }}>Modules</div>
            <button onClick={function() { setTab("modules"); }} style={{ background: "none", border: "none", color: PINK, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>Alles</button>
          </div>
          <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 4 }}>
            {modules.map(function(m, i) {
              const cnt = exercises.filter(function(e) { return e.moduleId === m.id; }).length;
              return (
                <div key={m.id} onClick={function() { setFilterModule(m.id); setTab("exercises"); }}
                  style={{ minWidth: 110, background: "#fff", borderRadius: 11, padding: 11, cursor: "pointer", flexShrink: 0, borderTop: "3px solid " + m.color, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                  <Badge level={m.level} />
                  <div style={{ fontWeight: 800, fontSize: 11, color: DARK, marginTop: 5, marginBottom: 2 }}>{m.name}</div>
                  <div style={{ fontSize: 9, color: "#bbb" }}>{cnt} oefeningen</div>
                  <div style={{ marginTop: 7, height: 3, background: "#f0f0f0", borderRadius: 3 }}>
                    <div style={{ width: cnt > 0 ? Math.min(100, cnt * 20) + "%" : "5%", height: "100%", background: m.color, borderRadius: 3 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: DARK }}>Recente oefeningen</div>
            <button onClick={function() { setTab("exercises"); }} style={{ background: "none", border: "none", color: PINK, fontWeight: 700, fontSize: 11, cursor: "pointer" }}>Alles</button>
          </div>
          {loading ? (
            <div style={{ textAlign: "center", padding: "28px 20px", color: "#bbb", fontSize: 12 }}>Laden...</div>
          ) : exercises.length === 0 ? (
            <div style={{ textAlign: "center", padding: "28px 20px" }}>
              <div style={{ fontSize: 40 }}>bas</div>
              <div style={{ color: "#bbb", marginTop: 8, fontSize: 11 }}>Nog geen oefeningen. Importeer er een!</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {exercises.slice(0, 3).map(function(ex) {
                return <ExerciseCard key={ex.id} ex={ex} modules={modules} onSession={setSessionEx} onView={setViewEx} onEdit={setEditEx} onDelete={handleDelete} />;
              })}
            </div>
          )}
        </div>
      </div>
    ) : null}

    {tab === "exercises" ? (
      <div style={{ padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: DARK }}>Oefeningen</div>
          {filterModule ? <button onClick={function() { setFilterModule(null); }} style={{ background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 20, padding: "3px 10px", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>Filter weg</button> : null}
        </div>
        <div style={{ display: "flex", gap: 5, overflowX: "auto", marginBottom: 12, paddingBottom: 4 }}>
          {[{ id: null, name: "Alle" }].concat(modules).map(function(m) {
            const active = filterModule === (m.id || null);
            return (
              <div key={m.id || "all"} onClick={function() { setFilterModule(m.id || null); }}
                style={{ flexShrink: 0, padding: "4px 11px", borderRadius: 20, background: active ? PINK : "#fff", color: active ? "#fff" : "#999", fontWeight: 700, fontSize: 10, cursor: "pointer", border: "1.5px solid " + (active ? PINK : "#eee") }}>
                {m.name}
              </div>
            );
          })}
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: "50px 20px", color: "#bbb", fontSize: 12 }}>Laden...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 20px" }}>
            <div style={{ fontSize: 40 }}>bas</div>
            <div style={{ color: "#bbb", marginTop: 8, fontSize: 11 }}>Geen oefeningen gevonden</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {filtered.map(function(ex) {
              return <ExerciseCard key={ex.id} ex={ex} modules={modules} onSession={setSessionEx} onView={setViewEx} onEdit={setEditEx} onDelete={handleDelete} />;
            })}
          </div>
        )}
      </div>
    ) : null}

    {tab === "modules" ? (
      <div style={{ padding: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: DARK, marginBottom: 12 }}>Modules</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {modules.map(function(m) {
            const cnt = exercises.filter(function(e) { return e.moduleId === m.id; }).length;
            const sess = exercises.filter(function(e) { return e.moduleId === m.id; }).reduce(function(a, e) { return a + (e.sessions || []).length; }, 0);
            return (
              <div key={m.id} style={{ background: "#fff", borderRadius: 12, padding: 13, borderLeft: "4px solid " + m.color, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
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
                <div style={{ marginTop: 7, fontSize: 10, color: "#bbb" }}>{sess} sessies</div>
              </div>
            );
          })}
        </div>
      </div>
    ) : null}

    {tab === "progress" ? (
      <div style={{ padding: 14 }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: DARK, marginBottom: 14 }}>Voortgang</div>
        {exercises.length === 0 ? (
          <div style={{ textAlign: "center", padding: "50px 20px" }}>
            <div style={{ fontSize: 40 }}>grafiek</div>
            <div style={{ color: "#bbb", marginTop: 8, fontSize: 11 }}>Nog geen data</div>
          </div>
        ) : (
          exercises.map(function(ex) {
            const maxBpm = (ex.sessions || []).reduce(function(m, s) { return Math.max(m, s.bpm); }, 0);
            const avgStars = ex.sessions && ex.sessions.length ? (ex.sessions.reduce(function(a, s) { return a + s.stars; }, 0) / ex.sessions.length).toFixed(1) : "-";
            return (
              <div key={ex.id} style={{ background: "#fff", borderRadius: 12, padding: 13, marginBottom: 9, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                <div style={{ fontWeight: 800, fontSize: 12, color: DARK, marginBottom: 8 }}>{ex.title}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {[["Max BPM", maxBpm || ex.bpm, PINK], ["Sessies", (ex.sessions || []).length, "#00B84C"], ["Gem.", avgStars, "#FFB800"]].map(function(item) {
                    return (
                      <div key={item[0]} style={{ background: BG, borderRadius: 8, padding: "7px 5px", textAlign: "center" }}>
                        <div style={{ fontWeight: 800, fontSize: 15, color: item[2] }}>{item[1]}</div>
                        <div style={{ fontSize: 9, color: "#bbb" }}>{item[0]}</div>
                      </div>
                    );
                  })}
                </div>
                {ex.sessions && ex.sessions.length > 0 ? (
                  <div style={{ marginTop: 9 }}>
                    <div style={{ fontSize: 9, color: "#ccc", marginBottom: 3 }}>BPM PROGRESSIE</div>
                    <div style={{ display: "flex", gap: 2, alignItems: "flex-end", height: 28 }}>
                      {ex.sessions.slice(-12).map(function(s, i) {
                        return <div key={i} style={{ flex: 1, height: Math.max(3, (s.bpm / 240) * 28), background: PINK, borderRadius: "2px 2px 0 0", opacity: .45 + (i / 12) * .55 }} />;
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    ) : null}

  </div>

  <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, background: "#fff", borderTop: "1px solid #f0f0f0", display: "flex", padding: "6px 0 12px", zIndex: 20 }}>
    {navItems.map(function(item) {
      const isActive = !item.action && tab === item.id;
      return (
        <button key={item.id} onClick={item.action || function() { setTab(item.id); }}
          style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", color: isActive ? PINK : "#bbb" }}>
          {item.id === "import_btn" ? (
            <div style={{ width: 38, height: 38, background: PINK, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, boxShadow: "0 3px 10px " + PINK + "55", marginTop: -13 }}>+</div>
          ) : (
            <span style={{ fontSize: 17 }}>o</span>
          )}
          <span style={{ fontSize: 9, fontWeight: 700 }}>{item.label}</span>
        </button>
      );
    })}
  </div>

  {showImport ? <EditModal modules={modules} onClose={function() { setShowImport(false); }} /> : null}
  {editEx ? <EditModal exercise={editEx} modules={modules} onClose={function() { setEditEx(null); }} /> : null}
  {sessionEx ? <SessionModal exercise={sessionEx} onClose={function() { setSessionEx(null); }} /> : null}
  {viewEx ? <TabView ex={viewEx} onClose={function() { setViewEx(null); }} onAddMp3={function(url) { handleAddMp3(viewEx.id, url); }} /> : null}
</div>
```

);
}