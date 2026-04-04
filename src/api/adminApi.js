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

/**
 * Admin: PATCH /api/admin/users/{id}/activate
 * @see https://github.com/project-favo/backend/blob/main/src/main/java/com/favo/backend/controller/AdminController.java
 */
export async function patchAdminUserActivate(id, { signal } = {}) {
  return apiFetch(`/api/admin/users/${encodeURIComponent(String(id))}/activate`, {
    method: 'PATCH',
    signal,
  });
}

/**
 * Admin: PATCH /api/admin/users/{id}/deactivate (Suspend)
 */
export async function patchAdminUserDeactivate(id, { signal } = {}) {
  return apiFetch(`/api/admin/users/${encodeURIComponent(String(id))}/deactivate`, {
    method: 'PATCH',
    signal,
  });
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
 * Genel katalog: GET /api/products — yalnızca aktif ürünler, sayfalama yok, dizi döner.
 * @see https://github.com/project-favo/backend/blob/main/FRONTEND_API_DOCUMENTATION.md
 */
export async function listProducts({ signal } = {}) {
  return apiFetch('/api/products', { method: 'GET', signal });
}

/**
 * Admin: GET /api/admin/products?page=&size=&activeOnly=
 * activeOnly=false (varsayılan) tüm ürünleri döndürür; true ise yalnızca aktifler.
 */
export async function listAdminProducts({
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
  return apiFetch(`/api/admin/products?${qs.toString()}`, { method: 'GET', signal });
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

