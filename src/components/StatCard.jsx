import './StatCard.css'

function StatCard({ label, value, tone = 'neutral' }) {
  return (
    <div className={`stat-card stat-card--${tone}`}>
      <span className="stat-card__dot" />
      <div className="stat-card__body">
        <p className="stat-card__value">{value}</p>
        <p className="stat-card__label">{label}</p>
      </div>
    </div>
  )
}

export default StatCard
