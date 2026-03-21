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
const VERSION = "V1.1";

const MODULES_DEFAULT = [
  { id: "mod1", name: "Fundamenten", level: "Beginner", color: PINK },
  { id: "mod2", name: "Groove & Ritme", level: "Beginner", color: PINK },
  { id: "mod3", name: "Muting & Articulatie", level: "Intermediate", color: "#FF8C00" },
  { id: "mod4", name: "Slap Bass", level: "Advanced", color: "#8B2FC9" },
];

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

function TabView({ ex, onClose, onAddMp3, onAddPages }) {
  const mp3Ref = useRef();
  const imgRef = useRef();
  const [page, setPage] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadLabel, setUploadLabel] = useState("");
  const audioRef = useRef(new Audio());
  const touchStartX = useRef(null);
  const pages = ex.pages || (ex.imageUrl ? [{ imageUrl: ex.imageUrl, tabText: ex.tabText, aiNotes: ex.aiNotes }] : []);

  useEffect(() => {
    if (ex.mp3Url) {
      audioRef.current.src = ex.mp3Url;
      audioRef.current.onended = () => setPlaying(false);
    }
    return () => {
      audioRef.current.pause();
    };
  }, [ex.mp3Url]);

  const togglePlay = () => {
    if (!ex.mp3Url) return mp3Ref.current.click();
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const handleMp3 = async (file) => {
    if (!file) return;
    setUploadLabel("Audio uploaden…"); setUploadProgress(0);
    const storageRef = ref(storage, `mp3/${ex.id}/${Date.now()}_${file.name}`);
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
      setUploadLabel(`Foto ${i + 1}/${files.length} uploaden...`); setUploadProgress(0);
      const storageRef = ref(storage, `tabs/${ex.id}/${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(storageRef, file);
      const url = await new Promise((resolve, reject) => {
        task.on("state_changed", snap => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 80), reject,
          async () => resolve(await getDownloadURL(task.snapshot.ref)));
      });
      setUploadLabel(`Foto ${i + 1}/${files.length} analyseren...`); setUploadProgress(80);
      let tabText = "", aiNotes = "";
      try {
        const r = new FileReader();
        const dataUrl = await new Promise(res => { r.onload = e => res(e.target.result); r.readAsDataURL(file); });
        const parsed = await analyzeTab(dataUrl, file.type);
        tabText = parsed.tabText || ""; aiNotes = parsed.notes || "";
      } catch { }
      newPages.push({ imageUrl: url, tabText, aiNotes });
    }
    setUploadProgress(null);
    const allPages = pages.concat(newPages);
    onAddPages(allPages);
    setPage(pages.length);
  };

  const handleTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const handleTouchEnd = (e) => {
    if (!touchStartX.current) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0 && page < pages.length - 1) setPage(p => p + 1);
      if (diff < 0 && page > 0) setPage(p => p - 1);
    }
    touchStartX.current = null;
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
        <div style={{ padding: 16 }}>
          {pages.length === 0 ? (
            <div style={{ border: `2px dashed #ddd`, borderRadius: 12, padding: 32, textAlign: "center", cursor: "pointer", background: "#fafafa" }} onClick={() => imgRef.current.click()}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📸</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>Foto's toevoegen</div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>Selecteer één of meerdere foto's</div>
            </div>
          ) : (
            <>
              {currentPage?.imageUrl && <img src={currentPage.imageUrl} alt={`pagina ${page + 1}`} style={{ width: "100%", borderRadius: 10 }} />}
              {currentPage?.tabText && (
                <div style={{ marginTop: 12, background: BG, borderRadius: 10, padding: 14, fontFamily: "monospace", fontSize: 11, lineHeight: 1.9, whiteSpace: "pre-wrap", color: DARK }}>
                  {currentPage.tabText}
                </div>
              )}
              {currentPage?.aiNotes && (
                <div style={{ marginTop: 10, background: PINK_LIGHT, borderRadius: 10, padding: 12, borderLeft: `3px solid ${PINK}` }}>
                  <div style={{ fontWeight: 700, color: PINK, fontSize: 11, marginBottom: 4 }}>🤖 AI Analyse</div>
                  <div style={{ fontSize: 12, color: DARK, lineHeight: 1.6 }}>{currentPage.aiNotes}</div>
                </div>
              )}
            </>
          )}
          {uploadProgress !== null && <UploadProgress progress={uploadProgress} label={uploadLabel} />}
        </div>
      </div>
      <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleAddImages(Array.from(e.target.files))} />

      {/* GROTE AFSPEL BALK ONDERAAN */}
      <div style={{ borderTop: "1px solid #eee", padding: "12px 16px 20px", display: "flex", alignItems: "center", gap: 15, background: "#fff", boxShadow: "0 -4px 10px rgba(0,0,0,0.03)" }}>
        <button onClick={togglePlay} style={{
          background: PINK, color: "#fff", border: "none", borderRadius: 12, minWidth: 100, height: 55,
          fontSize: 14, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center",
          justifyContent: "center", boxShadow: `0 4px 15px ${PINK}55`, flexShrink: 0, gap: 8
        }}>
          {ex.mp3Url ? (playing ? "⏸ PAUZE" : "▶ PLAY") : "🎵 AUDIO"}
        </button>
        <input ref={mp3Ref} type="file" accept="audio/*" style={{ display: "none" }} onChange={e => { const f = e.target.files[0]; if (f) handleMp3(f); }} />
        
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "#999", fontWeight: 700, marginBottom: 4 }}>
             {ex.mp3Url ? "GELADEN ✓" : "GEEN AUDIO GELADEN"}
          </div>
          <div style={{ fontWeight: 800, color: DARK, fontSize: 18 }}>{ex.bpm} <span style={{fontSize: 12, color: PINK}}>BPM</span></div>
        </div>
        
        <button onClick={() => imgRef.current.click()} style={{ background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 10, padding: "10px 15px", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>+ FOTO</button>
      </div>
    </div>
  );
}

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
      setUploadLabel(`Foto ${i + 1}/${imageFiles.length} uploaden...`); setUploadProgress(0);
      const imgRef = ref(storage, `tabs/${Date.now()}_${file.name}`);
      const task = uploadBytesResumable(imgRef, file);
      const url = await new Promise((resolve, reject) => {
        task.on("state_changed", snap => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 80), reject,
          async () => resolve(await getDownloadURL(task.snapshot.ref)));
      });
      setUploadLabel(`Foto ${i + 1}/${imageFiles.length} analyseren...`); setUploadProgress(80);
      let tabText = "", aiNotes = "";
      try {
        const parsed = await analyzeTab(imagePreviews[i], file.type);
        tabText = parsed.tabText || ""; aiNotes = parsed.notes || "";
        if (i === 0 && parsed.title && !title) detectedTitle = parsed.title;
        if (i === 0 && parsed.bpm) detectedBpm = parsed.bpm;
      } catch { }
      pages.push({ imageUrl: url, tabText, aiNotes });
      setUploadProgress(100);
    }

    if (mp3File) {
      setUploadLabel("Audio uploaden..."); setUploadProgress(0);
      const mp3StorageRef = ref(storage, `mp3/${Date.now()}_${mp3File.name}`);
      const task = uploadBytesResumable(mp3StorageRef, mp3File);
      await new Promise((resolve, reject) => {
        task.on("state_changed", snap => setUploadProgress((snap.bytesTransferred / snap.totalBytes) * 100), reject,
          async () => { mp3Url = await getDownloadURL(task.snapshot.ref); resolve(); });
      });
    }

    const exData = {
      title: detectedTitle || title || "Naamloze oefening",
      moduleId, bpm: detectedBpm, pages,
      imageUrl: pages[0]?.imageUrl || null,
      tabText: pages.map(p => p.tabText).filter(Boolean).join("\n\n--- pagina ---\n\n"),
      aiNotes: pages[0]?.aiNotes || "",
      mp3Url, sessions: exercise?.sessions || [],
      updatedAt: new Date().toISOString(),
    };

    if (isNew) { exData.createdAt = new Date().toISOString(); await addDoc(collection(db, "exercises"), exData); }
    else { await updateDoc(doc(db, "exercises", exercise.id), exData); }
    onClose();
  };

  const inp = { width: "100%", padding: "12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 13, outline: "none", fontFamily: "'Syne', sans-serif", boxSizing: "border-box" };
  const btn = { width: "100%", background: PINK, color: "#fff", border: "none", borderRadius: 12, padding: "15px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "'Syne', sans-serif" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: "20px 20px 0 0", width: "100%", maxHeight: "92vh", overflowY: "auto", padding: 20, fontFamily: "'Syne', sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: DARK }}>{isNew ? "Importeer Nieuw" : "Bewerken"}</div>
          <button onClick={onClose} style={{ background: "#f0f0f0", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", fontSize: 12 }}>✕</button>
        </div>

        {step === "uploading" && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>☁️</div>
            <div style={{ fontWeight: 800, fontSize: 15, color: DARK, marginBottom: 12 }}>{uploadLabel}</div>
            <UploadProgress progress={uploadProgress} />
          </div>
        )}

        {step === "form" && (
          <>
            <div onClick={() => fileRef.current.click()} style={{
              border: `2px dashed ${imagePreviews.length ? PINK : "#ddd"}`, borderRadius: 12,
              padding: imagePreviews.length ? 10 : 25, textAlign: "center", cursor: "pointer",
              marginBottom: 12, background: imagePreviews.length ? PINK_LIGHT : "#fafafa",
            }}>
              {imagePreviews.length > 0 ? (
                <div>
                  <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
                    {imagePreviews.map((src, i) => <img key={i} src={src} alt={`p${i + 1}`} style={{ height: 85, borderRadius: 8, flexShrink: 0 }} />)}
                  </div>
                  <div style={{ fontSize: 11, color: PINK, fontWeight: 700, marginTop: 6 }}>{imagePreviews.length} pagina's geselecteerd</div>
                </div>
              ) : (
                <><div style={{ fontSize: 32, marginBottom: 6 }}>📸</div><div style={{ fontWeight: 700, fontSize: 13, color: DARK }}>Foto's (Tab/Bladmuziek)</div></>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleImages(e.target.files)} />

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: "#aaa", display: "block", marginBottom: 4 }}>TITEL</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Naam oefening" style={inp} />
            </div>

            <div onClick={() => mp3Ref.current.click()} style={{
              border: `2px dashed ${mp3File || exercise?.mp3Url ? PINK : "#ddd"}`, borderRadius: 12,
              padding: 15, textAlign: "center", cursor: "pointer", marginBottom: 15,
              background: mp3File || exercise?.mp3Url ? PINK_LIGHT : "#fafafa",
            }}>
              <div style={{ color: mp3File || exercise?.mp3Url ? PINK : DARK, fontWeight: 800, fontSize: 13 }}>
                {mp3File ? `🎵 ${mp3File.name}` : "📁 Audio bestanden (MP3, WAV, etc.)"}
              </div>
            </div>
            <input ref={mp3Ref} type="file" accept="audio/*" style={{ display: "none" }} onChange={e => setMp3File(e.target.files[0])} />

            <div style={{ marginBottom: 15 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <label style={{ fontSize: 10, fontWeight: 800, color: "#aaa" }}>TEMPO</label>
                <span style={{ fontWeight: 800, color: PINK, fontSize: 13 }}>{bpm} BPM</span>
              </div>
              <input type="range" min={40} max={240} value={bpm} onChange={e => setBpm(Number(e.target.value))} style={{ width: "100%", accentColor: PINK }} />
            </div>

            <button onClick={handleSave} style={btn}>✓ OPSLAAN IN FLOW</button>
          </>
        )}
      </div>
    </div>
  );
}

function SessionModal({ exercise, onClose }) {
  const [bpm, setBpm] = useState(exercise.bpm || 100);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState("");
  const maxBpm = exercise.sessions?.reduce((m, s) => Math.max(m, s.bpm), 0) || 0;

  const handleSave = async () => {
    const session = { id: Date.now(), date: new Date().toISOString(), bpm, stars, note };
    await updateDoc(doc(db, "exercises", exercise.id), { sessions: [...(exercise.sessions || []), session] });
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "flex-end" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: "18px 18px 0 0", width: "100%", padding: 20, fontFamily: "'Syne', sans-serif" }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: DARK, marginBottom: 2 }}>Sessie loggen</div>
        <div style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>{exercise.title}</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>TEMPO</label>
            <span style={{ fontWeight: 800, color: PINK, fontSize: 14 }}>{bpm} BPM</span>
          </div>
          <input type="range" min={40} max={240} value={bpm} onChange={e => setBpm(Number(e.target.value))} style={{ width: "100%", accentColor: PINK }} />
          {maxBpm > 0 && <div style={{ fontSize: 10, color: "#999", marginTop: 3 }}>Max: <strong style={{ color: PINK }}>{maxBpm} BPM</strong>{bpm > maxBpm && <span style={{ color: "#00B84C", marginLeft: 6 }}>🎉 Nieuw record!</span>}</div>}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 6 }}>BEOORDELING</label>
          <StarRating value={stars} onChange={setStars} size={22} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>NOTITIE</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Wat ging goed?" rows={2}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 13, outline: "none", fontFamily: "'Syne', sans-serif", resize: "none", boxSizing: "border-box" }} />
        </div>
        <button onClick={handleSave} style={{ width: "100%", background: PINK, color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "'Syne', sans-serif", boxShadow: `0 3px 16px ${PINK}44` }}>✓ Sessie opslaan</button>
      </div>
    </div>
  );
}

function ExerciseCard({ ex, modules, onSession, onView, onEdit, onDelete }) {
  const mod = modules.find(m => m.id === ex.moduleId);
  const maxBpm = ex.sessions?.reduce((m, s) => Math.max(m, s.bpm), 0) || 0;
  const lastSession = ex.sessions?.[ex.sessions.length - 1];
  const avgStars = ex.sessions?.length ? (ex.sessions.reduce((a, s) => a + s.stars, 0) / ex.sessions.length).toFixed(1) : 0;
  const pages = ex.pages || (ex.imageUrl ? [{ imageUrl: ex.imageUrl }] : []);
  const [confirm, setConfirm] = useState(false);

  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: 13, boxShadow: "0 1px 8px rgba(0,0,0,0.06)", fontFamily: "'Syne', sans-serif" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <img src={pages[0]?.imageUrl || "https://via.placeholder.com/50"} alt="tab" onClick={() => onView(ex)} style={{ width: 50, height: 50, borderRadius: 9, objectFit: "cover", border: `2px solid ${PINK_LIGHT}`, cursor: "pointer", flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: DARK, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ex.title}</div>
          <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 4 }}>
            {mod && <Badge level={mod.level} />}
            <span style={{ fontSize: 9, color: PINK, fontWeight: 700, background: PINK_LIGHT, padding: "1px 6px", borderRadius: 8 }}>{pages.length} Pag.</span>
            {ex.mp3Url && <span style={{ fontSize: 14 }}>🎵</span>}
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#bbb" }}>
            <span><span style={{ color: PINK, fontWeight: 700 }}>{maxBpm || ex.bpm}</span> BPM</span>
            <span><span style={{ color: PINK, fontWeight: 700 }}>{ex.sessions?.length || 0}</span> sessies</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          <button onClick={() => onEdit(ex)} style={{ background: "#f4f4f4", color: "#666", border: "none", borderRadius: 7, padding: "5px 8px", fontSize: 12, cursor: "pointer" }}>✏️</button>
          <button onClick={() => setConfirm(true)} style={{ background: "#FFF0F0", color: "#E53935", border: "none", borderRadius: 7, padding: "5px 8px", fontSize: 12, cursor: "pointer" }}>🗑</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button onClick={() => onView(ex)} style={{ flex: 1, background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>📄 Tab bekijken</button>
        <button onClick={() => onSession(ex)} style={{ flex: 1, background: PINK, color: "#fff", border: "none", borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Sessie loggen</button>
      </div>

      {confirm && (
        <div style={{ marginTop: 10, background: "#FFF5F5", borderRadius: 10, padding: 12, textAlign: "center", border: "1px solid #FFD0D0" }}>
          <div style={{ fontSize: 12, color: DARK, marginBottom: 8, fontWeight: 700 }}>Verwijderen?</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirm(false)} style={{ flex: 1, background: "#eee", border: "none", borderRadius: 8, padding: "7px", fontSize: 12 }}>Nee</button>
            <button onClick={() => onDelete(ex)} style={{ flex: 1, background: "#E53935", color: "#fff", border: "none", borderRadius: 8, padding: "7px", fontSize: 12, fontWeight: 700 }}>Ja</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [exercises, setExercises] = useState([]);
  const [modules] = useState(MODULES_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [editExercise, setEditExercise] = useState(null);
  const [sessionEx, setSessionEx] = useState(null);
  const [viewEx, setViewEx] = useState(null);
  const [filterModule, setFilterModule] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "exercises"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setExercises(snap.docs.map(d => (Object.assign({ id: d.id }, d.data()))));
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleDelete = async (ex) => {
    for (const p of (ex.pages || [])) { if (p.imageUrl) try { await deleteObject(ref(storage, p.imageUrl)); } catch { } }
    if (ex.mp3Url) try { await deleteObject(ref(storage, ex.mp3Url)); } catch { }
    await deleteDoc(doc(db, "exercises", ex.id));
  };

  const handleAddMp3 = async (exId, url) => {
    await updateDoc(doc(db, "exercises", exId), { mp3Url: url });
    if (viewEx?.id === exId) setViewEx(v => Object.assign({}, v, { mp3Url: url }));
  };

  const handleAddPages = async (exId, pages) => {
    await updateDoc(doc(db, "exercises", exId), {
      pages, imageUrl: pages[0]?.imageUrl || null,
      tabText: pages.map(p => p.tabText).filter(Boolean).join("\n\n-- pagina --\n\n"),
    });
    if (viewEx?.id === exId) setViewEx(v => Object.assign({}, v, { pages }));
  };

  const totalSessions = exercises.reduce((a, e) => a + (e.sessions?.length || 0), 0);
  const filtered = filterModule ? exercises.filter(e => e.moduleId === filterModule) : exercises;
  const today = new Date().toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();

  return (
    <div style={{ maxWidth: 390, margin: "0 auto", minHeight: "100vh", background: BG, fontFamily: "'Syne', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&display=swap');*{box-sizing:border-box;margin:0;padding:0}input,select,textarea,button{font-family:'Syne',sans-serif}`}</style>

      <div style={{ background: "#fff", padding: "13px 16px 10px", borderBottom: "1px solid #f0f0f0", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ color: PINK, fontWeight: 800, fontSize: 19, letterSpacing: "-.5px" }}>BASS</span>
            <span style={{ color: DARK, fontWeight: 800, fontSize: 19, letterSpacing: "-.5px" }}>FLOW</span>
            <span style={{ fontSize: 9, color: PINK, marginLeft: 6, fontWeight: 800 }}>{VERSION}</span>
          </div>
          <div style={{ fontSize: 9, color: "#bbb", fontWeight: 700 }}>{today}</div>
        </div>
      </div>

      <div style={{ paddingBottom: 85, overflowY: "auto", height: "calc(100vh - 105px)" }}>

        {tab === "home" && (
          <div style={{ padding: 14 }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 24, color: DARK }}>BASS FLOW 🎸</div>
              <div style={{ fontSize: 11, color: "#bbb" }}>Bibliotheek & voortgang</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 20 }}>
              {[["Oefeningen", exercises.length], ["Sessies", totalSessions], ["Modules", modules.length]].map(([l, v]) => (
                <div key={l} style={{ background: "#fff", borderRadius: 11, padding: "12px 6px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
                  <div style={{ fontWeight: 800, fontSize: 22, color: PINK }}>{v}</div>
                  <div style={{ fontSize: 9, color: "#999", fontWeight: 700 }}>{l}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: DARK, marginBottom: 10 }}>Recente oefeningen</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {exercises.slice(0, 3).map(ex => (
                  <ExerciseCard key={ex.id} ex={ex} modules={modules} onSession={setSessionEx} onView={setViewEx} onEdit={setEditExercise} onDelete={handleDelete} />
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "exercises" && (
          <div style={{ padding: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: DARK, marginBottom: 12 }}>Mijn Bibliotheek</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {exercises.map(ex => (
                <ExerciseCard key={ex.id} ex={ex} modules={modules} onSession={setSessionEx} onView={setViewEx} onEdit={setEditExercise} onDelete={handleDelete} />
              ))}
            </div>
          </div>
        )}

        {tab === "progress" && (
          <div style={{ padding: 14 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: DARK, marginBottom: 14 }}>Mijn Statistieken</div>
            {exercises.map(ex => {
              const maxBpm = ex.sessions?.reduce((m, s) => Math.max(m, s.bpm), 0) || 0;
              return (
                <div key={ex.id} style={{ background: "#fff", borderRadius: 12, padding: 13, marginBottom: 9, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                  <div style={{ fontWeight: 800, fontSize: 12, color: DARK, marginBottom: 8 }}>{ex.title}</div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 11 }}>Max BPM: <strong style={{color: PINK}}>{maxBpm || ex.bpm}</strong></div>
                    <div style={{ fontSize: 11 }}>Sessies: <strong>{ex.sessions?.length || 0}</strong></div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 390, background: "#fff", borderTop: "1px solid #f0f0f0", display: "flex", padding: "8px 0 15px", zIndex: 20 }}>
        {[
          { id: "home", icon: "🏠", label: "Home" },
          { id: "exercises", icon: "🎵", label: "Bibliotheek" },
          { id: "import_btn", icon: "⬆", label: "Import", action: () => setShowImport(true) },
          { id: "progress", icon: "📈", label: "Stats" },
        ].map(({ id, icon, label, action }) => (
          <button key={id} onClick={action || (() => setTab(id))} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, background: "none", border: "none", cursor: "pointer", color: (!action && tab === id) ? PINK : "#bbb" }}>
            {id === "import_btn"
              ? <div style={{ width: 42, height: 42, background: PINK, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, boxShadow: `0 4px 12px ${PINK}55`, marginTop: -15, color: "#fff" }}>+</div>
              : <span style={{ fontSize: 20 }}>{icon}</span>
            }
            <span style={{ fontSize: 9, fontWeight: 800 }}>{label}</span>
          </button>
        ))}
      </div>

      {showImport && <EditModal modules={modules} onClose={() => setShowImport(false)} />}
      {editExercise && <EditModal exercise={editExercise} modules={modules} onClose={() => setEditExercise(null)} />}
      {sessionEx && <SessionModal exercise={sessionEx} onClose={() => setSessionEx(null)} />}
      {viewEx && <TabView ex={viewEx} onClose={() => setViewEx(null)} onAddMp3={url => handleAddMp3(viewEx.id, url)} onAddPages={pages => handleAddPages(viewEx.id, pages)} />}
    </div>
  );
}
