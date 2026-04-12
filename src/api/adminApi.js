import { apiFetch } from './http';

/**
 * GET /api/admin/users?page=&size=&activeOnly=&inactiveOnly=
 * - inactiveOnly=true → yalnızca askıya alınmış (isActive=false) kullanıcılar; backend’de AdminService + repository desteği gerekir.
 */
export async function listAdminUsers({
  page = 0,
  size = 20,
  activeOnly = false,
  inactiveOnly = false,
  signal,
} = {}) {
  const qs = new URLSearchParams({
    page: String(page),
    size: String(size),
    activeOnly: String(Boolean(activeOnly)),
    inactiveOnly: String(Boolean(inactiveOnly)),
  });
  return apiFetch(`/api/admin/users?${qs.toString()}`, { method: 'GET', signal });
}

/**
 * Mevcut filtreyle tüm sayfaları sırayla çeker (export vb. için).
 * @param {{ activeOnly?: boolean, inactiveOnly?: boolean, pageSize?: number, signal?: AbortSignal }} opts
 */
export async function fetchAllAdminUsers({
  activeOnly = false,
  inactiveOnly = false,
  pageSize = 200,
  signal,
} = {}) {
  const all = [];
  let page = 0;
  for (;;) {
    const res = await listAdminUsers({
      page,
      size: pageSize,
      activeOnly,
      inactiveOnly,
      signal,
    });
    if (!res.ok) {
      const msg = await messageFromFailedResponse(res);
      throw new Error(msg);
    }
    const dto = await res.json();
    const content = Array.isArray(dto?.content) ? dto.content : [];
    all.push(...content);
    const tp = dto?.totalPages ?? dto?.total_pages ?? dto?.page?.totalPages;
    if (content.length === 0) break;
    if (typeof tp === 'number' && Number.isFinite(tp) && page + 1 >= tp) break;
    if (content.length < pageSize) break;
    page += 1;
  }
  return all;
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
 * Mevcut filtreyle tüm sayfaları sırayla çeker (export vb. için).
 * @param {{ activeOnly?: boolean, pageSize?: number, signal?: AbortSignal }} opts
 */
export async function fetchAllAdminReviews({
  activeOnly = false,
  pageSize = 200,
  signal,
} = {}) {
  const all = [];
  let page = 0;
  for (;;) {
    const res = await listAdminReviews({
      page,
      size: pageSize,
      activeOnly,
      signal,
    });
    if (!res.ok) {
      const msg = await messageFromFailedResponse(res);
      throw new Error(msg);
    }
    const dto = await res.json();
    const content = Array.isArray(dto?.content) ? dto.content : [];
    all.push(...content);
    const tp = dto?.totalPages ?? dto?.total_pages ?? dto?.page?.totalPages;
    if (content.length === 0) break;
    if (typeof tp === 'number' && Number.isFinite(tp) && page + 1 >= tp) break;
    if (content.length < pageSize) break;
    page += 1;
  }
  return all;
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
 * Mevcut filtreyle tüm sayfaları sırayla çeker (export vb. için).
 * @param {{ activeOnly?: boolean, pageSize?: number, signal?: AbortSignal }} opts
 */
export async function fetchAllAdminProducts({
  activeOnly = false,
  pageSize = 200,
  signal,
} = {}) {
  const all = [];
  let page = 0;
  for (;;) {
    const res = await listAdminProducts({
      page,
      size: pageSize,
      activeOnly,
      signal,
    });
    if (!res.ok) {
      const msg = await messageFromFailedResponse(res);
      throw new Error(msg);
    }
    const dto = await res.json();
    const content = Array.isArray(dto?.content) ? dto.content : [];
    all.push(...content);
    const tp = dto?.totalPages ?? dto?.total_pages ?? dto?.page?.totalPages;
    if (content.length === 0) break;
    if (typeof tp === 'number' && Number.isFinite(tp) && page + 1 >= tp) break;
    if (content.length < pageSize) break;
    page += 1;
  }
  return all;
}

/**
 * Admin: GET /api/admin/products/{id} — pasif ürünler dahil detay.
 * @see https://github.com/project-favo/backend/blob/main/src/main/java/com/favo/backend/controller/AdminController.java
 */
export async function getAdminProduct(id, { signal } = {}) {
  return apiFetch(`/api/admin/products/${encodeURIComponent(String(id))}`, {
    method: 'GET',
    signal,
  });
}

/**
 * Admin: PATCH /api/admin/products/{id}/activate — ürünü tekrar yayında gösterir (isActive=true).
 * @see https://github.com/project-favo/backend/blob/main/src/main/java/com/favo/backend/controller/AdminController.java
 */
export async function patchAdminProductActivate(id, { signal } = {}) {
  return apiFetch(`/api/admin/products/${encodeURIComponent(String(id))}/activate`, {
    method: 'PATCH',
    signal,
  });
}

/**
 * Admin: PATCH /api/admin/products/{id}/deactivate — katalogda gizler (soft, isActive=false).
 * @see https://github.com/project-favo/backend/blob/main/src/main/java/com/favo/backend/controller/AdminController.java
 */
export async function patchAdminProductDeactivate(id, { signal } = {}) {
  return apiFetch(`/api/admin/products/${encodeURIComponent(String(id))}/deactivate`, {
    method: 'PATCH',
    signal,
  });
}

/**
 * ✏️ Product güncelle — PUT /api/products/{id}
 *
 * Partial update: yalnızca JSON’da gönderilen alanlar güncellenir (ProductRequestDto).
 * Body (hepsi opsiyonel): { name?, description?, imageURL?, tagId? } — tagId leaf tag olmalı.
 * Response: 200 OK + ProductResponseDto. RBAC: ADMIN.
 *
 * @see ProductController (updateProduct @PutMapping)
 */
export async function putProduct(id, body, { signal } = {}) {
  return apiFetch(`/api/products/${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal,
  });
}

/**
 * Edit formundan ProductRequestDto gövdesi: gönderilen alanlar backend’de güncellenir.
 * @param {{ name: string, description: string, imageURL: string, tagId: string }} fields
 */
export function buildProductUpdateBody(fields) {
  const name = typeof fields.name === 'string' ? fields.name.trim() : '';
  const description =
    typeof fields.description === 'string' ? fields.description.trim() : '';
  const imageURL = typeof fields.imageURL === 'string' ? fields.imageURL.trim() : '';
  const tagStr = typeof fields.tagId === 'string' ? fields.tagId.trim() : '';

  const body = {};
  if (name) body.name = name;
  body.description = description;
  body.imageURL = imageURL;
  const tid = Number(tagStr);
  if (tagStr !== '' && Number.isFinite(tid)) body.tagId = tid;

  return body;
}

/**
 * Başarısız fetch cevabından okunabilir mesaj (Spring JSON veya düz metin).
 */
export async function messageFromFailedResponse(res) {
  const text = await res.text();
  if (!text) return `Request failed (${res.status})`;
  try {
    const j = JSON.parse(text);
    if (typeof j === 'string') return j;
    return (
      j.message ||
      j.error ||
      j.detail ||
      (Array.isArray(j.errors) ? j.errors.map((e) => e?.defaultMessage || e).join('; ') : null) ||
      text
    );
  } catch {
    return text;
  }
}

/**
 * Admin: DELETE /api/products/{id} — soft delete; ilişkili review’lar da pasifleşir.
 */
export async function deleteProduct(id, { signal } = {}) {
  return apiFetch(`/api/products/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
    signal,
  });
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

