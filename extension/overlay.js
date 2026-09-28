/**
 * ThreatShare Browser Extension - In-Page Threat Overlay (Option A)
 * Injects a high-impact, enterprise-grade security warning screen
 * using Shadow DOM to isolate styles from the underlying webpage.
 */

(function () {
  // Avoid duplicate listeners
  if (window.__threatshareOverlayInitialized) return;
  window.__threatshareOverlayInitialized = true;

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[m]));
  }

  function showThreatOverlay(threat, webUrl) {
    if (!threat || document.getElementById('threatshare-overlay-host')) return;

    const host = document.createElement('div');
    host.id = 'threatshare-overlay-host';
    host.style.all = 'initial';
    host.style.position = 'fixed';
    host.style.top = '0';
    host.style.left = '0';
    host.style.width = '100vw';
    host.style.height = '100vh';
    host.style.zIndex = '2147483647';
    host.style.display = 'block';

    const shadow = host.attachShadow({ mode: 'open' });

    const indicator = threat.value || window.location.hostname;
    const category = threat.category || 'Malicious Threat Indicator';
    const severity = (threat.severity || 'High').toUpperCase();
    const confidence = threat.confidence || 90;
    const sightings = threat.sightings || 1;
    const platformUrl = webUrl || 'https://threatshare-six.vercel.app';
    const inspectUrl = `${platformUrl}/search?q=${encodeURIComponent(indicator)}`;

    const style = document.createElement('style');
    style.textContent = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }
      .threat-screen {
        width: 100vw;
        height: 100vh;
        background: #060911;
        background: radial-gradient(ellipse at 50% 15%, rgba(185, 28, 28, 0.28) 0%, rgba(6, 9, 17, 0.98) 75%);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: #f1f5f9;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px;
        overflow-y: auto;
      }
      .threat-card {
        max-width: 620px;
        width: 100%;
        background: rgba(15, 23, 42, 0.94);
        border: 1px solid rgba(239, 68, 68, 0.45);
        border-radius: 12px;
        padding: 36px 32px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.9), 0 0 35px rgba(239, 68, 68, 0.18);
        backdrop-filter: blur(12px);
        animation: threatCardIn 0.22s ease-out;
      }
      @keyframes threatCardIn {
        from { opacity: 0; transform: scale(0.97) translateY(6px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      .security-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        background: rgba(239, 68, 68, 0.14);
        border: 1px solid rgba(239, 68, 68, 0.35);
        color: #f87171;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 5px 12px;
        border-radius: 9999px;
        margin-bottom: 20px;
      }
      .card-title {
        font-size: 22px;
        font-weight: 800;
        letter-spacing: -0.02em;
        color: #ffffff;
        margin-bottom: 12px;
        line-height: 1.3;
      }
      .card-desc {
        font-size: 14px;
        line-height: 1.6;
        color: #94a3b8;
        margin-bottom: 24px;
      }
      .meta-box {
        background: rgba(9, 14, 26, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        padding: 16px;
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 14px;
        margin-bottom: 26px;
      }
      .meta-box .full {
        grid-column: span 2;
      }
      .meta-label {
        font-size: 10px;
        font-weight: 700;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        margin-bottom: 3px;
      }
      .meta-value {
        font-size: 13px;
        font-weight: 600;
        color: #e2e8f0;
        word-break: break-all;
      }
      .meta-value.mono {
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: #fca5a5;
      }
      .severity-tag {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        background: rgba(239, 68, 68, 0.22);
        color: #fca5a5;
        border: 1px solid rgba(239, 68, 68, 0.45);
      }
      .actions {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .action-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 11px 18px;
        font-size: 13px;
        font-weight: 600;
        border-radius: 6px;
        cursor: pointer;
        text-decoration: none;
        transition: all 0.15s ease;
        border: none;
      }
      .action-btn--primary {
        background: #2563eb;
        color: #ffffff;
      }
      .action-btn--primary:hover {
        background: #1d4ed8;
      }
      .action-btn--secondary {
        background: rgba(255, 255, 255, 0.06);
        color: #cbd5e1;
        border: 1px solid rgba(255, 255, 255, 0.12);
      }
      .action-btn--secondary:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #ffffff;
      }
      .action-btn--ghost {
        background: transparent;
        color: #64748b;
        font-size: 12px;
        text-decoration: underline;
        margin-top: 4px;
      }
      .action-btn--ghost:hover {
        color: #cbd5e1;
      }
    `;

    const screen = document.createElement('div');
    screen.className = 'threat-screen';
    screen.innerHTML = `
      <div class="threat-card">
        <div class="security-badge">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          ThreatShare Defense System
        </div>

        <h1 class="card-title">Security Alert: Access to Malicious Destination Intercepted</h1>

        <p class="card-desc">
          ThreatShare has identified this website as a confirmed threat indicator in your organization's threat feed. Navigating to this destination may compromise credentials, download hostile payloads, or expose internal assets.
        </p>

        <div class="meta-box">
          <div class="meta-item full">
            <div class="meta-label">Flagged Indicator</div>
            <div class="meta-value mono">${escapeHtml(indicator)}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Threat Classification</div>
            <div class="meta-value">${escapeHtml(category)}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Severity Level</div>
            <div class="meta-value">
              <span class="severity-tag">${escapeHtml(severity)}</span>
            </div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Confidence Score</div>
            <div class="meta-value">${escapeHtml(String(confidence))}%</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Intelligence Sightings</div>
            <div class="meta-value">${escapeHtml(String(sightings))} sighting(s) recorded</div>
          </div>
        </div>

        <div class="actions">
          <button class="action-btn action-btn--primary" id="threatOverlayBack">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"/>
              <polyline points="12 19 5 12 12 5"/>
            </svg>
            Back to Safety (Recommended)
          </button>
          <a class="action-btn action-btn--secondary" href="${escapeHtml(inspectUrl)}" target="_blank" rel="noopener noreferrer">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Inspect Indicator in ThreatShare
          </a>
          <button class="action-btn action-btn--ghost" id="threatOverlayDismiss">
            Proceed to destination anyway (Unsafe)
          </button>
        </div>
      </div>
    `;

    screen.querySelector('#threatOverlayBack').addEventListener('click', () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'about:blank';
      }
    });

    screen.querySelector('#threatOverlayDismiss').addEventListener('click', () => {
      host.remove();
      injectTopStickyBanner(indicator, category);
    });

    shadow.appendChild(style);
    shadow.appendChild(screen);
    document.documentElement.appendChild(host);
  }

  function injectTopStickyBanner(indicator, category) {
    if (document.getElementById('threatshare-top-banner-host')) return;

    const bannerHost = document.createElement('div');
    bannerHost.id = 'threatshare-top-banner-host';
    bannerHost.style.all = 'initial';
    bannerHost.style.position = 'fixed';
    bannerHost.style.top = '0';
    bannerHost.style.left = '0';
    bannerHost.style.width = '100vw';
    bannerHost.style.zIndex = '2147483646';

    const shadow = bannerHost.attachShadow({ mode: 'open' });
    const bannerStyle = document.createElement('style');
    bannerStyle.textContent = `
      .banner {
        background: #991b1b;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 12px;
        font-weight: 600;
        padding: 9px 18px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.4);
      }
      .banner-content {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .banner-btn {
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: #ffffff;
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
      }
      .banner-btn:hover {
        background: rgba(0, 0, 0, 0.4);
      }
    `;

    const banner = document.createElement('div');
    banner.className = 'banner';
    banner.innerHTML = `
      <div class="banner-content">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
        <span>SECURITY WARNING: This website matches a known ${escapeHtml(category)} threat (${escapeHtml(indicator)}).</span>
      </div>
      <button class="banner-btn" id="dismissBannerBtn">Dismiss</button>
    `;

    banner.querySelector('#dismissBannerBtn').addEventListener('click', () => {
      bannerHost.remove();
    });

    shadow.appendChild(bannerStyle);
    shadow.appendChild(banner);
    document.documentElement.appendChild(bannerHost);
  }

  // Receive message from background worker
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'SHOW_THREAT_OVERLAY' && message.threat) {
      showThreatOverlay(message.threat, message.webUrl);
    }
  });
})();
