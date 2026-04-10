import { useState, useEffect, useRef } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase.js";

const PINK = "#FF2D7A";
const PINK_LIGHT = "#FFE0EE";
const DARK = "#1A1A1A";
const BG = "#F5F4F0";

const MODULES = [
  { id: "mod1", name: "Fundamenten", level: "Beginner", color: PINK },
  { id: "mod2", name: "Groove & Ritme", level: "Beginner", color: PINK },
  { id: "mod3", name: "Muting & Articulatie", level: "Intermediate", color: "#FF8C00" },
  { id: "mod4", name: "Slap Bass", level: "Advanced", color: "#8B2FC9" },
];

function useOrientation() {
  const [landscape, setLandscape] = useState(window.innerWidth > window.innerHeight);
  useEffect(function() {
    function check() {
      setTimeout(function() {
        setLandscape(window.innerWidth > window.innerHeight);
      }, 150);
    }
    const interval = setInterval(function() {
      const isLandscape = window.innerWidth > window.innerHeight;
      setLandscape(function(prev) { return prev !== isLandscape ? isLandscape : prev; });
    }, 300);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", check);
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return function() {
      clearInterval(interval);
      if (window.visualViewport) window.visualViewport.removeEventListener("resize", check);
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);
  return landscape;
}

function verwerkFoto(file, drempel) {
  return new Promise(function(resolve) {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = function() {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      for (var i = 0; i < data.length; i += 4) {
        const helderheid = (data[i] + data[i+1] + data[i+2]) / 3;
        if (helderheid < drempel) {
          data[i] = 0; data[i+1] = 0; data[i+2] = 0;
        } else {
          data[i] = 255; data[i+1] = 255; data[i+2] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      canvas.toBlob(function(blob) {
        URL.revokeObjectURL(url);
        resolve(blob);
      }, "image/jpeg", 0.92);
    };
    img.src = url;
  });
}

async function analyseerMetClaude(fotoUrls, oefeningTitel) {
  const messages = [];
  const content = [];

  content.push({
    type: "text",
    text: "Je bent een ervaren muziekleraar gespecialiseerd in basgitaar. Analyseer de volgende tablature/notenbalk foto's van de oefening '" + oefeningTitel + "'. Geef een volledige Nederlandse analyse met:\n\n1. BESCHRIJVING: Wat staat er in de oefening (noten, akkoorden, ritme, tempo)\n2. TABLATURE: Beschrijf de noten per snaar (E, A, D, G) met fret nummers\n3. NOTENBALK: Beschrijf de noten in standaard notatie als die aanwezig is\n4. OEFENTIPS: Specifieke tips voor de bassist\n5. MOEILIJKHEIDSGRAAD: Beoordeling en aandachtspunten\n\nAls er tekst in een andere taal staat, vertaal die naar Nederlands. Wees concreet en praktisch."
  });

  for (var i = 0; i < fotoUrls.length; i++) {
    content.push({
      type: "image",
      source: {
        type: "url",
        url: fotoUrls[i]
      }
    });
  }

  messages.push({ role: "user", content: content });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: messages
    })
  });

  const data = await response.json();
  const tekst = data.content.filter(function(c) { return c.type === "text"; }).map(function(c) { return c.text; }).join("\n");
  return tekst;
}

function Badge({ level }) {
  const colors = {
    Beginner: [PINK_LIGHT, PINK],
    Intermediate: ["#FFF0E0", "#FF8C00"],
    Advanced: ["#F0E8FF", "#8B2FC9"]
  };
  const c = colors[level] || colors.Beginner;
  return (
    <span style={{ background: c[0], color: c[1], fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, textTransform: "uppercase" }}>
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
    return x + "," + y;
  }).join(" ");
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 9, color: "#bbb", marginBottom: 4 }}>BPM PROGRESSIE</div>
      <svg width={breedte} height={hoogte} style={{ overflow: "visible" }}>
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

function SessieRij({ sessie, onVerwijder, onBewerk }) {
  const [swipeX, setSwipeX] = useState(0);
  const [bewerken, setBewerken] = useState(false);
  const [bpm, setBpm] = useState(sessie.bpm);
  const [notitie, setNotitie] = useState(sessie.notitie || "");
  const touchStartX = useRef(null);
  const DREMPEL = 112;

  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchMove(e) {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.touches[0].clientX;
    if (diff > 0) setSwipeX(Math.min(diff, DREMPEL));
  }
  function handleTouchEnd() {
    if (swipeX > DREMPEL * 0.5) { setSwipeX(DREMPEL); }
    else { setSwipeX(0); }
    touchStartX.current = null;
  }

  function handleSlaOp() {
    onBewerk(sessie.id, { bpm: bpm, notitie: notitie });
    setBewerken(false);
    setSwipeX(0);
  }

  if (bewerken) {
    return (
      <div style={{ background: "#fff", borderRadius: 11, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", marginBottom: 7 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: "#999" }}>{new Date(sessie.datum).toLocaleDateString("nl-NL")}</span>
          <button onClick={function() { setBewerken(false); setSwipeX(0); }}
            style={{ background: "#f0f0f0", border: "none", borderRadius: 8, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
            <label style={{ fontSize: 10, fontWeight: 700, color: "#888" }}>TEMPO</label>
            <span style={{ fontSize: 11, fontWeight: 800, color: PINK }}>{bpm} BPM</span>
          </div>
          <input type="range" min={40} max={240} value={bpm} onChange={function(e) { setBpm(Number(e.target.value)); }} style={{ width: "100%", accentColor: PINK }} />
        </div>
        <textarea value={notitie} onChange={function(e) { setNotitie(e.target.value); }}
          placeholder="Notitie..." rows={2}
          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #eee", fontSize: 12, outline: "none", resize: "none", boxSizing: "border-box", marginBottom: 8 }} />
        <button onClick={handleSlaOp}
          style={{ width: "100%", background: PINK, color: "#fff", border: "none", borderRadius: 10, padding: "9px", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
          Opslaan
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 11, marginBottom: 7 }}>
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, display: "flex" }}>
        <button onClick={function() { setBewerken(true); }}
          style={{ background: "#FF8C00", border: "none", width: 56, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 2 }}>
          <span style={{ fontSize: 16 }}>✏️</span>
          <span style={{ fontSize: 8, color: "#fff", fontWeight: 700 }}>bewerk</span>
        </button>
        <button onClick={function() { onVerwijder(sessie.id); }}
          style={{ background: "#E53935", border: "none", width: 56, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", gap: 2, borderRadius: "0 11px 11px 0" }}>
          <span style={{ fontSize: 16 }}>🗑️</span>
          <span style={{ fontSize: 8, color: "#fff", fontWeight: 700 }}>wis</span>
        </button>
      </div>
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ background: "#fff", borderRadius: 11, padding: "10px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", transform: "translateX(-" + swipeX + "px)", transition: touchStartX.current ? "none" : "transform 0.2s", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#999" }}>{new Date(sessie.datum).toLocaleDateString("nl-NL")}</span>
          <span style={{ fontWeight: 700, color: PINK, fontSize: 13 }}>{sessie.bpm} BPM</span>
        </div>
        {sessie.notitie ? <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>{sessie.notitie}</div> : null}
      </div>
    </div>
  );
}

function SessieFormulier({ oefening, onSave, onClose }) {
  const [bpm, setBpm] = useState(oefening.bpm);
  const [notitie, setNotitie] = useState("");
  const maxBpm = (oefening.sessies || []).reduce(function(m, s) { return Math.max(m, s.bpm); }, 0);

  function handleSave() {
    onSave({ id: Date.now(), bpm: bpm, notitie: notitie, datum: new Date().toISOString() });
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 400, display: "flex", alignItems: "flex-end" }}
      onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: "18px 18px 0 0", width: "100%", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: DARK }}>Sessie loggen</div>
          <button onClick={onClose} style={{ background: "#f0f0f0", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "#999", marginBottom: 16 }}>{oefening.titel}</div>
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
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>NOTITIE</label>
          <textarea value={notitie} onChange={function(e) { setNotitie(e.target.value); }} placeholder="Wat ging goed?" rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 13, outline: "none", resize: "none", boxSizing: "border-box" }} />
        </div>
        <button onClick={handleSave} style={{ width: "100%", background: PINK, color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
          Sessie opslaan
        </button>
      </div>
    </div>
  );
}

function TablatureViewer({ fotos, fotoIndex, setFotoIndex }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const touchStart = useRef(null);
  const lastDistance = useRef(null);
  const dragStart = useRef(null);

  function getDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function resetZoom() { setZoom(1); setOffset({ x: 0, y: 0 }); }

  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      lastDistance.current = getDistance(e.touches);
    } else if (e.touches.length === 1) {
      if (zoom > 1) {
        dragStart.current = { x: e.touches[0].clientX - offset.x, y: e.touches[0].clientY - offset.y };
      } else {
        touchStart.current = e.touches[0].clientX;
      }
    }
  }

  function handleTouchMove(e) {
    e.preventDefault();
    if (e.touches.length === 2) {
      const dist = getDistance(e.touches);
      if (lastDistance.current) {
        const ratio = dist / lastDistance.current;
        setZoom(function(z) { return Math.min(4, Math.max(1, z * ratio)); });
        lastDistance.current = dist;
      }
    } else if (e.touches.length === 1 && zoom > 1 && dragStart.current) {
      setOffset({
        x: e.touches[0].clientX - dragStart.current.x,
        y: e.touches[0].clientY - dragStart.current.y
      });
    }
  }

  function handleTouchEnd(e) {
    lastDistance.current = null;
    dragStart.current = null;
    if (zoom <= 1 && touchStart.current !== null && e.changedTouches.length === 1) {
      const diff = touchStart.current - e.changedTouches[0].clientX;
      if (diff > 50 && fotoIndex < fotos.length - 1) { setFotoIndex(function(p) { return p + 1; }); resetZoom(); }
      if (diff < -50 && fotoIndex > 0) { setFotoIndex(function(p) { return p - 1; }); resetZoom(); }
      touchStart.current = null;
    }
  }

  if (fotos.length === 0) {
    return (
      <div style={{ flex: 1, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "#ccc" }}>
        <div style={{ fontSize: 36, marginBottom: 8 }}>🎸</div>
        <div style={{ fontSize: 13, color: "#bbb" }}>Geen tablature</div>
        <div style={{ fontSize: 10, marginTop: 4, color: "#ddd" }}>Voeg toe via bewerken</div>
      </div>
    );
  }

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ flex: 1, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", touchAction: "none", position: "relative" }}>
      <img src={fotos[fotoIndex]} alt="tablature"
        style={{
          width: "100%", height: "100%", objectFit: "contain",
          transform: "scale(" + zoom + ") translate(" + offset.x / zoom + "px, " + offset.y / zoom + "px)",
          transformOrigin: "center center",
          transition: zoom === 1 ? "transform 0.2s" : "none",
          userSelect: "none", WebkitUserSelect: "none"
        }} />
      {fotos.length > 1 ? (
        <div style={{ position: "absolute", top: 10, right: 12, background: "rgba(0,0,0,0.12)", color: "#333", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>
          {fotoIndex + 1}/{fotos.length}
        </div>
      ) : null}
      {zoom > 1 ? (
        <div style={{ position: "absolute", top: 10, left: 12, display: "flex", gap: 6 }}>
          <div style={{ background: "rgba(0,0,0,0.12)", color: "#333", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10 }}>
            {Math.round(zoom * 100)}%
          </div>
          <button onClick={resetZoom} style={{ background: PINK, color: "#fff", border: "none", borderRadius: 10, padding: "2px 8px", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>reset</button>
        </div>
      ) : null}
      {fotos.length > 1 ? (
        <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
          {fotos.map(function(_, i) {
            return <div key={i} onClick={function() { setFotoIndex(i); resetZoom(); }}
              style={{ width: i === fotoIndex ? 18 : 6, height: 6, borderRadius: 3, background: i === fotoIndex ? PINK : "rgba(0,0,0,0.2)", cursor: "pointer", transition: "all .2s" }} />;
          })}
        </div>
      ) : null}
    </div>
  );
}

function DetailScherm({ oefening, onClose, onEdit, onSessieAdd, onSessieUpdate, onSessieVerwijder, onInfoUpdate }) {
  const mod = MODULES.find(function(m) { return m.id === oefening.moduleId; });
  const [showSessie, setShowSessie] = useState(false);
  const [sessiesUitgeklapt, setSessiesUitgeklapt] = useState(false);
  const [fotoIndex, setFotoIndex] = useState(0);
  const [tempo, setTempo] = useState(oefening.bpm);
  const [info, setInfo] = useState(oefening.info || "");
  const [infoOpslaan, setInfoOpslaan] = useState(false);
  const landscape = useOrientation();
  const maxBpm = (oefening.sessies || []).reduce(function(m, s) { return Math.max(m, s.bpm); }, 0);
  const fotos = oefening.fotos || [];
  const aantalSessies = (oefening.sessies || []).length;
  const audioUrl = oefening.audioUrl || null;

  async function handleInfoOpslaan() {
    setInfoOpslaan(true);
    await onInfoUpdate(oefening.id, info);
    setInfoOpslaan(false);
  }

  if (landscape) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 200, display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>
        <TablatureViewer fotos={fotos} fotoIndex={fotoIndex} setFotoIndex={setFotoIndex} />
        <div style={{ background: "#f2f2f2", borderTop: "1px solid #ddd", padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", minWidth: 36 }}>
            <span style={{ fontSize: 18 }}>❓</span>
            <span style={{ fontSize: 8, color: "#666", fontWeight: 600 }}>Help</span>
          </div>
          <div style={{ width: 1, height: 32, background: "#ddd" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", minWidth: 52 }}>
            <span style={{ fontSize: 16 }}>🎵</span>
            <span style={{ fontSize: 8, color: "#666", fontWeight: 600 }}>Audio</span>
          </div>
          <div style={{ flex: 1 }} />
          <button style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#555", padding: "0 6px" }}>◀</button>
          <button style={{ width: 44, height: 44, background: PINK, border: "none", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <span style={{ color: "#fff", fontSize: 18, marginLeft: 3 }}>▶</span>
          </button>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", minWidth: 44 }}>
            <span style={{ fontSize: 18 }}>🎙</span>
            <span style={{ fontSize: 8, color: "#666", fontWeight: 600 }}>Record</span>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1, minWidth: 36 }}>
            <span style={{ fontSize: 16 }}>🎚</span>
            <span style={{ fontSize: 8, color: "#666", fontWeight: 600 }}>Tempo</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button onClick={function() { setTempo(function(t) { return Math.max(40, t - 1); }); }}
              style={{ background: "none", border: "none", color: "#333", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>−</button>
            <div style={{ textAlign: "center", minWidth: 42 }}>
              <span style={{ color: PINK, fontWeight: 800, fontSize: 17 }}>{tempo}</span>
            </div>
            <button onClick={function() { setTempo(function(t) { return Math.min(240, t + 1); }); }}
              style={{ background: "none", border: "none", color: "#333", fontSize: 20, cursor: "pointer", padding: "0 4px" }}>+</button>
          </div>
          <div style={{ width: 1, height: 32, background: "#ddd" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, cursor: "pointer", minWidth: 36 }}>
            <span style={{ fontSize: 18 }}>↩</span>
            <span style={{ fontSize: 8, color: "#666", fontWeight: 600 }}>Loop</span>
          </div>
          <div style={{ width: 1, height: 32, background: "#ddd" }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#555", fontSize: 11, fontWeight: 700, cursor: "pointer", padding: "0 4px" }}>✕</button>
          <button onClick={function() { onEdit(oefening); onClose(); }}
            style={{ background: PINK, border: "none", borderRadius: 16, padding: "5px 12px", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
            bewerk
          </button>
        </div>
        {showSessie ? (
          <SessieFormulier oefening={oefening} onSave={function(sessie) { onSessieAdd(oefening.id, sessie); }} onClose={function() { setShowSessie(false); }} />
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 200, display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", gap: 10, background: "#fff", borderBottom: "1px solid #eee", flexShrink: 0 }}>
        <button onClick={onClose} style={{ background: "#f0f0f0", border: "none", borderRadius: 20, padding: "5px 12px", color: DARK, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>← terug</button>
        <div style={{ flex: 1, fontWeight: 800, fontSize: 14, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{oefening.titel}</div>
        <button onClick={function() { onEdit(oefening); onClose(); }}
          style={{ background: PINK, color: "#fff", border: "none", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          bewerk
        </button>
      </div>

      <div style={{ width: "100%", aspectRatio: "16/7", flexShrink: 0, borderBottom: "1px solid #eee", display: "flex" }}>
        <TablatureViewer fotos={fotos} fotoIndex={fotoIndex} setFotoIndex={setFotoIndex} />
      </div>

      {audioUrl ? (
        <div style={{ background: "#fff", borderBottom: "1px solid #eee", padding: "8px 14px", flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#999", marginBottom: 4 }}>AUDIO</div>
          <audio controls src={audioUrl} style={{ width: "100%", height: 32, accentColor: PINK }} />
        </div>
      ) : null}

      <div style={{ flex: 1, overflowY: "auto", background: BG }}>
        <div style={{ padding: "12px 14px 0" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            {mod ? <Badge level={mod.level} /> : null}
            <span style={{ fontSize: 11, color: "#999" }}>{mod ? mod.name : ""}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[["Doel BPM", oefening.bpm, PINK], ["Max BPM", maxBpm || "-", "#00B84C"], ["Sessies", aantalSessies, "#FF8C00"]].map(function(item) {
              return (
                <div key={item[0]} style={{ background: "#fff", borderRadius: 10, padding: "10px 6px", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div style={{ fontWeight: 800, fontSize: 20, color: item[2] }}>{item[1]}</div>
                  <div style={{ fontSize: 9, color: "#999" }}>{item[0]}</div>
                </div>
              );
            })}
          </div>
          <BpmGrafiek sessies={oefening.sessies} />
        </div>

        <div style={{ padding: "12px 14px 0" }}>
          <div onClick={function() { setSessiesUitgeklapt(function(v) { return !v; }); }}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", borderRadius: sessiesUitgeklapt ? "12px 12px 0 0" : 12, padding: "12px 14px", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: DARK }}>
              Sessies
              {aantalSessies > 0 ? <span style={{ marginLeft: 8, background: PINK_LIGHT, color: PINK, fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 10 }}>{aantalSessies}</span> : null}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={function(e) { e.stopPropagation(); setShowSessie(true); }}
                style={{ background: PINK, color: "#fff", border: "none", borderRadius: 10, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                + Sessie
              </button>
              <span style={{ color: "#bbb", fontSize: 14 }}>{sessiesUitgeklapt ? "▲" : "▼"}</span>
            </div>
          </div>
          {sessiesUitgeklapt ? (
            <div style={{ background: BG, borderRadius: "0 0 12px 12px", padding: "8px 0 4px", boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}>
              {aantalSessies === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: "#bbb", fontSize: 12 }}>Nog geen sessies.</div>
              ) : (
                oefening.sessies.slice().reverse().map(function(s) {
                  return (
                    <SessieRij key={s.id} sessie={s}
                      onVerwijder={function(id) { onSessieVerwijder(oefening.id, id); }}
                      onBewerk={function(id, data) { onSessieUpdate(oefening.id, id, data); }} />
                  );
                })
              )}
            </div>
          ) : null}
        </div>

        <div style={{ padding: "12px 14px 24px" }}>
          <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ padding: "12px 14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: DARK }}>Info</div>
              {info !== (oefening.info || "") ? (
                <button onClick={handleInfoOpslaan}
                  style={{ background: PINK, color: "#fff", border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {infoOpslaan ? "..." : "Opslaan"}
                </button>
              ) : null}
            </div>
            <textarea value={info} onChange={function(e) { setInfo(e.target.value); }}
              placeholder="Voeg notities toe over deze oefening..."
              rows={6}
              style={{ width: "100%", padding: "0 14px 14px", border: "none", outline: "none", fontSize: 13, color: DARK, resize: "none", boxSizing: "border-box", background: "transparent", lineHeight: 1.6 }} />
          </div>
        </div>
      </div>

      {showSessie ? (
        <SessieFormulier oefening={oefening} onSave={function(sessie) { onSessieAdd(oefening.id, sessie); }} onClose={function() { setShowSessie(false); }} />
      ) : null}
    </div>
  );
}

function ModuleScherm({ module, oefeningen, onClose, onOpen, onEdit, onDelete }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 150, display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", padding: "13px 16px", borderBottom: "1px solid #eee", gap: 10, borderTop: "3px solid " + module.color }}>
        <button onClick={onClose} style={{ background: "#f0f0f0", border: "none", borderRadius: "50%", width: 32, height: 32, cursor: "pointer", fontWeight: 800 }}>terug</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: DARK }}>{module.name}</div>
          <Badge level={module.level} />
        </div>
        <div style={{ fontWeight: 800, color: module.color, fontSize: 18 }}>{oefeningen.length}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {oefeningen.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 40 }}>🎸</div>
            <div style={{ color: "#bbb", marginTop: 8, fontSize: 12 }}>Geen oefeningen in deze module.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
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
  const [titel, setTitel] = useState(oefening ? oefening.titel : "");
  const [moduleId, setModuleId] = useState(oefening ? oefening.moduleId : "mod1");
  const [bpm, setBpm] = useState(oefening ? oefening.bpm : 100);
  const [opslaan, setOpslaan] = useState(false);
  const [fotos, setFotos] = useState(oefening ? (oefening.fotos || []) : []);
  const [uploading, setUploading] = useState(false);
  const [verwerkStatus, setVerwerkStatus] = useState({});
  const [audioUploading, setAudioUploading] = useState(false);
  const [audioUrl, setAudioUrl] = useState(oefening ? (oefening.audioUrl || "") : "");
  const [drempel, setDrempel] = useState(160);
  const [analyseBezig, setAnalyseBezig] = useState(false);
  const [analyseStatus, setAnalyseStatus] = useState("");
  const invoerRef = useRef();
  const audioRef = useRef();

  async function handleFotoKies(e) {
    if (!oefening) return;
    const bestanden = Array.from(e.target.files);
    setUploading(true);
    const nieuweFotos = [...fotos];
    for (var i = 0; i < bestanden.length; i++) {
      var pad = "fotos/" + oefening.id + "/" + Date.now() + "_" + i + ".jpg";
      var storageRef = ref(storage, pad);
      await uploadBytes(storageRef, bestanden[i]);
      var url = await getDownloadURL(storageRef);
      nieuweFotos.push(url);
    }
    setFotos(nieuweFotos);
    await updateDoc(doc(db, "oefeningen", oefening.id), { fotos: nieuweFotos });
    setUploading(false);
  }

  async function handleVerwerk(index) {
    if (!oefening) return;
    setVerwerkStatus(function(prev) { return Object.assign({}, prev, { [index]: "bezig" }); });
    try {
      const response = await fetch(fotos[index]);
      const blob = await response.blob();
      const file = new File([blob], "foto.jpg", { type: "image/jpeg" });
      const verwerktBlob = await verwerkFoto(file, drempel);
      const pad = "fotos/" + oefening.id + "/clean_" + Date.now() + "_" + index + ".jpg";
      const storageRef = ref(storage, pad);
      await uploadBytes(storageRef, verwerktBlob);
      const nieuweUrl = await getDownloadURL(storageRef);
      const nieuweFotos = fotos.map(function(f, i) { return i === index ? nieuweUrl : f; });
      setFotos(nieuweFotos);
      await updateDoc(doc(db, "oefeningen", oefening.id), { fotos: nieuweFotos });
      setVerwerkStatus(function(prev) { return Object.assign({}, prev, { [index]: "klaar" }); });
    } catch (err) {
      setVerwerkStatus(function(prev) { return Object.assign({}, prev, { [index]: "fout" }); });
    }
  }

  function handleVerwijder(index) {
    const nieuweFotos = fotos.filter(function(_, i) { return i !== index; });
    setFotos(nieuweFotos);
    if (oefening) updateDoc(doc(db, "oefeningen", oefening.id), { fotos: nieuweFotos });
  }

  function handleVerschuif(index, richting) {
    const nieuweFotos = [...fotos];
    const naar = index + richting;
    if (naar < 0 || naar >= nieuweFotos.length) return;
    [nieuweFotos[index], nieuweFotos[naar]] = [nieuweFotos[naar], nieuweFotos[index]];
    setFotos(nieuweFotos);
    if (oefening) updateDoc(doc(db, "oefeningen", oefening.id), { fotos: nieuweFotos });
  }

  async function handleAudioKies(e) {
    if (!oefening) return;
    const bestand = e.target.files[0];
    if (!bestand) return;
    setAudioUploading(true);
    const pad = "audio/" + oefening.id + "/" + Date.now() + "_" + bestand.name;
    const storageRef = ref(storage, pad);
    await uploadBytes(storageRef, bestand);
    const url = await getDownloadURL(storageRef);
    setAudioUrl(url);
    await updateDoc(doc(db, "oefeningen", oefening.id), { audioUrl: url });
    setAudioUploading(false);
  }

  async function handleAnalyseer() {
    if (!oefening || fotos.length === 0) return;
    setAnalyseBezig(true);
    setAnalyseStatus("Bezig met analyseren van " + fotos.length + " foto" + (fotos.length > 1 ? "'s" : "") + "...");
    try {
      const analyse = await analyseerMetClaude(fotos, titel);
      await updateDoc(doc(db, "oefeningen", oefening.id), { info: analyse });
      setAnalyseStatus("✓ Analyse opgeslagen in Info blok!");
      setTimeout(function() { setAnalyseStatus(""); }, 3000);
    } catch (err) {
      setAnalyseStatus("Fout bij analyse. Probeer opnieuw.");
    }
    setAnalyseBezig(false);
  }

  async function handleSave() {
    if (!titel.trim()) return;
    setOpslaan(true);
    const data = {
      titel: titel, moduleId: moduleId, bpm: bpm, fotos: fotos,
      sessies: oefening ? (oefening.sessies || []) : [],
      info: oefening ? (oefening.info || "") : "",
      audioUrl: audioUrl,
      datum: oefening ? oefening.datum : new Date().toISOString(),
      bijgewerkt: new Date().toISOString()
    };
    await onSave(oefening ? oefening.id : null, data);
    setOpslaan(false);
    onClose();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "flex-end" }}
      onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: "#fff", borderRadius: "18px 18px 0 0", width: "100%", maxHeight: "92vh", overflowY: "auto", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 17, color: DARK }}>{isNieuw ? "Nieuwe oefening" : "Bewerken"}</div>
          <button onClick={onClose} style={{ background: "#f0f0f0", border: "none", borderRadius: "50%", width: 30, height: 30, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>TITEL</label>
          <input value={titel} onChange={function(e) { setTitel(e.target.value); }} placeholder="Naam van de oefening"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>MODULE</label>
          <select value={moduleId} onChange={function(e) { setModuleId(e.target.value); }}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1.5px solid #eee", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" }}>
            {MODULES.map(function(m) { return <option key={m.id} value={m.id}>{m.name}</option>; })}
          </select>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>TEMPO</label>
            <span style={{ fontWeight: 800, color: PINK, fontSize: 13 }}>{bpm} BPM</span>
          </div>
          <input type="range" min={40} max={240} value={bpm} onChange={function(e) { setBpm(Number(e.target.value)); }} style={{ width: "100%", accentColor: PINK }} />
        </div>

        {!isNieuw ? (
          <>
            {/* Tablature foto's */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>TABLATURE FOTO'S</label>
                <button onClick={function() { invoerRef.current.click(); }}
                  style={{ background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {uploading ? "Uploaden..." : "+ Foto"}
                </button>
                <input ref={invoerRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFotoKies} />
              </div>

              {fotos.length > 0 ? (
                <div style={{ marginBottom: 10, background: "#fafafa", borderRadius: 10, padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#888" }}>CONTRAST DREMPEL</label>
                    <span style={{ fontSize: 10, fontWeight: 800, color: PINK }}>{drempel}</span>
                  </div>
                  <input type="range" min={50} max={220} value={drempel}
                    onChange={function(e) { setDrempel(Number(e.target.value)); }}
                    style={{ width: "100%", accentColor: PINK }} />
                  <div style={{ fontSize: 9, color: "#bbb", marginTop: 2 }}>Lager = meer zwart · Hoger = meer wit</div>
                </div>
              ) : null}

              {/* AI Analyse knop */}
              {fotos.length > 0 ? (
                <div style={{ marginBottom: 10 }}>
                  <button onClick={handleAnalyseer} disabled={analyseBezig}
                    style={{ width: "100%", background: analyseBezig ? "#eee" : "#8B2FC9", color: analyseBezig ? "#bbb" : "#fff", border: "none", borderRadius: 10, padding: "11px", fontSize: 12, fontWeight: 800, cursor: analyseBezig ? "default" : "pointer" }}>
                    {analyseBezig ? "🤖 Analyseren..." : "🤖 Analyseer alle foto's met AI"}
                  </button>
                  {analyseStatus ? (
                    <div style={{ marginTop: 6, fontSize: 11, color: analyseStatus.startsWith("✓") ? "#00B84C" : analyseStatus.startsWith("Fout") ? "#E53935" : "#888", textAlign: "center", fontWeight: 600 }}>
                      {analyseStatus}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {fotos.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, background: "#fafafa", borderRadius: 10, border: "2px dashed #eee", color: "#bbb", fontSize: 12 }}>
                  Nog geen foto's
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {fotos.map(function(foto, i) {
                    const status = verwerkStatus[i];
                    return (
                      <div key={i} style={{ background: "#fafafa", borderRadius: 10, padding: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <img src={foto} alt={"foto " + (i + 1)} style={{ width: 56, height: 40, objectFit: "cover", borderRadius: 7, flexShrink: 0 }} />
                          <div style={{ flex: 1, fontSize: 11, color: "#999" }}>Foto {i + 1}</div>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={function() { handleVerschuif(i, -1); }} disabled={i === 0}
                              style={{ background: i === 0 ? "#eee" : "#f0f0f0", border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 12, cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#ccc" : "#666" }}>↑</button>
                            <button onClick={function() { handleVerschuif(i, 1); }} disabled={i === fotos.length - 1}
                              style={{ background: i === fotos.length - 1 ? "#eee" : "#f0f0f0", border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 12, cursor: i === fotos.length - 1 ? "default" : "pointer", color: i === fotos.length - 1 ? "#ccc" : "#666" }}>↓</button>
                            <button onClick={function() { handleVerwijder(i); }}
                              style={{ background: "#FFF0F0", color: "#E53935", border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 12, cursor: "pointer" }}>✕</button>
                          </div>
                        </div>
                        <button onClick={function() { handleVerwerk(i); }} disabled={status === "bezig"}
                          style={{ marginTop: 6, width: "100%", background: status === "klaar" ? "#00B84C" : status === "bezig" ? "#eee" : PINK_LIGHT, color: status === "klaar" ? "#fff" : status === "bezig" ? "#bbb" : PINK, border: "none", borderRadius: 8, padding: "6px", fontSize: 11, fontWeight: 700, cursor: status === "bezig" ? "default" : "pointer" }}>
                          {status === "bezig" ? "Bezig..." : status === "klaar" ? "✓ Clean gemaakt" : status === "fout" ? "Fout -- opnieuw?" : "🪄 Maak clean"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Audio */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>AUDIO</label>
                <button onClick={function() { audioRef.current.click(); }}
                  style={{ background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  {audioUploading ? "Uploaden..." : audioUrl ? "Vervang" : "+ Audio"}
                </button>
                <input ref={audioRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={handleAudioKies} />
              </div>
              {audioUrl ? (
                <div style={{ background: "#fafafa", borderRadius: 10, padding: 10 }}>
                  <audio controls src={audioUrl} style={{ width: "100%", height: 32 }} />
                  <button onClick={function() { setAudioUrl(""); updateDoc(doc(db, "oefeningen", oefening.id), { audioUrl: "" }); }}
                    style={{ marginTop: 6, background: "#FFF0F0", color: "#E53935", border: "none", borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer", width: "100%" }}>
                    Audio verwijderen
                  </button>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: 16, background: "#fafafa", borderRadius: 10, border: "2px dashed #eee", color: "#bbb", fontSize: 12 }}>
                  Geen audio gekoppeld
                </div>
              )}
            </div>
          </>
        ) : null}

        <button onClick={handleSave} disabled={opslaan}
          style={{ width: "100%", background: opslaan ? "#ccc" : PINK, color: "#fff", border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 800, cursor: opslaan ? "default" : "pointer" }}>
          {opslaan ? "Opslaan..." : (isNieuw ? "Opslaan" : "Wijzigingen opslaan")}
        </button>
      </div>
    </div>
  );
}

function OefeningKaart({ oefening, onOpen, onEdit, onDelete }) {
  const mod = MODULES.find(function(m) { return m.id === oefening.moduleId; });
  const fotos = oefening.fotos || [];
  const [bevestig, setBevestig] = useState(false);

  return (
    <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 8px rgba(0,0,0,0.06)", overflow: "hidden" }}>
      {fotos.length > 0 ? (
        <img src={fotos[0]} alt="tab" onClick={function() { onOpen(oefening); }}
          style={{ width: "100%", height: 100, objectFit: "cover", cursor: "pointer", display: "block" }} />
      ) : null}
      <div style={{ padding: 13 }}>
        <div onClick={function() { onOpen(oefening); }} style={{ cursor: "pointer", marginBottom: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: DARK, marginBottom: 4 }}>
            {oefening.titel}
            {fotos.length > 1 ? <span style={{ fontSize: 10, color: PINK, fontWeight: 700, marginLeft: 6, background: PINK_LIGHT, padding: "1px 6px", borderRadius: 8 }}>{fotos.length} fotos</span> : null}
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {mod ? <Badge level={mod.level} /> : null}
            <span style={{ fontSize: 10, color: "#bbb" }}>{mod ? mod.name : ""}</span>
            <span style={{ fontSize: 10, color: PINK, fontWeight: 700, marginLeft: "auto" }}>{oefening.bpm} BPM</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
          <button onClick={function() { onOpen(oefening); }} style={{ flex: 1, background: PINK_LIGHT, color: PINK, border: "none", borderRadius: 8, padding: "7px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>open</button>
          <button onClick={function() { onEdit(oefening); }} style={{ background: "#f4f4f4", color: "#666", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 11, cursor: "pointer" }}>bewerk</button>
          <button onClick={function() { setBevestig(true); }} style={{ background: "#FFF0F0", color: "#E53935", border: "none", borderRadius: 8, padding: "7px 10px", fontSize: 11, cursor: "pointer" }}>wis</button>
        </div>
        {bevestig ? (
          <div style={{ marginTop: 10, background: "#FFF5F5", borderRadius: 10, padding: 12, textAlign: "center", border: "1px solid #FFD0D0" }}>
            <div style={{ fontSize: 12, color: DARK, marginBottom: 8, fontWeight: 700 }}>Verwijderen?</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={function() { setBevestig(false); }} style={{ flex: 1, background: "#eee", border: "none", borderRadius: 8, padding: "7px", fontSize: 12, cursor: "pointer" }}>Annuleren</button>
              <button onClick={function() { onDelete(oefening.id); }} style={{ flex: 1, background: "#E53935", color: "#fff", border: "none", borderRadius: 8, padding: "7px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Verwijderen</button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("home");
  const [oefeningen, setOefeningen] = useState([]);
  const [laden, setLaden] = useState(true);
  const [showNieuw, setShowNieuw] = useState(false);
  const [bewerkOefening, setBewerkOefening] = useState(null);
  const [openOefening, setOpenOefening] = useState(null);
  const [openModule, setOpenModule] = useState(null);
  const today = new Date().toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" }).toUpperCase();

  useEffect(function() {
    const q = query(collection(db, "oefeningen"), orderBy("datum", "desc"));
    const stop = onSnapshot(q, function(snapshot) {
      const data = snapshot.docs.map(function(d) {
        return Object.assign({ id: d.id }, d.data());
      });
      setOefeningen(data);
      setLaden(false);
    });
    return stop;
  }, []);

  async function handleSave(id, data) {
    if (id) { await updateDoc(doc(db, "oefeningen", id), data); }
    else { await addDoc(collection(db, "oefeningen"), data); }
  }

  async function handleDelete(id) { await deleteDoc(doc(db, "oefeningen", id)); }

  async function handleSessieAdd(oefeningId, sessie) {
    const ex = oefeningen.find(function(e) { return e.id === oefeningId; });
    if (!ex) return;
    const nieuweSessies = (ex.sessies || []).concat([sessie]);
    await updateDoc(doc(db, "oefeningen", oefeningId), { sessies: nieuweSessies });
    setOpenOefening(function(prev) {
      if (!prev || prev.id !== oefeningId) return prev;
      return Object.assign({}, prev, { sessies: nieuweSessies });
    });
  }

  async function handleSessieUpdate(oefeningId, sessieId, data) {
    const ex = oefeningen.find(function(e) { return e.id === oefeningId; });
    if (!ex) return;
    const nieuweSessies = (ex.sessies || []).map(function(s) {
      return s.id === sessieId ? Object.assign({}, s, data) : s;
    });
    await updateDoc(doc(db, "oefeningen", oefeningId), { sessies: nieuweSessies });
    setOpenOefening(function(prev) {
      if (!prev || prev.id !== oefeningId) return prev;
      return Object.assign({}, prev, { sessies: nieuweSessies });
    });
  }

  async function handleSessieVerwijder(oefeningId, sessieId) {
    const ex = oefeningen.find(function(e) { return e.id === oefeningId; });
    if (!ex) return;
    const nieuweSessies = (ex.sessies || []).filter(function(s) { return s.id !== sessieId; });
    await updateDoc(doc(db, "oefeningen", oefeningId), { sessies: nieuweSessies });
    setOpenOefening(function(prev) {
      if (!prev || prev.id !== oefeningId) return prev;
      return Object.assign({}, prev, { sessies: nieuweSessies });
    });
  }

  async function handleInfoUpdate(oefeningId, info) {
    await updateDoc(doc(db, "oefeningen", oefeningId), { info: info });
    setOpenOefening(function(prev) {
      if (!prev || prev.id !== oefeningId) return prev;
      return Object.assign({}, prev, { info: info });
    });
  }

  const totalSessies = oefeningen.reduce(function(a, e) { return a + (e.sessies || []).length; }, 0);

  function renderKaarten(lijst) {
    if (laden) return <div style={{ textAlign: "center", padding: "40px 20px", color: "#bbb", fontSize: 12 }}>Laden...</div>;
    if (lijst.length === 0) {
      return (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 40 }}>🎸</div>
          <div style={{ color: "#bbb", marginTop: 8, fontSize: 11 }}>Nog geen oefeningen.</div>
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {lijst.map(function(ex) {
          return <OefeningKaart key={ex.id} oefening={ex} onOpen={setOpenOefening} onEdit={setBewerkOefening} onDelete={handleDelete} />;
        })}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 390, margin: "0 auto", minHeight: "100vh", background: BG, fontFamily: "sans-serif" }}>
      <div style={{ background: "#fff", padding: "13px 16px 10px", borderBottom: "1px solid #f0f0f0", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ color: PINK, fontWeight: 800, fontSize: 19 }}>BASS</span>
            <span style={{ color: DARK, fontWeight: 800, fontSize: 19 }}>FLOW</span>
            <span style={{ fontSize: 9, color: "#ccc", marginLeft: 6 }}>PRO v0.22</span>
          </div>
          <div style={{ fontSize: 9, color: "#bbb", fontWeight: 700 }}>{today}</div>
        </div>
      </div>

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
                <div style={{ fontSize: 40 }}>📈</div>
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
                <span style={{ fontSize: 17 }}>○</span>
              )}
              <span style={{ fontSize: 9, fontWeight: 700 }}>{item.label}</span>
            </button>
          );
        })}
      </div>

      {showNieuw ? <OefeningFormulier onSave={handleSave} onClose={function() { setShowNieuw(false); }} /> : null}
      {bewerkOefening ? <OefeningFormulier oefening={bewerkOefening} onSave={handleSave} onClose={function() { setBewerkOefening(null); }} /> : null}
      {openOefening ? <DetailScherm oefening={openOefening} onClose={function() { setOpenOefening(null); }} onEdit={setBewerkOefening} onSessieAdd={handleSessieAdd} onSessieUpdate={handleSessieUpdate} onSessieVerwijder={handleSessieVerwijder} onInfoUpdate={handleInfoUpdate} /> : null}
      {openModule ? <ModuleScherm module={openModule} oefeningen={oefeningen.filter(function(e) { return e.moduleId === openModule.id; })} onClose={function() { setOpenModule(null); }} onOpen={setOpenOefening} onEdit={setBewerkOefening} onDelete={handleDelete} /> : null}
    </div>
  );
}
