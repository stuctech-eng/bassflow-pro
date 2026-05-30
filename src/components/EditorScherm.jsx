import { useEffect, useRef, useState } from "react";
import { PINK, DARK } from "../constants.js";

export default function EditorScherm({ onTerug, oefeningId, maakConceptAan, fotos }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [geladen, setGeladen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [laadFout, setLaadFout] = useState(null);
  const [laadStatus, setLaadStatus] = useState("AlphaTab laden...");

  useEffect(() => {
    let api = null;

    async function initAlphaTab() {
      try {
        setLaadStatus("Muziekengine laden...");

        const alphaTab = await import("@coderline/alphatab");
        const { AlphaTabApi, Settings } = alphaTab;

        if (!containerRef.current) return;

        setLaadStatus("Notenbalk opbouwen...");

        const settings = new Settings();
        settings.core.engine = "html5";
        settings.core.logLevel = 0;
        settings.core.useWorkers = true;

        settings.player.enablePlayer = true;
        settings.player.enableUserInteraction = true;
        settings.player.soundFont =
          "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2";

        settings.display.layoutMode = alphaTab.LayoutMode.Page;
        settings.display.staveProfile = alphaTab.StaveProfile.TabAndStandard;
        settings.display.scale = 1.1;

        settings.notation.rhythmMode = alphaTab.NotationRhythmMode.ShowWithBeams;

        api = new AlphaTabApi(containerRef.current, settings);

        api.renderStarted.on(() => {
          setGeladen(false);
          setLaadStatus("Renderen...");
        });

        api.renderFinished.on(() => {
          setGeladen(true);
          setLaadStatus("Klaar");
        });

        api.playerStateChanged.on((e) => {
          setIsPlaying(e.state === 1);
        });

        api.error.on((e) => {
          console.error("AlphaTab fout:", e);
          setLaadFout("Fout bij laden: " + (e.message || "onbekend"));
        });

        // Voorbeeld baslijn
        api.tex(`
          \\track "Bass"
          \\tuning E1 A1 D2 G2
          \\instrument 33
          4.4.4 5.4.4 7.4.4 5.4.4 |
          4.3.4 5.3.4 7.3.4 5.3.4 |
          4.2.4 5.2.4 7.2.4 5.2.4 |
          4.1.4 5.1.4 7.1.4 5.1.4
        `);

        apiRef.current = api;
      } catch (err) {
        console.error("AlphaTab init fout:", err);
        setLaadFout("Kon muziekengine niet laden. Controleer je verbinding.");
      }
    }

    initAlphaTab();

    return () => {
      if (apiRef.current) {
        try { apiRef.current.destroy(); } catch (e) {}
        apiRef.current = null;
      }
    };
  }, []);

  function togglePlayback() {
    if (!apiRef.current || !geladen) return;
    apiRef.current.playPause();
  }

  function stopPlayback() {
    if (!apiRef.current || !geladen) return;
    apiRef.current.stop();
    setIsPlaying(false);
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "#fff",
      zIndex: 400, display: "flex", flexDirection: "column",
      paddingTop: "env(safe-area-inset-top)",
      paddingBottom: "env(safe-area-inset-bottom)"
    }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", borderBottom: "1px solid #eee", flexShrink: 0
      }}>
        <button onClick={onTerug} style={{
          background: "#f0f0f0", color: DARK, border: "none",
          borderRadius: 20, padding: "5px 14px", fontSize: 13,
          fontWeight: 700, cursor: "pointer", minHeight: 44, minWidth: 44
        }}>
          ← Terug
        </button>
        <div style={{ fontWeight: 800, fontSize: 14, color: DARK }}>🎼 Noten Editor</div>
        <div style={{ width: 60 }} />
      </div>

      {/* Status banner */}
      {!geladen && !laadFout && (
        <div style={{
          padding: "8px 16px", background: "#f5f5f7",
          borderBottom: "1px solid #eee", fontSize: 11,
          color: "#888", textAlign: "center", flexShrink: 0
        }}>
          {laadStatus}
        </div>
      )}

      {laadFout && (
        <div style={{
          padding: "10px 16px", background: "#FFF0F0",
          borderBottom: "1px solid #fdd", fontSize: 12,
          color: "#E53935", textAlign: "center", flexShrink: 0
        }}>
          ⚠️ {laadFout}
        </div>
      )}

      {/* AlphaTab container */}
      <div style={{ flex: 1, overflow: "auto", background: "#fff", WebkitOverflowScrolling: "touch" }}>
        <div ref={containerRef} style={{ width: "100%", minHeight: 300 }} />
      </div>

      {/* Transport */}
      <div style={{
        padding: "10px 16px", borderTop: "1px solid #eee",
        display: "flex", gap: 10, alignItems: "center",
        flexShrink: 0, background: "#fff"
      }}>
        <button
          onClick={togglePlayback}
          disabled={!geladen}
          style={{
            background: geladen ? PINK : "#eee",
            color: geladen ? "#fff" : "#bbb",
            border: "none", borderRadius: "50%",
            width: 44, height: 44, fontSize: 18,
            cursor: geladen ? "pointer" : "default",
            flexShrink: 0, display: "flex",
            alignItems: "center", justifyContent: "center"
          }}>
          {isPlaying ? "⏸" : "▶"}
        </button>

        <button
          onClick={stopPlayback}
          disabled={!geladen}
          style={{
            background: geladen ? "#f0f0f0" : "#eee",
            color: geladen ? DARK : "#bbb",
            border: "none", borderRadius: "50%",
            width: 44, height: 44, fontSize: 18,
            cursor: geladen ? "pointer" : "default",
            flexShrink: 0, display: "flex",
            alignItems: "center", justifyContent: "center"
          }}>
          ⏹
        </button>

        <div style={{ flex: 1, fontSize: 11, color: "#888" }}>
          {laadFout ? "Laad fout" : !geladen ? laadStatus : isPlaying ? "Speelt af..." : "Klaar om af te spelen"}
        </div>
      </div>
    </div>
  );
}
