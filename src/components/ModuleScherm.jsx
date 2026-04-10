import { DARK } from "../constants.js";
import Badge from "./Badge.jsx";
import OefeningKaart from "./OefeningKaart.jsx";

export default function ModuleScherm({ module, oefeningen, onClose, onOpen, onEdit, onDelete }) {
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
