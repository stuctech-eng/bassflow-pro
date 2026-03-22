import { useState, useEffect } from "react";
import {
  collection, onSnapshot, query, orderBy, deleteDoc, doc
} from "firebase/firestore";
import { ref, deleteObject } from "firebase/storage";
import { db, storage } from "./firebase.js";

const PINK = "#FF2D7A";
const BG = "#F5F4F0";
const DARK = "#1A1A1A";

const MODULES = [
  { id: "mod1", name: "Fundamenten" },
  { id: "mod2", name: "Groove & Ritme" },
  { id: "mod3", name: "Muting" },
  { id: "mod4", name: "Slap Bass" },
];

export default function App() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "exercises"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setExercises(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (ex) => {
    for (const p of (ex.pages || [])) {
      if (p.imageUrl) {
        try { await deleteObject(ref(storage, p.imageUrl)); } catch {}
      }
    }
    if (ex.mp3Url) {
      try { await deleteObject(ref(storage, ex.mp3Url)); } catch {}
    }
    await deleteDoc(doc(db, "exercises", ex.id));
  };

  const filtered = filter
    ? exercises.filter(e => e.moduleId === filter)
    : exercises;

  return (
    <div style={{ padding: 20, background: BG, minHeight: "100vh" }}>
      
      <h1 style={{ color: PINK }}>BassFlow</h1>

      {/* FILTER */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <button onClick={() => setFilter(null)}>Alle</button>
        {MODULES.map(m => (
          <button key={m.id} onClick={() => setFilter(m.id)}>
            {m.name}
          </button>
        ))}
      </div>

      {/* LIJST */}
      {loading ? (
        <div>Laden...</div>
      ) : filtered.length === 0 ? (
        <div>Geen oefeningen</div>
      ) : (
        filtered.map(ex => (
          <div key={ex.id} style={{
            background: "#fff",
            padding: 12,
            borderRadius: 10,
            marginBottom: 10
          }}>
            <div style={{ fontWeight: 700 }}>{ex.title}</div>
            <div style={{ fontSize: 12 }}>{ex.bpm} BPM</div>

            <button onClick={() => handleDelete(ex)}>
              Verwijderen
            </button>
          </div>
        ))
      )}
    </div>
  );
}