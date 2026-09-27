import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar.jsx'
import Topbar from '../components/Topbar.jsx'
import EnrichmentBadge from '../components/EnrichmentBadge.jsx'
import './SubmitIoc.css'
import { apiRequest, getCurrentUser } from '../api.js'

const initialForm = {
    indicator: '',
    type: 'IP Address',
    source: 'Manual entry',
    confidence: '82',
    notes: '',
    category: 'Suspicious Activity',
}

// ---------------------------------------------------------------------------
// SubmissionCard — polls enrichment status until it resolves
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2000
const POLL_MAX_MS = 30_000

function SubmissionCard({ item, onEnriched }) {
    const [enrichStatus, setEnrichStatus] = useState(item.enrichmentStatus || 'pending')
    const [enrichSources, setEnrichSources] = useState(item.enrichedBy || [])

    useEffect(() => {
        if (!item._id || enrichStatus !== 'pending') return

        let elapsed = 0
        const interval = setInterval(async () => {
            elapsed += POLL_INTERVAL_MS
            try {
                const fresh = await apiRequest(`/threats/${item._id}`)
                if (fresh.enrichmentStatus && fresh.enrichmentStatus !== 'pending') {
                    setEnrichStatus(fresh.enrichmentStatus)
                    setEnrichSources(fresh.enrichedBy || [])
                    onEnriched(fresh)
                    clearInterval(interval)
                }
            } catch {
                // silently ignore polling errors
            }
            if (elapsed >= POLL_MAX_MS) {
                clearInterval(interval)
                setEnrichStatus('error')
            }
        }, POLL_INTERVAL_MS)

        return () => clearInterval(interval)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [item._id])

    return (
        <div className="submission-card">
            <div className="submission-card__head">
                <span className="submission-card__label" title={item.value}>{item.value}</span>
                <span className={`status-pill status-pill--${(item.status || 'Queued').toLowerCase().replace(/\s+/g, '-')}`}>
                    {item.status || 'Queued'}
                </span>
            </div>
            <div className="submission-card__meta">
                <span>{item.type}</span>
                <strong>{item.score ?? item.confidence}%</strong>
            </div>
            <div className="submission-card__meta">
                <span>{item.source}</span>
            </div>
            <div className="submission-card__enrich">
                <EnrichmentBadge status={enrichStatus} sources={enrichSources} />
            </div>
        </div>
    )
}

// ---------------------------------------------------------------------------
// SubmitIoc page
// ---------------------------------------------------------------------------

function SubmitIoc() {
    const navigate = useNavigate()
    const [mode, setMode] = useState('single') // 'single' | 'bulk'
    const [form, setForm] = useState(initialForm)
    const [submitted, setSubmitted] = useState([])
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    // Duplicate / Re-sighting live validation state
    const [checkResult, setCheckResult] = useState(null)
    const [checking, setChecking] = useState(false)

    // Bulk ingestion state
    const [bulkText, setBulkText] = useState('')
    const [bulkCategory, setBulkCategory] = useState('Suspicious Activity')
    const [bulkSource, setBulkSource] = useState('Manual entry')
    const [bulkConfidence, setBulkConfidence] = useState('80')
    const [bulkLoading, setBulkLoading] = useState(false)

    useEffect(() => {
        apiRequest('/threats')
            .then(setSubmitted)
            .catch((requestError) => setError(requestError.message))
    }, [])

    const currentUser = getCurrentUser()
    const queue = useMemo(() => submitted, [submitted])

    // Live validation debounce check
    useEffect(() => {
        const val = form.indicator.trim()
        if (!val || val.length < 3) {
            setCheckResult(null)
            return
        }
        const timer = setTimeout(async () => {
            setChecking(true)
            try {
                const res = await apiRequest(`/threats/check?indicator=${encodeURIComponent(val)}`)
                setCheckResult(res.exists ? res.threat : null)
            } catch {
                setCheckResult(null)
            } finally {
                setChecking(false)
            }
        }, 350)
        return () => clearTimeout(timer)
    }, [form.indicator])

    function handleChange(event) {
        const { name, value } = event.target
        setForm((current) => ({ ...current, [name]: value }))
    }

    async function handleSubmit(event) {
        event.preventDefault()

        if (!form.indicator.trim()) {
            setError('Enter an indicator value before submitting.')
            return
        }
        try {
            const result = await apiRequest('/threats', {
                method: 'POST',
                body: JSON.stringify(form),
            })
            setSubmitted((current) => [result.threat, ...current.filter((item) => item._id !== result.threat._id)])
            setMessage(
                result.message ||
                    (result.detection === 'correlated'
                        ? `IoC submitted and correlated with ${result.relatedCount} existing indicator(s).`
                        : result.detection === 're-sighting'
                        ? 'Existing IoC re-sighted and reopened for investigation.'
                        : 'IoC submitted successfully.')
            )
            setError('')
            setCheckResult(null)
            setForm(initialForm)
        } catch (requestError) {
            setError(requestError.message)
            setMessage('')
        }
    }

    // Parsed count for bulk text
    const parsedBulkLines = useMemo(() => {
        return bulkText
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && !l.startsWith('#'))
    }, [bulkText])

    async function handleBulkSubmit(e) {
        e.preventDefault()
        if (parsedBulkLines.length === 0) {
            setError('Please enter at least one indicator.')
            return
        }
        setBulkLoading(true)
        setError('')
        setMessage('')

        try {
            const res = await apiRequest('/threats/bulk', {
                method: 'POST',
                body: JSON.stringify({
                    items: parsedBulkLines,
                    defaultCategory: bulkCategory,
                    defaultSource: bulkSource,
                    defaultConfidence: bulkConfidence,
                }),
            })
            setMessage(res.message)
            setBulkText('')
            // Refresh recent threats list
            const fresh = await apiRequest('/threats')
            setSubmitted(fresh)
        } catch (err) {
            setError(err.message || 'Bulk import failed.')
        } finally {
            setBulkLoading(false)
        }
    }

    function handleFileUpload(e) {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (event) => {
            const text = event.target?.result
            if (typeof text === 'string') {
                setBulkText(text)
            }
        }
        reader.readAsText(file)
    }

    return (
        <div className="dashboard-shell">
            <Sidebar activeKey="submit-ioc" />

            <div className="dashboard-main">
                <Topbar title="Submit IoC" user={currentUser} />

                <main className="page-shell submit-page">
                    <section className="form-card">
                        <div className="form-card__header-tabs">
                            <h2>{mode === 'single' ? 'New indicator submission' : 'Bulk IoC import'}</h2>
                            <div className="submit-mode-toggle">
                                <button
                                    type="button"
                                    className={`submit-mode-btn ${mode === 'single' ? 'submit-mode-btn--active' : ''}`}
                                    onClick={() => { setMode('single'); setError(''); setMessage('') }}
                                >
                                    Single IoC
                                </button>
                                <button
                                    type="button"
                                    className={`submit-mode-btn ${mode === 'bulk' ? 'submit-mode-btn--active' : ''}`}
                                    onClick={() => { setMode('bulk'); setError(''); setMessage('') }}
                                >
                                    Bulk Import
                                </button>
                            </div>
                        </div>

                        {mode === 'single' ? (
                            <form className="ioc-form" onSubmit={handleSubmit}>
                                <div className="field">
                                    <label htmlFor="indicator">Indicator value</label>
                                    <input
                                        id="indicator"
                                        name="indicator"
                                        type="text"
                                        placeholder="e.g. 185.212.47.118 or malicious-example.com"
                                        value={form.indicator}
                                        onChange={handleChange}
                                    />
                                    {checking && <span className="ioc-check-status">Checking feeds…</span>}
                                    {checkResult && (
                                        <div className="resighting-banner">
                                            <span className="resighting-banner__icon">⚠️</span>
                                            <div className="resighting-banner__content">
                                                <strong>Existing indicator detected in database:</strong>
                                                <span>
                                                    Status: <em>{checkResult.status}</em> · Total sightings: <em>{checkResult.sightings}</em> · Severity: <em>{checkResult.severity}</em>.
                                                    Submitting will record a <strong>re-sighting</strong> and reopen it for investigation.
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="field-grid">
                                    <div className="field">
                                        <label htmlFor="type">Type</label>
                                        <select id="type" name="type" value={form.type} onChange={handleChange}>
                                            <option>IP Address</option>
                                            <option>Domain</option>
                                            <option>File Hash</option>
                                            <option>URL</option>
                                            <option>Email</option>
                                        </select>
                                    </div>

                                    <div className="field">
                                        <label htmlFor="category">Threat category</label>
                                        <select id="category" name="category" value={form.category} onChange={handleChange}>
                                            <option>Malware</option>
                                            <option>Phishing</option>
                                            <option>Ransomware</option>
                                            <option>Botnet</option>
                                            <option>Suspicious Activity</option>
                                            <option>Reconnaissance</option>
                                        </select>
                                    </div>

                                    <div className="field">
                                        <label htmlFor="source">Source</label>
                                        <select id="source" name="source" value={form.source} onChange={handleChange}>
                                            <option>Manual entry</option>
                                            <option>User report</option>
                                            <option>External community feed</option>
                                            <option>Endpoint alert</option>
                                            <option>Threat intel partner</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="field">
                                    <label htmlFor="confidence">Confidence score</label>
                                    <input
                                        id="confidence"
                                        name="confidence"
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={form.confidence}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="field">
                                    <label htmlFor="notes">Submission notes</label>
                                    <textarea
                                        id="notes"
                                        name="notes"
                                        placeholder="Optional context, campaign details, or evidence summary."
                                        value={form.notes}
                                        onChange={handleChange}
                                    />
                                </div>

                                <div className="form-actions">
                                    <button type="button" className="btn btn--secondary" onClick={() => navigate('/dashboard')}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn--primary">
                                        {checkResult ? 'Re-sight Indicator' : 'Submit IoC'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <form className="ioc-form" onSubmit={handleBulkSubmit}>
                                <div className="field">
                                    <div className="bulk-input-header">
                                        <label htmlFor="bulkText">Paste Indicators (one per line):</label>
                                        <label className="bulk-file-upload-btn">
                                            📁 Upload CSV / TXT
                                            <input type="file" accept=".txt,.csv" onChange={handleFileUpload} style={{ display: 'none' }} />
                                        </label>
                                    </div>
                                    <textarea
                                        id="bulkText"
                                        className="bulk-textarea"
                                        rows={7}
                                        placeholder={"185.220.101.45\nmalware.wicar.org\n44d88612fea8a8f36de82e1278abb02f\nhttp://malware.wicar.org/data/eicar.com"}
                                        value={bulkText}
                                        onChange={(e) => setBulkText(e.target.value)}
                                    />
                                    <span className="bulk-count-badge">
                                        {parsedBulkLines.length} indicator{parsedBulkLines.length !== 1 ? 's' : ''} detected
                                    </span>
                                </div>

                                <div className="field-grid">
                                    <div className="field">
                                        <label>Default Category</label>
                                        <select value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
                                            <option>Malware</option>
                                            <option>Phishing</option>
                                            <option>Ransomware</option>
                                            <option>Botnet</option>
                                            <option>Suspicious Activity</option>
                                            <option>Reconnaissance</option>
                                        </select>
                                    </div>

                                    <div className="field">
                                        <label>Source</label>
                                        <select value={bulkSource} onChange={(e) => setBulkSource(e.target.value)}>
                                            <option>Manual entry</option>
                                            <option>External community feed</option>
                                            <option>Endpoint alert</option>
                                            <option>Threat intel partner</option>
                                        </select>
                                    </div>

                                    <div className="field">
                                        <label>Confidence</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={bulkConfidence}
                                            onChange={(e) => setBulkConfidence(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="form-actions">
                                    <button type="button" className="btn btn--secondary" onClick={() => navigate('/dashboard')}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn--primary" disabled={bulkLoading || parsedBulkLines.length === 0}>
                                        {bulkLoading ? 'Ingesting…' : `Import ${parsedBulkLines.length} Indicators`}
                                    </button>
                                </div>
                            </form>
                        )}

                        {message && <div className="form-success">{message}</div>}
                        {error && <div className="form-error">{error}</div>}
                    </section>

                    <aside className="list-card">
                        <h2>Recent submissions</h2>

                        <div className="submission-list">
                            {queue.map((item) => (
                                <SubmissionCard
                                    key={item._id || item.id}
                                    item={item}
                                    onEnriched={(updated) =>
                                        setSubmitted((current) =>
                                            current.map((t) => (t._id === updated._id ? updated : t))
                                        )
                                    }
                                />
                            ))}
                        </div>
                    </aside>
                </main>
            </div>
        </div>
    )
}

export default SubmitIoc
