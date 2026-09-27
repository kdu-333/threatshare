// Minimal inline icon set (stroke-based, single weight) so the whole
// interface shares one consistent icon style without adding an icon
// library dependency.

const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
}

export const GridIcon = (p) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.4" />
    <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.4" />
    <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.4" />
    <rect x="13" y="13" width="7.5" height="7.5" rx="1.4" />
  </svg>
)

export const ShieldIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 3l7 2.6v5.4c0 4.6-3 8.3-7 9.6-4-1.3-7-5-7-9.6V5.6L12 3Z" />
  </svg>
)

export const UploadIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 15V4M12 4l-4 4M12 4l4 4" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </svg>
)

export const SearchIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M20 20l-4.3-4.3" />
  </svg>
)

export const BellIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 14 6 10Z" />
    <path d="M10 19a2 2 0 0 0 4 0" />
  </svg>
)

export const ReportIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M7 3.5h7.5L19 8v12.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
    <path d="M14 3.5V8h4.5" />
    <path d="M9 13h6M9 16.5h6" />
  </svg>
)

export const ActivityIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M3 12h4l2 6 4-12 2 6h6" />
  </svg>
)

export const UsersIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.5 20c0-3 2.5-5.5 5.5-5.5S14.5 17 14.5 20" />
    <circle cx="17.5" cy="9" r="2.6" />
    <path d="M20.5 20c0-2.4-1.6-4.4-3.8-5.1" />
  </svg>
)

export const SettingsIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5v.2a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H4a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H10a1.6 1.6 0 0 0 1-1.5V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H20a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
  </svg>
)

export const LogoutIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
)

export const ChevronDownIcon = (p) => (
  <svg {...base} width={14} height={14} {...p}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)
