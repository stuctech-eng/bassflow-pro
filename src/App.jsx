import { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "./firebase.js";
import { PINK, PINK_LIGHT, DARK, BG, MODULES } from "./constants.js";
import BpmGrafiek from "./components/BpmGrafiek.jsx";
import OefeningKaart from "./components/OefeningKaart.jsx";
import OefeningFormulier from "./components/OefeningFormulier.jsx";
import DetailScherm from "./components/DetailScherm.jsx";
import ModuleScherm from "./components/ModuleScherm.jsx";
import Badge from "./components/Badge.jsx";


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
      const data = snapshot.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); });
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
            <span style={{ fontSize: 9, color: "#ccc", marginLeft: 6 }}>PRO v0.27</span>
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
