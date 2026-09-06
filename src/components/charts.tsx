interface Pt { x: number; y: number }

const W = 640;
const H = 220;
const PAD = { l: 36, r: 12, t: 12, b: 24 };

function scale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

export function LineChart({
  series,
  yLabel,
  yRef,
  xLabels,
}: {
  series: { points: Pt[]; color: string; width?: number; dots?: boolean; dashed?: boolean }[];
  yLabel?: string;
  yRef?: { y: number; label: string; color?: string };
  xLabels?: { x: number; label: string }[];
}) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return <p className="muted">No data yet.</p>;
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y).concat(yRef ? [yRef.y] : []);
  const xd: [number, number] = [Math.min(...xs), Math.max(...xs)];
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yPad = (yMax - yMin || 1) * 0.15;
  const yd: [number, number] = [yMin - yPad, yMax + yPad];
  const sx = scale(xd, [PAD.l, W - PAD.r]);
  const sy = scale(yd, [H - PAD.b, PAD.t]);
  const ticks = 4;
  const yTicks = Array.from({ length: ticks + 1 }, (_, i) => yd[0] + ((yd[1] - yd[0]) * i) / ticks);

  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={yLabel}>
      {yTicks.map((t) => (
        <g key={t}>
          <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} />
          <text x={PAD.l - 6} y={sy(t) + 3} textAnchor="end">{t.toFixed(1)}</text>
        </g>
      ))}
      {xLabels?.map((l) => (
        <text key={l.label + l.x} x={sx(l.x)} y={H - 6} textAnchor="middle">{l.label}</text>
      ))}
      {yRef && (
        <g>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(yRef.y)} y2={sy(yRef.y)} stroke={yRef.color ?? '#22c55e'} strokeDasharray="6 4" />
          <text x={W - PAD.r} y={sy(yRef.y) - 4} textAnchor="end" fill={yRef.color ?? '#22c55e'}>{yRef.label}</text>
        </g>
      )}
      {series.map((s, i) => {
        const d = s.points.map((p, j) => `${j === 0 ? 'M' : 'L'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
        return (
          <g key={i}>
            {s.points.length > 1 && (
              <path d={d} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dashed ? '4 4' : undefined} strokeLinejoin="round" />
            )}
            {s.dots && s.points.map((p, j) => <circle key={j} cx={sx(p.x)} cy={sy(p.y)} r={2.6} fill={s.color} opacity={0.7} />)}
          </g>
        );
      })}
    </svg>
  );
}

export function BarChart({
  bars,
  colors,
}: {
  bars: { label: string; values: number[]; highlight?: boolean }[];
  colors: string[];
}) {
  if (bars.length === 0) return <p className="muted">No data yet.</p>;
  const max = Math.max(1, ...bars.flatMap((b) => b.values));
  const sy = scale([0, max * 1.1], [H - PAD.b, PAD.t]);
  const groupW = (W - PAD.l - PAD.r) / bars.length;
  const barW = (groupW * 0.7) / colors.length;
  const yTicks = [0, max / 2, max];
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {yTicks.map((t) => (
        <g key={t}>
          <line className="grid" x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} />
          <text x={PAD.l - 6} y={sy(t) + 3} textAnchor="end">{Math.round(t)}</text>
        </g>
      ))}
      {bars.map((b, i) => {
        const x0 = PAD.l + i * groupW + groupW * 0.15;
        return (
          <g key={b.label}>
            {b.values.map((v, j) => (
              <rect key={j} x={x0 + j * barW} y={sy(v)} width={barW - 1} height={H - PAD.b - sy(v)} fill={colors[j]} opacity={j === 0 ? 0.35 : 1} rx={2} />
            ))}
            <text x={x0 + (barW * colors.length) / 2} y={H - 6} textAnchor="middle" fill={b.highlight ? '#f97316' : undefined}>{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
