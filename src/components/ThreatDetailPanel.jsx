import { useEffect, useRef, useState } from 'react'
import EnrichmentBadge from './EnrichmentBadge.jsx'
import { apiRequest, getCurrentUser } from '../api.js'
import { isAnalyst } from '../permissions.js'
import { CloseIcon } from './icons.jsx'
import './ThreatDetailPanel.css'

const STATUS_COLORS = {
    Confirmed: '#34a853',
    'Under Investigation': '#e8a900',
    Pending: '#8eadd4',
    Dismissed: '#888',
}

function Field({ label, value, mono }) {
    if (!value && value !== 0) return null
    return (
        <div className="tdp__field">
            <span className="tdp__label">{label}</span>
            <span className={`tdp__value${mono ? ' tdp__value--mono' : ''}`}>{value}</span>
        </div>
    )
}

function ThreatDetailPanel({ threat, onClose, onThreatUpdated }) {
    const panelRef = useRef(null)
    const currentUser = getCurrentUser()
    const canComment = isAnalyst(currentUser?.role)

    const [comments, setComments] = useState(threat?.comments || [])
    const [commentText, setCommentText] = useState('')
    const [commentType, setCommentType] = useState('comment') // 'comment' | 'evidence'
    const [evidenceUrl, setEvidenceUrl] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [commentError, setCommentError] = useState('')
    const [relatedThreats, setRelatedThreats] = useState([])
    const [relatedLoading, setRelatedLoading] = useState(false)

    // Keep comments in sync if threat changes
    useEffect(() => {
        setComments(threat?.comments || [])
    }, [threat?._id, threat?.comments])

    // Fetch related threat details whenever the threat changes
    useEffect(() => {
        const ids = threat?.relatedThreatIds
        if (!ids?.length) { setRelatedThreats([]); return }
        setRelatedLoading(true)
        Promise.all(ids.map((id) => apiRequest(`/threats/${id}`)))
            .then(setRelatedThreats)
            .catch(() => setRelatedThreats([]))
            .finally(() => setRelatedLoading(false))
    }, [threat?._id])

    // Close on Escape
    useEffect(() => {
        function onKey(e) { if (e.key === 'Escape') onClose() }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
    }, [onClose])

    // Trap focus inside panel
    useEffect(() => {
        panelRef.current?.focus()
    }, [])

    if (!threat) return null

    const statusColor = STATUS_COLORS[threat.status] || '#888'
    const enrichedDate = threat.enrichedAt
        ? new Date(threat.enrichedAt).toLocaleString()
        : null

    async function handleAddComment(e) {
        e.preventDefault()
        if (!commentText.trim()) return
        setSubmitting(true)
        setCommentError('')

        try {
            const res = await apiRequest(`/threats/${threat._id}/comments`, {
                method: 'POST',
                body: JSON.stringify({
                    text: commentText.trim(),
                    type: commentType,
                    url: evidenceUrl.trim() || undefined,
                }),
            })
            setComments(res.comments)
            setCommentText('')
            setEvidenceUrl('')
            if (onThreatUpdated) {
                onThreatUpdated({ ...threat, comments: res.comments })
            }
        } catch (err) {
            setCommentError(err.message || 'Could not post comment.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <>
            {/* Backdrop */}
            <div className="tdp-backdrop" onClick={onClose} aria-hidden="true" />

            {/* Panel */}
            <aside
                className="tdp"
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={`Threat details: ${threat.value}`}
            >
                <div className="tdp__header">
                    <div className="tdp__header-meta">
                        <span className="tdp__type-tag">{threat.type}</span>
                        <span
                            className="tdp__status-dot"
                            style={{ background: statusColor }}
                            title={threat.status}
                        />
                        <span className="tdp__status-label" style={{ color: statusColor }}>
                            {threat.status}
                        </span>
                    </div>
                    <button
                        type="button"
                        className="tdp__close"
                        onClick={onClose}
                        aria-label="Close panel"
                    >
                        <CloseIcon />
                    </button>
                </div>

                <h2 className="tdp__indicator">{threat.value}</h2>

                <div className="tdp__section">
                    <h3 className="tdp__section-title">Classification</h3>
                    <div className="tdp__fields">
                        <Field label="Category" value={threat.category} />
                        <Field label="Severity" value={
                            <span className={`severity-badge severity-badge--${threat.severity?.toLowerCase()}`}>
                                {threat.severity}
                            </span>
                        } />
                        <Field label="Confidence" value={`${threat.confidence}%`} />
                        <Field label="Sightings" value={threat.sightings} />
                    </div>
                </div>

                <div className="tdp__section">
                    <h3 className="tdp__section-title">Origin</h3>
                    <div className="tdp__fields">
                        <Field label="Source" value={threat.source} />
                        <Field label="Submitted" value={threat.createdAt ? new Date(threat.createdAt).toLocaleString() : null} />
                    </div>
                </div>

                <div className="tdp__section">
                    <h3 className="tdp__section-title">Enrichment</h3>
                    <div className="tdp__fields">
                        <Field label="Status" value={
                            <EnrichmentBadge
                                status={threat.enrichmentStatus || 'pending'}
                                sources={threat.enrichedBy || []}
                            />
                        } />
                        {threat.enrichedBy?.length > 0 && (
                            <Field label="Confirmed by" value={threat.enrichedBy.join(', ')} />
                        )}
                        {enrichedDate && <Field label="Checked at" value={enrichedDate} />}
                    </div>
                </div>

                {threat.notes && (
                    <div className="tdp__section">
                        <h3 className="tdp__section-title">Analyst notes</h3>
                        <p className="tdp__notes">{threat.notes}</p>
                    </div>
                )}

                {threat.relatedThreatIds?.length > 0 && (
                    <div className="tdp__section">
                        <h3 className="tdp__section-title">Related indicators ({threat.relatedThreatIds.length})</h3>
                        {relatedLoading ? (
                            <p className="tdp__related-loading">Loading related indicators…</p>
                        ) : (
                            <div className="tdp__related-list">
                                {relatedThreats.map((r) => (
                                    <div className="tdp__related-item" key={r._id}>
                                        <div className="tdp__related-value" title={r.value}>{r.value}</div>
                                        <div className="tdp__related-meta">
                                            <span className="tdp__related-type">{r.type}</span>
                                            <span className={`severity-badge severity-badge--${r.severity?.toLowerCase()}`}>{r.severity}</span>
                                            <span className={`status-pill status-pill--${r.status?.toLowerCase().replace(/\s+/g, '-')}`}>{r.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Comments & Evidence Section */}
                <div className="tdp__section tdp__section--comments">
                    <div className="tdp__section-header">
                        <h3 className="tdp__section-title">Investigation Notes &amp; Evidence ({comments.length})</h3>
                    </div>

                    <div className="tdp__comments-list">
                        {comments.length === 0 ? (
                            <p className="tdp__no-comments">No investigation comments or evidence recorded yet.</p>
                        ) : (
                            comments.map((c, i) => (
                                <div className={`tdp__comment-item tdp__comment-item--${c.type || 'comment'}`} key={c._id || i}>
                                    <div className="tdp__comment-head">
                                        <span className="tdp__comment-author">{c.author}</span>
                                        <span className="tdp__comment-badge">{c.type === 'evidence' ? 'Evidence' : 'Note'}</span>
                                        <span className="tdp__comment-time">{new Date(c.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                    <p className="tdp__comment-text">{c.text}</p>
                                    {c.url && (
                                        <a href={c.url} target="_blank" rel="noopener noreferrer" className="tdp__comment-url">
                                            {c.url}
                                        </a>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

                    {canComment ? (
                        <form className="tdp__comment-form" onSubmit={handleAddComment}>
                            <div className="tdp__comment-type-toggle">
                                <button
                                    type="button"
                                    className={`tdp__type-btn ${commentType === 'comment' ? 'tdp__type-btn--active' : ''}`}
                                    onClick={() => setCommentType('comment')}
                                >
                                    Add Note
                                </button>
                                <button
                                    type="button"
                                    className={`tdp__type-btn ${commentType === 'evidence' ? 'tdp__type-btn--active' : ''}`}
                                    onClick={() => setCommentType('evidence')}
                                >
                                    Attach Evidence
                                </button>
                            </div>

                            <textarea
                                className="tdp__comment-input"
                                placeholder={commentType === 'evidence' ? 'Describe forensic evidence, sandbox results, or campaign link...' : 'Add analyst investigation comment or mitigation advice...'}
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                rows={3}
                                required
                            />

                            {commentType === 'evidence' && (
                                <input
                                    type="url"
                                    className="tdp__evidence-url-input"
                                    placeholder="https://virustotal.com/gui/file/... (optional reference link)"
                                    value={evidenceUrl}
                                    onChange={(e) => setEvidenceUrl(e.target.value)}
                                />
                            )}

                            {commentError && <p className="tdp__comment-error">{commentError}</p>}

                            <button
                                type="submit"
                                className="btn btn--primary btn--small tdp__comment-submit"
                                disabled={submitting || !commentText.trim()}
                            >
                                {submitting ? 'Posting…' : commentType === 'evidence' ? 'Save Evidence' : 'Post Note'}
                            </button>
                        </form>
                    ) : (
                        <p className="tdp__readonly-notice">Viewer account: Notes and evidence are read-only.</p>
                    )}
                </div>

                <div className="tdp__section">
                    <Field label="Internal ID" value={threat._id} mono />
                </div>
            </aside>
        </>
    )
}

export default ThreatDetailPanel
