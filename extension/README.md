# ThreatShare — Web Threat Scanner & IoC Reporter

A real-time browser extension that inspects the website you are currently visiting, checks it against your ThreatShare intelligence database, detects suspicious heuristics (phishing patterns, raw IP hosts, insecure HTTP, malicious TLDs), and allows 1-click submission of threat indicators directly to ThreatShare.

---

## Features

- **Live Database Lookup**: Queries your ThreatShare backend (`GET /api/threats/check`) for the active tab's domain and URL.
- **Visual Alert Badges**:
  - 🔴 **Known Threat**: Displays a red warning badge, threat category, severity, confidence, and sightings count.
  - 🟡 **Suspicious Signals**: Warns if the website uses plaintext HTTP, raw IP addresses, high-risk TLDs (e.g. `.zip`, `.top`, `.click`), or nested brand-spoofing subdomains.
  - 🟢 **Clean / Normal**: Confirms no malicious sightings exist in your database.
- **1-Click IoC Submission**: Report malicious phishing sites, malware drop sites, or botnets directly to ThreatShare without leaving your browser tab.
- **Configurable Backend**: Works with both local development (`http://127.0.0.1:4000/api`) and deployed cloud environments (`https://threatshare-six.vercel.app/api`).

---

## How to Install in Your Browser (Chrome / Edge / Brave)

1. Open your browser and go to the Extensions page:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
2. Enable **Developer mode** (toggle switch in the top-right corner).
3. Click the **"Load unpacked"** button in the top-left.
4. Select the `extension` folder inside this project:
   `c:\Users\Admin\Desktop\threatshare-ui-prototype2\threatshare\extension`
5. The **ThreatShare Scanner** extension is now installed! Pin it to your toolbar for easy access.

---

## How to Test

1. Ensure your ThreatShare backend is running (`npm run server`).
2. Click the ThreatShare shield icon in your browser toolbar.
3. In the **Connect** tab, enter your analyst credentials (e.g. `admin@threatshare.local` / `demo-password`) and click **Log In**.
4. Navigate to any website:
   - For example, visit `malicious-example.com` or `login-secure-update.net` (from the ThreatShare seed data).
   - Click the extension: it will instantly detect and show:
     `🚨 Known Threat in ThreatShare!` with full indicator metadata!
5. To report a new suspicious link:
   - Open the extension, click **"🚨 Report This Website to ThreatShare"**, adjust category or confidence, and click **Submit Indicator**.
   - Open your ThreatShare dashboard to see your new IoC logged with real-time enrichment!
