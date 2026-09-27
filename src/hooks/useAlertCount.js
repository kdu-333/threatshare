/**
 * useAlertCount.js — polls /api/alerts every 30 s, returns open alert count.
 */
import { useEffect, useState } from 'react'
import { apiRequest, getToken, getCurrentUser } from '../api.js'
import { canAccessModule } from '../permissions.js'

export function useAlertCount() {
    const [count, setCount] = useState(0)

    useEffect(() => {
        if (!getToken()) return
        const user = getCurrentUser()
        if (!canAccessModule(user?.role, 'alerts')) return

        async function fetchCount() {
            try {
                const alerts = await apiRequest('/alerts')
                setCount(Array.isArray(alerts) ? alerts.length : 0)
            } catch {
                // silently fail — don't break the UI if the server is down
            }
        }

        fetchCount()
        const id = setInterval(fetchCount, 30_000)
        return () => clearInterval(id)
    }, [])

    return count
}
