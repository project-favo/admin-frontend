import { apiFetch } from './http';

export async function listAdminUsers({
  page = 0,
  size = 20,
  activeOnly = false,
  signal,
} = {}) {
  const qs = new URLSearchParams({
    page: String(page),
    size: String(size),
    activeOnly: String(Boolean(activeOnly)),
  });
  return apiFetch(`/api/admin/users?${qs.toString()}`, { method: 'GET', signal });
}

export async function listAdminReviews({
  page = 0,
  size = 20,
  activeOnly = false,
  signal,
} = {}) {
  const qs = new URLSearchParams({
    page: String(page),
    size: String(size),
    activeOnly: String(Boolean(activeOnly)),
  });
  return apiFetch(`/api/admin/reviews?${qs.toString()}`, { method: 'GET', signal });
}

/**
 * Tüm aktif ürünleri listeler (backend: GET /api/products — sayfalama yok, dizi döner).
 * @see https://github.com/project-favo/backend/blob/main/FRONTEND_API_DOCUMENTATION.md
 */
export async function listProducts({ signal } = {}) {
  return apiFetch('/api/products', { method: 'GET', signal });
}

