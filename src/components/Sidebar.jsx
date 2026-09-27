import { useNavigate } from 'react-router-dom'
import Logo from './Logo.jsx'
import {
  GridIcon,
  ShieldIcon,
  UploadIcon,
  SearchIcon,
  BellIcon,
  ReportIcon,
  ActivityIcon,
  UsersIcon,
  SettingsIcon,
  LogoutIcon,
} from './icons.jsx'
import { getCurrentUser, apiRequest } from '../api.js'
import { canAccessModule } from '../permissions.js'
import './Sidebar.css'

const NAV_SECTIONS = [
  {
    items: [
      { key: 'dashboard', label: 'Dashboard', icon: GridIcon },
      { key: 'threat-intel', label: 'Threat Intelligence', icon: ShieldIcon },
      { key: 'submit-ioc', label: 'Submit IoC', icon: UploadIcon },
      { key: 'search', label: 'Search Threats', icon: SearchIcon },
      { key: 'alerts', label: 'Alerts', icon: BellIcon },
      { key: 'reports', label: 'Reports', icon: ReportIcon },
      { key: 'activity', label: 'Activity Logs', icon: ActivityIcon },
    ],
  },
  {
    heading: 'Administration',
    items: [
      { key: 'users', label: 'Users', icon: UsersIcon },
      { key: 'settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
]

function Sidebar({ activeKey = 'dashboard' }) {
  const navigate = useNavigate()
  const currentUser = getCurrentUser()
  const role = currentUser?.role || 'Viewer'

  async function handleLogout() {
    try {
      await apiRequest('/auth/logout', { method: 'POST' })
    } catch {
      // log out client-side even if request fails
    }
    localStorage.removeItem('threatshare_token')
    localStorage.removeItem('threatshare_user')
    navigate('/login')
  }

  // Filter sections and items strictly according to the user's role
  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => canAccessModule(role, item.key)),
  })).filter((section) => section.items.length > 0)

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <Logo variant="light" size={26} />
      </div>

      <nav className="sidebar__nav">
        {visibleSections.map((section, idx) => (
          <div className="sidebar__section" key={idx}>
            {section.heading && (
              <p className="sidebar__heading">{section.heading}</p>
            )}
            {section.items.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={`sidebar__item ${activeKey === key ? 'sidebar__item--active' : ''}`}
                type="button"
                onClick={() => {
                  navigate(`/${key}`)
                }}
              >
                <Icon />
                <span>{label}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <button className="sidebar__item" type="button" onClick={handleLogout}>
          <LogoutIcon />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
