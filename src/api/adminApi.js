import { apiFetch } from './http';

function pickFiniteNumber(...candidates) {
  for (const v of candidates) {
    if (v == null) continue;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * AdminPageDto / Spring Page JSON — content ve sayfa meta bilgisini güvenle okur.
 * @see com.favo.backend.Domain.admin.AdminPageDto
 * @returns {{ content: unknown[], totalElements: number | null, totalPages: number | null, number: number | null, size: number | null }}
 */
export function normalizeAdminPageDto(dto) {
  if (dto == null || typeof dto !== 'object') {
    return { content: [], totalElements: null, totalPages: null, number: null, size: null };
  }
  if (Array.isArray(dto)) {
    const n = dto.length;
    return {
      content: dto,
      totalElements: n,
      totalPages: n > 0 ? 1 : 0,
      number: 0,
      size: n,
    };
  }
  const nested = dto.page && typeof dto.page === 'object' ? dto.page : {};
  let content = [];
  if (Array.isArray(dto.content)) content = dto.content;
  else if (Array.isArray(dto.items)) content = dto.items;
  else if (Array.isArray(nested.content)) content = nested.content;

  const totalElements = pickFiniteNumber(
    dto.totalElements,
    dto.total_elements,
    nested.totalElements,
    nested.total_elements,
    dto.total
  );
  const totalPages = pickFiniteNumber(
    dto.totalPages,
    dto.total_pages,
    nested.totalPages,
    nested.total_pages
  );
  const number = pickFiniteNumber(dto.number, nested.number, 0);
  const size = pickFiniteNumber(dto.size, nested.size, content.length > 0 ? content.length : null);

  return {
    content,
    totalElements,
    totalPages,
    number,
    size,
  };
}

/**
 * Sunucu cevabındaki `size` istenenden küçükse (max page size) sayfa adedini
 * `content.length < requestSize` ile tespit etmek tüm listeyi kaçırır; önce
 * totalElements / totalPages kullan.
 * @param {ReturnType<typeof normalizeAdminPageDto>} n
 * @param {number} loopPage
 * @param {number} requestSize
 * @param {number} totalCountAfterPush
 * @returns {boolean}
 */
function shouldEndAdminListFetch(n, loopPage, requestSize, totalCountAfterPush) {
  const { content, totalElements, totalPages, number: nFromDto } = n;
  if (content.length === 0) return true;
  const current = typeof nFromDto === 'number' && Number.isFinite(nFromDto) ? nFromDto : loopPage;
  if (
    typeof totalElements === 'number' &&
    Number.isFinite(totalElements) &&
    totalCountAfterPush >= totalElements
  ) {
    return true;
  }
  if (typeof totalPages === 'number' && Number.isFinite(totalPages) && totalPages > 0) {
    if (current + 1 >= totalPages) return true;
  }
  if (typeof totalElements === 'number' && Number.isFinite(totalElements) && totalCountAfterPush < totalElements) {
    return false;
  }
  if (typeof totalPages === 'number' && Number.isFinite(totalPages) && totalPages > 0) {
    return false;
  }
  return content.length < requestSize;
}

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
    const normalized = normalizeAdminPageDto(dto);
    const content = normalized.content;
    if (content.length === 0) break;
    all.push(...content);
    if (shouldEndAdminListFetch(normalized, page, pageSize, all.length)) break;
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

/**
 * Admin: GET /api/admin/users/{id} — UserResponseDto (tüm alanlar).
 * @see https://github.com/project-favo/backend/blob/main/src/main/java/com/favo/backend/controller/AdminController.java
 */
export async function getAdminUser(id, { signal } = {}) {
  return apiFetch(`/api/admin/users/${encodeURIComponent(String(id))}`, {
    method: 'GET',
    signal,
  });
}

/**
 * Admin: GET /api/admin/users/{id}/wishlist — kullanıcının beğenilen ürünleri (paged).
 */
export async function getAdminUserWishlist(
  id,
  { page = 0, size = 20, signal } = {}
) {
  const qs = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  return apiFetch(
    `/api/admin/users/${encodeURIComponent(String(id))}/wishlist?${qs.toString()}`,
    { method: 'GET', signal }
  );
}

/**
 * Admin: GET /api/admin/users/{id}/flagged-products — kullanıcının raporladığı / işaretlediği ürünler (paged).
 */
export async function getAdminUserFlaggedProducts(
  id,
  { page = 0, size = 20, activeOnly = true, signal } = {}
) {
  const qs = new URLSearchParams({
    page: String(page),
    size: String(size),
    activeOnly: String(Boolean(activeOnly)),
  });
  return apiFetch(
    `/api/admin/users/${encodeURIComponent(String(id))}/flagged-products?${qs.toString()}`,
    { method: 'GET', signal }
  );
}

/**
 * GET /api/reviews/me — giriş yapan kullanıcının kendi yorumları (en yeni önce).
 * @see com.favo.backend.controller.ReviewController#getMyReviews
 */
export async function getMyReviews({ signal } = {}) {
  return apiFetch('/api/reviews/me', {
    method: 'GET',
    signal,
    forceIdTokenRefresh: true,
  });
}

/**
 * GET /api/reviews/user/{userId} — belirli kullanıcının (aktif) yorumları.
 * @see com.favo.backend.controller.ReviewController#getReviewsByUser
 */
export async function listReviewsByUserId(userId, { signal } = {}) {
  return apiFetch(`/api/reviews/user/${encodeURIComponent(String(userId))}`, {
    method: 'GET',
    signal,
    forceIdTokenRefresh: true,
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
    const normalized = normalizeAdminPageDto(dto);
    const content = normalized.content;
    if (content.length === 0) break;
    all.push(...content);
    if (shouldEndAdminListFetch(normalized, page, pageSize, all.length)) break;
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
 * Kategori ağacı — root tag’ler (parent yok).
 * GET /api/tags/roots — Bearer gerekir (backend).
 */
export async function fetchTagRoots({ signal, forceIdTokenRefresh } = {}) {
  return apiFetch('/api/tags/roots', {
    method: 'GET',
    signal,
    forceIdTokenRefresh: forceIdTokenRefresh === true,
  });
}

/**
 * Bir tag’in alt öğeleri veya leaf ise ürün listesi.
 * GET /api/tags/{id}/children
 */
export async function fetchTagChildren(id, { signal, forceIdTokenRefresh } = {}) {
  return apiFetch(`/api/tags/${encodeURIComponent(String(id))}/children`, {
    method: 'GET',
    signal,
    forceIdTokenRefresh: forceIdTokenRefresh === true,
  });
}

/**
 * Tag arama (public; name boşsa tüm tag’ler — dikkatli kullan).
 * GET /api/tags/search?name=
 */
export async function searchTags(name, { signal } = {}) {
  const qs = new URLSearchParams();
  if (name != null && String(name).trim() !== '') {
    qs.set('name', String(name).trim());
  }
  return apiFetch(`/api/tags/search?${qs.toString()}`, { method: 'GET', signal });
}

/**
 * Yeni tag — POST /api/tags — Bearer gerekir.
 * Body: { name: string, parentId: number | null }
 */
export async function createTag(body, { signal, forceIdTokenRefresh } = {}) {
  return apiFetch('/api/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal,
    forceIdTokenRefresh: forceIdTokenRefresh === true,
  });
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
    const normalized = normalizeAdminPageDto(dto);
    const content = normalized.content;
    if (content.length === 0) break;
    all.push(...content);
    if (shouldEndAdminListFetch(normalized, page, pageSize, all.length)) break;
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
 * Yeni product — POST /api/products
 * Body: { name, description, imageURL, tagId } — tagId yalnızca leaf tag olmalı.
 * @see https://github.com/project-favo/backend/blob/main/FRONTEND_API_DOCUMENTATION.md
 */
export async function postProduct(body, { signal } = {}) {
  return apiFetch('/api/products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
    signal,
  });
}

/**
 * Create formundan gövde: POST /api/products için tam alan seti.
 * @param {{ name: string, description: string, imageURL: string, tagId: string | number }} fields
 */
export function buildProductCreateBody(fields) {
  const name = typeof fields.name === 'string' ? fields.name.trim() : '';
  const description =
    typeof fields.description === 'string' ? fields.description.trim() : '';
  const imageURL = typeof fields.imageURL === 'string' ? fields.imageURL.trim() : '';
  let tid = NaN;
  if (typeof fields.tagId === 'number' && Number.isFinite(fields.tagId)) {
    tid = fields.tagId;
  } else if (typeof fields.tagId === 'string') {
    tid = Number(fields.tagId.trim());
  }
  return {
    name,
    description,
    imageURL,
    tagId: Number.isFinite(tid) ? tid : NaN,
  };
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
 * @param {string} s
 * @returns {string}
 */
function tagNameKey(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase();
}

/**
 * @param {unknown[]} list
 * @param {string} name
 * @returns {{ id: unknown, name?: string, categoryPath?: string } | null}
 */
function findTagInListByName(list, name) {
  const want = tagNameKey(name);
  if (!want) return null;
  for (const t of list) {
    if (t && typeof t === 'object' && t.id != null && tagNameKey(t.name) === want) {
      return /** @type {{ id: unknown, name?: string, categoryPath?: string }} */ (t);
    }
  }
  return null;
}

/**
 * Aynı üst kategori altındaki alt seviyeler; leaf ise boş dizi.
 * @param {string | number} parentId
 * @param {AbortSignal | undefined} signal
 * @param {boolean} [fresh]
 */
async function listChildTagsForParent(parentId, signal, fresh) {
  const res = await fetchTagChildren(parentId, {
    signal,
    forceIdTokenRefresh: fresh === true,
  });
  if (!res.ok) {
    const msg = await messageFromFailedResponse(res);
    throw new Error(msg || `Could not load subcategories (${res.status})`);
  }
  const data = await res.json();
  if (data.isLeaf === true) {
    return /** @type {unknown[]} */ ([]);
  }
  return Array.isArray(data.children) ? data.children : [];
}

/**
 * Mevcut hiyerarşide aynı isim varsa (büyük/küçük harf duyarsız) o düğümün id’sini verir, yoksa yeni tag oluşturur.
 * @param {{ parentId: null | string | number, name: string, labelForCreate: string, signal?: AbortSignal, fresh?: boolean }} p
 * @returns {Promise<number | string>}
 */
async function findOrCreateChildTagName({
  parentId,
  name,
  labelForCreate,
  signal,
  fresh = true,
} = /** @type {any} */ ({})) {
  const useFresh = fresh === true;
  const n = String(name).trim();
  if (!n) {
    throw new Error('Each category segment (main, 1st sub, 2nd sub) must be non-empty.');
  }
  const toCreate = String(labelForCreate ?? n).trim();
  if (!toCreate) {
    throw new Error('Each category segment (main, 1st sub, 2nd sub) must be non-empty.');
  }

  if (parentId == null) {
    const res = await fetchTagRoots({ signal, forceIdTokenRefresh: useFresh });
    if (!res.ok) {
      const msg = await messageFromFailedResponse(res);
      throw new Error(msg || `Could not load root categories (${res.status})`);
    }
    const roots = await res.json();
    const list = Array.isArray(roots) ? roots : [];
    const hit = findTagInListByName(list, n);
    if (hit && hit.id != null) {
      return hit.id;
    }
  } else {
    const list = await listChildTagsForParent(parentId, signal, useFresh);
    const hit = findTagInListByName(list, n);
    if (hit && hit.id != null) {
      return hit.id;
    }
  }

  const res = await createTag(
    { name: toCreate, parentId: parentId == null ? null : parentId },
    { signal, forceIdTokenRefresh: useFresh }
  );
  if (!res.ok) {
    const msg = await messageFromFailedResponse(res);
    throw new Error(
      msg ||
        `Could not create category “${toCreate}”${
          parentId == null ? ' (root)' : ''
        } (${res.status})`
    );
  }
  const data = await res.json();
  const newId = data?.id;
  if (newId == null) {
    throw new Error('Create category: missing id in response.');
  }
  return newId;
}

/**
 * 3 seviyelik yol (ana + 2 alt) — zaten var olan halkaları (ör. fashion, men) yeniden oluşturmaz;
 * sadece eksik segmentleri kapatır. Böylece fashion.men.shoes sonrası fashion.men.tshirt aynı kök+arda kullanılabilir.
 * @param {{ main: string, sub1: string, sub2: string, signal?: AbortSignal }} p
 * @returns {Promise<{ id: number, name: string, categoryPath: string }>}
 */
export async function createThreeLevelTagPath(
  { main, sub1, sub2, signal } = /** @type {any} */ ({})
) {
  const root = String(main ?? '').trim();
  const a = String(sub1 ?? '').trim();
  const b = String(sub2 ?? '').trim();
  if (!root || !a || !b) {
    throw new Error('Main, 1st subcategory, and 2nd subcategory are all required.');
  }
  const FRESH = true;
  const idRoot = await findOrCreateChildTagName({
    parentId: null,
    name: root,
    labelForCreate: root,
    signal,
    fresh: FRESH,
  });
  const id1 = await findOrCreateChildTagName({
    parentId: idRoot,
    name: a,
    labelForCreate: a,
    signal,
    fresh: FRESH,
  });
  const id2 = await findOrCreateChildTagName({
    parentId: id1,
    name: b,
    labelForCreate: b,
    signal,
    fresh: FRESH,
  });

  const check = await fetchTagChildren(id2, { signal, forceIdTokenRefresh: FRESH });
  if (!check.ok) {
    const msg = await messageFromFailedResponse(check);
    throw new Error(
      msg || 'Categories were set up but could not load the new leaf tag.'
    );
  }
  const node = await check.json();
  const hasChildren = Array.isArray(node?.children) && node.children.length > 0;
  const isLeaf =
    node.isLeaf === true ||
    node.isLeaf === 'true' ||
    (node.isLeaf == null && !hasChildren);
  if (!isLeaf) {
    throw new Error(
      'The path is ready, but the last level is not a leaf; pick it from the category list.'
    );
  }
  const leafId = node.id != null ? node.id : id2;
  const categoryPath =
    node.categoryPath != null
      ? String(node.categoryPath)
      : [root, a, b].join('.');
  return {
    id: Number(leafId),
    name: node.name != null ? String(node.name) : b,
    categoryPath,
  };
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

