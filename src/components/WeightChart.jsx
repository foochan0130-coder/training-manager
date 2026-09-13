export default function WeightChart({ pts }) {
  if (pts.length < 2) return null;
  const W = 320, H = 150, P = 26;
  const kgs = pts.map((p) => p.kg);
  const min = Math.min(...kgs) - 0.5;
  const max = Math.max(...kgs) + 0.5;
  const x = (i) => P + (i * (W - 2 * P)) / (pts.length - 1);
  const y = (v) => H - P - ((v - min) * (H - 2 * P)) / (max - min);
  const line = pts.map((p, i) => `${x(i)},${y(p.kg)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", background: "#1A1D22", borderRadius: 12, border: "1px solid #262A31" }}>
      <polyline points={line} fill="none" stroke="#E8B416" strokeWidth="2" />
      {pts.map((p, i) => <circle key={p.date} cx={x(i)} cy={y(p.kg)} r="3" fill="#E8B416" />)}
      <text x={W - P} y={y(last.kg) - 9} fontSize="12" fill="#EDEEF0" textAnchor="end">{last.kg}kg</text>
      <text x={x(0)} y={H - 8} fontSize="9" fill="#8C929A">{pts[0].date.slice(5).replace("-", "/")}</text>
      <text x={x(pts.length - 1)} y={H - 8} fontSize="9" fill="#8C929A" textAnchor="end">{last.date.slice(5).replace("-", "/")}</text>
    </svg>
  );
}
