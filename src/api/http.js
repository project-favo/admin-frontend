import { firebaseAuth } from '../config/firebase';
import { getApiBaseUrl } from '../config/api';

export async function apiFetch(path, options = {}) {
  const auth = firebaseAuth;
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const headers = new Headers(options.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Accept')) headers.set('Accept', 'application/json');

  const base = getApiBaseUrl();
  const url = path.startsWith('http') ? path : `${base}${path.startsWith('/') ? '' : '/'}${path}`;
  return fetch(url, { ...options, headers });
}
