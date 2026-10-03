const API_URL = import.meta.env.VITE_API_URL || 'https://threatshare-api.onrender.com/api'

export function getToken() {
    return localStorage.getItem('threatshare_token')
}

export async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
            ...options.headers,
        },
    })
    const body = await response.json().catch(() => ({}))
    if (response.status === 401 && getToken()) {
        localStorage.removeItem('threatshare_token')
        localStorage.removeItem('threatshare_user')
        window.location.assign('/login')
    }
    if (!response.ok) throw new Error(body.message || 'Request failed.')
    return body
}

export function getCurrentUser() {
    const storedUser = localStorage.getItem('threatshare_user')
    return storedUser ? JSON.parse(storedUser) : { name: 'Guest', role: 'Viewer', initials: 'G' }
}