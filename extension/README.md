# ThreatShare — Web Threat Scanner & IoC Reporter

A real-time browser extension that inspects the website you are currently visiting, checks it against your ThreatShare intelligence database, detects suspicious heuristics (phishing patterns, raw IP hosts, insecure HTTP, malicious TLDs), and allows 1-click submission of threat indicators directly to ThreatShare.

---

## Features

- **Live Database Lookup**: Queries your ThreatShare backend (`GET /api/threats/check`) for the active tab's domain and URL.
- **In-Page Red Warning Overlay (Option A)**: Automatically intercepts navigation to known malicious sites with a high-impact, enterprise-grade red security block screen with full IoC classification, confidence rating, sightings count, and "Back to Safety" / "Inspect in ThreatShare" actions.
- **Right-Click Context Menu Scanner & Reporter (Option B)**: Highlight any IP address, domain, URL, or hash on any webpage, right-click, and instantly:
  - **Inspect in ThreatShare**: Real-time lookup with native desktop notifications.
  - **Quick-Report as Threat IoC**: Auto-detects indicator type (IPv4, SHA-256, MD5, URL, Domain) and logs it directly to your ThreatShare intelligence feed.
- **Visual Alert Badges**:
  - **Known Threat**: Displays a red warning badge, threat category, severity, confidence, and sightings count.
  - **Suspicious Signals**: Warns if the website uses plaintext HTTP, raw IP addresses, high-risk TLDs (e.g. `.zip`, `.top`, `.click`), or nested brand-spoofing subdomains.
  - **Clean / Normal**: Confirms no malicious sightings exist in your database.
- **1-Click IoC Submission**: Report malicious phishing sites, malware drop sites, or botnets directly to ThreatShare without leaving your browser tab.
- **Configurable Backend**: Works with both local development (`http://127.0.0.1:4000/api`) and deployed cloud environments (`https://threatshare-six.vercel.app/api`).

---

## How to Install in Your Browser (Chrome / Edge / Brave)

1. Open your browser and go to the Extensions page:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
2. Enable **Developer mode** (toggle switch in the top-right corner).
3. Click the **"Load unpacked"** button in the top-left (or click the **reload** icon if already loaded).
4. Select the `extension` folder inside this project:
   `c:\Users\Admin\Desktop\threatshare-ui-prototype2\threatshare\extension`
5. The **ThreatShare Scanner** extension is now installed! Pin it to your toolbar for easy access.

---

## How to Test for Presentations

### 1. In-Page Red Warning Overlay (Option A)
1. Ensure your ThreatShare backend is running (`npm run server`).
2. Visit any website that matches a known indicator in your ThreatShare database (e.g. `http://malicious-example.com` or `http://login-secure-update.net`).
3. Notice how ThreatShare immediately halts access and displays the full-screen **Security Alert: Access Intercepted** overlay with classification, severity, confidence, and one-click safety navigation!

### 2. Right-Click Context Menu (Option B)
1. On any webpage, highlight an indicator (e.g., select `185.220.101.45` or `44d88612fea8a8f36de82e1278abb02f`).
2. Right-click the highlighted text:
   - Click **"Inspect in ThreatShare"**: Instant desktop notification displaying threat status, sightings, and severity.
   - Click **"Quick-Report as Threat IoC"**: Automatically categorizes and logs the indicator directly to ThreatShare with an instant confirmation notification.
3. You can also right-click any hyperlink on a page and choose **"Inspect Destination Link in ThreatShare"** or **"Quick-Report Destination Link to ThreatShare"**.
