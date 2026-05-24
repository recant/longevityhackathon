type Props = { score: number; size?: number };

export default function DonutScore({ score, size = 120 }: Props) {
  const pct = Math.min(100, Math.max(0, score));
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="donut-score" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#e8eeec" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="10"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="donut-label">{Math.round(pct)}%</span>
    </div>
  );
}
