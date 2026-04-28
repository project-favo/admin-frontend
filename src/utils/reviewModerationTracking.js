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

/**
 * @param {object} review
 */
export function normalizeModerationStatus(review) {
  return String(review?.moderationStatus ?? review?.moderation_status ?? '')
    .trim()
    .toUpperCase();
}

/** Admin DTO: isActive açıkça false. */
export function isExplicitlyInactiveInCatalog(review) {
  const a = review?.isActive ?? review?.active ?? review?.is_active;
  return a === false || a === 'false' || a === 0;
}

export function isExplicitlyActiveInCatalog(review) {
  const a = review?.isActive ?? review?.active ?? review?.is_active;
  return a === true || a === 'true' || a === 1;
}

/**
 * Moderation tablosu ile aynı satır türü (mapReviewDtoToRow ile hizalı).
 * @param {object} review
 * @param {{ autoRejected: Set<string>, browserHidden: Set<string> } | null | undefined} [sets] — yoksa localStorage setleri
 * @returns {'published' | 'rejected' | 'auto_rejected' | 'inactive'}
 */
export function getModerationStatusKindForReview(review, sets) {
  const tracking = sets ?? {
    autoRejected: loadAutoRejectedIdSet(),
    browserHidden: loadBrowserHiddenIdSet(),
  };
  const rawId = review?.id ?? review?.reviewId;
  const idStr = rawId != null ? String(rawId) : '0';
  const hasNumericId =
    rawId != null && String(rawId).trim() !== '' && Number.isFinite(Number(rawId));
  const ms = normalizeModerationStatus(review);
  const explicitInactive = isExplicitlyInactiveInCatalog(review);
  let kind = /** @type {'published' | 'rejected' | 'auto_rejected' | 'inactive'} */ ('published');
  if (hasNumericId) {
    const flags = computeModerationRowFlags(
      review,
      idStr,
      tracking.autoRejected,
      tracking.browserHidden
    );
    if (flags.isAutoRejected) {
      kind = 'auto_rejected';
    } else if (flags.hidden) {
      kind = explicitInactive && ms !== 'REJECTED' ? 'inactive' : 'rejected';
    } else if (explicitInactive) {
      kind = 'inactive';
    }
  } else if (explicitInactive) {
    kind = 'inactive';
  }
  return kind;
}

/**
 * ModerationTable status sütunu ile aynı metin (ve opsiyonel tooltip metni).
 * @param {'published' | 'rejected' | 'auto_rejected' | 'inactive'} kind
 * @returns {{ label: string, title?: string }}
 */
export function getModerationStatusTableDisplay(kind) {
  if (kind === 'rejected') {
    return { label: 'Rejected' };
  }
  if (kind === 'auto_rejected') {
    return {
      label: 'Rejected',
      title: 'Hidden automatically by AI toxicity threshold (System settings).',
    };
  }
  if (kind === 'inactive') {
    return {
      label: 'Inactive',
      title: 'Not shown in the catalog: review is deactivated (isActive=false in API).',
    };
  }
  return { label: 'Active' };
}
