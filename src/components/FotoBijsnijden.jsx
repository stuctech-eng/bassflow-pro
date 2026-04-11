import { useState, useRef, useEffect } from "react";
import { PINK, DARK } from "../constants.js";

export default function FotoBijsnijden({ fotoUrl, onOpslaan, onSluiten }) {
  const canvasRef = useRef();
  const containerRef = useRef();
  const imgRef = useRef();
  const [imgGeladen, setImgGeladen] = useState(false);
  const [schaal, setSchaal] = useState(1);
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 });
  const [cropBox, setCropBox] = useState({ x: 40, y: 40, w: 280, h: 180 });
  const [actieveHoek, setActieveHoek] = useState(null);
  const [slepen, setSlepen] = useState(false);
  const sleepStart = useRef(null);
  const cropStart = useRef(null);
  const [opslaan, setOpslaan] = useState(false);

  useEffect(function() {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function() {
      imgRef.current = img;
      tekenCanvas(img, cropBox);
      setImgGeladen(true);
    };
    img.src = fotoUrl;
  }, [fotoUrl]);

  function tekenCanvas(img, crop) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;

    const schaalX = W / img.width;
    const schaalY = H / img.height;
    const s = Math.min(schaalX, schaalY);
    const ox = (W - img.width * s) / 2;
    const oy = (H - img.height * s) / 2;

    setSchaal(s);
    setImgOffset({ x: ox, y: oy });

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, ox, oy, img.width * s, img.height * s);

    // Dimming
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);

    // Crop venster
    ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
    ctx.drawImage(img, 
      (crop.x - ox) / s, (crop.y - oy) / s, crop.w / s, crop.h / s,
      crop.x, crop.y, crop.w, crop.h
    );

    // Rand
    ctx.strokeStyle = PINK;
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);

    // Grid lijnen
    ctx.strokeStyle = "rgba(255,45,122,0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(crop.x + crop.w / 3, crop.y);
    ctx.lineTo(crop.x + crop.w / 3, crop.y + crop.h);
    ctx.moveTo(crop.x + crop.w * 2 / 3, crop.y);
    ctx.lineTo(crop.x + crop.w * 2 / 3, crop.y + crop.h);
    ctx.moveTo(crop.x, crop.y + crop.h / 3);
    ctx.lineTo(crop.x + crop.w, crop.y + crop.h / 3);
    ctx.moveTo(crop.x, crop.y + crop.h * 2 / 3);
    ctx.lineTo(crop.x + crop.w, crop.y + crop.h * 2 / 3);
    ctx.stroke();

    // Hoek grepen
    const hoekGrootte = 18;
    ctx.fillStyle = PINK;
    [
      [crop.x, crop.y],
      [crop.x + crop.w, crop.y],
      [crop.x, crop.y + crop.h],
      [crop.x + crop.w, crop.y + crop.h]
    ].forEach(function(pt) {
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], hoekGrootte / 2, 0, Math.PI * 2);
      ctx.fill();
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
      if (Math.sqrt(dx * dx + dy * dy) < 28) return hoeken[i].naam;
    }
    return null;
  }

  function binnenCrop(pos, crop) {
    return pos.x > crop.x && pos.x < crop.x + crop.w && pos.y > crop.y && pos.y < crop.y + crop.h;
  }

  function handleStart(e) {
    e.preventDefault();
    const pos = getCanvasPos(e);
    const hoek = dichtsteBijHoek(pos, cropBox);
    if (hoek) {
      setActieveHoek(hoek);
      sleepStart.current = pos;
      cropStart.current = Object.assign({}, cropBox);
    } else if (binnenCrop(pos, cropBox)) {
      setSlepen(true);
      sleepStart.current = pos;
      cropStart.current = Object.assign({}, cropBox);
    }
  }

  function handleMove(e) {
    e.preventDefault();
    if (!sleepStart.current) return;
    const pos = getCanvasPos(e);
    const dx = pos.x - sleepStart.current.x;
    const dy = pos.y - sleepStart.current.y;
    const canvas = canvasRef.current;
    const W = canvas.width;
    const H = canvas.height;
    const MIN = 60;
    var nieuwCrop = Object.assign({}, cropStart.current);

    if (actieveHoek) {
      if (actieveHoek === "lt") {
        nieuwCrop.x = Math.min(cropStart.current.x + dx, cropStart.current.x + cropStart.current.w - MIN);
        nieuwCrop.y = Math.min(cropStart.current.y + dy, cropStart.current.y + cropStart.current.h - MIN);
        nieuwCrop.w = cropStart.current.w - (nieuwCrop.x - cropStart.current.x);
        nieuwCrop.h = cropStart.current.h - (nieuwCrop.y - cropStart.current.y);
      } else if (actieveHoek === "rt") {
        nieuwCrop.w = Math.max(MIN, cropStart.current.w + dx);
        nieuwCrop.y = Math.min(cropStart.current.y + dy, cropStart.current.y + cropStart.current.h - MIN);
        nieuwCrop.h = cropStart.current.h - (nieuwCrop.y - cropStart.current.y);
      } else if (actieveHoek === "lb") {
        nieuwCrop.x = Math.min(cropStart.current.x + dx, cropStart.current.x + cropStart.current.w - MIN);
        nieuwCrop.w = cropStart.current.w - (nieuwCrop.x - cropStart.current.x);
        nieuwCrop.h = Math.max(MIN, cropStart.current.h + dy);
      } else if (actieveHoek === "rb") {
        nieuwCrop.w = Math.max(MIN, cropStart.current.w + dx);
        nieuwCrop.h = Math.max(MIN, cropStart.current.h + dy);
      }
    } else if (slepen) {
      nieuwCrop.x = Math.max(0, Math.min(W - cropStart.current.w, cropStart.current.x + dx));
      nieuwCrop.y = Math.max(0, Math.min(H - cropStart.current.h, cropStart.current.y + dy));
    }

    nieuwCrop.x = Math.max(0, nieuwCrop.x);
    nieuwCrop.y = Math.max(0, nieuwCrop.y);
    if (nieuwCrop.x + nieuwCrop.w > W) nieuwCrop.w = W - nieuwCrop.x;
    if (nieuwCrop.y + nieuwCrop.h > H) nieuwCrop.h = H - nieuwCrop.y;

    setCropBox(nieuwCrop);
    if (imgRef.current) tekenCanvas(imgRef.current, nieuwCrop);
  }

  function handleEnd(e) {
    e.preventDefault();
    setActieveHoek(null);
    setSlepen(false);
    sleepStart.current = null;
  }

  async function handleOpslaan() {
    setOpslaan(true);
    const canvas = canvasRef.current;
    const img = imgRef.current;
    const s = schaal;
    const ox = imgOffset.x;
    const oy = imgOffset.y;

    const uitvoerCanvas = document.createElement("canvas");
    uitvoerCanvas.width = Math.round(cropBox.w / s);
    uitvoerCanvas.height = Math.round(cropBox.h / s);
    const ctx = uitvoerCanvas.getContext("2d");
    ctx.drawImage(img,
      (cropBox.x - ox) / s, (cropBox.y - oy) / s,
      cropBox.w / s, cropBox.h / s,
      0, 0, uitvoerCanvas.width, uitvoerCanvas.height
    );

    uitvoerCanvas.toBlob(async function(blob) {
      await onOpslaan(blob);
      setOpslaan(false);
    }, "image/jpeg", 0.92);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#000", zIndex: 500, display: "flex", flexDirection: "column", fontFamily: "sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", background: "#111", flexShrink: 0 }}>
        <button onClick={onSluiten}
          style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 20, padding: "6px 14px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          Annuleren
        </button>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>Bijsnijden</div>
        <button onClick={handleOpslaan} disabled={!imgGeladen || opslaan}
          style={{ background: imgGeladen ? PINK : "#555", border: "none", borderRadius: 20, padding: "6px 14px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: imgGeladen ? "pointer" : "default" }}>
          {opslaan ? "..." : "Opslaan"}
        </button>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
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

      <div style={{ padding: "10px 16px 24px", textAlign: "center", color: "#666", fontSize: 11 }}>
        Sleep de hoeken om bij te snijden · Sleep binnen het vak om te verplaatsen
      </div>
    </div>
  );
}
