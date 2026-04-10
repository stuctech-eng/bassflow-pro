import { PINK } from "../constants.js";

export default function BpmGrafiek({ sessies }) {
  if (!sessies || sessies.length < 2) return null;
  const bpms = sessies.map(function(s) { return s.bpm; });
  const max = Math.max.apply(null, bpms);
  const min = Math.min.apply(null, bpms);
  const range = max - min || 1;
  const hoogte = 50;
  const breedte = 260;
  const stap = breedte / (bpms.length - 1);
  const punten = bpms.map(function(b, i) {
    const x = i * stap;
    const y = hoogte - ((b - min) / range) * (hoogte - 8);
    return x + "," + y;
  }).join(" ");
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 9, color: "#bbb", marginBottom: 4 }}>BPM PROGRESSIE</div>
      <svg width={breedte} height={hoogte} style={{ overflow: "visible" }}>
        <polyline points={punten} fill="none" stroke={PINK} strokeWidth="2" strokeLinejoin="round" />
        {bpms.map(function(b, i) {
          const x = i * stap;
          const y = hoogte - ((b - min) / range) * (hoogte - 8);
          return <circle key={i} cx={x} cy={y} r="3" fill={PINK} />;
        })}
      </svg>
    </div>
  );
}
