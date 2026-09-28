/**
 * ThreatShare Browser Extension - Background Service Worker
 * Features:
 * - Option A: In-page red warning overlay on malicious destinations
 * - Option B: Right-click context menu (highlight & inspect or quick-report any IP, URL, domain, hash)
 * - Real-time badge indicator updates
 */

const DEFAULT_API = 'http://127.0.0.1:4000/api'
const DEFAULT_WEB = 'https://threatshare-six.vercel.app'

async function getConfig() {
  const data = await chrome.storage.local.get([
    'threatshare_api',
    'threatshare_web',
    'threatshare_token',
    'threatshare_overlay',
  ])
  return {
    apiUrl: data.threatshare_api || DEFAULT_API,
    webUrl: data.threatshare_web || DEFAULT_WEB,
    token: data.threatshare_token || '',
    overlayEnabled: data.threatshare_overlay !== false, // default true
  }
}

// -------------------------------------------------------------
// Threat Lookup Helper
// -------------------------------------------------------------

async function checkUrlThreat(url) {
  if (!url || !url.startsWith('http')) return null

  try {
    const parsed = new URL(url)
    const domain = parsed.hostname
    const { apiUrl, token } = await getConfig()

    const headers = token ? { Authorization: `Bearer ${token}` } : {}

    // Check domain first
    const res = await fetch(`${apiUrl}/threats/check?indicator=${encodeURIComponent(domain)}`, { headers })
    if (res.ok) {
      const data = await res.json()
      if (data.exists && data.threat) return data.threat
    }

    // Check full URL
    const resUrl = await fetch(`${apiUrl}/threats/check?indicator=${encodeURIComponent(url)}`, { headers })
    if (resUrl.ok) {
      const data = await resUrl.json()
      if (data.exists && data.threat) return data.threat
    }

    return { exists: false }
  } catch (err) {
    console.debug('[ThreatShare] Background check error:', err.message)
    return null
  }
}

// -------------------------------------------------------------
// Badge & Option A: In-Page Overlay Injection
// -------------------------------------------------------------

async function updateTabBadgeAndOverlay(tabId, url) {
  if (!url || !url.startsWith('http')) {
    chrome.action.setBadgeText({ tabId, text: '' })
    return
  }

  const threat = await checkUrlThreat(url)
  const { webUrl, overlayEnabled } = await getConfig()

  if (threat && threat.exists !== false) {
    // 1. Red warning badge on extension icon
    chrome.action.setBadgeText({ tabId, text: '!' })
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#dc2626' })
    chrome.action.setTitle({ tabId, title: `ThreatShare: Detected ${threat.severity || 'Threat'} indicator!` })

    // 2. Option A: In-Page Red Warning Overlay
    if (overlayEnabled) {
      chrome.tabs.sendMessage(tabId, {
        type: 'SHOW_THREAT_OVERLAY',
        threat,
        webUrl,
      }).catch(() => {
        // Fallback: inject overlay script if content script wasn't loaded yet
        chrome.scripting.executeScript({
          target: { tabId },
          files: ['overlay.js'],
        }).then(() => {
          chrome.tabs.sendMessage(tabId, {
            type: 'SHOW_THREAT_OVERLAY',
            threat,
            webUrl,
          }).catch(() => {})
        }).catch(() => {})
      })
    }
  } else if (threat && threat.exists === false) {
    chrome.action.setBadgeText({ tabId, text: '' })
    chrome.action.setTitle({ tabId, title: 'ThreatShare: Clean (no threat detected in database).' })
  } else {
    chrome.action.setBadgeText({ tabId, text: '' })
    chrome.action.setTitle({ tabId, title: 'ThreatShare Web Threat Scanner' })
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    updateTabBadgeAndOverlay(tabId, tab.url)
  }
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId)
  if (tab?.url) {
    updateTabBadgeAndOverlay(activeInfo.tabId, tab.url)
  }
})

// -------------------------------------------------------------
// Option B: Context Menu Setup & Indicator Auto-Detection
// -------------------------------------------------------------

function detectIndicatorType(val) {
  const trimmed = val.trim()
  const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  const sha256Regex = /^[a-fA-F0-9]{64}$/
  const md5Regex = /^[a-fA-F0-9]{32}$/
  const urlRegex = /^https?:\/\//i

  if (ipv4Regex.test(trimmed)) return 'IP Address'
  if (sha256Regex.test(trimmed)) return 'File Hash (SHA-256)'
  if (md5Regex.test(trimmed)) return 'File Hash (MD5)'
  if (urlRegex.test(trimmed)) return 'URL'
  return 'Domain'
}

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'threatshare-check-selection',
      title: 'Inspect "%s" in ThreatShare',
      contexts: ['selection'],
    })

    chrome.contextMenus.create({
      id: 'threatshare-report-selection',
      title: 'Quick-Report "%s" as Threat IoC',
      contexts: ['selection'],
    })

    chrome.contextMenus.create({
      id: 'threatshare-check-link',
      title: 'Inspect Destination Link in ThreatShare',
      contexts: ['link'],
    })

    chrome.contextMenus.create({
      id: 'threatshare-report-link',
      title: 'Quick-Report Destination Link to ThreatShare',
      contexts: ['link'],
    })
  })
}

chrome.runtime.onInstalled.addListener(setupContextMenus)
chrome.runtime.onStartup.addListener(setupContextMenus)

// -------------------------------------------------------------
// Option B: Context Menu Action Handler
// -------------------------------------------------------------

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const { apiUrl, webUrl, token } = await getConfig()
  const indicator = (info.selectionText || info.linkUrl || '').trim()
  if (!indicator) return

  // 1. Inspect indicator
  if (info.menuItemId === 'threatshare-check-selection' || info.menuItemId === 'threatshare-check-link') {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {}
      const res = await fetch(`${apiUrl}/threats/check?indicator=${encodeURIComponent(indicator)}`, { headers })
      const data = res.ok ? await res.json() : null

      if (data?.exists && data.threat) {
        const t = data.threat
        chrome.notifications.create(`threat-${Date.now()}`, {
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'ThreatShare Alert: Threat Detected!',
          message: `[${t.severity || 'HIGH'}] "${indicator}" is logged as ${t.category || 'Malicious'} (${t.sightings || 1} sighting(s)). Click to inspect.`,
        })
      } else {
        chrome.notifications.create(`clean-${Date.now()}`, {
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'ThreatShare Intelligence',
          message: `"${indicator}" has no recorded threat sightings in the database.`,
        })
      }
    } catch (err) {
      chrome.notifications.create(`err-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'ThreatShare Check Failed',
        message: `Could not verify indicator (${err.message}).`,
      })
    }
    return
  }

  // 2. Quick-Report IoC
  if (info.menuItemId === 'threatshare-report-selection' || info.menuItemId === 'threatshare-report-link') {
    const detectedType = detectIndicatorType(indicator)

    if (!token) {
      chrome.tabs.create({ url: `${webUrl}/submit-ioc` })
      chrome.notifications.create(`login-req-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'ThreatShare: Login Required',
        message: 'Log in to ThreatShare in the extension to submit IoCs instantly. Opening submission portal...',
      })
      return
    }

    try {
      const payload = {
        indicator,
        type: detectedType,
        category: 'Suspicious Activity',
        source: 'Browser Extension Context Menu',
        confidence: '85',
        notes: `Quick-reported via browser context menu from: ${tab?.url || 'webpage'}`,
      }

      const res = await fetch(`${apiUrl}/threats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Submission rejected by server')

      chrome.notifications.create(`submitted-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'ThreatShare: IoC Logged Successfully',
        message: `Submitted "${indicator}" (${detectedType}) to ThreatShare threat repository.`,
      })
    } catch (err) {
      chrome.notifications.create(`err-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'ThreatShare Report Failed',
        message: err.message || 'Could not record indicator.',
      })
    }
  }
})

// Clicking notification navigates to the ThreatShare dashboard
chrome.notifications.onClicked.addListener(async () => {
  const { webUrl } = await getConfig()
  chrome.tabs.create({ url: `${webUrl}/dashboard` })
})
