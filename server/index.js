import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { Activity, Alert, Report, Setting, Threat, User } from './models.js'
import { enrichIoc } from './enrich.js'

const app = express()
const port = process.env.PORT || 4000
const jwtSecret = process.env.JWT_SECRET || 'local-development-secret'
const loginAttempts = new Map()

app.use(cors({ origin: true, credentials: true }))
app.use(helmet())
app.use(express.json({ limit: '100kb' }))
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false }))

function normalizeIndicator(value) {
    return value.trim().toLowerCase()
}

function requireAuth(request, response, next) {
    const token = request.headers.authorization?.replace('Bearer ', '')
    if (!token) return response.status(401).json({ message: 'Authentication required.' })
    try {
        request.user = jwt.verify(token, jwtSecret)
        User.findById(request.user.id).then((account) => {
            if (!account || !account.active) return response.status(401).json({ message: 'Your account is inactive.' })
            request.user.role = account.role
            next()
        }).catch(() => response.status(401).json({ message: 'Unable to verify your session.' }))
    } catch {
        response.status(401).json({ message: 'Invalid or expired session.' })
    }
}

app.get('/api/health', (_request, response) => response.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' }))

app.post('/api/auth/login', async (request, response) => {
    const { email, password } = request.body
    if (!email || !password) return response.status(400).json({ message: 'Email and password are required.' })
    const normalizedEmail = email.trim().toLowerCase()
    const account = await User.findOne({ email: normalizedEmail, active: true })
    if (account && (await bcrypt.compare(password, account.passwordHash))) {
        loginAttempts.delete(normalizedEmail)
        const user = { id: account._id, name: account.name, role: account.role, initials: account.initials, email: account.email }
        await Activity.create({ action: 'User logged in', actor: account.name, target: account.email, time: 'Just now', userId: account._id })
        return response.json({ token: jwt.sign(user, jwtSecret, { expiresIn: '8h' }), user })
    }

    const attempt = loginAttempts.get(normalizedEmail) || { count: 0, blockedUntil: 0 }
    if (attempt.blockedUntil > Date.now()) return response.status(429).json({ message: 'Too many attempts. Try again later.' })

    attempt.count += 1
    if (attempt.count >= 5) { attempt.count = 0; attempt.blockedUntil = Date.now() + 15 * 60 * 1000 }
    loginAttempts.set(normalizedEmail, attempt)
    return response.status(401).json({ message: 'Invalid email or password.' })
})

app.post('/api/auth/logout', requireAuth, async (request, response) => {
    await Activity.create({ action: 'User logged out', actor: request.user.name, target: request.user.email, time: 'Just now', userId: request.user.id })
    response.json({ message: 'Logged out.' })
})

app.get('/api/threats', requireAuth, async (_request, response) => response.json(await Threat.find().sort({ createdAt: -1 }).limit(100)))
app.get('/api/dashboard', requireAuth, async (_request, response) => {
    const [threats, alerts, total, severityCounts, statusCounts, categoryCounts] = await Promise.all([
        Threat.find().sort({ createdAt: -1 }).limit(100),
        Alert.find({ status: 'Open' }).sort({ createdAt: -1 }).limit(10),
        Threat.countDocuments(),
        Threat.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
        Threat.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Threat.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    ])
    const counts = Object.fromEntries(severityCounts.map((item) => [item._id, item.count]))
    const statuses = Object.fromEntries(statusCounts.map((item) => [item._id, item.count]))
    response.json({ threats, alerts, stats: { total, critical: counts.Critical || 0, high: counts.High || 0, medium: counts.Medium || 0, pending: statuses.Pending || 0 }, categories: categoryCounts.map((item) => ({ label: item._id, value: item.count })) })
})

function isAuthorizedAnalyst(role) {
    return role === 'Administrator' || role === 'Systems Analyst' || role === 'Security Analyst'
}

app.post('/api/threats', requireAuth, async (request, response) => {
    if (!isAuthorizedAnalyst(request.user.role)) return response.status(403).json({ message: 'Only Analysts and Administrators can submit indicators.' })
    const { indicator, type, source, confidence, notes, category = 'Suspicious Activity' } = request.body
    if (!indicator?.trim() || !type) return response.status(400).json({ message: 'Indicator and type are required.' })
    const normalizedValue = normalizeIndicator(indicator)
    const score = Math.max(0, Math.min(100, Number(confidence) || 0))
    const existing = await Threat.findOneAndUpdate({ normalizedValue }, { $inc: { sightings: 1 }, $max: { confidence: score }, $set: { status: 'Under Investigation' } }, { returnDocument: 'after' })

    if (existing) {
        await Alert.create({ message: 'IoC re-sighted', detail: `${existing.value} was submitted again and requires review.`, severity: 'High', threatId: existing._id })
        await Activity.create({ action: 'Re-sighted indicator', actor: request.user.name, target: existing.value, time: 'Just now', userId: request.user.id })
        return response.status(200).json({ threat: existing, detection: 're-sighting', message: 'Existing indicator re-sighted and reopened for investigation.' })
    }

    const allowedCategories = ['Malware', 'Phishing', 'Ransomware', 'Botnet', 'Suspicious Activity', 'Reconnaissance']
    if (!allowedCategories.includes(category)) return response.status(400).json({ message: 'Invalid threat category.' })
    const related = await Threat.find({ category, normalizedValue: { $ne: normalizedValue } }).limit(10)
    const severity = score >= 90 ? 'Critical' : score >= 75 ? 'High' : score >= 50 ? 'Medium' : 'Low'
    let threat
    try {
        threat = await Threat.create({ value: indicator.trim(), normalizedValue, type, source, confidence: score, notes, category, severity, status: score >= 85 ? 'Confirmed' : 'Pending', relatedThreatIds: related.map((item) => item._id), createdBy: request.user.id })
    } catch (error) {
        if (error.code === 11000) return response.status(409).json({ message: 'This indicator was submitted at the same time by another user. Submit it again to record a re-sighting.' })
        throw error
    }

    if (related.length) await Threat.updateMany({ _id: { $in: related.map((item) => item._id) } }, { $addToSet: { relatedThreatIds: threat._id } })
    if (severity === 'Critical' || (severity === 'High' && related.length)) await Alert.create({ message: 'Threat automatically escalated', detail: `${threat.value} scored ${score}% and was linked to ${related.length} related indicator(s).`, severity, threatId: threat._id })
    await Activity.create({ action: 'Submitted indicator', actor: request.user.name, target: threat.value, time: 'Just now', userId: request.user.id })
    // Fire-and-forget enrichment — never blocks the response
    enrichIoc(threat).catch((err) => console.error('[enrich] background error:', err.message))
    response.status(201).json({ threat, detection: related.length ? 'correlated' : 'new', relatedCount: related.length })
})

// Check if indicator already exists (inline duplicate & re-sighting check)
app.get('/api/threats/check', requireAuth, async (request, response) => {
    const indicator = request.query.indicator?.trim()
    if (!indicator) return response.json({ exists: false })
    const normalizedValue = normalizeIndicator(indicator)
    const existing = await Threat.findOne({ normalizedValue })
    if (!existing) return response.json({ exists: false })
    response.json({
        exists: true,
        threat: {
            _id: existing._id,
            value: existing.value,
            status: existing.status,
            sightings: existing.sightings,
            severity: existing.severity,
            createdAt: existing.createdAt,
        }
    })
})

// Bulk IoC submission
app.post('/api/threats/bulk', requireAuth, async (request, response) => {
    if (!isAuthorizedAnalyst(request.user.role)) return response.status(403).json({ message: 'Only Analysts and Administrators can submit indicators.' })
    const { items = [], defaultCategory = 'Suspicious Activity', defaultSource = 'Manual entry', defaultConfidence = 80 } = request.body
    if (!Array.isArray(items) || items.length === 0) return response.status(400).json({ message: 'No indicators provided.' })

    const results = { created: 0, updated: 0, errors: 0 }
    for (const raw of items.slice(0, 50)) { // limit 50 at a time
        const val = typeof raw === 'string' ? raw.trim() : raw.indicator?.trim()
        if (!val) continue
        const type = typeof raw === 'object' && raw.type ? raw.type : (
            /^[a-f0-9]{32,64}$/i.test(val) ? 'File Hash' :
                /^(\d{1,3}\.){3}\d{1,3}$/.test(val) ? 'IP Address' :
                    /^https?:\/\//i.test(val) ? 'URL' : 'Domain'
        )
        const normalizedValue = normalizeIndicator(val)
        const score = Number(raw.confidence || defaultConfidence) || 80
        const category = raw.category || defaultCategory
        const severity = score >= 90 ? 'Critical' : score >= 75 ? 'High' : score >= 50 ? 'Medium' : 'Low'

        try {
            const existing = await Threat.findOneAndUpdate(
                { normalizedValue },
                { $inc: { sightings: 1 }, $max: { confidence: score }, $set: { status: 'Under Investigation' } },
                { returnDocument: 'after' }
            )
            if (existing) {
                results.updated += 1
                enrichIoc(existing).catch(() => { })
            } else {
                const threat = await Threat.create({
                    value: val,
                    normalizedValue,
                    type,
                    source: defaultSource,
                    confidence: score,
                    category,
                    severity,
                    status: score >= 85 ? 'Confirmed' : 'Pending',
                    createdBy: request.user.id,
                })
                results.created += 1
                enrichIoc(threat).catch(() => { })
            }
        } catch {
            results.errors += 1
        }
    }

    await Activity.create({ action: `Bulk imported ${results.created + results.updated} indicators`, actor: request.user.name, target: 'Bulk ingestion', time: 'Just now', userId: request.user.id })
    response.json({ message: `Bulk import finished: ${results.created} new, ${results.updated} re-sighted.`, ...results })
})

app.get('/api/threats/:id', requireAuth, async (request, response) => {
    const threat = await Threat.findById(request.params.id)
    if (!threat) return response.status(404).json({ message: 'Threat not found.' })
    response.json(threat)
})

app.patch('/api/threats/:id/status', requireAuth, async (request, response) => {
    if (!isAuthorizedAnalyst(request.user.role)) return response.status(403).json({ message: 'Only Analysts and Administrators can update threat status.' })
    const allowedStatuses = ['Confirmed', 'Under Investigation', 'Pending', 'Dismissed']
    const { status } = request.body
    if (!allowedStatuses.includes(status)) return response.status(400).json({ message: 'Invalid status value.' })
    const threat = await Threat.findByIdAndUpdate(request.params.id, { status }, { returnDocument: 'after' })
    if (!threat) return response.status(404).json({ message: 'Threat not found.' })
    await Activity.create({ action: `Status changed to ${status}`, actor: request.user.name, target: threat.value, time: 'Just now', userId: request.user.id })
    response.json(threat)
})

// Threat Comments & Evidence notes
app.post('/api/threats/:id/comments', requireAuth, async (request, response) => {
    if (!isAuthorizedAnalyst(request.user.role)) return response.status(403).json({ message: 'Only Analysts and Administrators can add comments and evidence.' })
    const { text, type = 'comment', url } = request.body
    if (!text?.trim()) return response.status(400).json({ message: 'Comment or note text is required.' })

    const comment = {
        author: request.user.name,
        role: request.user.role,
        text: text.trim(),
        type: type === 'evidence' ? 'evidence' : 'comment',
        url: url?.trim() || undefined,
        createdAt: new Date(),
    }

    const threat = await Threat.findByIdAndUpdate(
        request.params.id,
        { $push: { comments: comment } },
        { returnDocument: 'after' }
    )
    if (!threat) return response.status(404).json({ message: 'Threat not found.' })

    const actionLabel = type === 'evidence' ? 'Added evidence' : 'Added comment'
    await Activity.create({ action: actionLabel, actor: request.user.name, target: threat.value, time: 'Just now', userId: request.user.id })
    response.status(201).json({ comments: threat.comments })
})

app.get('/api/alerts', requireAuth, async (request, response) => {
    if (request.user.role === 'Viewer') return response.status(403).json({ message: 'Viewer accounts cannot access alerts.' })
    response.json(await Alert.find({ status: 'Open' }).sort({ createdAt: -1 }).limit(100))
})

app.patch('/api/alerts/:id/dismiss', requireAuth, async (request, response) => {
    if (!isAuthorizedAnalyst(request.user.role)) return response.status(403).json({ message: 'Only Analysts and Administrators can dismiss alerts.' })
    const alert = await Alert.findByIdAndUpdate(request.params.id, { status: 'Dismissed' }, { returnDocument: 'after' })
    if (!alert) return response.status(404).json({ message: 'Alert not found.' })
    await Activity.create({ action: 'Dismissed alert', actor: request.user.name, target: alert.message, time: 'Just now', userId: request.user.id })
    response.json(alert)
})

// Resolve alert with disposition reason & notes
app.patch('/api/alerts/:id/resolve', requireAuth, async (request, response) => {
    if (!isAuthorizedAnalyst(request.user.role)) return response.status(403).json({ message: 'Only Analysts and Administrators can resolve alerts.' })
    const { resolution = 'Resolved', resolutionNotes = '' } = request.body
    const alert = await Alert.findByIdAndUpdate(
        request.params.id,
        {
            status: 'Dismissed',
            resolution,
            resolutionNotes: resolutionNotes.trim(),
            resolvedBy: request.user.name,
            resolvedAt: new Date(),
        },
        { returnDocument: 'after' }
    )
    if (!alert) return response.status(404).json({ message: 'Alert not found.' })
    await Activity.create({ action: `Resolved alert (${resolution})`, actor: request.user.name, target: alert.message, time: 'Just now', userId: request.user.id })
    response.json(alert)
})
app.get('/api/users', requireAuth, async (request, response) => {
    if (request.user.role !== 'Administrator') return response.status(403).json({ message: 'Administrator access required.' })
    response.json(await User.find().select('-passwordHash').sort({ name: 1 }))
})
app.post('/api/users', requireAuth, async (request, response) => {
    if (request.user.role !== 'Administrator') return response.status(403).json({ message: 'Administrator access required.' })
    const { name, email, password, role } = request.body
    if (!name?.trim() || !email?.trim() || !password || !role) return response.status(400).json({ message: 'Name, email, password, and role are required.' })
    if (password.length < 8) return response.status(400).json({ message: 'Password must be at least 8 characters.' })
    try {
        const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), passwordHash: await bcrypt.hash(password, 10), role, initials: name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() })
        await Activity.create({ action: 'Created user', actor: request.user.name, target: user.name, time: 'Just now', userId: request.user.id })
        const safeUser = user.toObject()
        delete safeUser.passwordHash
        response.status(201).json(safeUser)
    } catch (error) {
        response.status(error.code === 11000 ? 409 : 400).json({ message: error.code === 11000 ? 'That email is already registered.' : 'Could not create user.' })
    }
})
app.patch('/api/users/:id', requireAuth, async (request, response) => {
    if (request.user.role !== 'Administrator') return response.status(403).json({ message: 'Administrator access required.' })
    const updates = {}
    for (const field of ['name', 'email', 'role', 'active']) if (request.body[field] !== undefined) updates[field] = request.body[field]
    if (request.body.password) {
        if (request.body.password.length < 8) return response.status(400).json({ message: 'Password must be at least 8 characters.' })
        updates.passwordHash = await bcrypt.hash(request.body.password, 10)
    }
    if (updates.name) updates.initials = updates.name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    let user
    try {
        user = await User.findByIdAndUpdate(request.params.id, updates, { returnDocument: 'after', runValidators: true }).select('-passwordHash')
    } catch (error) {
        if (error.code === 11000) return response.status(409).json({ message: 'That email is already registered.' })
        throw error
    }
    if (!user) return response.status(404).json({ message: 'User not found.' })
    await Activity.create({ action: 'Updated access level', actor: request.user.name, target: user.name, time: 'Just now', userId: request.user.id })
    response.json(user)
})
app.delete('/api/users/:id', requireAuth, async (request, response) => {
    if (request.user.role !== 'Administrator') return response.status(403).json({ message: 'Administrator access required.' })
    if (request.params.id === request.user.id.toString()) return response.status(400).json({ message: 'You cannot delete your own account.' })
    const user = await User.findByIdAndDelete(request.params.id)
    if (!user) return response.status(404).json({ message: 'User not found.' })
    await Activity.create({ action: 'Deleted user', actor: request.user.name, target: user.name, time: 'Just now', userId: request.user.id })
    response.json({ message: 'User deleted.' })
})
app.get('/api/activity', requireAuth, async (request, response) => {
    if (request.user.role !== 'Administrator') return response.status(403).json({ message: 'Administrator access required.' })
    response.json(await Activity.find().sort({ createdAt: -1 }).limit(100))
})
app.post('/api/activity/export', requireAuth, async (request, response) => {
    if (request.user.role !== 'Administrator') return response.status(403).json({ message: 'Administrator access required.' })
    await Activity.create({ action: 'Exported audit log (CSV)', actor: request.user.name, target: 'Activity Log', time: 'Just now', userId: request.user.id })
    response.json({ message: 'Export logged.' })
})
app.get('/api/reports', requireAuth, async (request, response) => {
    if (request.user.role !== 'Administrator') return response.status(403).json({ message: 'Administrator access required.' })
    response.json(await Report.find().sort({ name: 1 }))
})
app.post('/api/reports/:id/generate', requireAuth, async (request, response) => {
    if (request.user.role !== 'Administrator') return response.status(403).json({ message: 'Administrator access required.' })
    const report = await Report.findByIdAndUpdate(request.params.id, { lastRun: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }, { returnDocument: 'after' })
    if (!report) return response.status(404).json({ message: 'Report not found.' })
    await Activity.create({ action: 'Generated report', actor: request.user.name, target: report.name, time: 'Just now', userId: request.user.id })
    response.json(report)
})
app.get('/api/settings', requireAuth, async (request, response) => {
    if (request.user.role !== 'Administrator') return response.status(403).json({ message: 'Administrator access required.' })
    response.json(await Setting.findOne({ key: 'workspace' }) || await Setting.create({ key: 'workspace' }))
})
app.patch('/api/settings', requireAuth, async (request, response) => {
    if (request.user.role !== 'Administrator') return response.status(403).json({ message: 'Administrator access required.' })
    response.json(await Setting.findOneAndUpdate({ key: 'workspace' }, request.body, { returnDocument: 'after', upsert: true }))
})

app.use((error, _request, response, _next) => {
    console.error(error)
    response.status(error.statusCode || 500).json({ message: 'An unexpected server error occurred.' })
})

export async function startServer() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/threatshare')
    return app.listen(port, () => console.log(`ThreatShare API listening on http://127.0.0.1:${port}`))
}

if (process.env.NODE_ENV !== 'test') {
    startServer().catch((error) => { console.error('MongoDB connection failed:', error.message); process.exit(1) })
}

export { app }