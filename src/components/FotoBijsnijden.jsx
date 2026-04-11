import { useState, useRef, useEffect } from "react";
import { PINK } from "../constants.js";

export default function FotoBijsnijden({ fotoUrl, onOpslaan, onSluiten }) {
  const canvasRef = useRef();
  const imgRef = useRef();
  const [imgGeladen, setImgGeladen] = useState(false);
  const [opslaan, setOpslaan] = useState(false);
  const schaalRef = useRef(1);
  const imgOffsetRef = useRef({ x: 0, y: 0 });
  const cropBoxRef = useRef({ x: 40, y: 40, w: 280, h: 180 });
  const actieveHoekRef = useRef(null);
  const slepenRef = useRef(false);
  const sleepStart = useRef(null);
  const cropStart = useRef(null);

  useEffect(function() {
    const img = new Image();
    img.onload = function() {
      imgRef.current = img;
      tekenCanvas(img, cropBoxRef.current);
      setImgGeladen(true);
    };
    fetch(fotoUrl, { mode: "cors" })
      .then(function(r) { return r.blob(); })
      .then(function(blob) { img.src = URL.createObjectURL(blob); })
      .catch(function() { img.src = fotoUrl; });
  }, [fotoUrl]);

  function tekenCanvas(img, crop) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const s = Math.min(W / img.width, H / img.height);
    const ox = (W - img.width * s) / 2;
    const oy = (H - img.height * s) / 2;
    schaalRef.current = s;
    imgOffsetRef.current = { x: ox, y: oy };
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, ox, oy, img.width * s, img.height * s);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, W, H);
    ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
    ctx.drawImage(img,
      (crop.x - ox) / s, (crop.y - oy) / s, crop.w / s, crop.h / s,
      crop.x, crop.y, crop.w, crop.h
    );
    ctx.strokeStyle = PINK;
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
    ctx.strokeStyle = "rgba(255,45,122,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(crop.x + crop.w / 3, crop.y); ctx.lineTo(crop.x + crop.w / 3, crop.y + crop.h);
    ctx.moveTo(crop.x + crop.w * 2 / 3, crop.y); ctx.lineTo(crop.x + crop.w * 2 / 3, crop.y + crop.h);
    ctx.moveTo(crop.x, crop.y + crop.h / 3); ctx.lineTo(crop.x + crop.w, crop.y + crop.h / 3);
    ctx.moveTo(crop.x, crop.y + crop.h * 2 / 3); ctx.lineTo(crop.x + crop.w, crop.y + crop.h * 2 / 3);
    ctx.stroke();
    ctx.fillStyle = PINK;
    [[crop.x, crop.y], [crop.x + crop.w, crop.y], [crop.x, crop.y + crop.h], [crop.x + crop.w, crop.y + crop.h]].forEach(function(pt) {
      ctx.beginPath(); ctx.arc(pt[0], pt[1], 11, 0, Math.PI * 2); ctx.fill();
    });
  }

  function getCanvasPos(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: (touch.clientX - rect.left) * (canvas.width / rect.width),
      y: (touch.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function dichtsteBijHoek(pos, crop) {
    const hoeken = [
      { naam: "lt", x: crop.x, y: crop.y },
      { naam: "rt", x: crop.x + crop.w, y: crop.y },
      { naam: "lb", x: crop.x, y: crop.y + crop.h },
      { naam: "rb", x: crop.x + crop.w, y: crop.y + crop.h }
    ];
    for (var i = 0; i < hoeken.length; i++) {
      const dx = pos.x - hoeken[i].x;
      const dy = pos.y - hoeken[i].y;
      if (Math.sqrt(dx * dx + dy * dy) < 30) return hoeken[i].naam;
    }
    return null;
  }

  function binnenCrop(pos, crop) {
    return pos.x > crop.x + 15 && pos.x < crop.x + crop.w - 15 &&
           pos.y > crop.y + 15 && pos.y < crop.y + crop.h - 15;
  }

  function handleStart(e) {
    e.preventDefault();
    const pos = getCanvasPos(e);
    const crop = cropBoxRef.current;
    const hoek = dichtsteBijHoek(pos, crop);
    if (hoek) {
      actieveHoekRef.current = hoek;
      slepenRef.current = false;
      sleepStart.current = pos;
      cropStart.current = Object.assign({}, crop);
    } else if (binnenCrop(pos, crop)) {
      slepenRef.current = true;
      actieveHoekRef.current = null;
      sleepStart.current = pos;
      cropStart.current = Object.assign({}, crop);
    }
  }

  function handleMove(e) {
    e.preventDefault();
    if (!sleepStart.current) return;
    const pos = getCanvasPos(e);
    const dx = pos.x - sleepStart.current.x;
    const dy = pos.y - sleepStart.current.y;
    const W = canvasRef.current.width;
    const H = canvasRef.current.height;
    const MIN = 60;
    const start = cropStart.current;
    var c = Object.assign({}, start);
    const hoek = actieveHoekRef.current;

    if (hoek) {
      // Hoek slepen -- resize
      if (hoek === "lt") {
        c.x = Math.max(0, Math.min(start.x + dx, start.x + start.w - MIN));
        c.y = Math.max(0, Math.min(start.y + dy, start.y + start.h - MIN));
        c.w = start.w + (start.x - c.x);
        c.h = start.h + (start.y - c.y);
      } else if (hoek === "rt") {
        c.w = Math.max(MIN, Math.min(start.w + dx, W - start.x));
        c.y = Math.max(0, Math.min(start.y + dy, start.y + start.h - MIN));
        c.h = start.h + (start.y - c.y);
      } else if (hoek === "lb") {
        c.x = Math.max(0, Math.min(start.x + dx, start.x + start.w - MIN));
        c.w = start.w + (start.x - c.x);
        c.h = Math.max(MIN, Math.min(start.h + dy, H - start.y));
      } else if (hoek === "rb") {
        c.w = Math.max(MIN, Math.min(start.w + dx, W - start.x));
        c.h = Math.max(MIN, Math.min(start.h + dy, H - start.y));
      }
    } else if (slepenRef.current) {
      // Verplaatsen -- breedte en hoogte blijven EXACT hetzelfde
      c.x = Math.max(0, Math.min(W - start.w, start.x + dx));
      c.y = Math.max(0, Math.min(H - start.h, start.y + dy));
      c.w = start.w;
      c.h = start.h;
    }

    cropBoxRef.current = c;
    if (imgRef.current) tekenCanvas(imgRef.current, c);
  }

  function handleEnd(e) {
    e.preventDefault();
    actieveHoekRef.current = null;
    slepenRef.current = false;
    sleepStart.current = null;
  }

  async function handleOpslaan() {
    if (!imgRef.current || opslaan) return;
    setOpslaan(true);
    try {
      const img = imgRef.current;
      const s = schaalRef.current;
      const ox = imgOffsetRef.current.x;
      const oy = imgOffsetRef.current.y;
      const crop = cropBoxRef.current;
      const breedte = Math.max(1, Math.round(crop.w / s));
      const hoogte = Math.max(1, Math.round(crop.h / s));
      const uitvoer = document.createElement("canvas");
      uitvoer.width = breedte;
      uitvoer.height = hoogte;
      const ctx = uitvoer.getContext("2d");
      ctx.drawImage(img,
        (crop.x - ox) / s, (crop.y - oy) / s,
        crop.w / s, crop.h / s,
        0, 0, breedte, hoogte
      );
      uitvoer.toBlob(async function(blob) {
        if (blob) {
          await onOpslaan(blob);
        }
        setOpslaan(false);
      }, "image/jpeg", 0.92);
    } catch (err) {
      console.error("Bijsnijden fout:", err);
      setOpslaan(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 500, display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "52px 16px 12px", background: "#111", flexShrink: 0 }}>
        <button onClick={onSluiten}
          style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 20, padding: "8px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Annuleren
        </button>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>Bijsnijden</div>
        <button onClick={handleOpslaan} disabled={!imgGeladen || opslaan}
          style={{ background: imgGeladen ? PINK : "#555", border: "none", borderRadius: 20, padding: "8px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: imgGeladen ? "pointer" : "default" }}>
          {opslaan ? "Bezig..." : "Bewaar"}
        </button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
        <canvas
          ref={canvasRef}
          width={360}
          height={480}
          onTouchStart={handleStart}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
          style={{ width: "100%", maxWidth: 360, borderRadius: 8, touchAction: "none" }}
        />
      </div>
      <div style={{ padding: "10px 16px 40px", textAlign: "center", color: "#666", fontSize: 11 }}>
        Sleep hoeken om bij te snijden · Sleep midden om te verplaatsen
      </div>
    </div>
  );
}
