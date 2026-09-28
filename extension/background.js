/**
 * ThreatShare Browser Extension - Background Service Worker
 * Periodically checks the active tab's domain/URL against ThreatShare API
 * and updates the extension action badge icon in real time.
 */

const DEFAULT_API = 'http://127.0.0.1:4000/api'

async function getConfig() {
  const data = await chrome.storage.local.get(['threatshare_api', 'threatshare_token'])
  return {
    apiUrl: data.threatshare_api || DEFAULT_API,
    token: data.threatshare_token || '',
  }
}

async function checkUrlThreat(url) {
  if (!url || !url.startsWith('http')) return null

  try {
    const parsed = new URL(url)
    const domain = parsed.hostname
    const { apiUrl, token } = await getConfig()

    if (!token) return null

    // Check domain first, then full URL
    const headers = { Authorization: `Bearer ${token}` }
    const res = await fetch(`${apiUrl}/threats/check?indicator=${encodeURIComponent(domain)}`, { headers })
    if (res.ok) {
      const data = await res.json()
      if (data.exists) return data.threat
    }

    // Check full URL
    const resUrl = await fetch(`${apiUrl}/threats/check?indicator=${encodeURIComponent(url)}`, { headers })
    if (resUrl.ok) {
      const data = await resUrl.json()
      if (data.exists) return data.threat
    }

    return { exists: false }
  } catch (err) {
    console.debug('[ThreatShare] Background check error:', err.message)
    return null
  }
}

async function updateTabBadge(tabId, url) {
  if (!url || !url.startsWith('http')) {
    chrome.action.setBadgeText({ tabId, text: '' })
    return
  }

  const threat = await checkUrlThreat(url)

  if (threat && threat.exists !== false) {
    chrome.action.setBadgeText({ tabId, text: '!' })
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#dc2626' }) // Red
    chrome.action.setTitle({ tabId, title: `ThreatShare: Detected ${threat.severity || 'Threat'} indicator!` })
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
    updateTabBadge(tabId, tab.url)
  }
})

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId)
  if (tab?.url) {
    updateTabBadge(activeInfo.tabId, tab.url)
  }
})
