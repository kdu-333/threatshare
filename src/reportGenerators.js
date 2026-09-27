/**
 * reportGenerators.js
 * Generates CSV or PDF reports from live API data.
 * PDF uses jsPDF + jspdf-autotable.
 * CSV uses plain text download.
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { apiRequest } from './api.js'

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

const NOW_STR = () =>
    new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })

function downloadCSV(filename, headers, rows) {
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
}

function makePdf(title, subtitle) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

    // Header band
    doc.setFillColor(37, 84, 199)
    doc.rect(0, 0, 210, 22, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('ThreatShare', 14, 10)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Intelligence Platform', 14, 16)

    // Title
    doc.setTextColor(16, 24, 40)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(title, 14, 34)

    // Subtitle / date
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(90, 100, 114)
    doc.text(`${subtitle}  ·  Generated ${NOW_STR()}`, 14, 40)

    doc.setDrawColor(226, 231, 238)
    doc.line(14, 43, 196, 43)

    return doc
}

function savePdf(doc, filename) {
    doc.save(filename)
}

// Default autoTable theme options
const TABLE_OPTS = {
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [37, 84, 199], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [244, 246, 249] },
    margin: { left: 14, right: 14 },
}

function addSection(doc, title) {
    const y = (doc.lastAutoTable?.finalY ?? 43) + 8
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(37, 84, 199)
    doc.text(title, 14, y)
    doc.setDrawColor(226, 231, 238)
    doc.line(14, y + 2, 196, y + 2)
    return y + 6
}

// ─────────────────────────────────────────────
// 1. Weekly Threat Briefing
// ─────────────────────────────────────────────

export async function generateWeeklyBriefing(format) {
    const [dashboard, activity] = await Promise.all([
        apiRequest('/dashboard'),
        apiRequest('/activity'),
    ])
    const { threats, stats, categories } = dashboard

    if (format === 'csv') {
        const headers = ['Indicator', 'Type', 'Category', 'Severity', 'Confidence', 'Status', 'Source', 'Sightings']
        const rows = threats.map((t) => [t.value, t.type, t.category, t.severity, `${t.confidence}%`, t.status, t.source || '', t.sightings || 1])
        downloadCSV('weekly-threat-briefing.csv', headers, rows)
        return
    }

    // PDF
    const doc = makePdf('Weekly Threat Briefing', `${threats.length} indicators · ${stats.critical} critical`)

    // Stats box
    let y = 50
    const statBoxes = [
        { label: 'Total', value: stats.total },
        { label: 'Critical', value: stats.critical },
        { label: 'High', value: stats.high },
        { label: 'Pending', value: stats.pending },
    ]
    const boxW = 44
    statBoxes.forEach((s, i) => {
        const x = 14 + i * (boxW + 2)
        doc.setFillColor(244, 246, 249)
        doc.roundedRect(x, y, boxW, 18, 2, 2, 'F')
        doc.setTextColor(16, 24, 40)
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text(String(s.value), x + boxW / 2, y + 10, { align: 'center' })
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(90, 100, 114)
        doc.text(s.label, x + boxW / 2, y + 15, { align: 'center' })
    })

    // Critical indicators
    const startY = addSection(doc, 'Critical Indicators')
    const critical = threats.filter((t) => t.severity === 'Critical')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY,
        head: [['Indicator', 'Type', 'Category', 'Confidence', 'Status']],
        body: critical.length
            ? critical.map((t) => [t.value, t.type, t.category, `${t.confidence}%`, t.status])
            : [['No critical indicators', '', '', '', '']],
    })

    // High severity
    const highY = addSection(doc, 'High Severity Indicators')
    const high = threats.filter((t) => t.severity === 'High')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: highY,
        head: [['Indicator', 'Type', 'Category', 'Confidence', 'Status']],
        body: high.length
            ? high.map((t) => [t.value, t.type, t.category, `${t.confidence}%`, t.status])
            : [['No high-severity indicators', '', '', '', '']],
    })

    // Category breakdown
    const catY = addSection(doc, 'Category Breakdown')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: catY,
        head: [['Category', 'Count']],
        body: categories.map((c) => [c.label, c.value]),
    })

    // Recent activity
    const actY = addSection(doc, 'Recent Analyst Activity')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: actY,
        head: [['Action', 'Analyst', 'Target', 'Time']],
        body: activity.slice(0, 15).map((a) => [a.action, a.actor, a.target, a.time]),
    })

    savePdf(doc, 'weekly-threat-briefing.pdf')
}

// ─────────────────────────────────────────────
// 2. Exposure Summary
// ─────────────────────────────────────────────

export async function generateExposureSummary(format) {
    const { threats, categories } = await apiRequest('/dashboard')
    const highRisk = threats.filter((t) => t.severity === 'Critical' || t.severity === 'High')
    const pending = threats.filter((t) => t.status === 'Pending')
    const underInv = threats.filter((t) => t.status === 'Under Investigation')

    if (format === 'csv') {
        const headers = ['Indicator', 'Type', 'Category', 'Severity', 'Confidence', 'Status', 'Source']
        const rows = highRisk.map((t) => [t.value, t.type, t.category, t.severity, `${t.confidence}%`, t.status, t.source || ''])
        downloadCSV('exposure-summary.csv', headers, rows)
        return
    }

    const doc = makePdf('Exposure Summary', `${highRisk.length} high-risk indicators · ${pending.length} pending triage`)

    let y = 50
    const statBoxes = [
        { label: 'High Risk', value: highRisk.length },
        { label: 'Under Investigation', value: underInv.length },
        { label: 'Pending Triage', value: pending.length },
    ]
    const boxW = 58
    statBoxes.forEach((s, i) => {
        const x = 14 + i * (boxW + 2)
        doc.setFillColor(244, 246, 249)
        doc.roundedRect(x, y, boxW, 18, 2, 2, 'F')
        doc.setTextColor(16, 24, 40)
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text(String(s.value), x + boxW / 2, y + 10, { align: 'center' })
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(90, 100, 114)
        doc.text(s.label, x + boxW / 2, y + 15, { align: 'center' })
    })

    const hY = addSection(doc, 'Indicators Requiring Immediate Attention')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: hY,
        head: [['Indicator', 'Type', 'Category', 'Severity', 'Confidence', 'Status']],
        body: highRisk.map((t) => [t.value, t.type, t.category, t.severity, `${t.confidence}%`, t.status]),
    })

    const pY = addSection(doc, 'Pending Triage Queue')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: pY,
        head: [['Indicator', 'Type', 'Category', 'Severity', 'Source']],
        body: pending.length
            ? pending.map((t) => [t.value, t.type, t.category, t.severity, t.source || '—'])
            : [['No indicators pending triage', '', '', '', '']],
    })

    const cY = addSection(doc, 'Category Risk Distribution')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: cY,
        head: [['Category', 'Count']],
        body: categories.map((c) => [c.label, c.value]),
    })

    savePdf(doc, 'exposure-summary.pdf')
}

// ─────────────────────────────────────────────
// 3. Submission Quality
// ─────────────────────────────────────────────

export async function generateSubmissionQuality(format) {
    const threats = await apiRequest('/threats')
    const total = threats.length
    const avgConf = total ? Math.round(threats.reduce((s, t) => s + t.confidence, 0) / total) : 0
    const enriched = threats.filter((t) => t.enrichmentStatus === 'malicious' || t.enrichmentStatus === 'clean')

    if (format === 'csv') {
        const headers = ['Indicator', 'Type', 'Confidence', 'Severity', 'Status', 'Source', 'Enrichment', 'Sightings']
        const rows = threats.map((t) => [t.value, t.type, `${t.confidence}%`, t.severity, t.status, t.source || '', t.enrichmentStatus || 'pending', t.sightings || 1])
        downloadCSV('submission-quality.csv', headers, rows)
        return
    }

    const doc = makePdf('Submission Quality Report', `${total} submissions · avg confidence ${avgConf}%`)

    let y = 50
    const statBoxes = [
        { label: 'Submissions', value: total },
        { label: 'Avg Confidence', value: `${avgConf}%` },
        { label: 'Confirmed', value: threats.filter((t) => t.status === 'Confirmed').length },
        { label: 'Enriched', value: enriched.length },
    ]
    const boxW = 44
    statBoxes.forEach((s, i) => {
        const x = 14 + i * (boxW + 2)
        doc.setFillColor(244, 246, 249)
        doc.roundedRect(x, y, boxW, 18, 2, 2, 'F')
        doc.setTextColor(16, 24, 40)
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text(String(s.value), x + boxW / 2, y + 10, { align: 'center' })
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(90, 100, 114)
        doc.text(s.label, x + boxW / 2, y + 15, { align: 'center' })
    })

    const distY = addSection(doc, 'Confidence Score Distribution')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: distY,
        head: [['Range', 'Count', '%']],
        body: [
            ['90–100 (Critical)', threats.filter((t) => t.confidence >= 90).length, `${total ? Math.round(threats.filter((t) => t.confidence >= 90).length / total * 100) : 0}%`],
            ['75–89 (High)', threats.filter((t) => t.confidence >= 75 && t.confidence < 90).length, `${total ? Math.round(threats.filter((t) => t.confidence >= 75 && t.confidence < 90).length / total * 100) : 0}%`],
            ['50–74 (Medium)', threats.filter((t) => t.confidence >= 50 && t.confidence < 75).length, `${total ? Math.round(threats.filter((t) => t.confidence >= 50 && t.confidence < 75).length / total * 100) : 0}%`],
            ['0–49 (Low)', threats.filter((t) => t.confidence < 50).length, `${total ? Math.round(threats.filter((t) => t.confidence < 50).length / total * 100) : 0}%`],
        ],
    })

    const bySource = {}
    threats.forEach((t) => { bySource[t.source || 'Unknown'] = (bySource[t.source || 'Unknown'] || 0) + 1 })
    const srcY = addSection(doc, 'Submissions by Source')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: srcY,
        head: [['Source', 'Count', '% of Total']],
        body: Object.entries(bySource)
            .sort((a, b) => b[1] - a[1])
            .map(([src, cnt]) => [src, cnt, `${Math.round(cnt / total * 100)}%`]),
    })

    const allY = addSection(doc, 'All Submissions')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: allY,
        head: [['Indicator', 'Type', 'Confidence', 'Severity', 'Status', 'Enrichment']],
        body: threats.map((t) => [t.value, t.type, `${t.confidence}%`, t.severity, t.status, t.enrichmentStatus || 'pending']),
    })

    savePdf(doc, 'submission-quality.pdf')
}

// ─────────────────────────────────────────────
// 4. Access Audit
// ─────────────────────────────────────────────

export async function generateAccessAudit(format) {
    const [users, activity] = await Promise.all([
        apiRequest('/users'),
        apiRequest('/activity'),
    ])
    const permChanges = activity.filter((a) =>
        /access|user|role|created|deleted/i.test(a.action)
    )

    if (format === 'csv') {
        const headers = ['Name', 'Email', 'Role', 'Status', 'Member Since']
        const rows = users.map((u) => [
            u.name, u.email, u.role,
            u.active ? 'Active' : 'Inactive',
            u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—',
        ])
        downloadCSV('access-audit.csv', headers, rows)
        return
    }

    const doc = makePdf('Access Audit Report', `${users.length} users · ${permChanges.length} permission changes`)

    let y = 50
    const statBoxes = [
        { label: 'Total Users', value: users.length },
        { label: 'Active', value: users.filter((u) => u.active).length },
        { label: 'Inactive', value: users.filter((u) => !u.active).length },
        { label: 'Perm Changes', value: permChanges.length },
    ]
    const boxW = 44
    statBoxes.forEach((s, i) => {
        const x = 14 + i * (boxW + 2)
        doc.setFillColor(244, 246, 249)
        doc.roundedRect(x, y, boxW, 18, 2, 2, 'F')
        doc.setTextColor(16, 24, 40)
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text(String(s.value), x + boxW / 2, y + 10, { align: 'center' })
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(90, 100, 114)
        doc.text(s.label, x + boxW / 2, y + 15, { align: 'center' })
    })

    const usersY = addSection(doc, 'Workspace Users')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: usersY,
        head: [['Name', 'Email', 'Role', 'Status', 'Member Since']],
        body: users.map((u) => [
            u.name, u.email, u.role,
            u.active ? 'Active' : 'Inactive',
            u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—',
        ]),
    })

    const permY = addSection(doc, 'Recent Permission Changes')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: permY,
        head: [['Action', 'Performed By', 'Target', 'Time']],
        body: permChanges.length
            ? permChanges.map((a) => [a.action, a.actor, a.target, a.time])
            : [['No permission changes recorded', '', '', '']],
    })

    const logY = addSection(doc, 'Full Activity Log')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: logY,
        head: [['Action', 'Actor', 'Target', 'Time']],
        body: activity.map((a) => [a.action, a.actor, a.target, a.time]),
    })

    savePdf(doc, 'access-audit.pdf')
}

// ─────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────

export async function generateReport(reportName, format = 'pdf') {
    const name = reportName.toLowerCase()
    if (name.includes('weekly') || name.includes('briefing')) return generateWeeklyBriefing(format)
    if (name.includes('exposure')) return generateExposureSummary(format)
    if (name.includes('submission') || name.includes('quality')) return generateSubmissionQuality(format)
    if (name.includes('access') || name.includes('audit')) return generateAccessAudit(format)
    throw new Error(`No generator found for report: ${reportName}`)
}
