import logoImg from '../assets/threatshare-logo.png'
import './Logo.css'

/**
 * Shared brand mark using the custom ThreatShare logo asset.
 * `variant="light"` is used on dark backgrounds (sidebar);
 * default is for light backgrounds (login page).
 */
function Logo({ variant = 'default', showWordmark = true, size = 32 }) {
  const isLight = variant === 'light'

  return (
    <div className={`ts-logo ${isLight ? 'ts-logo--light' : ''}`}>
      <img
        src={logoImg}
        alt="ThreatShare"
        className="ts-logo__img"
        style={{ width: size, height: size }}
      />
      {showWordmark && (
        <span className={`ts-logo__word ${isLight ? 'ts-logo__word--light' : ''}`}>
          ThreatShare
        </span>
      )}
    </div>
  )
}

export default Logo
