import { PINK, DARK } from "../constants.js";

export default function AudioScherm({ onTerug }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 400, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #eee" }}>
        <div style={{ fontWeight: 800, fontSize: 17, color: DARK }}>🎵 Audio</div>
        <button onClick={onTerug} style={{ background: PINK, color: "#fff", border: "none", borderRadius: 20, padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>← Terug</button>
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: 14 }}>
        Komt binnenkort...
      </div>
    </div>
  );
}
