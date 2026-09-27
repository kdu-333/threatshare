import './SeverityBadge.css'

const TONE_BY_SEVERITY = {
  Critical: 'critical',
  High: 'high',
  Medium: 'medium',
  Low: 'low',
}

function SeverityBadge({ severity }) {
  const tone = TONE_BY_SEVERITY[severity] || 'low'
  return <span className={`badge badge--${tone}`}>{severity}</span>
}

export default SeverityBadge
