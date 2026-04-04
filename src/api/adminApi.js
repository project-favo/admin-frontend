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

/**
 * Admin: review’ı arayüzden kaldırır (soft delete).
 * @see https://github.com/project-favo/backend/blob/main/src/main/java/com/favo/backend/controller/AdminController.java
 */
export async function patchAdminReviewDeactivate(id, { signal } = {}) {
  return apiFetch(`/api/admin/reviews/${encodeURIComponent(String(id))}/deactivate`, {
    method: 'PATCH',
    signal,
  });
}

/**
 * Admin: pasif review’ı tekrar yayına alır.
 */
export async function patchAdminReviewActivate(id, { signal } = {}) {
  return apiFetch(`/api/admin/reviews/${encodeURIComponent(String(id))}/activate`, {
    method: 'PATCH',
    signal,
  });
}

