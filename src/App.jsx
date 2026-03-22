import { useState, useRef, useEffect } from "react";
import {
  collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase.js";

const PINK = "#FF2D7A";
const PINK_LIGHT = "#FFE0EE";
const BG = "#F5F4F0";
const DARK = "#1A1A1A";
const CARD_SHADOW = "0 4px 16px rgba(0,0,0,0.12)";
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

function Badge({ level }) {
  const c = {
    Beginner: [PINK_LIGHT, PINK],
    Intermediate: ["#FFF0E0", "#FF8C00"],
    Advanced: ["#F0E8FF", "#8B2FC9"],
  }[level] || [PINK_LIGHT, PINK];

  return (
    <span style={{
      background: c[0],
      color: c[1],
      fontSize: 9,
      fontWeight: 700,
      padding: "3px 8px",
      borderRadius: 20,
      letterSpacing: ".05em",
      textTransform: "uppercase",
    }}>
      {level}
    </span>
  );
}

function UploadProgress({ progress, label }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, color: "#999", marginBottom: 3 }}>{label || "Uploaden…"} {Math.round(progress)}%</div>
      <div style={{ height: 4, background: "#eee", borderRadius: 4 }}>
        <div style={{
          width: `${progress}%`,
          height: "100%",
          background: PINK,
          borderRadius: 4,
          transition: "width .2s"
        }} />
      </div>
    </div>
  );
}

// --- TabView met swipe animaties ---
function TabView({ ex, onClose, onAddMp3, onAddPages }) {
  const audioRef = useRef();
  const imgRef = useRef();
  const mp3Ref = useRef();
  const touchStartX = useRef(null);
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadLabel, setUploadLabel] = useState("");

  const pages = ex.pages || (ex.imageUrl ? [{ imageUrl: ex.imageUrl, tabText: ex.tabText, aiNotes: ex.aiNotes }] : []);

  const togglePlay = () => {
    if (!ex.mp3Url) return;
    if (!audioRef.current) audioRef.current = new Audio(ex.mp3Url);
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const handleTouchStart = e => touchStartX.current = e.touches[0].clientX;
  const handleTouchEnd = e => {
    if (!touchStartX.current) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && page < pages.length - 1) setPage(p => p + 1);
      if (diff < 0 && page > 0) setPage(p => p - 1);
    }
    touchStartX.current = null;
  };

  const handleMp3 = async (file) => {
    if (!file) return;
    setUploadLabel("MP3 uploaden…"); setUploadProgress(0);
    const storageRef = ref(storage, `mp3/${ex.id}/${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on("state_changed",
      snap => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100),
      err => { console.error(err); setUploadProgress(null); },
      async () => { const url = await getDownloadURL(task.snapshot.ref); onAddMp3(url); setUploadProgress(null); }
    );
  };

  const handleAddImages = async (files) => {
    if (!files?.length) return;
    const newPages = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadLabel(`Foto ${i+1}/${files.length} uploaden...`); setUploadProgress(0);
      const storageRef = ref(storage, `tabs/${ex.id}/${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(storageRef, file);
      const url = await new Promise((resolve, reject) => {
        task.on(
          "state_changed",
          snap => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 80),
          reject,
          async () => resolve(await getDownloadURL(task.snapshot.ref))
        );
      });
      // Voor iPhone swipe feel: simulatie kleine vertraging
      await new Promise(r => setTimeout(r, 150));
      newPages.push({ imageUrl: url, tabText: "", aiNotes: "" });
    }
    setUploadProgress(null);
    const allPages = pages.concat(newPages);
    onAddPages(allPages);
    setPage(pages.length);
  };

  const currentPage = pages[page];

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 200, display: "flex", flexDirection: "column", fontFamily: "'Syne', sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #eee", gap: 10 }}>
        <button onClick={onClose} style={{ background: "#f0f0f0", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontSize: 13 }}>✕</button>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 14, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.title}</div>
        {pages.length > 0 && <div style={{ background: PINK_LIGHT, color: PINK, padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{page + 1}/{pages.length}</div>}
      </div>
      <div style={{ flex: 1, overflowY: "auto", position: "relative" }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", alignItems: "center", transition: "transform .3s ease" }}>
          {pages.length === 0 ? (
            <div style={{ border: `2px dashed #ddd`, borderRadius: 12, padding: 32, textAlign: "center", cursor: "pointer", background: "#fafafa" }} onClick={() => imgRef.current.click()}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>Foto's toevoegen</div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>Selecteer één of meerdere foto's</div>
            </div>
          ) : (
            <>
              {currentPage?.imageUrl && <img src={currentPage.imageUrl} alt={`pagina ${page+1}`} style={{ width: "100%", borderRadius: 14, boxShadow: CARD_SHADOW }} />}
              {currentPage?.tabText && <pre style={{ marginTop: 12, background: BG, borderRadius: 10, padding: 14, fontFamily: "monospace", fontSize: 12, lineHeight: 1.8, whiteSpace: "pre-wrap", color: DARK }}>{currentPage.tabText}</pre>}
              {currentPage?.aiNotes && <div style={{ marginTop: 10, background: PINK_LIGHT, borderRadius: 10, padding: 12, borderLeft: `3px solid ${PINK}` }}>
                <div style={{ fontWeight: 700, color: PINK, fontSize: 11, marginBottom: 4 }}>🤖 AI Analyse</div>
                <div style={{ fontSize: 12, color: DARK, lineHeight: 1.6 }}>{currentPage.aiNotes}</div>
              </div>}
            </>
          )}
          {uploadProgress !== null && <UploadProgress progress={uploadProgress} label={uploadLabel} />}
        </div>
      </div>
      <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleAddImages(Array.from(e.target.files))} />
      <div style={{ borderTop: "1px solid #eee", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10, background: "#fafafa" }}>
        <button onClick={ex.mp3Url ? togglePlay : () => mp3Ref.current.click()} style={{
          background: PINK, color: "#fff", border: "none", borderRadius: "50%", width: 50, height: 50,
          fontSize: ex.mp3Url ? 18 : 16, cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", boxShadow: CARD_SHADOW, flexShrink: 0,
        }}>{ex.mp3Url ? (playing ? "⏸" : "▶") : "🎵"}</button>
        <input ref={mp3Ref} type="file" accept="audio/*" style={{ display: "none" }} onChange={e => { const f = e.target.files[0]; if (f) handleMp3(f); }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "#999" }}>{ex.mp3Url ? "MP3 gekoppeld ✓" : "Geen MP3 -- tik ▶"}</div>
          <div style={{ fontWeight: 800, color: PINK, fontSize: 15 }}>{ex.bpm || 0} BPM</div>
        </div>
        <button onClick={() => imgRef.current.click()} style={{ background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Foto</button>
      </div>
    </div>
  );
}

// --- Hoofd App ---
export default function App() {
  const [exercises, setExercises] = useState([]);
  const [tabOpen, setTabOpen] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "exercises"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => setExercises(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, []);

  const handleAddMp3 = (id, url) => updateDoc(doc(db, "exercises", id), { mp3Url: url });
  const handleAddPages = (id, pages) => updateDoc(doc(db, "exercises", id), { pages });

  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "'Syne', sans-serif", paddingBottom: 60 }}>
      <div style={{ padding: 16, fontWeight: 700, fontSize: 20, color: DARK }}>🎸 Bass Tab App</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: 16 }}>
        {exercises.map(ex => (
          <div key={ex.id} onClick={() => setTabOpen(ex)} style={{
            background: "#fff", borderRadius: 14, padding: 14, cursor: "pointer", boxShadow: CARD_SHADOW,
            transition: "transform .15s ease", display: "flex", flexDirection: "column"
          }} onMouseEnter={e => e.currentTarget.style.transform = "translateY(-3px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0px)"}>
            <div style={{ fontWeight: 700 }}>{ex.title}</div>
            <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{ex.bpm} BPM</div>
            <div style={{ marginTop: 6 }}><Badge level={ex.level || "Beginner"} /></div>
          </div>
        ))}
      </div>
      {tabOpen && <TabView ex={tabOpen} onClose={() => setTabOpen(null)} onAddMp3={(url) => handleAddMp3(tabOpen.id, url)} onAddPages={(pages) => handleAddPages(tabOpen.id, pages)} />}
    </div>
  );
}