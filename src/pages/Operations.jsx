import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from '../components/Sidebar.jsx'
import Topbar from '../components/Topbar.jsx'
import SeverityBadge from '../components/SeverityBadge.jsx'
import ReportFormatModal from '../components/ReportFormatModal.jsx'
import AlertResolveModal from '../components/AlertResolveModal.jsx'
import { SearchIcon, DownloadIcon } from '../components/icons.jsx'
import { apiRequest, getCurrentUser } from '../api.js'
import { generateReport } from '../reportGenerators.js'
import './Operations.css'

const moduleConfig = {
    search: { title: 'Search Threats', eyebrow: 'Investigation', heading: 'Find indicators across the threat feed' },
    alerts: { title: 'Alerts', eyebrow: 'Monitoring', heading: 'Review and triage security alerts' },
    reports: { title: 'Reports', eyebrow: 'Intelligence', heading: 'Generate and review threat reports' },
    activity: { title: 'Activity Logs', eyebrow: 'Audit trail', heading: 'Track changes across ThreatShare' },
    settings: { title: 'Settings', eyebrow: 'Workspace', heading: 'Manage workspace preferences' },
}

function Operations({ module }) {
    const config = moduleConfig[module]
    const location = useLocation()
    const [query, setQuery] = useState(() => {
        // Pre-fill from ?q= URL param when navigating from the Topbar search
        if (module === 'search') {
            return new URLSearchParams(location.search).get('q') || ''
        }
        return ''
    })
    const [threats, setThreats] = useState([])
    const [alerts, setAlerts] = useState([])
    const [activities, setActivities] = useState([])
    const [reports, setReports] = useState([])
    const [dismissed, setDismissed] = useState([])
    const [generated, setGenerated] = useState([])
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState('')
    const currentUser = getCurrentUser()

    useEffect(() => {
        const requests = {
            search: apiRequest('/threats').then(setThreats),
            alerts: apiRequest('/alerts').then(setAlerts),
            activity: apiRequest('/activity').then(setActivities),
            reports: apiRequest('/reports').then(setReports),
        }
        if (requests[module]) requests[module].catch((requestError) => setError(requestError.message))
    }, [module])

    const filteredThreats = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase()
        return threats.filter((threat) => !normalizedQuery ||
            [threat.value, threat.type, threat.category, threat.status].join(' ').toLowerCase().includes(normalizedQuery))
    }, [query, threats])

    if (module === 'settings') {
        return <SettingsPage config={config} saved={saved} onSave={() => setSaved(true)} />
    }

    return (
        <div className="dashboard-shell">
            <Sidebar activeKey={module} />
            <div className="dashboard-main">
                <Topbar title={config.title} user={currentUser} />
                <main className="page-shell operations-page">
                    <section className="page-header">
                        <div><p className="eyebrow">{config.eyebrow}</p><h2>{config.heading}</h2></div>
                        <span className="module-count">{module === 'reports' ? reports.length : module === 'activity' ? activities.length : module === 'alerts' ? alerts.length : filteredThreats.length} records</span>
                    </section>

                    {error && <p className="form-error" role="alert">{error}</p>}

                    {module === 'search' && <SearchView query={query} setQuery={setQuery} threats={filteredThreats} />}
                    {module === 'alerts' && <AlertsView alerts={alerts} dismissed={dismissed} onDismiss={async (id) => {
                        await apiRequest(`/alerts/${id}/dismiss`, { method: 'PATCH' })
                        setDismissed((items) => [...items, id])
                        setAlerts((items) => items.filter((alert) => alert._id !== id))
                    }} onResolve={async (id, resolution, resolutionNotes) => {
                        await apiRequest(`/alerts/${id}/resolve`, {
                            method: 'PATCH',
                            body: JSON.stringify({ resolution, resolutionNotes }),
                        })
                        setDismissed((items) => [...items, id])
                        setAlerts((items) => items.filter((alert) => alert._id !== id))
                    }} />}
                    {module === 'reports' && <ReportsView reports={reports} generated={generated} currentUser={currentUser} onGenerate={async (id, name, format) => {
                        await apiRequest(`/reports/${id}/generate`, { method: 'POST' })
                        setGenerated((items) => [...items, id])
                        await generateReport(name, format, currentUser)
                    }} />}
                    {module === 'activity' && <ActivityView entries={activities} query={query} setQuery={setQuery} />}
                </main>
            </div>
        </div>
    )
}

function SearchView({ query, setQuery, threats }) {
    return <section className="panel"><div className="panel__header"><h2>Indicator inventory</h2><span className="panel__meta">{threats.length} matches</span></div><div className="toolbar"><div className="search-box"><SearchIcon width={15} height={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search value, type, category, or status" /></div></div><ThreatRows threats={threats} /></section>
}

function ThreatRows({ threats }) {
    return <div className="table-wrap"><table className="module-table"><thead><tr><th>Indicator</th><th>Type</th><th>Category</th><th>Severity</th><th>Status</th></tr></thead><tbody>{threats.map((threat) => <tr key={threat._id}><td>{threat.value}</td><td>{threat.type}</td><td>{threat.category}</td><td><SeverityBadge severity={threat.severity} /></td><td>{threat.status}</td></tr>)}</tbody></table>{threats.length === 0 && <p className="empty-state">No indicators match this search.</p>}</div>
}

function AlertsView({ alerts, dismissed, onDismiss, onResolve }) {
    const [resolvingAlert, setResolvingAlert] = useState(null)
    const visibleAlerts = alerts.filter((alert) => !dismissed.includes(alert._id))

    return (
        <>
        <section className="panel">
            <div className="panel__header">
                <h2>Open alerts</h2>
                <span className="panel__meta">{visibleAlerts.length} active</span>
            </div>
            <div className="alert-list">
                {visibleAlerts.map((alert) => (
                    <article className="module-row" key={alert._id}>
                        <div>
                            <div className="module-row__title">{alert.message}</div>
                            <p>{alert.detail}</p>
                            <span className="module-row__time">Recently</span>
                        </div>
                        <div className="module-row__actions">
                            <SeverityBadge severity={alert.severity} />
                            <button
                                className="btn btn--primary btn--small"
                                type="button"
                                onClick={() => setResolvingAlert(alert)}
                            >
                                Investigate &amp; Resolve
                            </button>
                            <button
                                className="btn btn--secondary btn--small"
                                type="button"
                                onClick={() => onDismiss(alert._id)}
                            >
                                Dismiss
                            </button>
                        </div>
                    </article>
                ))}
            </div>
            {visibleAlerts.length === 0 && <p className="empty-state">All alerts have been resolved or dismissed.</p>}
        </section>

        {resolvingAlert && (
            <AlertResolveModal
                alert={resolvingAlert}
                onResolve={async (id, disposition, notes) => {
                    await onResolve(id, disposition, notes)
                    setResolvingAlert(null)
                }}
                onCancel={() => setResolvingAlert(null)}
            />
        )}
        </>
    )
}

function ReportsView({ reports, generated, currentUser, onGenerate }) {
    const [generating, setGenerating] = useState([])
    const [genError, setGenError] = useState({})
    const [formatPicker, setFormatPicker] = useState(null) // { id, name }

    async function handleGenerate(id, name, format) {
        setGenerating((g) => [...g, id])
        setGenError((e) => ({ ...e, [id]: null }))
        try {
            await onGenerate(id, name, format)
        } catch (err) {
            setGenError((e) => ({ ...e, [id]: err.message || 'Generation failed.' }))
        } finally {
            setGenerating((g) => g.filter((x) => x !== id))
        }
    }

    return (
        <>
        <section className="report-grid">
            {reports.map((report) => {
                const isGenerating = generating.includes(report._id)
                const isDone = generated.includes(report._id)
                const err = genError[report._id]
                return (
                    <article className="panel report-card" key={report._id}>
                        <div>
                            <p className="eyebrow">{report.frequency}</p>
                            <h3>{report.name}</h3>
                            <p>{report.description}</p>
                            {err && <p className="report-card__error">{err}</p>}
                        </div>
                        <div className="report-card__footer">
                            <span>Last run {report.lastRun}</span>
                            <div className="report-card__actions">
                                <button
                                    className="btn btn--secondary btn--small"
                                    type="button"
                                    disabled={isGenerating}
                                    title={`Print ${report.name}`}
                                    onClick={() => handleGenerate(report._id, report.name, 'print')}
                                >
                                    {isGenerating ? 'Generating…' : 'Print'}
                                </button>
                                <button
                                    className={`btn btn--small ${isDone ? 'btn--secondary' : 'btn--primary'}`}
                                    type="button"
                                    disabled={isGenerating}
                                    onClick={() => setFormatPicker({ id: report._id, name: report.name })}
                                >
                                    {isGenerating ? 'Processing…' : isDone ? 'Export options' : 'Export / Options'}
                                </button>
                            </div>
                        </div>
                    </article>
                )
            })}
        </section>

        {formatPicker && (
            <ReportFormatModal
                reportName={formatPicker.name}
                user={currentUser}
                onSelect={(format) => {
                    const { id, name } = formatPicker
                    setFormatPicker(null)
                    handleGenerate(id, name, format)
                }}
                onCancel={() => setFormatPicker(null)}
            />
        )}
        </>
    )
}


function ActivityView({ entries, query, setQuery }) {
    const [pageSize, setPageSize] = useState(10)
    const [currentPage, setCurrentPage] = useState(1)

    async function exportCSV(rows) {
        // Log who exported the audit log before downloading
        try { await apiRequest('/activity/export', { method: 'POST' }) } catch { /* proceed even if log fails */ }

        const headers = ['Timestamp', 'Action', 'Actor', 'Target']
        const lines = rows.map((e) => [
            e.createdAt ? new Date(e.createdAt).toLocaleString('en-US') : e.time,
            `"${e.action}"`,
            `"${e.actor}"`,
            `"${e.target}"`,
        ].join(','))
        const csv = [headers.join(','), ...lines].join('\n')
        const a = document.createElement('a')
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
        a.download = `threatshare-audit-log-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
    }

    const normalizedQuery = query.trim().toLowerCase()
    const filteredEntries = useMemo(() => {
        return entries.filter((entry) => 
            !normalizedQuery || 
            `${entry.actor} ${entry.action} ${entry.target}`.toLowerCase().includes(normalizedQuery)
        )
    }, [entries, normalizedQuery])

    // Reset to page 1 whenever search query or page size changes
    useEffect(() => {
        setCurrentPage(1)
    }, [normalizedQuery, pageSize])

    const totalPages = Math.max(1, Math.ceil(filteredEntries.length / pageSize))
    const startIndex = (currentPage - 1) * pageSize
    const paginatedEntries = filteredEntries.slice(startIndex, startIndex + pageSize)

    const pageNumbers = []
    for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i)
    }

    return (
        <section className="panel activity-panel">
            <div className="panel__header">
                <h2>Recent activity</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="panel__meta">{filteredEntries.length} auditable events</span>
                    <button
                        type="button"
                        className="btn btn--secondary btn--small"
                        onClick={() => exportCSV(filteredEntries)}
                        disabled={filteredEntries.length === 0}
                        title="Export audit log as CSV"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                        <DownloadIcon width={13} height={13} />
                        Export CSV
                    </button>
                </div>
            </div>

            <div className="toolbar activity-toolbar">
                <div className="search-box">
                    <span aria-hidden="true"><SearchIcon width={14} height={14} /></span>
                    <input 
                        value={query} 
                        onChange={(event) => setQuery(event.target.value)} 
                        placeholder="Search by action, user, or target..." 
                    />
                </div>

                <div className="page-size-selector">
                    <label htmlFor="pageSizeSelect">Show:</label>
                    <select
                        id="pageSizeSelect"
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="page-size-select"
                    >
                        <option value={10}>10 per page</option>
                        <option value={15}>15 per page</option>
                    </select>
                </div>
            </div>

            <div className="activity-list activity-list--compact">
                {paginatedEntries.map((entry) => (
                    <div className="activity-row" key={entry._id || `${entry.createdAt}-${entry.target}`}>
                        <div className="activity-row__left">
                            <span className="activity-row__dot" aria-hidden="true" />
                            <div className="activity-row__text">
                                <span className="activity-row__action">{entry.action}</span>
                                <span className="activity-row__meta">
                                    by <strong>{entry.actor}</strong> on <code className="activity-row__code">{entry.target}</code>
                                </span>
                            </div>
                        </div>
                        <span className="activity-row__time">
                            {entry.createdAt
                                ? new Date(entry.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                                : entry.time}
                        </span>
                    </div>
                ))}


                {filteredEntries.length === 0 && (
                    <p className="empty-state">No activity records match your search.</p>
                )}
            </div>

            {totalPages > 1 && (
                <div className="pagination">
                    <span className="pagination__info">
                        Showing {startIndex + 1}–{Math.min(startIndex + pageSize, filteredEntries.length)} of {filteredEntries.length}
                    </span>

                    <div className="pagination__controls">
                        <button
                            type="button"
                            className="pagination__btn"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        >
                            ‹ Prev
                        </button>

                        {pageNumbers.map((num) => (
                            <button
                                key={num}
                                type="button"
                                className={`pagination__num ${currentPage === num ? 'pagination__num--active' : ''}`}
                                onClick={() => setCurrentPage(num)}
                            >
                                {num}
                            </button>
                        ))}

                        <button
                            type="button"
                            className="pagination__btn"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        >
                            Next ›
                        </button>
                    </div>
                </div>
            )}
        </section>
    )
}


function SettingsPage({ config, saved, onSave }) {
    const currentUser = getCurrentUser()
    const [settings, setSettings] = useState(null)
    useEffect(() => { apiRequest('/settings').then(setSettings).catch(() => setSettings({ criticalAlerts: true, dailyDigest: true, defaultThreatView: 'All active indicators', timezone: 'UTC' })) }, [])
    if (!settings) return <div className="page-loading">Loading settings...</div>
    const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }))
    const save = async () => { await apiRequest('/settings', { method: 'PATCH', body: JSON.stringify(settings) }); onSave() }
    return <div className="dashboard-shell"><Sidebar activeKey="settings" /><div className="dashboard-main"><Topbar title={config.title} user={currentUser} /><main className="page-shell operations-page"><section className="page-header"><div><p className="eyebrow">{config.eyebrow}</p><h2>{config.heading}</h2></div></section><section className="settings-grid"><article className="panel settings-card"><h2>Notifications</h2><label className="toggle-row"><span><strong>Critical threat alerts</strong><small>Notify analysts when critical IoCs arrive.</small></span><input type="checkbox" checked={settings.criticalAlerts} onChange={(event) => update('criticalAlerts', event.target.checked)} /></label><label className="toggle-row"><span><strong>Daily intelligence digest</strong><small>Receive a summary of new activity each morning.</small></span><input type="checkbox" checked={settings.dailyDigest} onChange={(event) => update('dailyDigest', event.target.checked)} /></label></article><article className="panel settings-card"><h2>Workspace defaults</h2><label className="field"><span>Default threat view</span><select value={settings.defaultThreatView} onChange={(event) => update('defaultThreatView', event.target.value)}><option>All active indicators</option><option>Needs investigation</option><option>Critical and high severity</option></select></label><label className="field"><span>Timezone</span><select value={settings.timezone} onChange={(event) => update('timezone', event.target.value)}><option>UTC</option><option>Eastern Time</option><option>Central European Time</option></select></label><button className="btn btn--primary" type="button" onClick={save}>{saved ? 'Preferences saved' : 'Save preferences'}</button></article></section></main></div></div>
}

export default Operations