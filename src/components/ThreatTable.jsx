import SeverityBadge from './SeverityBadge.jsx'
import './ThreatTable.css'

function statusPillClass(status) {
  const normalized = (status || '').toLowerCase().replace(/\s+/g, '-')
  return `table-status-pill table-status-pill--${normalized}`
}

function truncate(value, max = 38) {
  if (!value) return ''
  return value.length > max ? `${value.slice(0, max)}…` : value
}

function ThreatTable({ threats }) {
  if (!threats || threats.length === 0) {
    return <p className="threat-table-empty">No recent threat indicators found.</p>
  }

  return (
    <div className="threat-table-wrap">
      <table className="threat-table">
        <thead>
          <tr>
            <th>IoC</th>
            <th>Type</th>
            <th>Threat Category</th>
            <th>Severity</th>
            <th>Confidence</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody>
          {threats.map((t) => (
            <tr key={t.id}>
              <td className="threat-table__ioc" title={t.value}>
                {truncate(t.value)}
              </td>
              <td className="threat-table__type">{t.type}</td>
              <td className="threat-table__category">{t.category}</td>
              <td>
                <SeverityBadge severity={t.severity} />
              </td>
              <td className="threat-table__confidence">{t.confidence}%</td>
              <td>
                <span className={statusPillClass(t.status)}>{t.status}</span>
              </td>
              <td className="threat-table__date">{t.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ThreatTable
