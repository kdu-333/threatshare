import 'dotenv/config'
import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { Activity, Alert, Report, Setting, Threat, User } from './models.js'

const threats = [
    { value: '185.212.47.118', type: 'IP Address', category: 'Ransomware', severity: 'Critical', confidence: 95, status: 'Confirmed', source: 'External community feed' },
    { value: 'malicious-example.com', type: 'Domain', category: 'Phishing', severity: 'High', confidence: 89, status: 'Under Investigation', source: 'User report' },
    { value: 'A94A8FE5CCB19BA61C4C0873D391E987982FBBD3', type: 'File Hash', category: 'Malware', severity: 'High', confidence: 92, status: 'Confirmed', source: 'Endpoint alert' },
    { value: 'suspicious-site.com', type: 'Domain', category: 'Suspicious Activity', severity: 'Medium', confidence: 70, status: 'Pending', source: 'Manual entry' },
    { value: '91.202.114.9', type: 'IP Address', category: 'Botnet', severity: 'Medium', confidence: 74, status: 'Confirmed', source: 'Threat intel partner' },
    { value: 'login-secure-update.net', type: 'Domain', category: 'Phishing', severity: 'Low', confidence: 58, status: 'Dismissed', source: 'User report' },
].map((threat) => ({ ...threat, normalizedValue: threat.value.toLowerCase(), createdBy: 'local-admin' }))

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/threatshare')
await Threat.deleteMany({})
await Alert.deleteMany({})
await User.deleteMany({})
await Activity.deleteMany({})
await Report.deleteMany({})
await Setting.deleteMany({})
const insertedThreats = await Threat.insertMany(threats)
await Alert.insertMany([
    { message: 'Critical ransomware IoC submitted', detail: '185.212.47.118 flagged by Analyst K. Daniel', severity: 'Critical', threatId: insertedThreats[0]._id },
    { message: 'New high-risk domain reported', detail: 'malicious-example.com - phishing campaign', severity: 'High', threatId: insertedThreats[1]._id },
])
const passwordHash = await bcrypt.hash('demo-password', 10)
await User.insertMany([
    { name: 'Krystian Daniel', email: 'admin@threatshare.local', passwordHash, role: 'Administrator', initials: 'KD' },
    { name: 'Maya Patel', email: 'maya@threatshare.local', passwordHash, role: 'Systems Analyst', initials: 'MP' },
    { name: 'Luis Ortega', email: 'luis@threatshare.local', passwordHash, role: 'Viewer', initials: 'LO' },
    { name: 'Nadia Shah', email: 'nadia@threatshare.local', passwordHash, role: 'Administrator', initials: 'NS' },
])
await Activity.insertMany([
    { action: 'Confirmed threat indicator', actor: 'Krystian Daniel', target: '185.212.47.118', time: '10 min ago' },
    { action: 'Added evidence', actor: 'Maya Patel', target: 'ioc-1039', time: '4 hr ago' },
    { action: 'Updated access level', actor: 'Krystian Daniel', target: 'Luis Ortega', time: 'Yesterday' },
])
await Report.insertMany([
    { name: 'Weekly threat briefing', description: 'A concise overview of new indicators, severity trends, and analyst activity.', frequency: 'Weekly', lastRun: 'Aug 21, 2026' },
    { name: 'Exposure summary', description: 'Current high-risk categories and indicators requiring investigation.', frequency: 'On demand', lastRun: 'Aug 20, 2026' },
    { name: 'Submission quality', description: 'Confidence scores and validation outcomes across recent submissions.', frequency: 'Monthly', lastRun: 'Aug 1, 2026' },
    { name: 'Access audit', description: 'Workspace users, roles, and recent permission changes.', frequency: 'On demand', lastRun: 'Jul 31, 2026' },
])
await Setting.create({ key: 'workspace' })
console.log(`Seeded ${insertedThreats.length} threats, 2 alerts, 4 users, 3 activities, 4 reports, and workspace settings.`)
await mongoose.disconnect()