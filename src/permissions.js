/**
 * permissions.js
 * Centralized Role-Based Access Control (RBAC) definitions
 * strictly based on the ThreatShare Use Case Diagram.
 * 
 * Roles:
 * - Admin (Administrator)
 * - Security Analyst (Systems Analyst / Security Analyst)
 * - Viewer
 */

export const ROLES = {
  ADMIN: 'Administrator',
  ANALYST: 'Systems Analyst',
  SECURITY_ANALYST: 'Security Analyst',
  VIEWER: 'Viewer',
}

export function isAdmin(role) {
  return role === ROLES.ADMIN
}

export function isAnalyst(role) {
  return role === ROLES.ANALYST || role === ROLES.SECURITY_ANALYST || role === ROLES.ADMIN
}

export function isViewer(role) {
  return role === ROLES.VIEWER
}

/**
 * Route / Module permissions strictly matching the diagram:
 * - Viewer: View Dashboard, Search Threats, View Approved Intelligence (Threat Intel)
 * - Analyst: All Viewer capabilities + Submit IoCs, Validate IoCs, Investigate Threats (Alerts), Update Status
 * - Admin: All Analyst & Viewer capabilities + Manage Reports, Manage Roles, View Logs, Manage Users, Settings
 */
export const MODULE_PERMISSIONS = {
  dashboard: ['Administrator', 'Systems Analyst', 'Security Analyst', 'Viewer'],
  'threat-intel': ['Administrator', 'Systems Analyst', 'Security Analyst', 'Viewer'],
  search: ['Administrator', 'Systems Analyst', 'Security Analyst', 'Viewer'],
  'submit-ioc': ['Administrator', 'Systems Analyst', 'Security Analyst'],
  alerts: ['Administrator', 'Systems Analyst', 'Security Analyst'],
  reports: ['Administrator'],
  activity: ['Administrator'],
  users: ['Administrator'],
  settings: ['Administrator'],
}

export function canAccessModule(role, moduleKey) {
  const allowed = MODULE_PERMISSIONS[moduleKey]
  return allowed ? allowed.includes(role) : false
}
