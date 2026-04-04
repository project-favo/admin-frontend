import { apiFetch } from './http';

/**
 * Admin oturumu: Firebase token ile backend’de ROLE_ADMIN doğrulaması.
 * @see AuthController POST /api/auth/login/admin
 */
export async function adminLogin(_idToken, { signal } = {}) {
  return apiFetch('/api/auth/login/admin', { method: 'POST', signal });
}

/**
 * Oturum açmış kullanıcının profilini döner.
 * @see https://github.com/project-favo/backend/blob/main/FRONTEND_API_DOCUMENTATION.md (GET /api/auth/me)
 */
export async function getAuthMe({ signal } = {}) {
  return apiFetch('/api/auth/me', { method: 'GET', signal });
}
