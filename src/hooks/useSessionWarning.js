/**
 * useSessionWarning.js
 * Reads the JWT exp from localStorage, returns secondsLeft.
 * < 0  → expired
 * < 300 → show warning banner
 */
import { useEffect, useState } from 'react'
import { getToken } from '../api.js'

function getExpiry() {
    const token = getToken()
    if (!token) return null
    try {
        const payload = JSON.parse(atob(token.split('.')[1]))
        return payload.exp ? payload.exp * 1000 : null
    } catch {
        return null
    }
}

export function useSessionWarning() {
    const [secondsLeft, setSecondsLeft] = useState(() => {
        const exp = getExpiry()
        return exp ? Math.floor((exp - Date.now()) / 1000) : null
    })

    useEffect(() => {
        const id = setInterval(() => {
            const exp = getExpiry()
            if (!exp) { setSecondsLeft(null); return }
            setSecondsLeft(Math.floor((exp - Date.now()) / 1000))
        }, 10_000) // check every 10 s

        return () => clearInterval(id)
    }, [])

    // Only warn in the last 5 minutes (300 s)
    const showWarning = secondsLeft !== null && secondsLeft > 0 && secondsLeft <= 300

    return { secondsLeft, showWarning }
}
