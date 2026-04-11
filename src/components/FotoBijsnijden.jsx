import { useState, useRef, useEffect } from "react";
import { PINK } from "../constants.js";

export default function FotoBijsnijden({ fotoUrl, onOpslaan, onSluiten }) {
  const canvasRef = useRef();
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
  const schaalRef = useRef(1);
  const imgOffsetRef = useRef({ x: 0, y: 0 });
  const cropBoxRef = useRef({ x: 40, y: 40, w: 280, h: 180 });

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
    const schaalX = W / img.width;
    const schaalY = H / img.height;
    const s = Math.min(schaalX, schaalY);
    const ox = (W - img.width * s) / 2;
    const oy = (H - img.height * s) / 2;
    schaalRef.current = s;
    imgOffsetRef.current = { x: ox, y: oy };
    setSchaal(s);
    setImgOffset({ x: ox, y: oy });
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(img, ox, oy, img.width * s, img.height * s);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, W, H);
    ctx.clearRect(crop.x, crop.y, crop.w, crop.h);
    ctx.drawImage(img,
      (crop.x - ox) / s, (crop.y - oy) / s, crop.w / s, crop.h / s,
      crop.x, crop.y, crop.w, crop.h
    );
    ctx.strokeStyle = PINK;
    ctx.lineWidth = 2;
    ctx.strokeRect(crop.x, crop.y, crop.w, crop.h);
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
    ctx.fillStyle = PINK;
    [[crop.x, crop.y], [crop.x + crop.w, crop.y], [crop.x, crop.y + crop.h], [crop.x + crop.w, crop.y + crop.h]].forEach(function(pt) {
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 10, 0, Math.PI * 2);
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
    const hoek = dichtsteBijHoek(pos, cropBoxRef.current);
    if (hoek) {
      setActieveHoek(hoek);
      sleepStart.current = pos;
      cropStart.current = Object.assign({}, cropBoxRef.current);
    } else if (binnenCrop(pos, cropBoxRef.current)) {
      setSlepen(true);
      sleepStart.current = pos;
      cropStart.current = Object.assign({}, cropBoxRef.current);
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
    const hoek = actieveHoek;
    if (hoek) {
      if (hoek === "lt") {
        nieuwCrop.x = Math.min(cropStart.current.x + dx, cropStart.current.x + cropStart.current.w - MIN);
        nieuwCrop.y = Math.min(cropStart.current.y + dy, cropStart.current.y + cropStart.current.h - MIN);
        nieuwCrop.w = cropStart.current.w - (nieuwCrop.x - cropStart.current.x);
        nieuwCrop.h = cropStart.current.h - (nieuwCrop.y - cropStart.current.y);
      } else if (hoek === "rt") {
        nieuwCrop.w = Math.max(MIN, cropStart.current.w + dx);
        nieuwCrop.y = Math.min(cropStart.current.y + dy, cropStart.current.y + cropStart.current.h - MIN);
        nieuwCrop.h = cropStart.current.h - (nieuwCrop.y - cropStart.current.y);
      } else if (hoek === "lb") {
        nieuwCrop.x = Math.min(cropStart.current.x + dx, cropStart.current.x + cropStart.current.w - MIN);
        nieuwCrop.w = cropStart.current.w - (nieuwCrop.x - cropStart.current.x);
        nieuwCrop.h = Math.max(MIN, cropStart.current.h + dy);
      } else if (hoek === "rb") {
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
    cropBoxRef.current = nieuwCrop;
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
    if (!imgRef.current || opslaan) return;
    setOpslaan(true);
    try {
      const img = imgRef.current;
      const s = schaalRef.current;
      const ox = imgOffsetRef.current.x;
      const oy = imgOffsetRef.current.y;
      const crop = cropBoxRef.current;
      const uitvoerCanvas = document.createElement("canvas");
      uitvoerCanvas.width = Math.round(crop.w / s);
      uitvoerCanvas.height = Math.round(crop.h / s);
      const ctx = uitvoerCanvas.getContext("2d");
      ctx.drawImage(img,
        (crop.x - ox) / s, (crop.y - oy) / s, crop.w / s, crop.h / s,
        0, 0, uitvoerCanvas.width, uitvoerCanvas.height
      );
      uitvoerCanvas.toBlob(async function(blob) {
        await onOpslaan(blob);
        setOpslaan(false);
      }, "image/jpeg", 0.92);
    } catch (err) {
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
        Sleep de hoeken om bij te snijden · Sleep binnen het vak om te verplaatsen
      </div>
    </div>
  );
}
