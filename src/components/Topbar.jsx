import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SearchIcon, BellIcon, SunIcon, MoonIcon } from './icons.jsx'
import { useAlertCount } from '../hooks/useAlertCount.js'
import { useTheme } from '../hooks/useTheme.js'
import { canAccessModule } from '../permissions.js'
import './Topbar.css'

function Topbar({ title, user }) {
    const alertCount = useAlertCount()
    const { theme, toggleTheme } = useTheme()
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState('')

    function handleSearchKeyDown(e) {
        if (e.key === 'Enter' && searchQuery.trim()) {
            navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
            setSearchQuery('')
        }
    }

    return (
        <header className="topbar">
            <h1 className="topbar__title">{title}</h1>

            <div className="topbar__actions">
                <div className="topbar__search">
                    <SearchIcon width={16} height={16} />
                    <input
                        type="text"
                        placeholder="Search IoCs, domains, hashes..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        aria-label="Global threat search"
                    />
                </div>

                {/* Theme toggle */}
                <button
                    className="topbar__icon-btn"
                    type="button"
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    onClick={toggleTheme}
                    title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                >
                    {theme === 'dark' ? <SunIcon width={16} height={16} /> : <MoonIcon width={16} height={16} />}
                </button>

                {/* Alerts bell — Analyst & Admin only */}
                {canAccessModule(user?.role, 'alerts') && (
                    <button
                        className="topbar__icon-btn"
                        type="button"
                        aria-label={`Notifications${alertCount > 0 ? ` — ${alertCount} open` : ''}`}
                        onClick={() => navigate('/alerts')}
                    >
                        <BellIcon />
                        {alertCount > 0 && (
                            <span className="topbar__badge topbar__badge--live" aria-hidden="true">
                                {alertCount > 99 ? '99+' : alertCount}
                            </span>
                        )}
                    </button>
                )}

                {/* User info — display only */}
                <div className="topbar__user">
                    <span className="topbar__avatar">{user.initials}</span>
                    <span className="topbar__user-info">
                        <span className="topbar__user-name">{user.name}</span>
                        <span className="topbar__user-role">{user.role}</span>
                    </span>
                </div>
            </div>
        </header>
    )
}

export default Topbar
