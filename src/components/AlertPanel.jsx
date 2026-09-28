import { useNavigate } from 'react-router-dom'
import SeverityBadge from './SeverityBadge.jsx'
import { CheckIcon } from './icons.jsx'
import './AlertPanel.css'

function formatAlertDetail(detail) {
  if (!detail) return null

  // Regex to match URLs, long hashes (MD5, SHA1, SHA256), or IPv4 addresses
  const regex = /(https?:\/\/[^\s]+|[a-f0-9]{32,64}|(?:\d{1,3}\.){3}\d{1,3})/gi
  const parts = []
  let lastIndex = 0
  let match

  while ((match = regex.exec(detail)) !== null) {
    if (match.index > lastIndex) {
      parts.push(detail.substring(lastIndex, match.index))
    }
    const val = match[0]
    const isLong = val.length > 24
    const displayVal = isLong ? `${val.slice(0, 10)}…${val.slice(-8)}` : val
    parts.push(
      <code key={match.index} className="alert-code-tag" title={val}>
        {displayVal}
      </code>
    )
    lastIndex = regex.lastIndex
  }

  if (lastIndex < detail.length) {
    parts.push(detail.substring(lastIndex))
  }

  return parts.length > 0 ? parts : detail
}

function AlertPanel({ alerts, onResolve }) {
  const navigate = useNavigate()

  if (!alerts || alerts.length === 0) {
    return (
      <div className="alert-panel-empty">
        <span className="alert-panel-empty__icon"><CheckIcon width={24} height={24} /></span>
        <p>No active alerts. All systems normal.</p>
      </div>
    )
  }

  return (
    <div className="alert-panel">
      {alerts.map((alert) => (
        <div className={`alert-card alert-card--${(alert.severity || 'medium').toLowerCase()}`} key={alert.id || alert._id}>
          <div className="alert-card__top">
            <div className="alert-card__badge-wrap">
              <SeverityBadge severity={alert.severity} />
              <span className="alert-card__title">{alert.message}</span>
            </div>

            <div className="alert-card__meta">
              <span className="alert-card__time">{alert.time || 'Recently'}</span>
              <button
                type="button"
                className="alert-card__resolve-btn"
                title="Triage this alert in Operations"
                onClick={() => navigate('/alerts')}
              >
                Triage ›
              </button>
            </div>
          </div>

          <div className="alert-card__detail">
            {formatAlertDetail(alert.detail)}
          </div>
        </div>
      ))}
    </div>
  )
}

export default AlertPanel
