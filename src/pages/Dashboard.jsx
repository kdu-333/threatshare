import Sidebar from '../components/Sidebar.jsx'
import Topbar from '../components/Topbar.jsx'
import StatCard from '../components/StatCard.jsx'
import ThreatTable from '../components/ThreatTable.jsx'
import AlertPanel from '../components/AlertPanel.jsx'
import ThreatActivityChart from '../components/ThreatActivityChart.jsx'
import CategoryBreakdown from '../components/CategoryBreakdown.jsx'
import SessionWarningBanner from '../components/SessionWarningBanner.jsx'
import './Dashboard.css'
import { useNavigate } from 'react-router-dom'
import { apiRequest, getCurrentUser } from '../api.js'
import { canAccessModule } from '../permissions.js'
import { useEffect, useState, useCallback } from 'react'

// Build threats-per-day series for the last 7 days
function buildTrendSeries(threats) {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push({
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dateStr: d.toISOString().slice(0, 10),
      value: 0,
    })
  }
  threats.forEach((t) => {
    const dateStr = t.createdAt?.slice(0, 10)
    const day = days.find((d) => d.dateStr === dateStr)
    if (day) day.value += 1
  })
  return days
}

function Dashboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const currentUser = getCurrentUser()

  const fetchData = useCallback(async () => {
    setRefreshing(true)
    try {
      const result = await apiRequest('/dashboard')
      setData(result)
      setLastUpdated(new Date())
      setError('')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  if (error) return <div className="page-error">{error}</div>
  if (!data) return <div className="page-loading">Loading dashboard...</div>

  const summaryStats = [
    { id: 'total', label: 'Total Threats', value: data.stats.total, tone: 'neutral' },
    { id: 'critical', label: 'Critical', value: data.stats.critical, tone: 'critical' },
    { id: 'high', label: 'High', value: data.stats.high, tone: 'high' },
    { id: 'medium', label: 'Medium', value: data.stats.medium, tone: 'medium' },
    { id: 'pending', label: 'Pending Investigation', value: data.stats.pending, tone: 'neutral' },
  ]

  const trendSeries = buildTrendSeries(data.threats)

  return (
    <div className="dashboard-shell">
      <Sidebar activeKey="dashboard" />

      <div className="dashboard-main">
        <Topbar title="Threat Intelligence Dashboard" user={currentUser} />
        <SessionWarningBanner />

        <main className="dashboard-content">
          <div className="dashboard-content__intro">
            <div>
              <p>Monitor, investigate, and manage reported threat intelligence.</p>
              {lastUpdated && (
                <p className="dashboard-last-updated">
                  Last updated: {lastUpdated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' })}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className="btn btn--secondary"
                type="button"
                onClick={fetchData}
                disabled={refreshing}
                title="Refresh dashboard data"
              >
                {refreshing ? '↻ Refreshing…' : '↻ Refresh'}
              </button>
              {canAccessModule(currentUser?.role, 'submit-ioc') && (
                <button className="btn btn--primary" type="button" onClick={() => navigate('/submit-ioc')}>
                  + Submit IoC
                </button>
              )}
            </div>
          </div>

          <section className="stat-grid" aria-label="Threat summary">
            {summaryStats.map((s) => (
              <StatCard key={s.id} label={s.label} value={s.value} tone={s.tone} />
            ))}
          </section>

          <section className="dashboard-grid">
            <div className="panel panel--table">
              <div className="panel__header">
                <h2>Recent Threats</h2>
                <button type="button" className="link link-button" onClick={() => navigate('/threat-intel')}>View all</button>
              </div>
              <ThreatTable threats={data.threats.slice(0, 6).map((threat) => ({ ...threat, id: threat._id, date: threat.createdAt?.slice(0, 10) }))} />
            </div>

            <div className="panel panel--alerts">
              <div className="panel__header">
                <h2>Recent Alerts</h2>
                {canAccessModule(currentUser?.role, 'alerts') && (
                  <button type="button" className="link link-button" onClick={() => navigate('/alerts')}>View all</button>
                )}
              </div>
              <AlertPanel alerts={data.alerts.slice(0, 6).map((alert) => ({ ...alert, id: alert._id, time: 'Recently' }))} />
            </div>
          </section>

          <section className="dashboard-grid dashboard-grid--split">
            <div className="panel panel--chart">
              <div className="panel__header">
                <h2>Threat Activity</h2>
                <span className="panel__meta">Submissions per day — last 7 days</span>
              </div>
              <ThreatActivityChart series={trendSeries} yLabel="Threats" />
            </div>

            <div className="panel panel--categories">
              <div className="panel__header">
                <h2>Threat Categories</h2>
                <span className="panel__meta">Active IoCs</span>
              </div>
              <CategoryBreakdown categories={data.categories} />
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

export default Dashboard
