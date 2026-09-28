import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar.jsx'
import Topbar from '../components/Topbar.jsx'
import EnrichmentBadge from '../components/EnrichmentBadge.jsx'
import ThreatDetailPanel from '../components/ThreatDetailPanel.jsx'
import SessionWarningBanner from '../components/SessionWarningBanner.jsx'
import { apiRequest, getCurrentUser } from '../api.js'
import { isAnalyst, canAccessModule } from '../permissions.js'
import { CheckIcon, SearchIcon, DownloadIcon } from '../components/icons.jsx'
import './ThreatIntel.css'

const severityFilters = ['all', 'Critical', 'High', 'Medium', 'Low']
const ALL_STATUSES = ['Pending', 'Under Investigation', 'Confirmed', 'Dismissed']

// ---------------------------------------------------------------------------
// Export helpers
// ---------------------------------------------------------------------------

function exportCSV(threats) {
    const headers = ['Value', 'Type', 'Category', 'Severity', 'Confidence', 'Status', 'Enrichment', 'Source', 'Sightings', 'Created']
    const rows = threats.map((t) => [
        `"${t.value}"`,
        t.type,
        t.category,
        t.severity,
        t.confidence,
        t.status,
        t.enrichmentStatus || 'pending',
        `"${t.source || ''}"`,
        t.sightings || 1,
        t.createdAt ? new Date(t.createdAt).toISOString() : '',
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    download('threatshare-export.csv', 'text/csv', csv)
}

function exportJSON(threats) {
    download('threatshare-export.json', 'application/json', JSON.stringify(threats, null, 2))
}

function exportSTIX21(threats) {
    const timestamp = new Date().toISOString()
    const objects = threats.map((t, idx) => {
        let pattern = ''
        if (t.type === 'IP Address') pattern = `[ipv4-addr:value = '${t.value}']`
        else if (t.type === 'Domain') pattern = `[domain-name:value = '${t.value}']`
        else if (t.type === 'URL') pattern = `[url:value = '${t.value}']`
        else if (t.type === 'File Hash') {
            const hashType = t.value.length === 32 ? 'MD5' : t.value.length === 64 ? 'SHA-256' : 'SHA-1'
            pattern = `[file:hashes.'${hashType}' = '${t.value}']`
        } else {
            pattern = `[custom-object:value = '${t.value}']`
        }

        return {
            type: 'indicator',
            spec_version: '2.1',
            id: `indicator--${t._id || idx}`,
            created: t.createdAt ? new Date(t.createdAt).toISOString() : timestamp,
            modified: t.updatedAt ? new Date(t.updatedAt).toISOString() : timestamp,
            name: `${t.category}: ${t.value}`,
            description: t.notes || `Threat intelligence shared via ThreatShare platform with confidence ${t.confidence}%.`,
            indicator_types: [t.category?.toLowerCase().replace(/\s+/g, '-') || 'malicious-activity'],
            pattern,
            pattern_type: 'stix',
            valid_from: t.createdAt ? new Date(t.createdAt).toISOString() : timestamp,
            confidence: t.confidence,
            labels: [t.severity?.toLowerCase(), t.status?.toLowerCase()].filter(Boolean),
            external_references: t.enrichedBy?.map((src) => ({ source_name: src })) || [],
        }
    })

    const bundle = {
        type: 'bundle',
        id: `bundle--${Math.random().toString(36).substring(2, 15)}`,
        spec_version: '2.1',
        objects,
    }

    download(`threatshare-stix2.1-${Date.now()}.json`, 'application/json', JSON.stringify(bundle, null, 2))
}

function download(filename, mime, content) {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([content], { type: mime }))
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
}

// ---------------------------------------------------------------------------
// StatusCell — inline dropdown for Admins & Analysts
// ---------------------------------------------------------------------------

function StatusCell({ threat, canEdit, onUpdated }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
        if (!open) return
        function handleClick(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false)
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [open])

    async function changeStatus(newStatus) {
        if (newStatus === threat.status) { setOpen(false); return }
        setLoading(true)
        setOpen(false)
        try {
            const updated = await apiRequest(`/threats/${threat._id}/status`, {
                method: 'PATCH',
                body: JSON.stringify({ status: newStatus }),
            })
            onUpdated(updated)
        } catch (err) {
            console.error('Status update failed:', err.message)
        } finally {
            setLoading(false)
        }
    }

    const statusSlug = threat.status.toLowerCase().replace(/\s+/g, '-')

    if (!canEdit) {
        return <span className={`status-pill status-pill--${statusSlug}`}>{threat.status}</span>
    }

    return (
        <div className="status-cell" ref={ref}>
            <button
                type="button"
                className={`status-pill status-pill--${statusSlug} status-pill--editable${loading ? ' status-pill--loading' : ''}`}
                onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
                title="Click to change status"
                disabled={loading}
            >
                {loading ? '…' : threat.status}
                <span className="status-pill__caret" aria-hidden="true">▾</span>
            </button>

            {open && (
                <div className="status-dropdown" role="listbox" aria-label="Change status">
                    {ALL_STATUSES.map((s) => (
                        <button
                            key={s}
                            type="button"
                            role="option"
                            aria-selected={s === threat.status}
                            className={`status-dropdown__item status-dropdown__item--${s.toLowerCase().replace(/\s+/g, '-')}${s === threat.status ? ' status-dropdown__item--active' : ''}`}
                            onClick={(e) => { e.stopPropagation(); changeStatus(s) }}
                        >
                            {s === threat.status && <span className="status-dropdown__check"><CheckIcon width={12} height={12} /></span>}
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ---------------------------------------------------------------------------
// ThreatIntel page
// ---------------------------------------------------------------------------

function ThreatIntel() {
    const navigate = useNavigate()
    const [selectedSeverity, setSelectedSeverity] = useState('all')
    const [search, setSearch] = useState('')
    const [threats, setThreats] = useState([])
    const [categories, setCategories] = useState([])
    const [error, setError] = useState('')
    const [selectedThreat, setSelectedThreat] = useState(null)
    const [showExportMenu, setShowExportMenu] = useState(false)
    const exportRef = useRef(null)
    const currentUser = getCurrentUser()
    const canEdit = isAnalyst(currentUser?.role)

    useEffect(() => {
        apiRequest('/dashboard')
            .then((data) => { setThreats(data.threats); setCategories(data.categories) })
            .catch((requestError) => setError(requestError.message))
    }, [])

    // Close export menu on outside click
    useEffect(() => {
        if (!showExportMenu) return
        function onOutside(e) {
            if (exportRef.current && !exportRef.current.contains(e.target)) setShowExportMenu(false)
        }
        document.addEventListener('mousedown', onOutside)
        return () => document.removeEventListener('mousedown', onOutside)
    }, [showExportMenu])

    function handleThreatUpdated(updated) {
        setThreats((current) => current.map((t) => (t._id === updated._id ? updated : t)))
        if (selectedThreat?._id === updated._id) setSelectedThreat(updated)
    }

    const handleClose = useCallback(() => setSelectedThreat(null), [])

    const filteredThreats = useMemo(() => {
        const query = search.trim().toLowerCase()
        return threats.filter((threat) => {
            const matchesSeverity = selectedSeverity === 'all' || threat.severity === selectedSeverity
            const matchesQuery =
                !query ||
                [threat.value, threat.type, threat.category, threat.status]
                    .join(' ')
                    .toLowerCase()
                    .includes(query)
            return matchesSeverity && matchesQuery
        })
    }, [search, selectedSeverity, threats])

    return (
        <div className="dashboard-shell">
            <Sidebar activeKey="threat-intel" />

            <div className="dashboard-main">
                <Topbar title="Threat Intelligence" user={currentUser} />
                <SessionWarningBanner />

                <main className="page-shell threat-intel-page">
                    <section className="page-header">
                        <div>
                            <p className="eyebrow">Threat feed</p>
                            <h2>Operational threat intelligence</h2>
                        </div>

                        <div className="page-header-actions">
                            {/* Export menu */}
                            <div className="export-wrap" ref={exportRef}>
                                <button
                                    className="btn btn--secondary"
                                    type="button"
                                    onClick={() => setShowExportMenu((v) => !v)}
                                    disabled={filteredThreats.length === 0}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <DownloadIcon width={13} height={13} />
                                    Export
                                </button>
                                {showExportMenu && (
                                    <div className="export-menu">
                                        <button type="button" onClick={() => { exportCSV(filteredThreats); setShowExportMenu(false) }}>
                                            Export as CSV
                                        </button>
                                        <button type="button" onClick={() => { exportJSON(filteredThreats); setShowExportMenu(false) }}>
                                            Export as JSON
                                        </button>
                                        <button type="button" onClick={() => { exportSTIX21(filteredThreats); setShowExportMenu(false) }}>
                                            Export as STIX 2.1 (OASIS CTI)
                                        </button>
                                    </div>
                                )}
                            </div>

                            {canAccessModule(currentUser?.role, 'submit-ioc') && (
                                <button className="btn btn--primary" type="button" onClick={() => navigate('/submit-ioc')}>
                                    + Submit IoC
                                </button>
                            )}
                        </div>
                    </section>

                    <section className="page-summary">
                        <div className="summary-card summary-card--primary">
                            <span>Active indicators</span>
                            <strong>{filteredThreats.length}</strong>
                        </div>
                        <div className="summary-card">
                            <span>Validated this week</span>
                            <strong>{threats.length ? Math.round(threats.filter((t) => t.status === 'Confirmed').length / threats.length * 100) : 0}%</strong>
                        </div>
                        <div className="summary-card">
                            <span>High risk campaigns</span>
                            <strong>{threats.filter((t) => t.severity === 'High' || t.severity === 'Critical').length}</strong>
                        </div>
                    </section>

                    <section className="intel-layout">
                        <div className="panel panel--wide">
                            <div className="panel__header">
                                <h2>Threat inventory</h2>
                                <span className="panel__meta">{filteredThreats.length} entries</span>
                            </div>

                            <div className="toolbar">
                                <div className="search-box">
                                    <span aria-hidden="true"><SearchIcon width={14} height={14} /></span>
                                    <input
                                        type="text"
                                        placeholder="Search indicators"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                    />
                                </div>

                                <div className="filter-group" aria-label="Threat severity filters">
                                    {severityFilters.map((level) => (
                                        <button
                                            key={level}
                                            type="button"
                                            className={selectedSeverity === level ? 'filter-chip filter-chip--active' : 'filter-chip'}
                                            onClick={() => setSelectedSeverity(level)}
                                        >
                                            {level === 'all' ? 'All' : level}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="table-wrap">
                                <table className="intel-table">
                                    <thead>
                                        <tr>
                                            <th>Indicator</th>
                                            <th>Type</th>
                                            <th>Category</th>
                                            <th>Severity</th>
                                            <th>Confidence</th>
                                            <th>Status {canEdit && <span className="th-hint">(click to change)</span>}</th>
                                            <th>Enrichment</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredThreats.map((threat) => (
                                            <tr
                                                key={threat._id}
                                                className="intel-table__row--clickable"
                                                onClick={() => setSelectedThreat(threat)}
                                                title="Click to view details"
                                            >
                                                <td className="td--indicator">{threat.value}</td>
                                                <td>{threat.type}</td>
                                                <td>{threat.category}</td>
                                                <td>
                                                    <span className={`severity-badge severity-badge--${threat.severity.toLowerCase()}`}>
                                                        {threat.severity}
                                                    </span>
                                                </td>
                                                <td>{threat.confidence}%</td>
                                                <td>
                                                    <StatusCell
                                                        threat={threat}
                                                        canEdit={canEdit}
                                                        onUpdated={handleThreatUpdated}
                                                    />
                                                </td>
                                                <td>
                                                    <EnrichmentBadge
                                                        status={threat.enrichmentStatus || 'pending'}
                                                        sources={threat.enrichedBy || []}
                                                    />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                {error && <p className="table-error">{error}</p>}
                            </div>
                        </div>

                        <aside className="panel">
                            <div className="panel__header">
                                <h2>Category breakdown</h2>
                                <span className="panel__meta">Live mix</span>
                            </div>

                            <div className="category-list">
                                {(() => {
                                    const total = categories.reduce((sum, c) => sum + c.value, 0)
                                    return categories.map((category) => {
                                        const pct = total > 0 ? Math.round((category.value / total) * 100) : 0
                                        return (
                                            <div className="category-row" key={category.label}>
                                                <div className="category-row__header">
                                                    <span>{category.label}</span>
                                                    <strong>{pct}%</strong>
                                                </div>
                                                <div className="category-row__bar">
                                                    <span style={{ width: `${pct}%`, background: category.color }} />
                                                </div>
                                            </div>
                                        )
                                    })
                                })()}
                            </div>
                        </aside>
                    </section>
                </main>
            </div>

            {/* Threat detail side panel */}
            {selectedThreat && (
                <ThreatDetailPanel
                    threat={selectedThreat}
                    onClose={handleClose}
                    onThreatUpdated={handleThreatUpdated}
                />
            )}
        </div>
    )
}

export default ThreatIntel
