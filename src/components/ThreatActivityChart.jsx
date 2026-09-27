import './ThreatActivityChart.css'

const WIDTH = 560
const HEIGHT = 160
const PADDING = 24

function buildPoints(series) {
  if (!series || series.length === 0) return []
  const values = series.map((s) => s.value)
  const max = Math.max(...values, 1) // minimum scale of 1 so 0-count days render at baseline
  const step = series.length > 1 ? (WIDTH - PADDING * 2) / (series.length - 1) : 0

  return series.map((s, i) => {
    const x = PADDING + i * step
    const y = HEIGHT - PADDING - (s.value / max) * (HEIGHT - PADDING * 2)
    return { x, y, ...s }
  })
}

function ThreatActivityChart({ series, yLabel = 'Value' }) {
  if (!series || series.length === 0) {
    return <div className="activity-chart-empty">No activity data recorded.</div>
  }

  const points = buildPoints(series)
  const maxValue = Math.max(...series.map((s) => s.value), 1)

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ')
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${HEIGHT - PADDING} L ${points[0].x.toFixed(1)} ${HEIGHT - PADDING} Z`
    : ''

  return (
    <div className="activity-chart">
      {/* Y-axis max label */}
      <div className="activity-chart__y-labels">
        <span>{maxValue}</span>
        <span>{Math.round(maxValue / 2)}</span>
        <span>0</span>
      </div>

      <div className="activity-chart__plot">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="activity-chart__svg" role="img" aria-label={`${yLabel} over time`}>
          <defs>
            <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          {[0, 0.5, 1].map((frac, i) => (
            <line
              key={i}
              x1={PADDING}
              y1={PADDING + frac * (HEIGHT - PADDING * 2)}
              x2={WIDTH - PADDING}
              y2={PADDING + frac * (HEIGHT - PADDING * 2)}
              stroke="var(--color-border)"
              strokeWidth="1"
              strokeDasharray={frac === 1 ? '0' : '4 3'}
            />
          ))}

          {areaPath && <path d={areaPath} fill="url(#activityFill)" stroke="none" />}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {points.map((p, i) => (
            <g key={`${p.label}-${i}`}>
              <title>{p.label}: {p.value} threat{p.value !== 1 ? 's' : ''}</title>
              <circle
                cx={p.x}
                cy={p.y}
                r="4"
                fill="var(--color-surface)"
                stroke="var(--color-accent)"
                strokeWidth="2.5"
              />
            </g>
          ))}
        </svg>

        <div className="activity-chart__labels">
          {series.map((s, i) => (
            <span key={`${s.label}-${i}`}>{s.label}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ThreatActivityChart
