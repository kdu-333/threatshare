// =========================================================
// Mock data for the ThreatShare UI prototype.
//
// BACKEND NOTE: everything in this file is a stand-in for data
// that will eventually be fetched from the Express.js API,
// which in turn reads from MongoDB. Once the backend exists,
// replace the imports of this file with API calls, e.g.:
//   const res = await fetch('/api/threats/recent')
// =========================================================

export const currentUser = {
  name: 'Krystian Daniel',
  role: 'Administrator',
  initials: 'KD',
}

export const summaryStats = [
  { id: 'total', label: 'Total Threats', value: 248, tone: 'neutral' },
  { id: 'critical', label: 'Critical', value: 18, tone: 'critical' },
  { id: 'high', label: 'High', value: 47, tone: 'high' },
  { id: 'medium', label: 'Medium', value: 82, tone: 'medium' },
  { id: 'pending', label: 'Pending Investigation', value: 21, tone: 'neutral' },
]

export const recentThreats = [
  {
    id: 'ioc-1042',
    value: '185.212.47.118',
    type: 'IP Address',
    category: 'Ransomware',
    severity: 'Critical',
    confidence: 95,
    status: 'Confirmed',
    date: '2026-08-21',
  },
  {
    id: 'ioc-1041',
    value: 'malicious-example.com',
    type: 'Domain',
    category: 'Phishing',
    severity: 'High',
    confidence: 89,
    status: 'Under Investigation',
    date: '2026-08-21',
  },
  {
    id: 'ioc-1040',
    value: 'A94A8FE5CCB19BA61C4C0873D391E987982FBBD3',
    type: 'File Hash',
    category: 'Malware',
    severity: 'High',
    confidence: 92,
    status: 'Confirmed',
    date: '2026-08-20',
  },
  {
    id: 'ioc-1039',
    value: 'suspicious-site.com',
    type: 'Domain',
    category: 'Suspicious Activity',
    severity: 'Medium',
    confidence: 70,
    status: 'Pending',
    date: '2026-08-20',
  },
  {
    id: 'ioc-1038',
    value: '91.202.114.9',
    type: 'IP Address',
    category: 'Botnet',
    severity: 'Medium',
    confidence: 74,
    status: 'Confirmed',
    date: '2026-08-19',
  },
  {
    id: 'ioc-1037',
    value: 'login-secure-update.net',
    type: 'Domain',
    category: 'Phishing',
    severity: 'Low',
    confidence: 58,
    status: 'Dismissed',
    date: '2026-08-18',
  },
]

export const recentAlerts = [
  {
    id: 'alert-1',
    message: 'Critical ransomware IoC submitted',
    detail: '185.212.47.118 flagged by Analyst K. Daniel',
    time: '10 min ago',
    severity: 'Critical',
  },
  {
    id: 'alert-2',
    message: 'New high-risk domain reported',
    detail: 'malicious-example.com — phishing campaign',
    time: '52 min ago',
    severity: 'High',
  },
  {
    id: 'alert-3',
    message: 'Threat record updated',
    detail: 'ioc-1040 status changed to Confirmed',
    time: '2 hr ago',
    severity: 'Medium',
  },
  {
    id: 'alert-4',
    message: 'Analyst added evidence',
    detail: 'Screenshot attached to ioc-1039',
    time: '4 hr ago',
    severity: 'Low',
  },
]

export const threatCategories = [
  { label: 'Malware', value: 74, color: 'var(--color-accent)' },
  { label: 'Phishing', value: 61, color: 'var(--color-cyan)' },
  { label: 'Ransomware', value: 38, color: 'var(--color-critical)' },
  { label: 'Botnet', value: 29, color: 'var(--color-high)' },
  { label: 'Suspicious Activity', value: 46, color: 'var(--color-text-secondary)' },
]

// Simple 8-point series for the "Threat Activity" line/area chart.
export const threatActivitySeries = [
  { label: 'Aug 14', value: 24 },
  { label: 'Aug 15', value: 31 },
  { label: 'Aug 16', value: 22 },
  { label: 'Aug 17', value: 35 },
  { label: 'Aug 18', value: 40 },
  { label: 'Aug 19', value: 33 },
  { label: 'Aug 20', value: 44 },
  { label: 'Aug 21', value: 38 },
]

export const userManagement = [
  { id: 'user-1', name: 'Krystian Daniel', role: 'Senior Analyst', access: 'Administrator', initials: 'KD' },
  { id: 'user-2', name: 'Maya Patel', role: 'Threat Hunter', access: 'Systems Analyst', initials: 'MP' },
  { id: 'user-3', name: 'Luis Ortega', role: 'Incident Responder', access: 'Viewer', initials: 'LO' },
  { id: 'user-4', name: 'Nadia Shah', role: 'SOC Lead', access: 'Administrator', initials: 'NS' },
]

export const iocSubmissionQueue = [
  { id: 'submission-1', value: '185.212.47.118', source: 'External community feed', status: 'Validated', score: 96, type: 'IP Address' },
  { id: 'submission-2', value: 'login-secure-update.net', source: 'User report', status: 'Needs Review', score: 74, type: 'Domain' },
  { id: 'submission-3', value: '9f2c...7b19', source: 'Endpoint alert', status: 'Queued', score: 58, type: 'Hash' },
  { id: 'submission-4', value: '95.181.102.14', source: 'Threat intel partner', status: 'Validated', score: 91, type: 'IP Address' },
]

export const threatClassificationMatrix = [
  { label: 'Malware', count: 26, score: 84, tone: 'critical' },
  { label: 'Phishing', count: 19, score: 72, tone: 'high' },
  { label: 'Botnet', count: 11, score: 64, tone: 'medium' },
  { label: 'Ransomware', count: 9, score: 88, tone: 'critical' },
  { label: 'Reconnaissance', count: 7, score: 51, tone: 'low' },
]

export const activityLog = [
  { id: 'activity-1', action: 'Confirmed threat indicator', actor: 'Krystian Daniel', target: '185.212.47.118', time: '10 min ago' },
  { id: 'activity-2', action: 'Added evidence', actor: 'Maya Patel', target: 'ioc-1039', time: '4 hr ago' },
  { id: 'activity-3', action: 'Updated access level', actor: 'Krystian Daniel', target: 'Luis Ortega', time: 'Yesterday' },
  { id: 'activity-4', action: 'Submitted indicator', actor: 'Luis Ortega', target: 'login-secure-update.net', time: 'Yesterday' },
]

export const reportCatalog = [
  { id: 'report-weekly', name: 'Weekly threat briefing', description: 'A concise overview of new indicators, severity trends, and analyst activity.', frequency: 'Weekly', lastRun: 'Aug 21, 2026' },
  { id: 'report-exposure', name: 'Exposure summary', description: 'Current high-risk categories and indicators requiring investigation.', frequency: 'On demand', lastRun: 'Aug 20, 2026' },
  { id: 'report-submissions', name: 'Submission quality', description: 'Confidence scores and validation outcomes across recent submissions.', frequency: 'Monthly', lastRun: 'Aug 1, 2026' },
  { id: 'report-audit', name: 'Access audit', description: 'Workspace users, roles, and recent permission changes.', frequency: 'On demand', lastRun: 'Jul 31, 2026' },
]
