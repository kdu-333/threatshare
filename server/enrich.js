/**
 * enrich.js — IoC Auto-Enrichment Engine
 *
 * Queries VirusTotal v3, abuse.ch MalwareBazaar, and URLhaus depending on the
 * IoC type, then patches the Threat document with the results.
 *
 * This module is designed to be called fire-and-forget. It never throws.
 */

import { Threat, Alert, Activity } from './models.js'

const VT_KEY = process.env.VIRUSTOTAL_API_KEY || ''
const VT_BASE = 'https://www.virustotal.com/api/v3'
const MB_BASE = 'https://mb-api.abuse.ch/api/v1/'
const UH_BASE = 'https://urlhaus-api.abuse.ch/v1/'

// How long to wait for any external HTTP call before giving up (ms)
const TIMEOUT_MS = 10_000

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

async function fetchWithTimeout(url, options = {}, timeoutMs = TIMEOUT_MS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
        return await fetch(url, { ...options, signal: controller.signal })
    } finally {
        clearTimeout(timer)
    }
}

function detectType(ioc) {
    const v = ioc.trim().toLowerCase()
    if (/^[a-f0-9]{32}$/i.test(v)) return 'md5'
    if (/^[a-f0-9]{64}$/i.test(v)) return 'sha256'
    if (/^[a-f0-9]{40}$/i.test(v)) return 'sha1'
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(v)) return 'ip'
    if (/^https?:\/\//i.test(v)) return 'url'
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return 'email'
    if (/^[a-z0-9-]+(\.[a-z]{2,})+$/i.test(v)) return 'domain'
    return 'unknown'
}

// ------------------------------------------------------------------
// VirusTotal queries
// ------------------------------------------------------------------

async function vtGet(endpoint) {
    if (!VT_KEY) return null
    try {
        const res = await fetchWithTimeout(`${VT_BASE}${endpoint}`, {
            headers: { 'x-apikey': VT_KEY },
        })
        if (!res.ok) return null
        return res.json()
    } catch {
        return null
    }
}

async function queryVirusTotal(value, iocType) {
    let data = null
    if (iocType === 'ip') {
        data = await vtGet(`/ip_addresses/${encodeURIComponent(value)}`)
    } else if (iocType === 'domain') {
        data = await vtGet(`/domains/${encodeURIComponent(value)}`)
    } else if (iocType === 'url') {
        // VT encodes URLs as base64url (no padding)
        const id = Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
        data = await vtGet(`/urls/${id}`)
    } else if (iocType === 'md5' || iocType === 'sha256' || iocType === 'sha1') {
        data = await vtGet(`/files/${value}`)
    }

    if (!data?.data?.attributes) return null

    const stats = data.data.attributes.last_analysis_stats || {}
    const malicious = (stats.malicious || 0) + (stats.suspicious || 0)
    const total = Object.values(stats).reduce((s, n) => s + n, 0)
    if (total === 0) return null

    const ratio = malicious / total
    return {
        source: 'VirusTotal',
        malicious: malicious > 0,
        detections: malicious,
        total,
        // Map detection ratio → confidence contribution (0-100)
        confidence: Math.round(ratio * 100),
        // Reputation score — negative is bad on VT
        reputation: data.data.attributes.reputation ?? 0,
    }
}

// ------------------------------------------------------------------
// MalwareBazaar (file hashes only)
// ------------------------------------------------------------------

async function queryMalwareBazaar(hash) {
    try {
        const res = await fetchWithTimeout(MB_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `query=get_info&hash=${encodeURIComponent(hash)}`,
        })
        if (!res.ok) return null
        const json = await res.json()
        if (json.query_status !== 'hash_found') return null
        const sample = json.data?.[0]
        return {
            source: 'MalwareBazaar',
            malicious: true,
            malwareName: sample?.signature || null,
            tags: sample?.tags || [],
            confidence: 95,
        }
    } catch {
        return null
    }
}

// ------------------------------------------------------------------
// URLhaus (URLs, domains, IPs)
// ------------------------------------------------------------------

async function queryUrlhaus(value, iocType) {
    try {
        let body
        if (iocType === 'url') body = `query=lookup_url&url=${encodeURIComponent(value)}`
        else if (iocType === 'domain') body = `query=lookup_host&host=${encodeURIComponent(value)}`
        else if (iocType === 'ip') body = `query=lookup_host&host=${encodeURIComponent(value)}`
        else return null

        const res = await fetchWithTimeout(UH_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body,
        })
        if (!res.ok) return null
        const json = await res.json()
        const isHit = json.query_status === 'is_host' || json.query_status === 'is_url'
        if (!isHit) return null

        const urlsCount = json.urls?.length || json.url_count || 1
        return {
            source: 'URLhaus',
            malicious: true,
            urlCount: urlsCount,
            confidence: Math.min(90, 50 + urlsCount * 5),
        }
    } catch {
        return null
    }
}

// ------------------------------------------------------------------
// Main enrichment function — exported
// ------------------------------------------------------------------

/**
 * Enrich a newly-created Threat document in the background.
 * @param {object} threat  The saved Mongoose Threat document
 */
export async function enrichIoc(threat) {
    const iocType = detectType(threat.value)

    // Email and unknown types have no suitable keyless feed
    if (iocType === 'email' || iocType === 'unknown') {
        await Threat.findByIdAndUpdate(threat._id, { enrichmentStatus: 'skipped', enrichedAt: new Date() })
        return
    }

    try {
        // Fire all applicable queries in parallel
        const promises = [queryVirusTotal(threat.value, iocType)]
        if (['md5', 'sha256', 'sha1'].includes(iocType)) promises.push(queryMalwareBazaar(threat.value))
        if (['url', 'domain', 'ip'].includes(iocType)) promises.push(queryUrlhaus(threat.value, iocType))

        const results = (await Promise.all(promises)).filter(Boolean)

        if (results.length === 0) {
            await Threat.findByIdAndUpdate(threat._id, {
                enrichmentStatus: 'clean',
                enrichedBy: [],
                enrichedAt: new Date(),
            })
            return
        }

        const knownMalicious = results.some((r) => r.malicious)
        const maxConfidence = Math.max(...results.map((r) => r.confidence || 0))
        const enrichedBy = [...new Set(results.map((r) => r.source))]

        // Derive new severity from enriched confidence
        const newConfidence = Math.max(threat.confidence, maxConfidence)
        const newSeverity =
            newConfidence >= 90 ? 'Critical'
            : newConfidence >= 75 ? 'High'
            : newConfidence >= 50 ? 'Medium'
            : 'Low'

        const update = {
            enrichmentStatus: knownMalicious ? 'malicious' : 'clean',
            enrichedBy,
            enrichedAt: new Date(),
            confidence: newConfidence,
            severity: newSeverity,
        }
        if (knownMalicious) update.status = 'Under Investigation'

        await Threat.findByIdAndUpdate(threat._id, update)

        // Fire an alert if this IoC is confirmed across at least one feed
        if (knownMalicious) {
            const sourceList = enrichedBy.join(' + ')
            const vtResult = results.find((r) => r.source === 'VirusTotal')
            const detail = vtResult
                ? `${threat.value} matched ${vtResult.detections}/${vtResult.total} VirusTotal engines and was confirmed by: ${sourceList}.`
                : `${threat.value} was confirmed malicious by: ${sourceList}.`

            await Alert.create({
                message: 'Auto-enrichment: Known malicious IoC confirmed',
                detail,
                severity: newSeverity,
                threatId: threat._id,
            })

            await Activity.create({
                action: 'Auto-enrichment flagged indicator',
                actor: 'System',
                target: threat.value,
                time: 'Just now',
                userId: null,
            })
        }
    } catch (err) {
        console.error('[enrich] Unexpected error for', threat.value, err.message)
        await Threat.findByIdAndUpdate(threat._id, { enrichmentStatus: 'error', enrichedAt: new Date() }).catch(() => {})
    }
}
