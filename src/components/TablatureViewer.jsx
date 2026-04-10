import { useState, useRef } from "react";
import { PINK } from "../constants.js";

export default function TablatureViewer({ fotos, fotoIndex, setFotoIndex }) {
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
