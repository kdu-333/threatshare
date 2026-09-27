/**
 * useTheme.js — Dark/light theme hook
 * Persists preference in localStorage, defaults to 'dark'.
 */
import { useEffect, useState } from 'react'

export function useTheme() {
    const [theme, setTheme] = useState(() => localStorage.getItem('ts_theme') || 'dark')

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('ts_theme', theme)
    }, [theme])

    function toggleTheme() {
        setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
    }

    return { theme, toggleTheme }
}
