import './EnrichmentBadge.css'

const LABELS = {
    pending:  { text: 'Checking feeds…', cls: 'enrichment--pending', pulse: true },
    clean:    { text: 'No hits',         cls: 'enrichment--clean',   pulse: false },
    malicious:{ text: '⚠ Malicious',     cls: 'enrichment--malicious', pulse: false },
    error:    { text: 'Check failed',    cls: 'enrichment--error',   pulse: false },
    skipped:  { text: '—',              cls: 'enrichment--skipped',  pulse: false },
}

/**
 * EnrichmentBadge
 * @param {{ status: string, sources: string[] }} props
 */
function EnrichmentBadge({ status = 'pending', sources = [] }) {
    const cfg = LABELS[status] ?? LABELS.pending
    const title = sources.length ? `Confirmed by: ${sources.join(', ')}` : undefined

    return (
        <span
            className={`enrichment-badge ${cfg.cls}${cfg.pulse ? ' enrichment-badge--pulse' : ''}`}
            title={title}
        >
            {cfg.pulse && <span className="enrichment-badge__dot" aria-hidden="true" />}
            {cfg.text}
        </span>
    )
}

export default EnrichmentBadge
