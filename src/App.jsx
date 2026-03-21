import { useState, useRef, useEffect } from "react";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase.js";

const PINK = "#FF2D7A";
const PINK_LIGHT = "#FFE0EE";
const BG = "#F5F4F0";
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

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

// --- DE MULTI-TRACK PLAYER ---
function TabView({ ex, onClose }) {
  const audioRef = useRef();
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedTrack, setSelectedTrack] = useState(0);
  
  // Sync instellingen
  const [rows, setRows] = useState(ex.rows || 4);
  const [cols, setCols] = useState(ex.measuresPerRow || 4);
  const [showSync, setShowSync] = useState(false);

  const tracks = ex.audioTracks || (ex.mp3Url ? [{ url: ex.mp3Url, name: "Spoor 1" }] : []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.ontimeupdate = () => setCurrentTime(audioRef.current.currentTime);
      audioRef.current.onloadedmetadata = () => setDuration(audioRef.current.duration);
    }
  }, [playbackRate, selectedTrack]);

  const togglePlay = () => {
    if (tracks.length === 0) return alert("Geen audio gevonden.");
    playing ? audioRef.current.pause() : audioRef.current.play();
    setPlaying(!playing);
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
      width: `${100/cols}%`, height: `${100/rows}%`, borderLeft: `4px solid ${PINK}`,
      background: "rgba(255, 45, 122, 0.15)", pointerEvents: "none", zIndex: 10,
      transition: "left 0.1s linear, top 0.1s linear"
    };
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 1000, display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "10px", borderBottom: "1px solid #eee" }}>
        <button onClick={onClose} style={{ border: "none", background: "#f0f0f0", borderRadius: "50%", width: 32, height: 32, fontWeight: 800 }}>✕</button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 800, fontSize: 14 }}>{ex.title}</div>
        <button onClick={() => setShowSync(!showSync)} style={{ background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 8, padding: "5px 12px", fontSize: 11, fontWeight: 700 }}>⚙️ SYNC</button>
      </div>

      {showSync && (
        <div style={{ padding: 15, background: "#f9f9f9", display: "flex", gap: 10, borderBottom: "1px solid #eee" }}>
          <input type="number" value={rows} onChange={e => setRows(Number(e.target.value))} style={{width:50}} placeholder="Rijen" />
          <input type="number" value={cols} onChange={e => setCols(Number(e.target.value))} style={{width:50}} placeholder="Maten" />
          <span style={{fontSize:10, color:"#999"}}>Stel in voor roze lijn</span>
        </div>
      )}

      {/* Spoor Kiezer (indien meerdere bestanden) */}
      {tracks.length > 1 && (
        <div style={{ display: "flex", overflowX: "auto", padding: "10px", gap: 10, background: "#fff", borderBottom: "1px solid #eee" }}>
          {tracks.map((t, i) => (
            <button key={i} onClick={() => { setSelectedTrack(i); setPlaying(false); }} style={{ 
              whiteSpace: "nowrap", padding: "6px 12px", borderRadius: 20, border: "none", 
              background: selectedTrack === i ? PINK : "#eee", color: selectedTrack === i ? "#fff" : "#666", fontSize: 11, fontWeight: 700 
            }}>
              {t.name || `Spoor ${i+1}`}
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", position: "relative", background: "#333" }}>
        <div style={{ position: "relative" }}>
          {ex.imageUrl && <><div style={getCursorStyle()} /><img src={ex.imageUrl} style={{ width: "100%" }} /></>}
        </div>
      </div>

      <div style={{ padding: 15, background: "#fff", borderTop: "1px solid #eee" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 5 }}>
            {[0.75, 1, 1.25].map(r => (
              <button key={r} onClick={() => setPlaybackRate(r)} style={{ fontSize: 10, padding: "6px 12px", background: playbackRate === r ? PINK : "#eee", color: playbackRate === r ? "#fff" : "#000", border: "none", borderRadius: 6, fontWeight: 700 }}>{r}x</button>
            ))}
          </div>
          <button onClick={() => window.open(tracks[selectedTrack]?.url, '_blank')} style={{ background: "#eee", border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 10, fontWeight: 700 }}>💾 DOWNLOAD</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          <button onClick={togglePlay} style={{ background: PINK, color: "#fff", border: "none", borderRadius: "50%", width: 55, height: 55, fontSize: 24 }}>{playing ? "⏸" : "▶"}</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: PINK }}>{ex.bpm} BPM</div>
            <div style={{ fontSize: 10, color: "#999" }}>{Math.floor(currentTime)}s / {Math.floor(duration)}s</div>
          </div>
          <audio ref={audioRef} src={tracks[selectedTrack]?.url} />
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "exercises"), orderBy("createdAt", "desc"));
    return onSnapshot(q, snap => setExercises(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    const imgFile = files.find(f => f.type.startsWith('image/'));
    const mp3Files = files.filter(f => f.type.startsWith('audio/'));

    if (!imgFile) return alert("Selecteer een foto.");
    setLoading(true);

    // Upload Foto
    const imgRef = ref(storage, `tabs/${Date.now()}_${imgFile.name}`);
    await uploadBytesResumable(imgRef, imgFile);
    const imageUrl = await getDownloadURL(imgRef);

    // Upload meerdere MP3's
    const audioTracks = [];
    for (const f of mp3Files) {
      const mRef = ref(storage, `mp3/${Date.now()}_${f.name}`);
      await uploadBytesResumable(mRef, f);
      const url = await getDownloadURL(mRef);
      audioTracks.push({ url, name: f.name.replace(".mp3", "") });
    }

    // AI Analyse
    let aiData = { title: "Nieuwe Oefening", bpm: 100 };
    try {
      // (Analyse logica hier...)
    } catch(e) {}

    await addDoc(collection(db, "exercises"), {
      title: aiData.title, bpm: aiData.bpm, imageUrl, audioTracks, 
      createdAt: new Date().toISOString(), sessions: []
    });

    setLoading(false);
    setShowAdd(false);
  };

  const logSession = async (stars) => {
    const newSessions = [...(sessionEx.sessions || []), { date: new Date().toISOString(), stars }];
    await updateDoc(doc(db, "exercises", sessionEx.id), { sessions: newSessions });
    setSessionEx(null);
  };

  return (
    <div style={{ maxWidth: 400, margin: "0 auto", minHeight: "100vh", background: BG, fontFamily: "sans-serif" }}>
      <div style={{ padding: 20, background: "#fff", borderBottom: "1px solid #eee" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: PINK, margin: 0 }}>BASSFLOW PRO</h1>
      </div>

      <div style={{ padding: 15 }}>
        {exercises.map(ex => (
          <div key={ex.id} style={{ background: "#fff", padding: 14, borderRadius: 16, marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
            <div onClick={() => setViewEx(ex)} style={{ display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}>
              <img src={ex.imageUrl} style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{ex.title}</div>
                <div style={{ fontSize: 11, color: PINK, fontWeight: 700 }}>{ex.bpm} BPM • {ex.audioTracks?.length || 0} tracks</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              <button onClick={() => setViewEx(ex)} style={{ flex: 1, padding: 8, borderRadius: 10, border: "none", background: PINK_LIGHT, color: PINK, fontWeight: 800, fontSize: 12 }}>OEFEFEN</button>
              <button onClick={() => setSessionEx(ex)} style={{ flex: 1, padding: 8, borderRadius: 10, border: "none", background: PINK, color: "#fff", fontWeight: 800, fontSize: 12 }}>+ LOG</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setShowAdd(true)} style={{ position: "fixed", bottom: 25, right: 25, background: PINK, color: "#fff", border: "none", width: 60, height: 60, borderRadius: "50%", fontSize: 30, boxShadow: "0 5px 20px rgba(255,45,122,0.4)" }}>+</button>

      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 2000, padding: 30, color: "#fff", display: "flex", flexDirection: "column", justifyContent: "center", textAlign: "center" }}>
          <h2>Nieuwe Oefening</h2>
          <p style={{fontSize: 12, opacity: 0.8, marginBottom: 20}}>Kies 1 foto en 1 of meerdere MP3's tegelijk</p>
          <input type="file" multiple onChange={handleUpload} style={{marginBottom: 20, background: "#fff", color: "#000", padding: 10, borderRadius: 8, width: "100%"}} />
          {loading && <div style={{color: PINK, fontWeight: 900}}>Uploaden...</div>}
          <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "1px solid #fff", color: "#fff", padding: 10, borderRadius: 8, marginTop: 20 }}>Annuleren</button>
        </div>
      )}

      {sessionEx && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", padding: 30, borderRadius: 20, textAlign: "center", width: "80%" }}>
            <h3 style={{marginBottom: 20}}>Sessie Loggen</h3>
            <StarRating onChange={logSession} />
            <button onClick={() => setSessionEx(null)} style={{ marginTop: 20, border: "none", background: "none", color: "#999" }}>Sluiten</button>
          </div>
        </div>
      )}

      {viewEx && <TabView ex={viewEx} onClose={() => setViewEx(null)} />}
    </div>
  );
}
