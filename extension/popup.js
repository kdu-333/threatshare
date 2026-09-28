/**
 * ThreatShare Browser Extension - Popup Controller
 * Manages active tab scanning, heuristic evaluation, threat lookup,
 * and 1-click submission to ThreatShare backend.
 */

const DEFAULT_API_URL = 'http://127.0.0.1:4000/api'
const DEFAULT_WEB_URL = 'http://localhost:5173'

let currentTab = null
let currentDomain = ''
let currentUrl = ''
let config = {
  apiUrl: DEFAULT_API_URL,
  token: '',
  user: null,
}

// -------------------------------------------------------------
// Initialization
// -------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async () => {
  await loadConfig()
  initTabs()
  initForms()
  await initActiveTab()
  checkApiHealth()
})

async function loadConfig() {
  const data = await chrome.storage.local.get(['threatshare_api', 'threatshare_token', 'threatshare_user'])
  config.apiUrl = data.threatshare_api || DEFAULT_API_URL
  config.token = data.threatshare_token || ''
  config.user = data.threatshare_user ? JSON.parse(data.threatshare_user) : null

  document.getElementById('settingApiUrl').value = config.apiUrl
  updateAuthUI()
}

function updateAuthUI() {
  const loggedOut = document.getElementById('authLoggedOut')
  const loggedIn = document.getElementById('authLoggedIn')

  if (config.token && config.user) {
    loggedOut.style.display = 'none'
    loggedIn.style.display = 'block'
    document.getElementById('userName').textContent = config.user.name || 'Analyst'
    document.getElementById('userRole').textContent = config.user.role || 'Security Analyst'
    document.getElementById('userInitials').textContent = config.user.initials || 'TS'
  } else {
    loggedOut.style.display = 'block'
    loggedIn.style.display = 'none'
  }
}

// -------------------------------------------------------------
// Tab Navigation
// -------------------------------------------------------------

function initTabs() {
  const navTabs = document.querySelectorAll('.nav-tab')
  navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      navTabs.forEach((t) => t.classList.remove('active'))
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'))

      tab.classList.add('active')
      const targetId = tab.getAttribute('data-tab')
      document.getElementById(targetId)?.classList.add('active')
    })
  })

  document.getElementById('btnSettings').addEventListener('click', () => {
    document.querySelector('.nav-tab[data-tab="tab-auth"]').click()
  })

  document.getElementById('btnOpenDashboard').addEventListener('click', () => {
    chrome.tabs.create({ url: `${DEFAULT_WEB_URL}/dashboard` })
  })
}

// -------------------------------------------------------------
// Active Tab Scanner & Heuristics
// -------------------------------------------------------------

async function initActiveTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tabs || !tabs[0] || !tabs[0].url) {
      showNotScannable('No active webpage detected.')
      return
    }

    currentTab = tabs[0]
    currentUrl = currentTab.url

    // Skip internal browser pages
    if (currentUrl.startsWith('chrome://') || currentUrl.startsWith('edge://') || currentUrl.startsWith('about:')) {
      showNotScannable('Browser internal page cannot be scanned.')
      return
    }

    const parsed = new URL(currentUrl)
    currentDomain = parsed.hostname

    // Update target card
    document.getElementById('siteDomain').textContent = currentDomain
    document.getElementById('siteUrl').textContent = currentUrl

    const protoBadge = document.getElementById('siteProtocol')
    if (parsed.protocol === 'https:') {
      protoBadge.textContent = 'HTTPS'
      protoBadge.className = 'protocol-badge protocol-badge--https'
    } else {
      protoBadge.textContent = 'HTTP (INSECURE)'
      protoBadge.className = 'protocol-badge protocol-badge--http'
    }

    // Set initial prefill for Submit tab
    document.getElementById('inputIndicator').value = currentUrl

    // Run Heuristics & Threat Lookup
    const heuristicWarnings = evaluateHeuristics(parsed)
    renderHeuristics(heuristicWarnings)
    await scanAgainstThreatShare(currentDomain, currentUrl, heuristicWarnings)
  } catch (err) {
    showNotScannable(`Scan error: ${err.message}`)
  }
}

function evaluateHeuristics(parsed) {
  const warnings = []
  const host = parsed.hostname.toLowerCase()

  // 1. Insecure Plaintext HTTP
  if (parsed.protocol === 'http:') {
    warnings.push('Insecure Protocol: Plaintext HTTP detected without TLS encryption.')
  }

  // 2. Direct IPv4 host
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    warnings.push('Raw IP Address: Website accessed directly via numeric IP instead of a verified domain.')
  }

  // 3. Non-standard HTTP ports
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    warnings.push(`Non-Standard Port: Communication on unusual port :${parsed.port}`)
  }

  // 4. Suspicious TLDs often leveraged by disposable phishing campaigns
  const highRiskTlds = ['.top', '.xyz', '.click', '.zip', '.country', '.work', '.gq', '.cf', '.tk']
  if (highRiskTlds.some((tld) => host.endsWith(tld))) {
    warnings.push('High-Risk TLD: Domain extension frequently associated with disposable phishing campaigns.')
  }

  // 5. Deep subdomain chains (brand impersonation signature)
  const parts = host.split('.')
  if (parts.length > 4) {
    warnings.push('Deep Subdomain Nesting: Multiple subdomains often indicate brand spoofing.')
  }

  return warnings
}

function renderHeuristics(warnings) {
  const box = document.getElementById('heuristicAlerts')
  if (!warnings || warnings.length === 0) {
    box.style.display = 'none'
    box.innerHTML = ''
    return
  }

  box.style.display = 'flex'
  box.innerHTML = warnings
    .map((w) => `<div class="heuristic-pill"><span>⚠️</span><span>${w}</span></div>`)
    .join('')
}

async function scanAgainstThreatShare(domain, url, heuristicWarnings) {
  const scanBox = document.getElementById('scanResult')
  const titleEl = document.getElementById('statusTitle')
  const descEl = document.getElementById('statusDesc')
  const detailsCard = document.getElementById('threatDetailsCard')

  try {
    const headers = config.token ? { Authorization: `Bearer ${config.token}` } : {}

    // Check domain first
    let res = await fetch(`${config.apiUrl}/threats/check?indicator=${encodeURIComponent(domain)}`, { headers })
    let data = res.ok ? await res.json() : null

    // If not found by domain, check full URL
    if (!data?.exists) {
      const resUrl = await fetch(`${config.apiUrl}/threats/check?indicator=${encodeURIComponent(url)}`, { headers })
      if (resUrl.ok) data = await resUrl.json()
    }

    if (data?.exists && data.threat) {
      const t = data.threat
      scanBox.className = 'status-card status-card--threat'
      scanBox.querySelector('.status-icon-wrap').innerHTML = '🚨'
      titleEl.textContent = `Known Threat in ThreatShare!`
      descEl.textContent = `Flagged as a confirmed threat indicator with ${t.sightings || 1} sighting(s).`

      // Show details
      detailsCard.style.display = 'flex'
      document.getElementById('detCategory').textContent = t.category || 'Malicious IoC'
      const sevEl = document.getElementById('detSeverity')
      sevEl.textContent = t.severity || 'High'
      sevEl.className = `badge-severity badge-severity--${(t.severity || 'high').toLowerCase()}`
      document.getElementById('detConfidence').textContent = `${t.confidence || 90}%`
      document.getElementById('detStatus').textContent = t.status || 'Confirmed'

      // Pre-fill submit form with existing details
      document.getElementById('selectCategory').value = t.category || 'Suspicious Activity'
      return
    }

    // No record in database
    detailsCard.style.display = 'none'
    if (heuristicWarnings.length > 0) {
      scanBox.className = 'status-card status-card--suspicious'
      scanBox.querySelector('.status-icon-wrap').innerHTML = '⚠️'
      titleEl.textContent = 'Suspicious Signals Detected'
      descEl.textContent = `${heuristicWarnings.length} suspicious pattern(s) identified. Consider reporting this URL.`
    } else {
      scanBox.className = 'status-card status-card--clean'
      scanBox.querySelector('.status-icon-wrap').innerHTML = '🛡️'
      titleEl.textContent = 'Clean / No Known Threat Records'
      descEl.textContent = 'This website has no malicious history reported in the ThreatShare database.'
    }
  } catch (err) {
    scanBox.className = 'status-card'
    scanBox.querySelector('.status-icon-wrap').innerHTML = 'ℹ️'
    titleEl.textContent = 'ThreatShare Scanner Ready'
    descEl.textContent = heuristicWarnings.length
      ? `${heuristicWarnings.length} suspicious pattern(s) detected locally.`
      : 'Connect with ThreatShare backend in Connect tab for real-time IoC checks.'
  }
}

function showNotScannable(msg) {
  const scanBox = document.getElementById('scanResult')
  scanBox.className = 'status-card'
  scanBox.querySelector('.status-icon-wrap').innerHTML = '🔒'
  document.getElementById('statusTitle').textContent = 'Page Protected'
  document.getElementById('statusDesc').textContent = msg
  document.getElementById('siteDomain').textContent = 'Non-web page'
  document.getElementById('siteUrl').textContent = '—'
}

// -------------------------------------------------------------
// Forms & Submission
// -------------------------------------------------------------

function initForms() {
  // Target radio toggle
  document.querySelectorAll('input[name="targetType"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      document.getElementById('inputIndicator').value =
        e.target.value === 'domain' ? currentDomain : currentUrl
    })
  })

  // Confidence slider
  const confSlider = document.getElementById('inputConfidence')
  const confLabel = document.getElementById('confValue')
  confSlider.addEventListener('input', (e) => {
    confLabel.textContent = `${e.target.value}%`
  })

  // Quick report button on scanner tab
  document.getElementById('btnQuickReport').addEventListener('click', () => {
    document.querySelector('.nav-tab[data-tab="tab-submit"]').click()
  })

  // Submit IoC form
  document.getElementById('submitIocForm').addEventListener('submit', async (e) => {
    e.preventDefault()

    if (!config.token) {
      showToast('Please log in under the "Connect" tab first.', 'error')
      document.querySelector('.nav-tab[data-tab="tab-auth"]').click()
      return
    }

    const indicator = document.getElementById('inputIndicator').value.trim()
    const targetType = document.querySelector('input[name="targetType"]:checked').value
    const category = document.getElementById('selectCategory').value
    const confidence = Number(confSlider.value)
    const notes = document.getElementById('inputNotes').value.trim()

    const submitBtn = document.getElementById('btnSubmitThreat')
    submitBtn.disabled = true
    submitBtn.textContent = 'Submitting to ThreatShare…'

    try {
      const payload = {
        indicator,
        type: targetType === 'domain' ? 'Domain' : 'URL',
        category,
        confidence,
        source: 'ThreatShare Extension',
        notes: notes || `Reported from browser extension while visiting ${currentDomain}`,
      }

      const res = await fetch(`${config.apiUrl}/threats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Submission failed.')

      showToast(`✓ Threat indicator successfully added!`, 'success')
      document.getElementById('inputNotes').value = ''
      document.querySelector('.nav-tab[data-tab="tab-scan"]').click()

      // Refresh scan
      await scanAgainstThreatShare(currentDomain, currentUrl, [])
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = 'Submit Indicator to ThreatShare'
    }
  })

  // Auth & Settings
  document.getElementById('btnSaveSettings').addEventListener('click', async () => {
    const newApi = document.getElementById('settingApiUrl').value.trim()
    config.apiUrl = newApi || DEFAULT_API_URL
    await chrome.storage.local.set({ threatshare_api: config.apiUrl })
    showToast('Settings saved.', 'success')
    checkApiHealth()
  })

  document.getElementById('btnLogin').addEventListener('click', async () => {
    const email = document.getElementById('authEmail').value.trim()
    const password = document.getElementById('authPassword').value.trim()

    if (!email || !password) {
      showToast('Enter your email and password.', 'error')
      return
    }

    const btn = document.getElementById('btnLogin')
    btn.disabled = true
    btn.textContent = 'Authenticating…'

    try {
      const res = await fetch(`${config.apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Authentication failed.')

      config.token = data.token
      config.user = data.user
      await chrome.storage.local.set({
        threatshare_token: data.token,
        threatshare_user: JSON.stringify(data.user),
      })

      showToast(`Welcome back, ${data.user.name}!`, 'success')
      updateAuthUI()
      document.querySelector('.nav-tab[data-tab="tab-scan"]').click()
      await scanAgainstThreatShare(currentDomain, currentUrl, [])
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      btn.disabled = false
      btn.textContent = 'Log In to ThreatShare'
    }
  })

  document.getElementById('btnLogout').addEventListener('click', async () => {
    config.token = ''
    config.user = null
    await chrome.storage.local.remove(['threatshare_token', 'threatshare_user'])
    updateAuthUI()
    showToast('Logged out.', 'success')
  })
}

async function checkApiHealth() {
  const dot = document.querySelector('.status-dot')
  const text = document.getElementById('connStatusText')

  try {
    const res = await fetch(`${config.apiUrl}/health`, { signal: AbortSignal.timeout(3000) })
    if (res.ok) {
      dot.className = 'status-dot status-dot--connected'
      text.textContent = 'ThreatShare Backend Connected'
      return
    }
    throw new Error()
  } catch {
    dot.className = 'status-dot status-dot--error'
    text.textContent = 'Backend Offline or Unreachable'
  }
}

function showToast(message, type = 'normal') {
  const toast = document.getElementById('toast')
  toast.textContent = message
  toast.className = `toast show toast--${type}`
  setTimeout(() => {
    toast.className = 'toast'
  }, 3500)
}
