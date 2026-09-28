import { useState } from 'react'
import SeverityBadge from './SeverityBadge.jsx'
import './AlertResolveModal.css'

const DISPOSITIONS = [
    { label: 'Mitigated / Blocked', value: 'Mitigated / Blocked', desc: 'Indicator blocked in firewall, proxy, or endpoint EDR.' },
    { label: 'False Positive', value: 'False Positive', desc: 'Benign activity or verified internal infrastructure.' },
    { label: 'Escalated to SOC', value: 'Escalated to SOC', desc: 'Assigned to incident response team for active investigation.' },
    { label: 'Dismissed', value: 'Dismissed', desc: 'No action required or duplicate detection.' },
]

function AlertResolveModal({ alert, onResolve, onCancel }) {
    const [disposition, setDisposition] = useState('Mitigated / Blocked')
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)

    async function handleSubmit(e) {
        e.preventDefault()
        setSubmitting(true)
        try {
            await onResolve(alert._id, disposition, notes)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="arm-backdrop" onClick={onCancel}>
            <div className="arm" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Resolve security alert">
                <div className="arm__header">
                    <div>
                        <span className="eyebrow">Incident Response</span>
                        <h2 className="arm__title">Resolve Security Alert</h2>
                    </div>
                    <SeverityBadge severity={alert.severity} />
                </div>

                <div className="arm__alert-info">
                    <strong>{alert.message}</strong>
                    <p>{alert.detail}</p>
                </div>

                <form className="arm__form" onSubmit={handleSubmit}>
                    <label className="arm__label">Resolution Disposition</label>
                    <div className="arm__options">
                        {DISPOSITIONS.map((d) => (
                            <label
                                key={d.value}
                                className={`arm__option ${disposition === d.value ? 'arm__option--active' : ''}`}
                            >
                                <input
                                    type="radio"
                                    name="disposition"
                                    value={d.value}
                                    checked={disposition === d.value}
                                    onChange={(e) => setDisposition(e.target.value)}
                                />
                                <div>
                                    <strong>{d.label}</strong>
                                    <span>{d.desc}</span>
                                </div>
                            </label>
                        ))}
                    </div>

                    <div className="field">
                        <label htmlFor="resNotes">Analyst Resolution Notes (optional)</label>
                        <textarea
                            id="resNotes"
                            className="arm__notes"
                            rows={3}
                            placeholder="e.g. Confirmed malicious C2 IP. Blocked in Palo Alto firewall rule #4102. Ticket INC-8491 opened."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>

                    <div className="arm__actions">
                        <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={submitting}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn--primary" disabled={submitting}>
                            {submitting ? 'Resolving…' : 'Submit Resolution'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default AlertResolveModal
