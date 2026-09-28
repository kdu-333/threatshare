/**
 * reportGenerators.js
 * Generates CSV, downloadable PDF, or print-ready reports from live API data.
 * PDF uses jsPDF + jspdf-autotable with multi-page headers, footers, pagination,
 * and user attribution ("Printed by").
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { apiRequest, getCurrentUser } from './api.js'

// ─────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────

const NOW_STR = () =>
    new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    })

function downloadCSV(filename, headers, rows, meta = {}) {
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const metaLines = []
    if (meta.title) metaLines.push(`# ThreatShare Intelligence Report: ${meta.title}`)
    if (meta.printedBy) metaLines.push(`# Printed / Exported By: ${meta.printedBy}`)
    if (meta.generatedAt) metaLines.push(`# Generated At: ${meta.generatedAt}`)
    metaLines.push('# Security Classification: TLP:AMBER (Confidential / Internal Use Only)')
    metaLines.push('#')

    const csvBody = [
        headers.map(escape).join(','),
        ...rows.map((r) => r.map(escape).join(',')),
    ].join('\n')

    const fullContent = [...metaLines, csvBody].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([fullContent], { type: 'text/csv;charset=utf-8;' }))
    a.download = filename
    a.click()
    URL.revokeObjectURL(a.href)
}

function printPdf(doc) {
    doc.autoPrint({ variant: 'non-conform' })
    const blob = doc.output('blob')
    const blobUrl = URL.createObjectURL(blob)

    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    iframe.src = blobUrl

    let printed = false
    iframe.onload = () => {
        try {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
            printed = true
        } catch {
            // Browser blocked iframe print, fallback will trigger
        }
    }
    document.body.appendChild(iframe)

    setTimeout(() => {
        if (!printed) {
            window.open(blobUrl, '_blank')
        }
        setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe)
            }
            URL.revokeObjectURL(blobUrl)
        }, 120000)
    }, 800)
}

function makePdf(title, subtitle, user) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const currentUser = user || getCurrentUser()
    const userName = currentUser?.name || 'Authorized Analyst'
    const userRole = currentUser?.role || 'Security Analyst'

    // Top Header band
    doc.setFillColor(30, 58, 138) // #1e3a8a navy
    doc.rect(0, 0, 210, 24, 'F')

    // Brand Name & Tagline
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('ThreatShare', 14, 11)

    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(191, 219, 254) // #bfdbfe
    doc.text('Cyber Threat Intelligence Platform', 14, 18)

    // Security Classification Badge (Top Right)
    doc.setFillColor(220, 38, 38) // #dc2626 red
    doc.roundedRect(148, 7, 48, 10, 1.5, 1.5, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text('TLP:AMBER · STRICTLY CONFIDENTIAL', 172, 13.5, { align: 'center' })

    // Report Title
    doc.setTextColor(15, 23, 42) // #0f172a
    doc.setFontSize(17)
    doc.setFont('helvetica', 'bold')
    doc.text(title, 14, 35)

    // Subtitle
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105) // #475569
    doc.text(subtitle, 14, 41)

    // Attribution & Print Meta Bar
    doc.setFillColor(241, 245, 249) // #f1f5f9
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.25)
    doc.roundedRect(14, 45, 182, 8.5, 1.5, 1.5, 'FD')

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 58, 138)
    doc.text('PRINTED BY:', 18, 50.6)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(15, 23, 42)
    doc.text(userName, 38, 50.6)

    const nameWidth = doc.getTextWidth(`${userName} `)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(`(${userRole})`, 38 + nameWidth, 50.6)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100, 116, 139)
    doc.text(`Printed / Generated: ${NOW_STR()}`, 192, 50.6, { align: 'right' })

    return { doc, userName, userRole }
}

function drawStatBoxes(doc, startY, boxes) {
    const totalW = 182
    const count = boxes.length
    const gap = 2.5
    const boxW = (totalW - (count - 1) * gap) / count
    const boxH = 17

    boxes.forEach((s, i) => {
        const x = 14 + i * (boxW + gap)
        doc.setFillColor(248, 250, 252) // #f8fafc
        doc.setDrawColor(226, 232, 240) // #e2e8f0
        doc.setLineWidth(0.3)
        doc.roundedRect(x, startY, boxW, boxH, 1.5, 1.5, 'FD')

        doc.setTextColor(15, 23, 42)
        doc.setFontSize(14)
        doc.setFont('helvetica', 'bold')
        doc.text(String(s.value), x + boxW / 2, startY + 9, { align: 'center' })

        doc.setFontSize(6.8)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(100, 116, 139)
        doc.text(s.label.toUpperCase(), x + boxW / 2, startY + 14, { align: 'center' })
    })

    return startY + boxH
}

function addSection(doc, title, startY = null) {
    let y = startY !== null ? startY : ((doc.lastAutoTable?.finalY ?? 55) + 10)

    // Prevent orphaned section title at page bottom
    if (y > 255) {
        doc.addPage()
        y = 26
    }

    doc.setFontSize(10.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(30, 58, 138)
    doc.text(title, 14, y)

    doc.setDrawColor(203, 213, 225) // slate-300
    doc.setLineWidth(0.3)
    doc.line(14, y + 2.5, 196, y + 2.5)

    return y + 6.5
}

function finalizePdf(doc, title, user, format, filename) {
    const totalPages = doc.getNumberOfPages()
    const currentUser = user || getCurrentUser()
    const userName = currentUser?.name || 'Authorized Analyst'
    const userRole = currentUser?.role || 'Security Analyst'

    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)

        // Top running header on page > 1
        if (i > 1) {
            doc.setFillColor(248, 250, 252)
            doc.rect(14, 8, 182, 8, 'F')
            doc.setDrawColor(226, 232, 240)
            doc.setLineWidth(0.2)
            doc.line(14, 16, 196, 16)

            doc.setFontSize(7.5)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(30, 58, 138)
            doc.text('ThreatShare Intelligence Platform', 16, 13)

            doc.setFont('helvetica', 'normal')
            doc.setTextColor(100, 116, 139)
            doc.text(`·  ${title}`, 72, 13)

            doc.text(`Printed by: ${userName} (${userRole})`, 194, 13, { align: 'right' })
        }

        // Running footer on ALL pages
        doc.setDrawColor(226, 232, 240)
        doc.setLineWidth(0.2)
        doc.line(14, 285, 196, 285)

        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 116, 139)
        doc.text('ThreatShare Platform · Confidential & Proprietary · TLP:AMBER', 14, 290)

        doc.setFont('helvetica', 'bold')
        doc.setTextColor(51, 65, 85)
        doc.text(`Printed by: ${userName} (${userRole})`, 105, 290, { align: 'center' })

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 116, 139)
        doc.text(`Page ${i} of ${totalPages}`, 196, 290, { align: 'right' })
    }

    if (format === 'print') {
        printPdf(doc)
    } else {
        doc.save(filename)
    }
}

// Default autoTable theme options
const TABLE_OPTS = {
    theme: 'grid',
    styles: {
        fontSize: 7.5,
        cellPadding: 2.2,
        overflow: 'linebreak',
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.15,
        valign: 'middle',
    },
    headStyles: {
        fillColor: [30, 58, 138],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        lineColor: [30, 58, 138],
    },
    alternateRowStyles: {
        fillColor: [248, 250, 252],
    },
    margin: { top: 25, bottom: 22, left: 14, right: 14 },
    didParseCell: (data) => {
        if (data.section === 'body') {
            const val = String(data.cell.raw || '')
            if (val === 'Critical') {
                data.cell.styles.textColor = [192, 39, 45]
                data.cell.styles.fontStyle = 'bold'
            } else if (val === 'High') {
                data.cell.styles.textColor = [181, 97, 14]
                data.cell.styles.fontStyle = 'bold'
            } else if (val === 'Medium') {
                data.cell.styles.textColor = [147, 114, 11]
            } else if (val === 'Low') {
                data.cell.styles.textColor = [63, 122, 78]
            } else if (val === 'Confirmed') {
                data.cell.styles.textColor = [30, 58, 138]
                data.cell.styles.fontStyle = 'bold'
            }
        }
    },
}

// ─────────────────────────────────────────────
// 1. Weekly Threat Briefing
// ─────────────────────────────────────────────

export async function generateWeeklyBriefing(format, user) {
    const currentUser = user || getCurrentUser()
    const [dashboard, activity] = await Promise.all([
        apiRequest('/dashboard'),
        apiRequest('/activity'),
    ])
    const { threats, stats, categories } = dashboard

    if (format === 'csv') {
        const headers = ['Indicator', 'Type', 'Category', 'Severity', 'Confidence', 'Status', 'Source', 'Sightings']
        const rows = threats.map((t) => [t.value, t.type, t.category, t.severity, `${t.confidence}%`, t.status, t.source || '', t.sightings || 1])
        downloadCSV('weekly-threat-briefing.csv', headers, rows, {
            title: 'Weekly Threat Briefing',
            printedBy: `${currentUser.name} (${currentUser.role || 'Analyst'})`,
            generatedAt: NOW_STR(),
        })
        return
    }

    // PDF / Print
    const { doc } = makePdf('Weekly Threat Briefing', `${threats.length} total indicators · ${stats.critical} critical · ${stats.high} high`, currentUser)

    // Stat boxes
    const endBoxY = drawStatBoxes(doc, 57, [
        { label: 'Total', value: stats.total },
        { label: 'Critical', value: stats.critical },
        { label: 'High', value: stats.high },
        { label: 'Pending', value: stats.pending },
    ])

    // Critical indicators
    const startY = addSection(doc, 'Critical Indicators', endBoxY + 7)
    const critical = threats.filter((t) => t.severity === 'Critical')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY,
        columnStyles: {
            0: { cellWidth: 62 },
            1: { cellWidth: 30 },
            2: { cellWidth: 36 },
            3: { cellWidth: 24, halign: 'center' },
            4: { cellWidth: 30, halign: 'center' },
        },
        head: [['Indicator', 'Type', 'Category', 'Confidence', 'Status']],
        body: critical.length
            ? critical.map((t) => [t.value, t.type, t.category, `${t.confidence}%`, t.status])
            : [['No critical indicators recorded', '', '', '', '']],
    })

    // High severity
    const highY = addSection(doc, 'High Severity Indicators')
    const high = threats.filter((t) => t.severity === 'High')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: highY,
        columnStyles: {
            0: { cellWidth: 62 },
            1: { cellWidth: 30 },
            2: { cellWidth: 36 },
            3: { cellWidth: 24, halign: 'center' },
            4: { cellWidth: 30, halign: 'center' },
        },
        head: [['Indicator', 'Type', 'Category', 'Confidence', 'Status']],
        body: high.length
            ? high.map((t) => [t.value, t.type, t.category, `${t.confidence}%`, t.status])
            : [['No high-severity indicators recorded', '', '', '', '']],
    })

    // Category breakdown
    const catY = addSection(doc, 'Category Breakdown')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: catY,
        columnStyles: {
            0: { cellWidth: 130 },
            1: { cellWidth: 52, halign: 'right' },
        },
        head: [['Category', 'Count']],
        body: categories.map((c) => [c.label, c.value]),
    })

    // Recent activity
    const actY = addSection(doc, 'Recent Analyst Activity')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: actY,
        columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 42 },
            2: { cellWidth: 55 },
            3: { cellWidth: 35, halign: 'right' },
        },
        head: [['Action', 'Analyst', 'Target', 'Time']],
        body: activity.slice(0, 15).map((a) => [a.action, a.actor, a.target, a.time]),
    })

    finalizePdf(doc, 'Weekly Threat Briefing', currentUser, format, 'weekly-threat-briefing.pdf')
}

// ─────────────────────────────────────────────
// 2. Exposure Summary
// ─────────────────────────────────────────────

export async function generateExposureSummary(format, user) {
    const currentUser = user || getCurrentUser()
    const { threats, categories } = await apiRequest('/dashboard')
    const highRisk = threats.filter((t) => t.severity === 'Critical' || t.severity === 'High')
    const pending = threats.filter((t) => t.status === 'Pending')
    const underInv = threats.filter((t) => t.status === 'Under Investigation')

    if (format === 'csv') {
        const headers = ['Indicator', 'Type', 'Category', 'Severity', 'Confidence', 'Status', 'Source']
        const rows = highRisk.map((t) => [t.value, t.type, t.category, t.severity, `${t.confidence}%`, t.status, t.source || ''])
        downloadCSV('exposure-summary.csv', headers, rows, {
            title: 'Exposure Summary',
            printedBy: `${currentUser.name} (${currentUser.role || 'Analyst'})`,
            generatedAt: NOW_STR(),
        })
        return
    }

    const { doc } = makePdf('Exposure Summary', `${highRisk.length} high-risk indicators · ${pending.length} pending triage · ${underInv.length} under investigation`, currentUser)

    const endBoxY = drawStatBoxes(doc, 57, [
        { label: 'High Risk', value: highRisk.length },
        { label: 'Under Investigation', value: underInv.length },
        { label: 'Pending Triage', value: pending.length },
    ])

    const hY = addSection(doc, 'Indicators Requiring Immediate Attention', endBoxY + 7)
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: hY,
        columnStyles: {
            0: { cellWidth: 54 },
            1: { cellWidth: 26 },
            2: { cellWidth: 32 },
            3: { cellWidth: 22, halign: 'center' },
            4: { cellWidth: 22, halign: 'center' },
            5: { cellWidth: 26, halign: 'center' },
        },
        head: [['Indicator', 'Type', 'Category', 'Severity', 'Confidence', 'Status']],
        body: highRisk.length
            ? highRisk.map((t) => [t.value, t.type, t.category, t.severity, `${t.confidence}%`, t.status])
            : [['No high-risk indicators requiring attention', '', '', '', '', '']],
    })

    const pY = addSection(doc, 'Pending Triage Queue')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: pY,
        columnStyles: {
            0: { cellWidth: 58 },
            1: { cellWidth: 28 },
            2: { cellWidth: 34 },
            3: { cellWidth: 24, halign: 'center' },
            4: { cellWidth: 38 },
        },
        head: [['Indicator', 'Type', 'Category', 'Severity', 'Source']],
        body: pending.length
            ? pending.map((t) => [t.value, t.type, t.category, t.severity, t.source || '—'])
            : [['No indicators pending triage', '', '', '', '']],
    })

    const cY = addSection(doc, 'Category Risk Distribution')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: cY,
        columnStyles: {
            0: { cellWidth: 130 },
            1: { cellWidth: 52, halign: 'right' },
        },
        head: [['Category', 'Count']],
        body: categories.map((c) => [c.label, c.value]),
    })

    finalizePdf(doc, 'Exposure Summary', currentUser, format, 'exposure-summary.pdf')
}

// ─────────────────────────────────────────────
// 3. Submission Quality
// ─────────────────────────────────────────────

export async function generateSubmissionQuality(format, user) {
    const currentUser = user || getCurrentUser()
    const threats = await apiRequest('/threats')
    const total = threats.length
    const avgConf = total ? Math.round(threats.reduce((s, t) => s + t.confidence, 0) / total) : 0
    const enriched = threats.filter((t) => t.enrichmentStatus === 'malicious' || t.enrichmentStatus === 'clean')

    if (format === 'csv') {
        const headers = ['Indicator', 'Type', 'Confidence', 'Severity', 'Status', 'Source', 'Enrichment', 'Sightings']
        const rows = threats.map((t) => [t.value, t.type, `${t.confidence}%`, t.severity, t.status, t.source || '', t.enrichmentStatus || 'pending', t.sightings || 1])
        downloadCSV('submission-quality.csv', headers, rows, {
            title: 'Submission Quality Report',
            printedBy: `${currentUser.name} (${currentUser.role || 'Analyst'})`,
            generatedAt: NOW_STR(),
        })
        return
    }

    const { doc } = makePdf('Submission Quality Report', `${total} total submissions · avg confidence ${avgConf}% · ${enriched.length} enriched`, currentUser)

    const endBoxY = drawStatBoxes(doc, 57, [
        { label: 'Submissions', value: total },
        { label: 'Avg Confidence', value: `${avgConf}%` },
        { label: 'Confirmed', value: threats.filter((t) => t.status === 'Confirmed').length },
        { label: 'Enriched', value: enriched.length },
    ])

    const distY = addSection(doc, 'Confidence Score Distribution', endBoxY + 7)
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: distY,
        columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 50, halign: 'right' },
            2: { cellWidth: 52, halign: 'right' },
        },
        head: [['Score Range', 'Count', '% of Submissions']],
        body: [
            ['90–100 (Critical Confidence)', threats.filter((t) => t.confidence >= 90).length, `${total ? Math.round((threats.filter((t) => t.confidence >= 90).length / total) * 100) : 0}%`],
            ['75–89 (High Confidence)', threats.filter((t) => t.confidence >= 75 && t.confidence < 90).length, `${total ? Math.round((threats.filter((t) => t.confidence >= 75 && t.confidence < 90).length / total) * 100) : 0}%`],
            ['50–74 (Medium Confidence)', threats.filter((t) => t.confidence >= 50 && t.confidence < 75).length, `${total ? Math.round((threats.filter((t) => t.confidence >= 50 && t.confidence < 75).length / total) * 100) : 0}%`],
            ['0–49 (Low Confidence)', threats.filter((t) => t.confidence < 50).length, `${total ? Math.round((threats.filter((t) => t.confidence < 50).length / total) * 100) : 0}%`],
        ],
    })

    const bySource = {}
    threats.forEach((t) => {
        const src = t.source || 'Unknown'
        bySource[src] = (bySource[src] || 0) + 1
    })
    const srcY = addSection(doc, 'Submissions by Source')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: srcY,
        columnStyles: {
            0: { cellWidth: 80 },
            1: { cellWidth: 50, halign: 'right' },
            2: { cellWidth: 52, halign: 'right' },
        },
        head: [['Source', 'Count', '% of Total']],
        body: Object.entries(bySource)
            .sort((a, b) => b[1] - a[1])
            .map(([src, cnt]) => [src, cnt, `${Math.round((cnt / total) * 100)}%`]),
    })

    const allY = addSection(doc, 'All Submissions')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: allY,
        columnStyles: {
            0: { cellWidth: 54 },
            1: { cellWidth: 26 },
            2: { cellWidth: 22, halign: 'center' },
            3: { cellWidth: 24, halign: 'center' },
            4: { cellWidth: 28, halign: 'center' },
            5: { cellWidth: 28, halign: 'center' },
        },
        head: [['Indicator', 'Type', 'Confidence', 'Severity', 'Status', 'Enrichment']],
        body: threats.map((t) => [t.value, t.type, `${t.confidence}%`, t.severity, t.status, t.enrichmentStatus || 'pending']),
    })

    finalizePdf(doc, 'Submission Quality Report', currentUser, format, 'submission-quality.pdf')
}

// ─────────────────────────────────────────────
// 4. Access Audit
// ─────────────────────────────────────────────

export async function generateAccessAudit(format, user) {
    const currentUser = user || getCurrentUser()
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
            u.name,
            u.email,
            u.role,
            u.active ? 'Active' : 'Inactive',
            u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—',
        ])
        downloadCSV('access-audit.csv', headers, rows, {
            title: 'Access Audit Report',
            printedBy: `${currentUser.name} (${currentUser.role || 'Analyst'})`,
            generatedAt: NOW_STR(),
        })
        return
    }

    const { doc } = makePdf('Access Audit Report', `${users.length} total users · ${permChanges.length} permission changes`, currentUser)

    const endBoxY = drawStatBoxes(doc, 57, [
        { label: 'Total Users', value: users.length },
        { label: 'Active', value: users.filter((u) => u.active).length },
        { label: 'Inactive', value: users.filter((u) => !u.active).length },
        { label: 'Perm Changes', value: permChanges.length },
    ])

    const usersY = addSection(doc, 'Workspace Users', endBoxY + 7)
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: usersY,
        columnStyles: {
            0: { cellWidth: 36 },
            1: { cellWidth: 54 },
            2: { cellWidth: 36 },
            3: { cellWidth: 24, halign: 'center' },
            4: { cellWidth: 32, halign: 'right' },
        },
        head: [['Name', 'Email', 'Role', 'Status', 'Member Since']],
        body: users.map((u) => [
            u.name,
            u.email,
            u.role,
            u.active ? 'Active' : 'Inactive',
            u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—',
        ]),
    })

    const permY = addSection(doc, 'Recent Permission Changes')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: permY,
        columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 42 },
            2: { cellWidth: 55 },
            3: { cellWidth: 35, halign: 'right' },
        },
        head: [['Action', 'Performed By', 'Target', 'Time']],
        body: permChanges.length
            ? permChanges.map((a) => [a.action, a.actor, a.target, a.time])
            : [['No permission changes recorded', '', '', '']],
    })

    const logY = addSection(doc, 'Full Activity Log')
    autoTable(doc, {
        ...TABLE_OPTS,
        startY: logY,
        columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 42 },
            2: { cellWidth: 55 },
            3: { cellWidth: 35, halign: 'right' },
        },
        head: [['Action', 'Actor', 'Target', 'Time']],
        body: activity.map((a) => [a.action, a.actor, a.target, a.time]),
    })

    finalizePdf(doc, 'Access Audit Report', currentUser, format, 'access-audit.pdf')
}

// ─────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────

export async function generateReport(reportName, format = 'pdf', user = null) {
    const currentUser = user || getCurrentUser()
    const name = reportName.toLowerCase()
    if (name.includes('weekly') || name.includes('briefing')) return generateWeeklyBriefing(format, currentUser)
    if (name.includes('exposure')) return generateExposureSummary(format, currentUser)
    if (name.includes('submission') || name.includes('quality')) return generateSubmissionQuality(format, currentUser)
    if (name.includes('access') || name.includes('audit')) return generateAccessAudit(format, currentUser)
    throw new Error(`No generator found for report: ${reportName}`)
}
