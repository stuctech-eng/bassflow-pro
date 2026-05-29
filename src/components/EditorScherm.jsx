import { useEffect, useRef, useState } from "react";
import { PINK, DARK } from "../constants.js";

const ALPHATAB_CDN = "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/alphaTab.min.js";

export default function EditorScherm({ onTerug, fotos }) {
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const [geladen, setGeladen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [laadFout, setLaadFout] = useState(false);

  useEffect(() => {
    // Laad AlphaTab script dynamisch
    if (document.getElementById("alphatab-script")) {
      initAlphaTab();
      return;
    }
    const script = document.createElement("script");
    script.id = "alphatab-script";
    script.src = ALPHATAB_CDN;
    script.onload = () => initAlphaTab();
    script.onerror = () => setLaadFout(true);
    document.head.appendChild(script);

    return () => {
      if (apiRef.current) {
        apiRef.current.destroy();
        apiRef.current = null;
      }
    };
  }, []);

  function initAlphaTab() {
    if (!containerRef.current || !window.alphaTab) return;

    const settings = {
      core: {
        engine: "html5",
        logLevel: 0,
      },
      player: {
        enablePlayer: true,
        enableUserInteraction: true,
        soundFont: "https://cdn.jsdelivr.net/npm/@coderline/alphatab@latest/dist/soundfont/sonivox.sf2",
      },
      display: {
        layoutMode: "horizontal",
        staveProfile: "TabAndStandard",
        scale: 1.2,
      },
      notation: {
        rhythmMode: "showWithBeams",
      },
    };

    const api = new window.alphaTab.AlphaTabApi(containerRef.current, settings);

    api.renderStarted.on(() => setGeladen(false));
    api.renderFinished.on(() => setGeladen(true));
    api.playerStateChanged.on((e) => {
      setIsPlaying(e.state === 1);
    });

    // Voorbeeld baslijn als test
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
  }

  function togglePlayback() {
    if (!apiRef.current) return;
    apiRef.current.playPause();
  }

  function stopPlayback() {
    if (!apiRef.current) return;
    apiRef.current.stop();
    setIsPlaying(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "#fff", zIndex: 400, display: "flex", flexDirection: "column" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid #eee", flexShrink: 0 }}>
        <button onClick={onTerug}
          style={{ background: "#f0f0f0", color: DARK, border: "none", borderRadius: 20, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          ← Terug
        </button>
        <div style={{ fontWeight: 800, fontSize: 14, color: DARK }}>🎼 Noten Editor</div>
        <div style={{ width: 60 }} />
      </div>

      {/* Status */}
      {!geladen && !laadFout && (
        <div style={{ padding: "8px 16px", background: "#f5f5f7", borderBottom: "1px solid #eee", fontSize: 11, color: "#888", textAlign: "center", flexShrink: 0 }}>
          AlphaTab laden...
        </div>
      )}

      {laadFout && (
        <div style={{ padding: "8px 16px", background: "#FFF0F0", borderBottom: "1px solid #eee", fontSize: 11, color: "#E53935", textAlign: "center", flexShrink: 0 }}>
          Fout -- internet nodig voor eerste keer laden
        </div>
      )}

      {/* AlphaTab container */}
      <div style={{ flex: 1, overflow: "auto", background: "#fff" }}>
        <div ref={containerRef} style={{ width: "100%", minHeight: 300 }} />
      </div>

      {/* Transport */}
      <div style={{ padding: "10px 16px", borderTop: "1px solid #eee", display: "flex", gap: 10, alignItems: "center", flexShrink: 0, background: "#fff" }}>
        <button onClick={togglePlayback} disabled={!geladen}
          style={{ background: geladen ? PINK : "#eee", color: geladen ? "#fff" : "#bbb", border: "none", borderRadius: "50%", width: 44, height: 44, fontSize: 16, cursor: geladen ? "pointer" : "default", flexShrink: 0 }}>
          {isPlaying ? "⏸" : "▶"}
        </button>
        <button onClick={stopPlayback} disabled={!geladen}
          style={{ background: geladen ? "#f0f0f0" : "#eee", color: geladen ? DARK : "#bbb", border: "none", borderRadius: "50%", width: 44, height: 44, fontSize: 16, cursor: geladen ? "pointer" : "default", flexShrink: 0 }}>
          ⏹
        </button>
        <div style={{ flex: 1, fontSize: 11, color: "#888" }}>
          {!geladen ? "Laden..." : isPlaying ? "Speelt af..." : "Klaar"}
        </div>
      </div>
    </div>
  );
}
