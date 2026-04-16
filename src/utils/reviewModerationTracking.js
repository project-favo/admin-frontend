/** @type {string} */
const K_AUTO = 'favo.admin.autoRejectedReviewIds.v1';
/** @type {string} */
const K_BROWSER = 'favo.admin.browserHiddenReviewIds.v1';

const MAX_IDS = 5000;

function parseIdSet(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    const a = JSON.parse(raw);
    return new Set(Array.isArray(a) ? a.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveIdSet(key, set) {
  const arr = [...set].slice(-MAX_IDS);
  localStorage.setItem(key, JSON.stringify(arr));
}

export function loadAutoRejectedIdSet() {
  return parseIdSet(K_AUTO);
}

export function loadBrowserHiddenIdSet() {
  return parseIdSet(K_BROWSER);
}

export function addAutoRejectedReviewIds(ids) {
  if (!ids?.length) return;
  const s = loadAutoRejectedIdSet();
  for (const id of ids) s.add(String(id));
  saveIdSet(K_AUTO, s);
}

export function addBrowserHiddenReviewIds(ids) {
  if (!ids?.length) return;
  const s = loadBrowserHiddenIdSet();
  for (const id of ids) s.add(String(id));
  saveIdSet(K_BROWSER, s);
}

/** Restore (approve) sonrası veya API’de tekrar aktif görüldüğünde takipten çıkarır. */
export function removeTrackedModerationId(id) {
  const sid = String(id);
  const a = loadAutoRejectedIdSet();
  const b = loadBrowserHiddenIdSet();
  a.delete(sid);
  b.delete(sid);
  saveIdSet(K_AUTO, a);
  saveIdSet(K_BROWSER, b);
}

function boolishFalse(v) {
  return v === false || v === 'false' || v === 0;
}

function boolishTrue(v) {
  return v === true || v === 'true' || v === 1;
}

/**
 * Yorumun katalogda gizli olup olmadığını API alanlarından çıkarır.
 *
 * Backend notu: Soft delete / admin deactivate genelde `Review.isActive=false` yapar; bazı
 * yanıtlarda yalnızca `moderationStatus: "APPROVED"` kalabilir (DTO `isActive` göndermiyorsa ve
 * deactivate `REJECTED` set etmiyorsa). O durumda bu fonksiyon null döner — doğru sonuç için
 * backend’in admin review JSON’una `isActive` eklemesi ve/veya gizlemede `moderationStatus` güncellemesi gerekir.
 *
 * @returns {boolean|null} true = gizli, false = yayında, null = yanıt tek başına yeterli değil
 */
export function inferReviewCatalogHidden(review) {
  if (!review || typeof review !== 'object') return null;

  const ms = String(review.moderationStatus ?? review.moderation_status ?? '').trim().toUpperCase();
  if (ms === 'REJECTED') return true;

  const activeCandidate =
    review.active ??
    review.isActive ??
    review.is_active ??
    review.catalogActive ??
    review.catalog_active;

  const visibleCandidate = review.visible ?? review.isVisible ?? review.is_visible;
  const deletedCandidate = review.deleted ?? review.isDeleted ?? review.is_deleted;

  if (boolishFalse(activeCandidate)) return true;
  if (boolishFalse(visibleCandidate)) return true;
  if (boolishTrue(deletedCandidate)) return true;

  if (boolishTrue(activeCandidate) && ms !== 'REJECTED') return false;
  if (boolishTrue(visibleCandidate)) return false;

  return null;
}

/**
 * @deprecated inferReviewCatalogHidden kullanın
 * @returns {boolean|null}
 */
export function triStateCatalogActive(review) {
  const h = inferReviewCatalogHidden(review);
  if (h === true) return false;
  if (h === false) return true;
  return null;
}

/**
 * @param {object} review
 * @param {string} idStr
 * @param {Set<string>} autoRejected
 * @param {Set<string>} browserHidden
 */
export function computeModerationRowFlags(review, idStr, autoRejected, browserHidden) {
  const fromApi = inferReviewCatalogHidden(review);
  const hidden =
    fromApi === true ||
    (fromApi === null && (autoRejected.has(idStr) || browserHidden.has(idStr)));
  const isAutoRejected = Boolean(hidden && autoRejected.has(idStr));
  return {
    hidden,
    isAutoRejected,
  };
}
