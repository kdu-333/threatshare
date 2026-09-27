import './CategoryBreakdown.css'

const CATEGORY_COLORS = {
  'Malware': '#9333ea',
  'Phishing': '#f59e0b',
  'Ransomware': '#ef4444',
  'Botnet': '#06b6d4',
  'Suspicious Activity': '#3b82f6',
  'Reconnaissance': '#10b981',
}

function CategoryBreakdown({ categories }) {
  if (!categories || categories.length === 0) {
    return <p className="category-empty">No category data available.</p>
  }

  const max = Math.max(...categories.map((c) => c.value)) || 1
  const total = categories.reduce((sum, c) => sum + c.value, 0) || 1

  return (
    <div className="category-breakdown">
      {categories.map((c) => {
        const color = c.color || CATEGORY_COLORS[c.label] || 'var(--color-accent)'
        const percentage = Math.round((c.value / total) * 100)
        const fillWidth = Math.max(8, Math.round((c.value / max) * 100))

        return (
          <div className="category-breakdown__row" key={c.label}>
            <div className="category-breakdown__meta">
              <span className="category-breakdown__label">{c.label}</span>
              <span className="category-breakdown__value">
                {c.value} <small>({percentage}%)</small>
              </span>
            </div>
            <div className="category-breakdown__track">
              <div
                className="category-breakdown__fill"
                style={{ width: `${fillWidth}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default CategoryBreakdown
