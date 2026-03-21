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

const MODULES = [
  { id: "mod1", name: "Fundamenten", level: "Beginner", color: PINK },
  { id: "mod2", name: "Groove & Ritme", level: "Beginner", color: PINK },
  { id: "mod3", name: "Muting", level: "Intermediate", color: "#FF8C00" },
  { id: "mod4", name: "Slap Bass", level: "Advanced", color: "#8B2FC9" },
];

function StarRating({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} onClick={() => onChange?.(s)} style={{ cursor: "pointer", fontSize: 28, color: s <= value ? "#FFB800" : "#DDD" }}>★</span>
      ))}
    </div>
  );
}

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
    const mp3File = files.find(f => f.type.startsWith('audio/'));

    if (!imgFile) return alert("Selecteer een foto van je tab.");
    setLoading(true);

    const imgRef = ref(storage, `tabs/${Date.now()}_${imgFile.name}`);
    await uploadBytesResumable(imgRef, imgFile);
    const imageUrl = await getDownloadURL(imgRef);

    let mp3Url = null;
    if (mp3File) {
      const mRef = ref(storage, `mp3/${Date.now()}_${mp3File.name}`);
      await uploadBytesResumable(mRef, mp3File);
      mp3Url = await getDownloadURL(mRef);
    }

    await addDoc(collection(db, "exercises"), {
      title: "Nieuwe Oefening",
      bpm: 100,
      imageUrl,
      mp3Url,
      moduleId: "mod1",
      sessions: [],
      createdAt: new Date().toISOString()
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
      <div style={{ padding: "20px", background: "#fff", borderBottom: "1px solid #eee", textAlign: "center" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: PINK, margin: 0 }}>BASSFLOW PRO</h1>
      </div>

      <div style={{ padding: 15 }}>
        {exercises.map(ex => (
          <div key={ex.id} style={{ background: "#fff", padding: 15, borderRadius: 18, marginBottom: 12, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
            <div onClick={() => setViewEx(ex)} style={{ display: "flex", gap: 15, alignItems: "center" }}>
              <img src={ex.imageUrl} style={{ width: 55, height: 55, borderRadius: 12, objectFit: "cover" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{ex.title}</div>
                <div style={{ fontSize: 12, color: PINK, fontWeight: 700 }}>{ex.bpm} BPM • {ex.sessions?.length || 0} sessies</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 15 }}>
              <button onClick={() => setViewEx(ex)} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: PINK_LIGHT, color: PINK, fontWeight: 800 }}>BEKIJK</button>
              <button onClick={() => setSessionEx(ex)} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: PINK, color: "#fff", fontWeight: 800 }}>+ LOG</button>
            </div>
          </div>
        ))}
      </div>

      <button onClick={() => setShowAdd(true)} style={{ position: "fixed", bottom: 25, right: 25, background: PINK, color: "#fff", border: "none", width: 65, height: 65, borderRadius: "50%", fontSize: 35, boxShadow: "0 5px 20px rgba(255,45,122,0.4)" }}>+</button>

      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, padding: 30, display: "flex", flexDirection: "column", justifyContent: "center", color: "#fff" }}>
          <h2 style={{ textAlign: "center" }}>Voeg oefening toe</h2>
          <input type="file" multiple onChange={handleUpload} style={{ margin: "20px 0", background: "#fff", color: "#000", padding: 15, borderRadius: 10, width: "100%" }} />
          {loading && <p style={{ textAlign: "center", fontWeight: 800, color: PINK }}>Bezig met uploaden...</p>}
          <button onClick={() => setShowAdd(false)} style={{ background: "none", border: "1px solid #fff", color: "#fff", padding: 12, borderRadius: 10 }}>Annuleren</button>
        </div>
      )}

      {sessionEx && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", padding: 30, borderRadius: 25, width: "85%", textAlign: "center" }}>
            <h3 style={{ marginBottom: 20 }}>Hoe ging het?</h3>
            <StarRating onChange={logSession} />
            <button onClick={() => setSessionEx(null)} style={{ marginTop: 25, border: "none", color: "#999", background: "none" }}>Sluiten</button>
          </div>
        </div>
      )}

      {viewEx && (
        <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 100, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: 15, borderBottom: "1px solid #eee", display: "flex", alignItems: "center" }}>
            <button onClick={() => setViewEx(null)} style={{ border: "none", background: "#eee", borderRadius: "50%", width: 35, height: 35 }}>✕</button>
            <div style={{ flex: 1, textAlign: "center", fontWeight: 800 }}>{viewEx.title}</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <img src={viewEx.imageUrl} style={{ width: "100%" }} />
          </div>
          {viewEx.mp3Url && (
            <div style={{ padding: 20, background: "#f9f9f9", borderTop: "1px solid #eee" }}>
              <audio src={viewEx.mp3Url} controls style={{ width: "100%" }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
