import { firebaseAuth } from '../config/firebase';
import { getApiBaseUrl } from '../config/api';

/**
 * @param {RequestInit & { forceIdTokenRefresh?: boolean }} options
 * `forceIdTokenRefresh: true` → `getIdToken(true)` (RBAC/401 sorunlarında taze token).
 * Mutating yöntemlerde ayrıca taze token istenir; option ile kapatılamaz.
 */
export async function apiFetch(path, options = {}) {
  const { forceIdTokenRefresh, ...rest } = options;
  const user = firebaseAuth?.currentUser;
  const method = String(rest.method || 'GET').toUpperCase();
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const useFreshToken = forceIdTokenRefresh === true || isMutating;
  const token = user ? await user.getIdToken(useFreshToken) : null;

  const headers = new Headers(rest.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const base = getApiBaseUrl();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  return fetch(url, { ...rest, headers });
}
