import { useMemo, useState } from 'react'
import Sidebar from '../components/Sidebar.jsx'
import Topbar from '../components/Topbar.jsx'
import { SearchIcon } from '../components/icons.jsx'
import './Users.css'
import { apiRequest, getCurrentUser } from '../api.js'
import { useEffect } from 'react'

const accessOptions = ['Administrator', 'Systems Analyst', 'Security Analyst', 'Viewer']

function Users() {
    const [users, setUsers] = useState([])
    const [search, setSearch] = useState('')
    const [filter, setFilter] = useState('All')
    const [error, setError] = useState('')
    const [showForm, setShowForm] = useState(false)
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'Systems Analyst' })
    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({ name: '', email: '', password: '' })
    const currentUser = getCurrentUser()
    const canManageUsers = currentUser.role === 'Administrator'

    useEffect(() => {
        apiRequest('/users').then(setUsers).catch((requestError) => setError(requestError.message))
    }, [])

    const filteredUsers = useMemo(() => {
        const query = search.trim().toLowerCase()

        return users.filter((user) => {
            const matchesSearch =
                !query ||
                `${user.name} ${user.role}`.toLowerCase().includes(query)

            const matchesFilter = filter === 'All' || user.role === filter

            return matchesSearch && matchesFilter
        })
    }, [filter, search, users])

    function handleAccessChange(userId, nextAccess) {
        apiRequest(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify({ role: nextAccess }) })
            .then((updatedUser) => setUsers((current) => current.map((user) => user._id === userId ? updatedUser : user)))
            .catch((requestError) => setError(requestError.message))
    }

    async function handleAddUser(event) {
        event.preventDefault()
        try {
            const user = await apiRequest('/users', { method: 'POST', body: JSON.stringify(form) })
            setUsers((current) => [user, ...current])
            setForm({ name: '', email: '', password: '', role: 'Systems Analyst' })
            setShowForm(false)
            setError('')
        } catch (requestError) { setError(requestError.message) }
    }

    async function handleToggleAccess(user) {
        try {
            const updatedUser = await apiRequest(`/users/${user._id}`, { method: 'PATCH', body: JSON.stringify({ active: !user.active }) })
            setUsers((current) => current.map((item) => item._id === user._id ? updatedUser : item))
        } catch (requestError) { setError(requestError.message) }
    }

    function beginEdit(user) {
        setEditingId(user._id)
        setEditForm({ name: user.name, email: user.email, password: '' })
        setError('')
    }

    async function handleEditUser(event, userId) {
        event.preventDefault()
        try {
            const updatedUser = await apiRequest(`/users/${userId}`, { method: 'PATCH', body: JSON.stringify(editForm) })
            setUsers((current) => current.map((user) => user._id === userId ? updatedUser : user))
            setEditingId(null)
        } catch (requestError) { setError(requestError.message) }
    }

    async function handleDelete(user) {
        if (!window.confirm(`Delete ${user.name}?`)) return
        try {
            await apiRequest(`/users/${user._id}`, { method: 'DELETE' })
            setUsers((current) => current.filter((item) => item._id !== user._id))
        } catch (requestError) { setError(requestError.message) }
    }

    return (
        <div className="dashboard-shell">
            <Sidebar activeKey="users" />

            <div className="dashboard-main">
                <Topbar title="User Management" user={currentUser} />

                <main className="page-shell users-page">
                    <section className="page-header">
                        <div>
                            <p className="eyebrow">Administration</p>
                            <h2>Team access and permissions</h2>
                        </div>
                        {canManageUsers && <button className="btn btn--primary" type="button" onClick={() => setShowForm((current) => !current)}>
                            {showForm ? 'Cancel' : '+ Add User'}
                        </button>}
                    </section>

                    {showForm && <form className="panel user-create-form" onSubmit={handleAddUser}>
                        <h2>Create user account</h2>
                        <div className="field-grid">
                            <label className="field"><span>Full name</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                            <label className="field"><span>Login email</span><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
                            <label className="field"><span>Initial password</span><input required minLength="8" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
                            <label className="field"><span>Access level</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{accessOptions.map((option) => <option key={option}>{option}</option>)}</select></label>
                        </div>
                        <button className="btn btn--primary" type="submit">Create account</button>
                    </form>}

                    <section className="users-toolbar">
                        <div className="search-box">
                            <span aria-hidden="true"><SearchIcon width={14} height={14} /></span>
                            <input
                                type="text"
                                placeholder="Search users"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                            />
                        </div>

                        <div className="filter-group" aria-label="User access filters">
                            {['All', ...accessOptions].map((option) => (
                                <button
                                    key={option}
                                    type="button"
                                    className={filter === option ? 'filter-chip filter-chip--active' : 'filter-chip'}
                                    onClick={() => setFilter(option)}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    </section>

                    {error && <p className="form-error" role="alert">{error}</p>}
                    <section className="users-grid">
                        {filteredUsers.map((user) => (
                            <article className="user-card" key={user._id}>
                                <div className="user-card__top">
                                    <div className="user-card__avatar" aria-hidden="true">{user.initials}</div>

                                    <div className="user-card__meta">
                                        <h3>{user.name}</h3>
                                        <p>{user.role}</p>
                                    </div>
                                </div>

                                <div className="user-card__body">
                                    {editingId === user._id && <form className="user-edit-form" onSubmit={(event) => handleEditUser(event, user._id)}>
                                        <label className="field"><span>Full name</span><input required value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} /></label>
                                        <label className="field"><span>Login email</span><input required type="email" value={editForm.email} onChange={(event) => setEditForm({ ...editForm, email: event.target.value })} /></label>
                                        <label className="field"><span>New password</span><input minLength="8" type="password" placeholder="Leave blank to keep current" value={editForm.password} onChange={(event) => setEditForm({ ...editForm, password: event.target.value })} /></label>
                                        <div className="user-card__actions"><button className="btn btn--primary btn--small" type="submit">Save account</button><button className="btn btn--secondary btn--small" type="button" onClick={() => setEditingId(null)}>Cancel</button></div>
                                    </form>}
                                    <label className="field">
                                        <span>Access level</span>
                                        <select value={user.role} disabled={!canManageUsers} onChange={(event) => handleAccessChange(user._id, event.target.value)}>
                                            {accessOptions.map((option) => (
                                                <option key={option} value={option}>
                                                    {option}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <div className="user-card__status">
                                        <span className={`status-pill status-pill--${user.active ? user.role.toLowerCase().replace(/\s+/g, '-') : 'inactive'}`}>
                                            {user.active ? user.role : 'Access off'}
                                        </span>
                                        {canManageUsers && <div className="user-card__actions"><button className="btn btn--secondary btn--small" type="button" onClick={() => beginEdit(user)}>Edit account</button><button className="btn btn--secondary btn--small" type="button" onClick={() => handleToggleAccess(user)}>{user.active ? 'Turn off access' : 'Enable access'}</button><button className="btn btn--danger btn--small" type="button" onClick={() => handleDelete(user)}>Delete</button></div>}
                                    </div>
                                </div>
                            </article>
                        ))}
                    </section>
                </main>
            </div>
        </div>
    )
}

export default Users
