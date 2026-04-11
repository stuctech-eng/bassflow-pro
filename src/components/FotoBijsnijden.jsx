import { useState, useRef, useEffect } from "react";
import { PINK } from "../constants.js";

export default function FotoBijsnijden({ fotoUrl, onOpslaan, onSluiten }) {
  const [opslaan, setOpslaan] = useState(false);
  const [imgAfm, setImgAfm] = useState(null);
  const containerRef = useRef();
  const imgRef = useRef();
  const [crop, setCrop] = useState({ x: 20, y: 20, w: 280, h: 160 });
  const [actief, setActief] = useState(null);
  const sleepStart = useRef(null);
  const cropStart = useRef(null);
  const actiefRef = useRef(null);
  const cropRef = useRef({ x: 20, y: 20, w: 280, h: 160 });

  const SCHERM_B = 360;
  const SCHERM_H = 420;

  useEffect(function() {
    const img = new Image();
    img.onload = function() {
      imgRef.current = img;
      setImgAfm({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = fotoUrl;
  }, [fotoUrl]);

  function getSchaal() {
    if (!imgAfm) return 1;
    return Math.min(SCHERM_B / imgAfm.w, SCHERM_H / imgAfm.h);
  }

  function getImgWeergave() {
    if (!imgAfm) return { w: SCHERM_B, h: SCHERM_H, ox: 0, oy: 0 };
    const s = getSchaal();
    const w = imgAfm.w * s;
    const h = imgAfm.h * s;
    const ox = (SCHERM_B - w) / 2;
    const oy = (SCHERM_H - h) / 2;
    return { w, h, ox, oy };
  }

  function getPos(e) {
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    const schaalX = SCHERM_B / rect.width;
    const schaalY = SCHERM_H / rect.height;
    return {
      x: (touch.clientX - rect.left) * schaalX,
      y: (touch.clientY - rect.top) * schaalY
    };
  }

  function dichtsteBijHoek(pos) {
    const c = cropRef.current;
    const hoeken = [
      { naam: "lt", x: c.x, y: c.y },
      { naam: "rt", x: c.x + c.w, y: c.y },
      { naam: "lb", x: c.x, y: c.y + c.h },
      { naam: "rb", x: c.x + c.w, y: c.y + c.h }
    ];
    for (var i = 0; i < hoeken.length; i++) {
      const dx = pos.x - hoeken[i].x;
      const dy = pos.y - hoeken[i].y;
      if (Math.sqrt(dx * dx + dy * dy) < 30) return hoeken[i].naam;
    }
    return null;
  }

  function binnenCrop(pos) {
    const c = cropRef.current;
    return pos.x > c.x + 20 && pos.x < c.x + c.w - 20 &&
           pos.y > c.y + 20 && pos.y < c.y + c.h - 20;
  }

  function handleStart(e) {
    e.preventDefault();
    const pos = getPos(e);
    const hoek = dichtsteBijHoek(pos);
    if (hoek) {
      actiefRef.current = hoek;
      setActief(hoek);
    } else if (binnenCrop(pos)) {
      actiefRef.current = "sleep";
      setActief("sleep");
    } else {
      return;
    }
    sleepStart.current = pos;
    cropStart.current = Object.assign({}, cropRef.current);
  }

  function handleMove(e) {
    e.preventDefault();
    if (!sleepStart.current || !actiefRef.current) return;
    const pos = getPos(e);
    const dx = pos.x - sleepStart.current.x;
    const dy = pos.y - sleepStart.current.y;
    const s = cropStart.current;
    const MIN = 50;
    var c = Object.assign({}, s);

    if (actiefRef.current === "sleep") {
      c.x = Math.max(0, Math.min(SCHERM_B - s.w, s.x + dx));
      c.y = Math.max(0, Math.min(SCHERM_H - s.h, s.y + dy));
      c.w = s.w;
      c.h = s.h;
    } else if (actiefRef.current === "lt") {
      c.x = Math.max(0, Math.min(s.x + dx, s.x + s.w - MIN));
      c.y = Math.max(0, Math.min(s.y + dy, s.y + s.h - MIN));
      c.w = s.w + (s.x - c.x);
      c.h = s.h + (s.y - c.y);
    } else if (actiefRef.current === "rt") {
      c.w = Math.max(MIN, Math.min(s.w + dx, SCHERM_B - s.x));
      c.y = Math.max(0, Math.min(s.y + dy, s.y + s.h - MIN));
      c.h = s.h + (s.y - c.y);
    } else if (actiefRef.current === "lb") {
      c.x = Math.max(0, Math.min(s.x + dx, s.x + s.w - MIN));
      c.w = s.w + (s.x - c.x);
      c.h = Math.max(MIN, Math.min(s.h + dy, SCHERM_H - s.y));
    } else if (actiefRef.current === "rb") {
      c.w = Math.max(MIN, Math.min(s.w + dx, SCHERM_B - s.x));
      c.h = Math.max(MIN, Math.min(s.h + dy, SCHERM_H - s.y));
    }

    cropRef.current = c;
    setCrop(Object.assign({}, c));
  }

  function handleEnd(e) {
    e.preventDefault();
    actiefRef.current = null;
    setActief(null);
    sleepStart.current = null;
  }

 async function handleOpslaan() {
  if (!imgAfm || opslaan) return;
  setOpslaan(true);
  try {
    const s = getSchaal();
    const weergave = getImgWeergave();
    const c = cropRef.current;

    const origX = Math.max(0, (c.x - weergave.ox) / s);
    const origY = Math.max(0, (c.y - weergave.oy) / s);
    const origW = Math.min(imgAfm.w - origX, c.w / s);
    const origH = Math.min(imgAfm.h - origY, c.h / s);

    // Haal foto op als blob om CORS te omzeilen
    const response = await fetch(fotoUrl);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = function() {
      const uitvoer = document.createElement("canvas");
      uitvoer.width = Math.round(origW);
      uitvoer.height = Math.round(origH);
      const ctx = uitvoer.getContext("2d");
      ctx.drawImage(img, origX, origY, origW, origH, 0, 0, uitvoer.width, uitvoer.height);
      URL.revokeObjectURL(blobUrl);
      uitvoer.toBlob(async function(resultBlob) {
        if (resultBlob) {
          await onOpslaan(resultBlob);
        }
        setOpslaan(false);
      }, "image/jpeg", 0.92);
    };
    img.src = blobUrl;
  } catch (err) {
    setOpslaan(false);
  }
}


      // Converteer scherm coordinaten naar originele foto coordinaten
      const origX = Math.max(0, (c.x - weergave.ox) / s);
      const origY = Math.max(0, (c.y - weergave.oy) / s);
      const origW = Math.min(imgAfm.w - origX, c.w / s);
      const origH = Math.min(imgAfm.h - origY, c.h / s);

      const uitvoer = document.createElement("canvas");
      uitvoer.width = Math.round(origW);
      uitvoer.height = Math.round(origH);
      const ctx = uitvoer.getContext("2d");
      ctx.drawImage(img, origX, origY, origW, origH, 0, 0, uitvoer.width, uitvoer.height);

      uitvoer.toBlob(async function(blob) {
        if (blob) {
          await onOpslaan(blob);
        } else {
          setOpslaan(false);
        }
      }, "image/jpeg", 0.92);
    } catch (err) {
      setOpslaan(false);
    }
  }

  const weergave = getImgWeergave();
  const c = crop;

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 500, display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "52px 16px 12px", background: "#111", flexShrink: 0 }}>
        <button onClick={onSluiten}
          style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 20, padding: "8px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Annuleren
        </button>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>Bijsnijden</div>
        <button onClick={handleOpslaan} disabled={!imgAfm || opslaan}
          style={{ background: imgAfm ? PINK : "#555", border: "none", borderRadius: 20, padding: "8px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: imgAfm ? "pointer" : "default" }}>
          {opslaan ? "Bezig..." : "Bewaar"}
        </button>
      </div>

      {/* Viewer */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          ref={containerRef}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          style={{
            position: "relative",
            width: SCHERM_B,
            height: SCHERM_H,
            background: "#000",
            touchAction: "none",
            overflow: "hidden"
          }}>

          {/* Foto */}
          {imgAfm ? (
            <img src={fotoUrl} alt="foto"
              style={{
                position: "absolute",
                left: weergave.ox,
                top: weergave.oy,
                width: weergave.w,
                height: weergave.h,
                userSelect: "none",
                WebkitUserSelect: "none",
                pointerEvents: "none"
              }} />
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#444", fontSize: 12 }}>Laden...</div>
          )}

          {/* Dimming lagen */}
          {imgAfm ? (
            <>
              <div style={{ position: "absolute", left: 0, top: 0, width: SCHERM_B, height: c.y, background: "rgba(0,0,0,0.55)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", left: 0, top: c.y + c.h, width: SCHERM_B, height: SCHERM_H - c.y - c.h, background: "rgba(0,0,0,0.55)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", left: 0, top: c.y, width: c.x, height: c.h, background: "rgba(0,0,0,0.55)", pointerEvents: "none" }} />
              <div style={{ position: "absolute", left: c.x + c.w, top: c.y, width: SCHERM_B - c.x - c.w, height: c.h, background: "rgba(0,0,0,0.55)", pointerEvents: "none" }} />

              {/* Crop rand */}
              <div style={{ position: "absolute", left: c.x, top: c.y, width: c.w, height: c.h, border: "2px solid " + PINK, boxSizing: "border-box", pointerEvents: "none" }}>
                {/* Grid */}
                <div style={{ position: "absolute", left: "33%", top: 0, width: 1, height: "100%", background: "rgba(255,45,122,0.35)" }} />
                <div style={{ position: "absolute", left: "66%", top: 0, width: 1, height: "100%", background: "rgba(255,45,122,0.35)" }} />
                <div style={{ position: "absolute", top: "33%", left: 0, height: 1, width: "100%", background: "rgba(255,45,122,0.35)" }} />
                <div style={{ position: "absolute", top: "66%", left: 0, height: 1, width: "100%", background: "rgba(255,45,122,0.35)" }} />
              </div>

              {/* Hoek grepen */}
              {[
                { naam: "lt", left: c.x - 11, top: c.y - 11 },
                { naam: "rt", left: c.x + c.w - 11, top: c.y - 11 },
                { naam: "lb", left: c.x - 11, top: c.y + c.h - 11 },
                { naam: "rb", left: c.x + c.w - 11, top: c.y + c.h - 11 }
              ].map(function(h) {
                return (
                  <div key={h.naam} style={{
                    position: "absolute", left: h.left, top: h.top,
                    width: 22, height: 22, borderRadius: "50%",
                    background: PINK, pointerEvents: "none"
                  }} />
                );
              })}
            </>
          ) : null}
        </div>
      </div>

      <div style={{ padding: "10px 16px 40px", textAlign: "center", color: "#666", fontSize: 11 }}>
        Sleep hoeken om bij te snijden · Sleep midden om te verplaatsen
      </div>
    </div>
  );
}
