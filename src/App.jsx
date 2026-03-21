import { useState, useRef, useEffect } from "react";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase.js";

// --- CONFIG & STYLING ---
const PINK = "#FF2D7A";
const PINK_LIGHT = "#FFE0EE";
const BG = "#F5F4F0";
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const MODULES = [
  { id: "mod1", name: "Fundamenten", level: "Beginner", color: PINK },
  { id: "mod2", name: "Groove & Ritme", level: "Beginner", color: PINK },
  { id: "mod3", name: "Muting", level: "Intermediate", color: "#FF8C00" },
  { id: "mod4", name: "Slap Bass", level: "Advanced", color: "#8B2FC9" },
];

// --- HELPERS ---
function StarRating({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} onClick={() => onChange?.(s)} style={{ cursor: "pointer", fontSize: 20, color: s <= value ? "#FFB800" : "#DDD" }}>★</span>
      ))}
    </div>
  );
}

async function analyzeTab(imageData, mediaType) {
  const base64 = imageData.split(",")[1];
  try {
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
            { type: "text", text: `Analyseer deze basgitaar bladmuziek. Geef ALLEEN JSON terug: {"title":"titel","bpm":120,"notes":"uitleg"}` }
          ]
        }]
      })
    });
    const data = await res.json();
    return JSON.parse(data.content[0].text);
  } catch (e) { return { title: "Nieuwe Oefening", bpm: 100 }; }
}

// --- DE INTERACTIEVE PLAYER ---
function TabView({ ex, onClose }) {
  const audioRef = useRef();
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [rows, setRows] = useState(ex.rows || 4);
  const [cols, setCols] = useState(ex.measuresPerRow || 4);
  const [showSync, setShowSync] = useState(false);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.ontimeupdate = () => setCurrentTime(audioRef.current.currentTime);
      audioRef.current.onloadedmetadata = () => setDuration(audioRef.current.duration);
    }
  }, [playbackRate]);

  const togglePlay = () => {
    if (!ex.mp3Url) return alert("Geen MP3 gekoppeld.");
    playing ? audioRef.current.pause() : audioRef.current.play();
    setPlaying(!playing);
  };

  const downloadMp3 = () => {
    if (ex.mp3Url) window.open(ex.mp3Url, '_blank');
  };

  const getCursorStyle = () => {
    if (!ex.bpm || !duration) return { display: "none" };
    const secPerMeasure = (60 / ex.bpm) * 4;
    const totalMeasures = Math.floor(currentTime / secPerMeasure);
    const currentRow = Math.floor(totalMeasures / cols);
    const currentCol = totalMeasures % cols;
    if (currentRow >= rows) return { display: "none" };
    return {
      position: "absolute", top: `${(currentRow/rows)*100}%`, left: `${(currentCol/cols)*100}%`,
      width: `${100/cols}%`, height: `${100/rows}%`, borderLeft: `3px solid ${PINK}`,
      background: "rgba(255, 45, 122, 0.1)", pointerEvents: "none", zIndex: 10
    };
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 1000, display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "10px", borderBottom: "1px solid #eee" }}>
        <button onClick={onClose} style={{ border: "none", background: "#f0f0f0", borderRadius: "50%", width: 30, height: 30 }}>✕</button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 800 }}>{ex.title}</div>
        <button onClick={() => setShowSync(!showSync)} style={{ background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 10, fontWeight: 700 }}>⚙️ SYNC</button>
      </div>

      {showSync && (
        <div style={{ padding: 10, background: "#f9f9f9", display: "flex", gap: 10, borderBottom: "1px solid #eee" }}>
          <input type="number" value={rows} onChange={e => setRows(Number(e.target.value))} style={{width:50}} title="Rijen" />
          <input type="number" value={cols} onChange={e => setCols(Number(e.target.value))} style={{width:50}} title="Maten" />
          <span style={{fontSize:10, color:"#999"}}>Stel in hoeveel regels/maten de foto heeft</span>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", position: "relative", background: "#333" }}>
        <div style={{ position: "relative" }}>
          {ex.imageUrl && <><div style={getCursorStyle()} /><img src={ex.imageUrl} style={{ width: "100%" }} /></>}
        </div>
      </div>

      <div style={{ padding: 15, background: "#fafafa", borderTop: "1px solid #eee" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 5 }}>
            {[0.75, 1, 1.25].map(r => (
              <button key={r} onClick={() => setPlaybackRate(r)} style={{ fontSize: 10, padding: "5px 10px", background: playbackRate === r ? PINK : "#eee", color: playbackRate === r ? "#fff" : "#000", border: "none", borderRadius: 4 }}>{r}x</button>
            ))}
          </div>
          <button onClick={downloadMp3} style={{ background: "#eee", border: "none", borderRadius: 4, padding: "5px 10px", fontSize: 10 }}>💾 Download MP3</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <button onClick={togglePlay} style={{ background: PINK, color: "#fff", border: "none", borderRadius: "50%", width: 50, height: 50, fontSize: 20 }}>{playing ? "⏸" : "▶"}</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{ex.bpm} BPM</div>
            <div style={{ fontSize: 10, color: "#999" }}>{Math.floor(currentTime)}s / {Math.floor(duration)}s</div>
          </div>
          <audio ref={audioRef} src={ex.mp3Url} />
        </div>
      </div>
    </div>
  );
}

// --- HOOFD APP ---
export default function App() {
  const [exercises, setExercises] = useState([]);
  const [viewEx, setViewEx] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [sessionEx, setSessionEx] = useState(null);
  
  const [loading, setLoading] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "exercises"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setExercises(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    const imgFile = files.find(f => f.type.startsWith('image/'));
    const mp3File = files.find(f => f.type.startsWith('audio/'));

    if (!imgFile) return alert("Selecteer minimaal een foto.");
    setLoading(1);

    const imgRef = ref(storage, `tabs/${Date.now()}_${imgFile.name}`);
    await uploadBytesResumable(imgRef, imgFile);
    const imageUrl = await getDownloadURL(imgRef);

    let mp3Url = null;
    if (mp3File) {
      const mRef = ref(storage, `mp3/${Date.now()}_${mp3File.name}`);
      await uploadBytesResumable(mRef, mp3File);
      mp3Url = await getDownloadURL(mRef);
    }

    const ai = await analyzeTab(imageUrl, imgFile.type);

    await addDoc(collection(db, "exercises"), {
      title: ai.title || "Nieuwe Oefening",
      bpm: ai.bpm || 100,
      imageUrl, mp3Url,
      moduleId: "mod1",
      sessions: [],
      createdAt: new Date().toISOString()
    });

    setLoading(0);
    setShowAdd(false);
  };

  const logSession = async (stars) => {
    const newSessions = [...(sessionEx.sessions || []), { date: new Date().toISOString(), stars }];
    await updateDoc(doc(db, "exercises", sessionEx.id), { sessions: newSessions });
    setSessionEx(null);
  };

  return (
    <div style={{ maxWidth: 400, margin: "0 auto", minHeight: "100vh", background: BG, fontFamily: "sans-serif" }}>
      <div style={{ padding: "20px", background: "#fff", borderBottom: "1px solid #eee" }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: PINK }}>BASSFLOW PRO</h1>
      </div>

      <div style={{ padding: 15 }}>
        {exercises.map(ex => (
          <div key={ex.id} style={{ background: "#fff", padding: 12, borderRadius: 12, marginBottom: 10, boxShadow: "0 2px 5px rgba(0,0,0,0.05)" }}>
            <div onClick={() => setViewEx(ex)} style={{ display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}>
              <img src={ex.imageUrl} style={{ width: 45, height: 45, borderRadius: 8, objectFit: "cover" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{ex.title}</div>
                <div style={{ fontSize: 11, color: PINK }}>{ex.bpm} BPM • {ex.sessions?.length || 0} sessies</div>
              </div>
              {ex.mp3Url && <span>🎵</span>}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button onClick={() => setViewEx(ex)} style={{ flex: 1, padding: 6, borderRadius: 6, border: "none", background: PINK_LIGHT, color: PINK, fontWeight: 700, fontSize: 11 }}>SPEEL</button>
              <button onClick={() => setSessionEx(ex)} style={{ flex: 1, padding: 6, borderRadius: 6, border: "none", background: PINK, color: "#fff", fontWeight: 700, fontSize: 11 }}>+ LOG</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setShowAdd(true)} style={{ position: "fixed", bottom: 20, right: 20, background: PINK, color: "#fff", border: "none", width: 55, height: 55, borderRadius: "50%", fontSize: 24, boxShadow: "0 4px 15px rgba(255,45,122,0.4)" }}>+</button>

      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 2000, padding: 30, color: "#fff", textAlign: "center" }}>
          <h2>Voeg Oefening Toe</h2>
          <p style={{fontSize:12, marginBottom:20}}>Selecteer een foto (en eventueel een MP3)</p>
          <input type="file" multiple onChange={handleUpload} style={{marginBottom: 20}} />
          {loading === 1 && <div style={{color: PINK, fontWeight: 800}}>AI analyseert & uploadt...</div>}
          <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "1px solid #fff", color: "#fff", padding: 10, width: "100%", marginTop: 20 }}>Sluiten</button>
        </div>
      )}

      {sessionEx && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", padding: 25, borderRadius: 15, textAlign: "center", width: "80%" }}>
            <h3 style={{marginBottom: 15}}>Hoe ging het?</h3>
            <StarRating onChange={logSession} />
            <button onClick={() => setSessionEx(null)} style={{ marginTop: 20, border: "none", background: "none", color: "#999" }}>Annuleren</button>
          </div>
        </div>
      )}

      {viewEx && <TabView ex={viewEx} onClose={() => setViewEx(null)} />}
    </div>
  );
}
