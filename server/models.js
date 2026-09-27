import mongoose from 'mongoose'

const threatSchema = new mongoose.Schema({
    value: { type: String, required: true },
    normalizedValue: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true },
    category: { type: String, required: true },
    severity: { type: String, enum: ['Critical', 'High', 'Medium', 'Low'], required: true },
    confidence: { type: Number, min: 0, max: 100, required: true },
    status: { type: String, enum: ['Confirmed', 'Under Investigation', 'Pending', 'Dismissed'], default: 'Pending' },
    sightings: { type: Number, default: 1 },
    relatedThreatIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Threat' }],
    notes: String,
    source: String,
    createdBy: String,
    enrichmentStatus: { type: String, enum: ['pending', 'clean', 'malicious', 'error', 'skipped'], default: 'pending' },
    enrichedBy: [String],
    enrichedAt: Date,
    comments: [{
        author: { type: String, required: true },
        role: String,
        text: { type: String, required: true },
        type: { type: String, enum: ['comment', 'evidence'], default: 'comment' },
        url: String,
        createdAt: { type: Date, default: Date.now }
    }],
}, { timestamps: true })

const alertSchema = new mongoose.Schema({
    message: { type: String, required: true },
    detail: { type: String, required: true },
    severity: { type: String, enum: ['Critical', 'High', 'Medium', 'Low'], required: true },
    threatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Threat' },
    status: { type: String, enum: ['Open', 'Dismissed'], default: 'Open' },
    resolution: { type: String, default: null },
    resolutionNotes: String,
    resolvedBy: String,
    resolvedAt: Date,
}, { timestamps: true })

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ['Administrator', 'Systems Analyst', 'Security Analyst', 'Viewer'], required: true },
    initials: { type: String, required: true },
    active: { type: Boolean, default: true },
}, { timestamps: true })

const activitySchema = new mongoose.Schema({
    action: { type: String, required: true },
    actor: { type: String, required: true },
    target: { type: String, required: true },
    time: { type: String, required: true },
    userId: String,
}, { timestamps: true })

const reportSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: true },
    frequency: { type: String, required: true },
    lastRun: { type: String, required: true },
}, { timestamps: true })

const settingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    criticalAlerts: { type: Boolean, default: true },
    dailyDigest: { type: Boolean, default: true },
    defaultThreatView: { type: String, default: 'All active indicators' },
    timezone: { type: String, default: 'UTC' },
}, { timestamps: true })

export const Threat = mongoose.model('Threat', threatSchema)
export const Alert = mongoose.model('Alert', alertSchema)
export const User = mongoose.model('User', userSchema)
export const Activity = mongoose.model('Activity', activitySchema)
export const Report = mongoose.model('Report', reportSchema)
export const Setting = mongoose.model('Setting', settingSchema)