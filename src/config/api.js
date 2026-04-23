/** Empty in dev → same-origin `/api` (Vite proxy). Else full API origin, no trailing slash. */
export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
}

/**
 * @param {string | null | undefined} href
 * @returns {string | null}
 */
export function resolveResourceUrl(href) {
  if (href == null || String(href).trim() === '') return null;
  const s = String(href).trim();
  if (/^https?:\/\//i.test(s)) return s;
  const base = getApiBaseUrl();
  if (s.startsWith('/')) {
    return base ? `${base}${s}` : s;
  }
  return s;
}

/**
 * @see com.favo.backend.controller.UserProfileImageController — binary GET, no JSON.
 * @param {string | number} userId
 */
export function buildUserProfileImageUrl(userId) {
  const base = getApiBaseUrl();
  const path = `/api/users/${encodeURIComponent(String(userId))}/profile-image`;
  if (base) return `${base}${path}`;
  return path;
}
