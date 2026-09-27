import { useNavigate } from 'react-router-dom'
import { useSessionWarning } from '../hooks/useSessionWarning.js'
import { apiRequest } from '../api.js'
import './SessionWarningBanner.css'

function fmt(secs) {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, '0')}`
}

function SessionWarningBanner() {
    const { secondsLeft, showWarning } = useSessionWarning()
    const navigate = useNavigate()

    if (!showWarning) return null

    async function handleRenew() {
        // Re-hit the health endpoint with our token to confirm it's still valid,
        // then redirect to login to get a fresh token (simplest safe renewal flow).
        try {
            await apiRequest('/health')
        } catch { /* ignore */ }
        // Clear token and send to login so the user can re-auth
        localStorage.removeItem('threatshare_token')
        localStorage.removeItem('threatshare_user')
        navigate('/login', { state: { reason: 'renew' } })
    }

    const urgent = secondsLeft <= 60

    return (
        <div className={`session-banner${urgent ? ' session-banner--urgent' : ''}`} role="alert">
            <span className="session-banner__icon">⏱</span>
            <span className="session-banner__text">
                Your session expires in <strong>{fmt(secondsLeft)}</strong> — save your work.
            </span>
            <button type="button" className="session-banner__btn" onClick={handleRenew}>
                Renew session
            </button>
        </div>
    )
}

export default SessionWarningBanner
