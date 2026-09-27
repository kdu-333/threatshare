import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import './Login.css'
import { apiRequest } from '../api.js'

function EyeIcon({ visible }) {
  return visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M6.6 6.7C4 8.3 1 12 1 12s4 7 11 7c2 0 3.7-.5 5.1-1.3M17.4 17.4C19.9 15.8 23 12 23 12s-1.9-3.3-5.1-5.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()

    if (!email || !password) {
      setError('Enter your email and password to continue.')
      return
    }
    try {
      const result = await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      localStorage.setItem('threatshare_token', result.token)
      localStorage.setItem('threatshare_user', JSON.stringify(result.user))
      setError('')
      navigate('/dashboard')
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-card__brand">
          <Logo size={34} />
          <p className="login-card__subtitle">
            Threat Intelligence Sharing &amp; Analysis System
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="password-input">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="login-form__row">
            <span className="link-muted" style={{ fontSize: '0.8rem', color: '#6b7280' }}>
              Forgot password? Contact your administrator.
            </span>
          </div>

          <button type="submit" className="btn btn--primary btn--block">
            Sign In
          </button>
        </form>

        <div className="login-card__footer">
          <p className="login-card__note">Authorized users only &mdash; contact your administrator for access.</p>
        </div>
      </div>

      <footer className="page-footer">
        <div className="page-footer__status">
          <span className="page-footer__status-dot" aria-hidden="true" />
          All systems operational
        </div>
        <p className="page-footer__copyright">
          © 2026 ThreatShare. All rights reserved. · Internal use only.
        </p>
      </footer>
    </div>
  )
}

export default Login
