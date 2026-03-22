import { useState, useEffect, useRef } from "react";
import {
  collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc
} from "firebase/firestore";
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "firebase/storage";
import { db, storage } from "./firebase.js";

const PINK = "#FF2D7A";
const BG = "#F5F4F0";

export default function App() {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  const [imageFiles, setImageFiles] = useState([]);
  const [title, setTitle] = useState("");
  const [bpm, setBpm] = useState(100);

  const fileRef = useRef();

  useEffect(() => {
    const q = query(collection(db, "exercises"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setExercises(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleImages = (files) => {
    setImageFiles(Array.from(files));
  };

  const handleUpload = async () => {
    if (!imageFiles.length) return;

    const pages = [];

    for (let i = 0; i < imageFiles.length; i++) {
      const file = imageFiles[i];

      const storageRef = ref(storage, `tabs/${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(storageRef, file);

      const url = await new Promise((resolve, reject) => {
        task.on(
          "state_changed",
          null,
          reject,
          async () => {
            const downloadURL = await getDownloadURL(task.snapshot.ref);
            resolve(downloadURL);
          }
        );
      });

      pages.push({ imageUrl: url });
    }

    await addDoc(collection(db, "exercises"), {
      title: title || "Naamloze oefening",
      bpm,
      pages,
      imageUrl: pages[0]?.imageUrl || null,
      createdAt: new Date().toISOString()
    });

    // reset
    setImageFiles([]);
    setTitle("");
    setBpm(100);
  };

  const handleDelete = async (ex) => {
    for (const p of (ex.pages || [])) {
      if (p.imageUrl) {
        try { await deleteObject(ref(storage, p.imageUrl)); } catch {}
      }
    }
    await deleteDoc(doc(db, "exercises", ex.id));
  };

  return (
    <div style={{ padding: 20, background: BG, minHeight: "100vh" }}>
      
      <h1 style={{ color: PINK }}>BassFlow</h1>

      {/* FORM */}
      <div style={{ marginBottom: 20 }}>
        <input
          placeholder="Titel"
          value={title}
          onChange={e => setTitle(e.target.value)}
        />

        <input
          type="number"
          value={bpm}
          onChange={e => setBpm(Number(e.target.value))}
        />

        <button onClick={() => fileRef.current.click()}>
          Foto kiezen
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={e => handleImages(e.target.files)}
        />

        <button onClick={handleUpload}>
          Opslaan
        </button>
      </div>

      {/* LIJST */}
      {loading ? (
        <div>Laden...</div>
      ) : (
        exercises.map(ex => (
          <div key={ex.id} style={{
            background: "#fff",
            padding: 10,
            marginBottom: 10
          }}>
            <div>{ex.title}</div>
            <div>{ex.bpm} BPM</div>

            {ex.imageUrl && (
              <img src={ex.imageUrl} width={100} />
            )}

            <button onClick={() => handleDelete(ex)}>
              Verwijderen
            </button>
          </div>
        ))
      )}
    </div>
  );
}