import { PINK_LIGHT, PINK } from "../constants.js";

export default function Badge({ level }) {
  const colors = {
    Beginner: [PINK_LIGHT, PINK],
    Intermediate: ["#FFF0E0", "#FF8C00"],
    Advanced: ["#F0E8FF", "#8B2FC9"]
  };
  const c = colors[level] || colors.Beginner;
  return (
    <span style={{ background: c[0], color: c[1], fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, textTransform: "uppercase" }}>
      {level}
    </span>
  );
}
