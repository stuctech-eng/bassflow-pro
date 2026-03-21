import { useState, useRef, useEffect } from "react";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy
} from "firebase/firestore";
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

// --- HELPER COMPONENTS ---
function StarRating({ value, onChange, size = 16 }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: 1 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s}
          onMouseEnter={() => onChange && setHover(s)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange?.(s)}
          style={{ cursor: onChange ? "pointer" : "default", fontSize: size, color: s <= (hover || value) ? "#FFB800" : "#DDD", transition: "color .12s" }}
        >★</span>
      ))}
    </div>
  );
}

function Badge({ level }) {
  const c = { Beginner: [PINK_LIGHT, PINK], Intermediate: ["#FFF0E0", "#FF8C00"], Advanced: ["#F0E8FF", "#8B2FC9"] }[level] || [PINK_LIGHT, PINK];
  return <span style={{ background: c[0], color: c[1], fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, letterSpacing: ".05em", textTransform: "uppercase" }}>{level}</span>;
}

function UploadProgress({ progress, label }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, color: "#999", marginBottom: 3 }}>{label || "Uploaden…"} {Math.round(progress)}%</div>
      <div style={{ height: 4, background: "#eee", borderRadius: 4 }}>
        <div style={{ width: `${progress}%`, height: "100%", background: PINK, borderRadius: 4, transition: "width .2s" }} />
      </div>
    </div>
  );
}

async function analyzeTab(imageData, mediaType) {
  const base64 = imageData.split(",")[1];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20240620", max_tokens: 1000,
      messages: [{
        role: "user", content: [
          { type: "image", source: { type: "base64", media_type: mediaType || "image/jpeg", data: base64 } },
          { type: "text", text: `Analyseer deze basgitaar bladmuziek/tabulatuur. Geef ALLEEN JSON terug:\n{"title":"titel","tabText":"ASCII tabulatuur G|\\nD|\\nA|\\nE|","bpm":120,"notes":"korte analyse NL"}` }
        ]
      }]
    })
  });
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "{}";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// --- DE INTERACTIEVE PLAYER (TABVIEW) ---
function TabView({ ex, onClose, onAddMp3, onAddPages, onUpdateSync }) {
  const mp3Ref = useRef();
  const imgRef = useRef();
  const audioRef = useRef();
  
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadLabel, setUploadLabel] = useState("");
  
  // Sync instellingen (Onthoudt wat in Firebase staat)
  const [rows, setRows] = useState(ex.rows || 4);
  const [measuresPerRow, setMeasuresPerRow] = useState(ex.measuresPerRow || 4);
  const [showConfig, setShowConfig] = useState(false);

  // Loop instellingen
  const [loopStart, setLoopStart] = useState(null);
  const [loopEnd, setLoopEnd] = useState(null);

  const pages = ex.pages || (ex.imageUrl ? [{ imageUrl: ex.imageUrl, tabText: ex.tabText, aiNotes: ex.aiNotes }] : []);
  const currentPage = pages[page];

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      
      const handleTimeUpdate = () => {
        const time = audioRef.current.currentTime;
        setCurrentTime(time);
        if (loopStart !== null && loopEnd !== null && time >= loopEnd) {
          audioRef.current.currentTime = loopStart;
        }
      };
      audioRef.current.ontimeupdate = handleTimeUpdate;
      audioRef.current.onloadedmetadata = () => setDuration(audioRef.current.duration);
    }
  }, [playbackRate, loopStart, loopEnd]);

  const togglePlay = () => {
    if (!ex.mp3Url) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(ex.mp3Url);
      audioRef.current.playbackRate = playbackRate;
    }
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const saveSync = () => {
    onUpdateSync(ex.id, { rows, measuresPerRow });
    setShowConfig(false);
  };

  const getCursorStyle = () => {
    if (!ex.bpm || !duration) return { display: "none" };
    const secondsPerMeasure = (60 / ex.bpm) * 4; 
    const totalMeasures = Math.floor(currentTime / secondsPerMeasure);
    const currentRow = Math.floor(totalMeasures / measuresPerRow);
    const currentMeasureInRow = totalMeasures % measuresPerRow;
    if (currentRow >= rows) return { display: "none" };

    return {
      position: "absolute",
      top: `${(currentRow / rows) * 100}%`,
      left: `${(currentMeasureInRow / measuresPerRow) * 100}%`,
      width: `${100 / measuresPerRow}%`,
      height: `${100 / rows}%`,
      borderLeft: `4px solid ${PINK}`,
      background: "rgba(255, 45, 122, 0.15)",
      transition: "left 0.1s linear, top 0.1s linear",
      pointerEvents: "none",
      zIndex: 10
    };
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 200, display: "flex", flexDirection: "column", fontFamily: "'Syne', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #eee", gap: 10 }}>
        <button onClick={onClose} style={{ background: "#f0f0f0", border: "none", borderRadius: "50%", width: 32, height: 32 }}>✕</button>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis" }}>{ex.title}</div>
        <button onClick={() => setShowConfig(!showConfig)} style={{ background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700 }}>⚙️ SYNC</button>
      </div>

      {showConfig && (
        <div style={{ padding: 15, background: "#f9f9f9", borderBottom: "2px solid #eee" }}>
           <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15, marginBottom: 10 }}>
            <div>
              <label style={{fontSize:9, fontWeight:700}}>REGELS</label>
              <input type="number" value={rows} onChange={e => setRows(Number(e.target.value))} style={{width:'100%', padding:8}}/>
            </div>
            <div>
              <label style={{fontSize:9, fontWeight:700}}>MATEN/REGEL</label>
              <input type="number" value={measuresPerRow} onChange={e => setMeasuresPerRow(Number(e.target.value))} style={{width:'100%', padding:8}}/>
            </div>
          </div>
          <button onClick={saveSync} style={{width:'100%', background:PINK, color:'#fff', border:'none', padding:8, borderRadius:6, fontWeight:700}}>✓ Opslaan</button>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", position: "relative", background: "#333" }}>
        <div style={{ position: "relative", width: "100%" }}>
          {currentPage?.imageUrl && (
            <>
              <div style={getCursorStyle()} />
              <img src={currentPage.imageUrl} style={{ width: "100%", display: "block" }} />
            </>
          )}
        </div>
      </div>

      <div style={{ padding: "10px 16px", background: "#fff", borderTop: "1px solid #eee", display: "flex", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 5 }}>
          {[0.75, 1, 1.25].map(r => (
            <button key={r} onClick={() => setPlaybackRate(r)} style={{fontSize:10, background: playbackRate===r?PINK:"#eee", color:playbackRate===r?"#fff":"#000", border:'none', padding:'5px 8px', borderRadius:4}}>{r}x</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={() => setLoopStart(currentTime)} style={{fontSize:10, background: PINK_LIGHT, color: PINK, border:'none', padding:'5px 8px', borderRadius:4}}>{loopStart !== null ? "START ✓" : "LOOP ["}</button>
          <button onClick={() => setLoopEnd(currentTime)} style={{fontSize:10, background: PINK_LIGHT, color: PINK, border:'none', padding:'5px 8px', borderRadius:4}}>{loopEnd !== null ? "STOP ✓" : "LOOP ]"}</button>
          {(loopStart || loopEnd) && <button onClick={() => {setLoopStart(null); setLoopEnd(null);}} style={{fontSize:10, color: "#999"}}>✕</button>}
        </div>
      </div>

      <div style={{ padding: "15px 20px", background: "#fafafa", borderTop: "1px solid #eee", display: "flex", alignItems: "center", gap: 20 }}>
        <button onClick={togglePlay} style={{ background: PINK, color: "#fff", border: "none", borderRadius: "50%", width: 54, height: 54, fontSize: 22 }}>
          {playing ? "⏸" : "▶"}
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, color: PINK, fontSize: 16 }}>{ex.bpm} BPM</div>
          <div style={{ fontSize: 10, color: "#999" }}>{Math.floor(currentTime)}s / {Math.floor(duration)}s</div>
        </div>
        <button onClick={() => imgRef.current.click()} style={{ background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 8, padding: "7px 12px", fontSize: 11, fontWeight: 700 }}>+ Foto</button>
      </div>
      <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: "none" }} />
    </div>
  );
}

// --- REST VAN DE COMPONENTEN (EditModal, SessionModal, ExerciseCard, App) ---
function EditModal({ exercise, modules, onClose }) {
  const isNew = !exercise;
  const [step, setStep] = useState("form");
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [mp3File, setMp3File] = useState(null);
  const [title, setTitle] = useState(exercise?.title || "");
  const [moduleId, setModuleId] = useState(exercise?.moduleId || modules[0]?.id || "mod1");
  const [bpm, setBpm] = useState(exercise?.bpm || 100);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState("");
  const fileRef = useRef();
  const mp3Ref = useRef();

  const handleImages = (files) => {
    const arr = Array.from(files);
    setImageFiles(arr);
    const previews = new Array(arr.length);
    let loaded = 0;
    arr.forEach((f, idx) => {
      const r = new FileReader();
      r.onload = e => {
        previews[idx] = e.target.result;
        loaded++;
        if (loaded === arr.length) setImagePreviews(Array.from(previews));
      };
      r.readAsDataURL(f);
    });
  };

  const handleSave = async () => {
    setStep("uploading");
    let pages = exercise?.pages || [];
    let mp3Url = exercise?.mp3Url || null;
    let detectedBpm = bpm;
    let detectedTitle = title;

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];
      setUploadLabel(`Foto ${i+1} uploaden...`);
      const imgRefStore = ref(storage, `tabs/${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(imgRefStore, file);
      const url = await new Promise((resolve) => {
        task.on("state_changed", snap => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 80), null,
          async () => resolve(await getDownloadURL(task.snapshot.ref)));
      });
      try {
        const parsed = await analyzeTab(imagePreviews[i], file.type);
        pages.push({ imageUrl: url, tabText: parsed.tabText, aiNotes: parsed.notes });
        if (i === 0) {
            if (!title) detectedTitle = parsed.title;
            detectedBpm = parsed.bpm || bpm;
        }
      } catch { pages.push({ imageUrl: url, tabText: "", aiNotes: "" }); }
    }

    if (mp3File) {
      setUploadLabel("MP3 uploaden...");
      const mp3StorageRef = ref(storage, `mp3/${Date.now()}_${mp3File.name}`);
      const task = uploadBytesResumable(mp3StorageRef, mp3File);
      mp3Url = await new Promise((resolve) => {
        task.on("state_changed", snap => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100), null,
          async () => resolve(await getDownloadURL(task.snapshot.ref)));
      });
    }

    const exData = {
      title: detectedTitle || "Naamloze oefening",
      moduleId, bpm: detectedBpm, pages,
      imageUrl: pages[0]?.imageUrl || null,
      mp3Url, sessions: exercise?.sessions || [],
      updatedAt: new Date().toISOString(),
    };

    if (isNew) { exData.createdAt = new Date().toISOString(); await addDoc(collection(db, "exercises"), exData); }
    else { await updateDoc(doc(db, "exercises", exercise.id), exData); }
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: "#fff", borderRadius: "18px 18px 0 0", width: "100%", maxHeight: "90vh", overflowY: "auto", padding: 20 }}>
        {step === "uploading" ? (
          <div style={{textAlign:'center', padding:40}}>
            <UploadProgress progress={uploadProgress} label={uploadLabel} />
          </div>
        ) : (
          <>
            <div style={{fontWeight:800, marginBottom:15}}>{isNew ? "Nieuwe Oefening" : "Bewerken"}</div>
            <div onClick={() => fileRef.current.click()} style={{border:'2px dashed #ddd', padding:20, textAlign:'center', borderRadius:12, marginBottom:10}}>📸 Foto's</div>
            <input ref={fileRef} type="file" multiple accept="image/*" style={{display:'none'}} onChange={e => handleImages(e.target.files)} />
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titel" style={{width:'100%', padding:10, marginBottom:10}} />
            <input type="number" value={bpm} onChange={e => setBpm(Number(e.target.value))} placeholder="BPM" style={{width:'100%', padding:10, marginBottom:10}} />
            <div onClick={() => mp3Ref.current.click()} style={{border:'2px dashed #ddd', padding:10, textAlign:'center', borderRadius:12, marginBottom:20}}>🎵 {mp3File ? mp3File.name : "Kies MP3"}</div>
            <input ref={mp3Ref} type="file" accept="audio/*" style={{display:'none'}} onChange={e => setMp3File(e.target.files[0])} />
            <button onClick={handleSave} style={{width:'100%', background:PINK, color:'#fff', padding:15, borderRadius:12, border:'none', fontWeight:800}}>✓ Opslaan</button>
          </>
        )}
      </div>
    </div>
  );
}

function SessionModal({ exercise, onClose }) {
  const [bpm, setBpm] = useState(exercise.bpm || 100);
  const [stars, setStars] = useState(0);
  const handleSave = async () => {
    const session = { id: Date.now(), date: new Date().toISOString(), bpm, stars };
    await updateDoc(doc(db, "exercises", exercise.id), { sessions: [...(exercise.sessions || []), session] });
    onClose();
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }}>
      <div style={{ background: "#fff", padding: 20, width: "100%", borderRadius: "18px 18px 0 0" }}>
        <div style={{fontWeight:800, marginBottom:10}}>Sessie Loggen</div>
        <input type="range" min={40} max={240} value={bpm} onChange={e => setBpm(Number(e.target.value))} style={{width:'100%', accentColor:PINK}} />
        <div style={{textAlign:'center', fontWeight:800, color:PINK, margin:'10px 0'}}>{bpm} BPM</div>
        <StarRating value={stars} onChange={setStars} size={25} />
        <button onClick={handleSave} style={{width:'100%', background:PINK, color:'#fff', padding:15, borderRadius:12, border:'none', marginTop:20, fontWeight:800}}>✓ Opslaan</button>
      </div>
    </div>
  );
}

function ExerciseCard({ ex, modules, onSession, onView, onEdit, onDelete }) {
  const mod = modules.find(m => m.id === ex.moduleId);
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 13, marginBottom: 10, boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", gap: 10 }}>
        <img src={ex.imageUrl || "https://via.placeholder.com/50"} onClick={() => onView(ex)} style={{ width: 50, height: 50, borderRadius: 9, objectFit: "cover" }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{ex.title}</div>
          <div style={{ fontSize: 11, color: PINK, fontWeight: 700 }}>{ex.bpm} BPM</div>
        </div>
        <button onClick={() => onEdit(ex)} style={{border:'none', background:'none'}}>✏️</button>
        <button onClick={() => onDelete(ex)} style={{border:'none', background:'none'}}>🗑</button>
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button onClick={() => onView(ex)} style={{ flex: 1, background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 700 }}>📄 Bekijken</button>
        <button onClick={() => onSession(ex)} style={{ flex: 1, background: PINK, color: "#fff", border: "none", borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 700 }}>+ Sessie</button>
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [editExercise, setEditExercise] = useState(null);
  const [sessionEx, setSessionEx] = useState(null);
  const [viewEx, setViewEx] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "exercises"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => {
      setExercises(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const handleDelete = async (ex) => {
    if (window.confirm("Zeker weten?")) {
        await deleteDoc(doc(db, "exercises", ex.id));
    }
  };

  const handleUpdateSync = async (id, data) => {
    await updateDoc(doc(db, "exercises", id), data);
  };

  return (
    <div style={{ maxWidth: 390, margin: "0 auto", minHeight: "100vh", background: BG, fontFamily: "'Syne', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}`}</style>

      <div style={{ background: "#fff", padding: "15px", borderBottom: "1px solid #f0f0f0", position: "sticky", top: 0, zIndex: 10 }}>
        <span style={{ color: PINK, fontWeight: 800, fontSize: 20 }}>BASS</span><span style={{ fontWeight: 800, fontSize: 20 }}>FLOW PRO</span>
      </div>

      <div style={{ padding: 15, paddingBottom: 80 }}>
        {tab === "home" && (
           <>
            <div style={{fontWeight:800, fontSize:22, marginBottom:15}}>Jouw Library</div>
            {exercises.map(ex => <ExerciseCard key={ex.id} ex={ex} modules={MODULES_DEFAULT} onSession={setSessionEx} onView={setViewEx} onEdit={setEditExercise} onDelete={handleDelete} />)}
           </>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, width: "100%", maxWidth: 390, background: "#fff", borderTop: "1px solid #eee", display: "flex", padding: "10px 0" }}>
        <button onClick={() => setTab("home")} style={{ flex: 1, border: "none", background: "none" }}>🏠</button>
        <button onClick={() => setShowImport(true)} style={{ flex: 1, background: PINK, color: "#fff", border: "none", borderRadius: "50%", width: 40, height: 40, marginTop:-20 }}>+</button>
        <button onClick={() => setTab("home")} style={{ flex: 1, border: "none", background: "none" }}>📈</button>
      </div>

      {showImport && <EditModal modules={MODULES_DEFAULT} onClose={() => setShowImport(false)} />}
      {editExercise && <EditModal exercise={editExercise} modules={MODULES_DEFAULT} onClose={() => setEditExercise(null)} />}
      {sessionEx && <SessionModal exercise={sessionEx} onClose={() => setSessionEx(null)} />}
      {viewEx && <TabView ex={viewEx} onClose={() => setViewEx(null)} onUpdateSync={handleUpdateSync} />}
    </div>
  );
}
