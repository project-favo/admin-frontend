import '../styles/Moderation.css';
import TablePagination from '../components/TablePagination';
import ModerationTable from '../components/ModerationTable';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchAllAdminReviews,
  listAdminReviews,
  messageFromFailedResponse,
  patchAdminReviewActivate,
  patchAdminReviewDeactivate,
} from '../api/adminApi';
import { downloadModerationPdf } from '../utils/moderationPdfExport';
import { getTablePageSize } from '../utils/adminPreferences';
import {
  buildTextForLocalToxicityEstimate,
  estimateToxicityPercentFromText,
  extractToxicityScore,
  getReviewToxicityPercent,
  toxicityToPercent,
} from '../utils/reviewToxicityScore';
import {
  addBrowserHiddenReviewIds,
  getModerationStatusKindForReview,
  isExplicitlyActiveInCatalog,
  isExplicitlyInactiveInCatalog,
  loadAutoRejectedIdSet,
  loadBrowserHiddenIdSet,
  normalizeModerationStatus,
  removeTrackedModerationId,
} from '../utils/reviewModerationTracking';
import loadingDots from '../assets/loading-dots.svg';

function loadModerationTrackingSets() {
  return {
    autoRejected: loadAutoRejectedIdSet(),
    browserHidden: loadBrowserHiddenIdSet(),
  };
}

function formatInteger(value) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function truncateText(text, maxLen) {
  if (text == null) return '';
  const s = String(text).trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
}

/** Title + description combined the same way as the Content preview column (before truncation). */
function buildReviewPreviewBody(review) {
  const title = review?.title != null ? String(review.title).trim() : '';
  const desc = review?.description != null ? String(review.description).trim() : '';

  let body = '';
  if (title && desc) {
    if (title === desc) {
      body = title;
    } else if (desc.startsWith(title)) {
      body = desc;
    } else {
      body = `${title} — ${desc}`;
    }
  } else {
    body = title || desc;
  }

  return body;
}

function toContentPreview(review) {
  const body = buildReviewPreviewBody(review);
  const mediaCount = Array.isArray(review?.mediaList) ? review.mediaList.length : 0;
  const mediaPrefix = mediaCount > 0 ? '🖼️ ' : '';

  const display = body || '—';
  return `${mediaPrefix}"${truncateText(display, 120)}"`;
}

/** ReviewResponseDto: isCollaborative, productId, productName, likeCount */
function formatCollaborativeLabel(review) {
  const v = review?.isCollaborative ?? review?.is_collaborative;
  if (v == null) return '—';
  return v === true || v === 'true' || v === 1 ? 'Yes' : 'No';
}

function formatReviewLikeCount(review) {
  const n = review?.likeCount ?? review?.like_count;
  if (n == null) return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return formatInteger(num) ?? String(n);
}

function formatProductLabel(review) {
  const nameRaw = review?.productName ?? review?.product_name;
  const idRaw = review?.productId ?? review?.product_id;
  const name = nameRaw != null ? String(nameRaw).trim() : '';
  const idStr =
    idRaw != null && String(idRaw).trim() !== '' ? String(idRaw).trim() : '';
  if (name && idStr) return `${name} (#${idStr})`;
  if (name) return name;
  if (idStr) return `Product #${idStr}`;
  return '—';
}

function formatReviewerLabel(review) {
  const nameRaw =
    review?.ownerUserName ??
    review?.owner_username ??
    review?.ownerUsername ??
    review?.userName ??
    review?.username ??
    review?.user_name ??
    review?.authorName ??
    review?.author_name ??
    review?.fullName ??
    review?.full_name ??
    review?.name;
  const idRaw = review?.userId ?? review?.user_id ?? review?.authorId ?? review?.author_id;
  const name = nameRaw != null ? String(nameRaw).trim() : '';
  const idStr = idRaw != null && String(idRaw).trim() !== '' ? String(idRaw).trim() : '';
  if (name && idStr) return `${name} (#${idStr})`;
  if (name) return name;
  if (idStr) return `User #${idStr}`;
  return '—';
}

/** Özet listesinde aynı ürünü iki kez göstermemek için (productId öncelikli). */
function productKeyFromReview(review) {
  const idRaw = review?.productId ?? review?.product_id;
  if (idRaw != null && String(idRaw).trim() !== '') {
    const n = Number(idRaw);
    if (Number.isFinite(n)) return `id:${n}`;
    return `id:${String(idRaw).trim()}`;
  }
  return `lbl:${formatProductLabel(review)}`;
}

/**
 * @param {object} r
 * @param {'all' | 'active' | 'inactive'} filter
 */
function reviewMatchesCatalogFilter(r, filter) {
  if (filter === 'all') return true;
  if (filter === 'active') return isExplicitlyActiveInCatalog(r);
  if (filter === 'inactive') return isExplicitlyInactiveInCatalog(r);
  return true;
}

function getUserReportStatus(review) {
  const moderationStatus = normalizeModerationStatus(review);
  if (moderationStatus === 'MANUALLY_FLAGGED') {
    return {
      label: 'Reported',
      kind: 'reported',
      title: 'Flagged by users via review report flow.',
    };
  }
  if (!moderationStatus) {
    return {
      label: '—',
      kind: 'unknown',
      title: 'Review moderation status is missing in API response.',
    };
  }
  return {
    label: 'Not reported',
    kind: 'not_reported',
    title: 'No user report flag on this review.',
  };
}

/** Arayüz: 0–30 yeşil, 31–69 turuncu, 70–100 kırmızı (toxicity yüzdesi). */
function aiScoreToneFromPercent(pct) {
  if (pct == null || !Number.isFinite(pct)) return null;
  if (pct <= 30) return 'low';
  if (pct >= 70) return 'high';
  return 'mid';
}

function aiScoreEmojiFromTone(tone) {
  if (tone === 'low') return '🟢';
  if (tone === 'high') return '🔴';
  if (tone === 'mid') return '🟠';
  return '';
}

function getReviewScoreTone(review) {
  const pct = getReviewToxicityPercent(review);
  if (pct == null) return null;
  return aiScoreToneFromPercent(pct);
}

/**
 * “Low” filtresi: skor 0% olan kayıtları dışlar (0% sütunda yeşil bantta kalsa da yalnız “All”da listelenir).
 * @param {object} r
 * @param {'all' | 'low' | 'mid' | 'high'} filter
 */
function reviewMatchesScoreFilter(r, filter) {
  if (filter === 'all') return true;
  const tone = getReviewScoreTone(r);
  if (filter === 'low') {
    if (tone !== 'low') return false;
    const pct = getReviewToxicityPercent(r);
    return Number.isFinite(pct) && pct > 0;
  }
  return tone === filter;
}

/**
 * Skor kaynağı backend (ToxicityService eşikleri sunucuda farklı olabilir).
 * @see https://github.com/project-favo/backend/blob/main/src/main/java/com/favo/backend/Service/Moderation/ToxicityService.java
 */
function formatAiScoreFromReview(review) {
  const raw = extractToxicityScore(review);
  let pct = toxicityToPercent(raw);
  let source = 'api';

  if (pct == null) {
    const text = buildTextForLocalToxicityEstimate(review);
    const est = estimateToxicityPercentFromText(text);
    if (est != null) {
      pct = est;
      source = 'estimate';
    }
  }

  const status = String(review?.moderationStatus ?? '')
    .trim()
    .toUpperCase();

  if (pct != null) {
    const scoreTone = aiScoreToneFromPercent(pct);
    const emoji = aiScoreEmojiFromTone(scoreTone);
    const display = `${emoji} ${pct}%`;
    const bandHint =
      'Arayüz: 🟢 0–30, 🟠 31–69, 🔴 70–100; yüzde metni aynı renkte.';
    const title =
      source === 'api'
        ? raw != null
          ? `Backend toxicityScore: ${raw.toFixed(4)} → ${pct}%. ${bandHint}`
          : undefined
        : `API'de toxicityScore yok (kayıtta HF skoru yok). Yerel metin tahmini: ${pct}%. ${bandHint} Kalıcı skor için sunucuda HUGGINGFACE_API_TOKEN ve yeniden analiz gerekir.`;
    return { display, title, scoreTone };
  }

  if (status === 'PENDING') {
    return {
      display: '⏳ Pending AI',
      title: 'Skor henüz yok veya HuggingFace analizi bekleniyor.',
      scoreTone: null,
    };
  }
  if (status === 'AUTO_FLAGGED') {
    return {
      display: '⚠️ —',
      title: 'İşaretli; toxicity skoru yanıtta yok (veri tutarsızlığı olabilir).',
      scoreTone: null,
    };
  }

  return { display: '—', title: undefined, scoreTone: null };
}

const MODERATION_POLL_MS = 5000;

function mapReviewDtoToRow(r, pageNum, idx, sets) {
  const tracking = sets ?? loadModerationTrackingSets();
  const rawId = r?.id ?? r?.reviewId;
  const idStr = rawId != null ? String(rawId) : `${pageNum}-${idx}`;
  const hasNumericId =
    rawId != null && String(rawId).trim() !== '' && Number.isFinite(Number(rawId));
  const { display, title, scoreTone } = formatAiScoreFromReview(r);
  const reportStatus = getUserReportStatus(r);
  const moderationStatusKind = getModerationStatusKindForReview(r, tracking);

  return {
    id: idStr,
    hasNumericId,
    reviewPath: hasNumericId ? `/moderation/reviews/${encodeURIComponent(idStr)}` : null,
    moderationStatusKind,
    contentPreview: toContentPreview(r),
    reviewerLabel: formatReviewerLabel(r),
    productLabel: formatProductLabel(r),
    productKey: productKeyFromReview(r),
    collaborativeLabel: formatCollaborativeLabel(r),
    likeCountDisplay: formatReviewLikeCount(r),
    userReportLabel: reportStatus.label,
    userReportKind: reportStatus.kind,
    userReportTitle: reportStatus.title,
    aiScore: display,
    aiScoreTitle: title,
    aiScoreTone: scoreTone,
  };
}

function mapAdminPageDtoToRows(dto, pageNum, sets) {
  const content = Array.isArray(dto?.content) ? dto.content : [];
  return content.map((r, idx) => mapReviewDtoToRow(r, pageNum, idx, sets));
}

function readPageMeta(dto) {
  let totalElements = null;
  let totalPages = null;
  const te =
    dto?.totalElements ?? dto?.total_elements ?? dto?.total ?? dto?.page?.totalElements;
  if (te != null) {
    const n = typeof te === 'number' ? te : Number(te);
    if (Number.isFinite(n)) totalElements = n;
  }
  const tp = dto?.totalPages ?? dto?.total_pages ?? dto?.page?.totalPages;
  if (tp != null) {
    const n = typeof tp === 'number' ? tp : Number(tp);
    if (Number.isFinite(n)) totalPages = n;
  }
  return { totalElements, totalPages };
}

function reviewMatchesReportFilter(review, reportFilter) {
  if (reportFilter !== 'reported') return true;
  return normalizeModerationStatus(review) === 'MANUALLY_FLAGGED';
}

/** İnceleme metni (başlık+açıklama) ve ürün adı / ürün ID alanlarında alt dizgi araması. */
function reviewMatchesSearchQuery(review, qLower) {
  if (!qLower) return true;
  const body = buildReviewPreviewBody(review);
  const nameRaw = review?.productName ?? review?.product_name;
  const idRaw = review?.productId ?? review?.product_id;
  const parts = [body, nameRaw != null ? String(nameRaw) : '', idRaw != null ? String(idRaw) : ''];
  const hay = parts.join(' ').toLowerCase();
  return hay.includes(qLower);
}

const Moderation = () => {
  const [page, setPage] = useState(0);
  const [size] = useState(() => getTablePageSize());
  const [scoreFilter, setScoreFilter] = useState(
    /** @type {'all' | 'low' | 'mid' | 'high'} */ ('all')
  );
  const [reportFilter, setReportFilter] = useState(/** @type {'all' | 'reported'} */ ('all'));
  const [catalogFilter, setCatalogFilter] = useState(/** @type {'all' | 'active' | 'inactive'} */ ('all'));
  const [rows, setRows] = useState([]);
  const [totalElements, setTotalElements] = useState(null);
  const [totalPages, setTotalPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [pollTick, setPollTick] = useState(0);
  const [listVersion, setListVersion] = useState(0);
  const pollSilentRef = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  const searchTrim = useMemo(() => searchInput.trim().toLowerCase(), [searchInput]);
  const isSearchActive = searchTrim.length > 0;

  const moderationTotalPillLabel = useMemo(() => {
    if (reportFilter === 'all' && scoreFilter === 'all' && catalogFilter === 'all') {
      return 'All reviews';
    }
    if (reportFilter === 'reported' && scoreFilter === 'all' && catalogFilter === 'all') {
      return 'Reported reviews';
    }
    const parts = [];
    if (reportFilter === 'reported') parts.push('Reported');
    if (catalogFilter === 'active') parts.push('Active');
    if (catalogFilter === 'inactive') parts.push('Inactive');
    if (scoreFilter === 'low') parts.push('Low (1–30)');
    if (scoreFilter === 'mid') parts.push('Mid (31–69)');
    if (scoreFilter === 'high') parts.push('High (70–100)');
    return parts.length > 0 ? parts.join(' · ') : 'All reviews';
  }, [reportFilter, scoreFilter, catalogFilter]);

  const moderationEmptyHint = useMemo(() => {
    if (isSearchActive) {
      return 'No reviews match your search. Try other words in the content or product name.';
    }
    if (reportFilter === 'reported') {
      return 'There are no user-reported reviews matching this filter.';
    }
    if (scoreFilter !== 'all') {
      return 'No reviews match this AI toxicity filter (or scores are still pending).';
    }
    if (catalogFilter === 'active') {
      return 'No active reviews in the catalog (isActive=true) for this list.';
    }
    if (catalogFilter === 'inactive') {
      return 'No inactive reviews in the catalog (isActive=false) for this list.';
    }
    return 'No review records were returned for this page.';
  }, [isSearchActive, reportFilter, scoreFilter, catalogFilter]);

  useEffect(() => {
    const t = window.setInterval(() => {
      pollSilentRef.current = true;
      setPollTick((n) => n + 1);
    }, MODERATION_POLL_MS);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const silent = pollSilentRef.current;
    pollSilentRef.current = false;

    if (!silent) {
      setLoading(true);
      setError(null);
      setActionFeedback(null);
    }

    (async () => {
      try {
        const needsFullListFetch =
          scoreFilter !== 'all' ||
          reportFilter !== 'all' ||
          isSearchActive ||
          catalogFilter === 'inactive' ||
          (catalogFilter === 'active' &&
            (scoreFilter !== 'all' || reportFilter !== 'all' || isSearchActive));

        if (needsFullListFetch) {
          const all = await fetchAllAdminReviews({
            activeOnly: catalogFilter === 'active',
            pageSize: 200,
            signal: controller.signal,
          });
          if (cancelled) return;
          let filtered = all;
          if (reportFilter !== 'all') {
            filtered = filtered.filter((r) => reviewMatchesReportFilter(r, reportFilter));
          }
          if (catalogFilter !== 'all') {
            filtered = filtered.filter((r) => reviewMatchesCatalogFilter(r, catalogFilter));
          }
          if (scoreFilter !== 'all') {
            filtered = filtered.filter((r) => reviewMatchesScoreFilter(r, scoreFilter));
          }
          if (isSearchActive) {
            filtered = filtered.filter((r) => reviewMatchesSearchQuery(r, searchTrim));
          }
          const n = filtered.length;
          const tp = n === 0 ? 0 : Math.ceil(n / size);
          const slice = filtered.slice(page * size, page * size + size);
          setError(null);
          const setsSearch = loadModerationTrackingSets();
          setRows(slice.map((r, idx) => mapReviewDtoToRow(r, page, idx, setsSearch)));
          setTotalElements(n);
          setTotalPages(tp);
        } else {
          const res = await listAdminReviews({
            page,
            size,
            activeOnly: catalogFilter === 'active',
            signal: controller.signal,
          });
          if (cancelled) return;
          if (!res.ok) {
            throw new Error(`Request failed (${res.status})`);
          }
          const dto = await res.json();
          if (cancelled) return;
          setError(null);
          const setsPage = loadModerationTrackingSets();
          setRows(mapAdminPageDtoToRows(dto, page, setsPage));
          const meta = readPageMeta(dto);
          setTotalElements(meta.totalElements);
          setTotalPages(meta.totalPages);
        }
      } catch (e) {
        if (cancelled) return;
        if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') return;
        setRows([]);
        setTotalElements(null);
        setTotalPages(null);
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, size, scoreFilter, reportFilter, catalogFilter, searchTrim, isSearchActive, pollTick, listVersion]);

  useEffect(() => {
    setPage(0);
  }, [searchTrim]);

  useEffect(() => {
    setPage(0);
  }, [catalogFilter]);

  useEffect(() => {
    if (loading) return;
    if (typeof totalPages !== 'number' || !Number.isFinite(totalPages)) return;
    if (totalPages <= 0) {
      if (page > 0) setPage(0);
      return;
    }
    if (page >= totalPages) setPage(totalPages - 1);
  }, [loading, page, totalPages]);

  const formattedTotal = useMemo(() => formatInteger(totalElements), [totalElements]);
  const showingFrom = rows.length === 0 ? 0 : page * size + 1;
  const showingTo = page * size + rows.length;

  const canPrev = page > 0 && !loading;
  const canNext =
    !loading &&
    (typeof totalPages === 'number' && totalPages > 0
      ? page + 1 < totalPages
      : scoreFilter === 'all' &&
        reportFilter === 'all' &&
        (catalogFilter === 'all' || catalogFilter === 'active') &&
        !isSearchActive &&
        rows.length === size);
  const pageStatusText = useMemo(() => {
    const tp =
      typeof totalPages === 'number' && totalPages > 0 ? String(totalPages) : '—';
    return `Page ${page + 1} of ${tp}`;
  }, [page, totalPages]);

  const goPrev = () => setPage((p) => Math.max(0, p - 1));
  const goNext = () => setPage((p) => p + 1);
  const goFirst = () => setPage(0);
  const goLast = () => {
    if (typeof totalPages === 'number' && totalPages > 0) setPage(totalPages - 1);
  };
  const canFirst = page > 0 && !loading;
  const canLast =
    !loading &&
    typeof totalPages === 'number' &&
    totalPages > 1 &&
    page < totalPages - 1;

  async function handleExportPdf() {
    if (exporting) return;
    setActionFeedback(null);
    setExporting(true);
    try {
      const reviews = await fetchAllAdminReviews({
        activeOnly: catalogFilter === 'active',
      });
      let filtered = reviews;
      if (reportFilter !== 'all') {
        filtered = filtered.filter((r) => reviewMatchesReportFilter(r, reportFilter));
      }
      if (catalogFilter !== 'all') {
        filtered = filtered.filter((r) => reviewMatchesCatalogFilter(r, catalogFilter));
      }
      if (scoreFilter !== 'all') {
        filtered = filtered.filter((r) => reviewMatchesScoreFilter(r, scoreFilter));
      }
      if (isSearchActive) {
        filtered = filtered.filter((r) => reviewMatchesSearchQuery(r, searchTrim));
      }
      const setsPdf = loadModerationTrackingSets();
      const rows = filtered.map((r, idx) => mapReviewDtoToRow(r, 0, idx, setsPdf));
      const reportLabel = reportFilter === 'reported' ? 'Reported reviews' : 'All reviews';
      const catalogLabel =
        catalogFilter === 'all'
          ? null
          : catalogFilter === 'active'
            ? 'Catalog: active only (isActive=true)'
            : 'Catalog: inactive only (isActive=false)';
      const scoreLabel =
        scoreFilter === 'all'
          ? null
          : scoreFilter === 'low'
            ? 'AI toxicity: Low (1–30, excludes 0%)'
            : scoreFilter === 'mid'
              ? 'AI toxicity: Mid (31–69)'
              : 'AI toxicity: High (70–100)';
      const searchLabel = isSearchActive
        ? `Search: "${searchInput.trim()}" (content or product)`
        : null;
      const extraBits = [catalogLabel, scoreLabel, searchLabel].filter(Boolean);
      downloadModerationPdf({
        rows: rows.map(
          ({ contentPreview, productLabel, collaborativeLabel, likeCountDisplay, aiScore }) => ({
            contentPreview,
            productLabel,
            collaborativeLabel,
            likeCountDisplay,
            aiScore,
          })
        ),
        filterLabel: [reportLabel, ...extraBits].join(' · '),
      });
      setActionFeedback({ ok: true, message: 'PDF downloaded.' });
    } catch (e) {
      setActionFeedback({
        ok: false,
        message: e instanceof Error ? e.message : 'Export failed.',
      });
    } finally {
      setExporting(false);
    }
  }

  const handleApprove = async (id) => {
    if (actionBusyId != null) return;
    setActionFeedback(null);
    setActionBusyId(id);
    try {
      const res = await patchAdminReviewActivate(id);
      if (!res.ok) {
        const msg = await messageFromFailedResponse(res);
        throw new Error(msg);
      }
      removeTrackedModerationId(id);
      setListVersion((v) => v + 1);
      setActionFeedback({ ok: true, message: 'Review approved; review is now active.' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setActionFeedback({ ok: false, message });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleReject = async (id) => {
    if (actionBusyId != null) return;
    setActionFeedback(null);
    setActionBusyId(id);
    try {
      const res = await patchAdminReviewDeactivate(id);
      if (!res.ok) {
        const msg = await messageFromFailedResponse(res);
        throw new Error(msg);
      }
      addBrowserHiddenReviewIds([id]);
      setListVersion((v) => v + 1);
      setActionFeedback({ ok: true, message: 'Review rejected (hidden).' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setActionFeedback({ ok: false, message });
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <div className="moderation-page">
      <div className="moderation-page-inner">
        <header className="moderation-header">
          <h2 className="moderation-main-title">Content moderation</h2>
          <p className="moderation-subtitle">
            Review queued content, monitor user-reported comments, and activate or hide reviews.
          </p>
        </header>

        <div className="moderation-toolbar" aria-label="Moderation queue controls">
          <div
            className="moderation-total-pill"
            title="Total reviews matching the current filter"
          >
            <span className="moderation-total-pill-label">{moderationTotalPillLabel}</span>
            <span className="moderation-total-pill-value" aria-live="polite">
              {loading && formattedTotal == null ? '…' : formattedTotal ?? '—'}
            </span>
          </div>
          <div
            className="moderation-filter-segment moderation-filter-segment--report"
            role="group"
            aria-label="Filter by report status"
          >
            <button
              type="button"
              className={
                reportFilter === 'all'
                  ? 'moderation-filter-segment-btn moderation-filter-segment-btn--active'
                  : 'moderation-filter-segment-btn'
              }
              onClick={() => {
                if (reportFilter === 'all') return;
                setPage(0);
                setReportFilter('all');
              }}
              disabled={loading}
            >
              All
            </button>
            <button
              type="button"
              className={
                reportFilter === 'reported'
                  ? 'moderation-filter-segment-btn moderation-filter-segment-btn--active'
                  : 'moderation-filter-segment-btn'
              }
              onClick={() => {
                if (reportFilter === 'reported') return;
                setPage(0);
                setReportFilter('reported');
              }}
              disabled={loading}
            >
              Reported
            </button>
          </div>
          <div
            className="moderation-filter-segment moderation-filter-segment--catalog"
            role="group"
            aria-label="Filter by catalog activity (isActive from API)"
          >
            {[
              ['all', 'All', 'All reviews, active and inactive in catalog'],
              ['active', 'Active', 'isActive true — review is shown in the catalog'],
              [
                'inactive',
                'Inactive',
                'isActive false — review is hidden / deactivated in the catalog',
              ],
            ].map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                className={
                  catalogFilter === id
                    ? 'moderation-filter-segment-btn moderation-filter-segment-btn--active'
                    : 'moderation-filter-segment-btn'
                }
                title={hint}
                onClick={() => {
                  if (catalogFilter === id) return;
                  setPage(0);
                  setCatalogFilter(/** @type {'all' | 'active' | 'inactive'} */ (id));
                }}
                disabled={loading}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="moderation-filter-segment moderation-filter-segment--score"
            role="group"
            aria-label="Filter by AI toxicity band"
          >
            {[
              ['all', 'All', 'All reviews'],
              [
                'low',
                '🟢 Low',
                'AI toxicity 1–30% (0% scores only appear under “All”)',
              ],
              ['mid', '🟠 Mid', 'AI toxicity band 31–69'],
              ['high', '🔴 High', 'AI toxicity band 70–100'],
            ].map(([id, label, hint]) => (
              <button
                key={id}
                type="button"
                className={
                  scoreFilter === id
                    ? 'moderation-filter-segment-btn moderation-filter-segment-btn--active'
                    : 'moderation-filter-segment-btn'
                }
                title={hint}
                onClick={() => {
                  if (scoreFilter === id) return;
                  setPage(0);
                  setScoreFilter(/** @type {'all' | 'low' | 'mid' | 'high'} */ (id));
                }}
                disabled={loading}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="moderation-toolbar-search">
            <input
              id="moderation-search"
              type="search"
              className="moderation-toolbar-search-input"
              placeholder="Search review or product name…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              autoComplete="off"
              enterKeyHint="search"
              aria-label="Search by review content or product name"
            />
          </div>
          <button
            type="button"
            className="moderation-toolbar-export"
            title="Download PDF of reviews matching the current filter"
            onClick={handleExportPdf}
            disabled={loading || exporting}
          >
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>

        {error && (
          <div className="moderation-alert moderation-alert--error" role="alert">
            Failed to load reviews: {error}
          </div>
        )}

        {actionFeedback && (
          <div
            className={
              actionFeedback.ok
                ? 'moderation-alert moderation-alert--success'
                : 'moderation-alert moderation-alert--error'
            }
            role="status"
          >
            {actionFeedback.message}
          </div>
        )}

        {loading ? (
          <div className="moderation-loading" aria-live="polite" aria-busy="true">
            <img src={loadingDots} alt="" />
            <div className="moderation-loading-text">Loading moderation queue…</div>
          </div>
        ) : !error && rows.length === 0 ? (
          <div className="moderation-empty" role="status">
            <p className="moderation-empty-title">No reviews to show</p>
            <p className="moderation-empty-hint">{moderationEmptyHint}</p>
          </div>
        ) : !error ? (
          <>
            <div className="moderation-pagination-bar moderation-pagination-bar--top">
              <TablePagination
                ariaLabel="Moderation list pages (top)"
                statusText={pageStatusText}
                canPrev={canPrev}
                canNext={canNext}
                onPrev={goPrev}
                onNext={goNext}
                canFirst={canFirst}
                canLast={canLast}
                onFirst={goFirst}
                onLast={goLast}
              />
            </div>
            <ModerationTable
              items={rows}
              onApprove={handleApprove}
              onReject={handleReject}
              actionBusyId={actionBusyId}
            />
          </>
        ) : null}

        <footer className="moderation-footer">
          <p className="moderation-footer-summary">
            Showing {showingFrom}-{showingTo} of{' '}
            {loading && formattedTotal == null ? '…' : formattedTotal ?? '—'} reviews
          </p>
          <div className="moderation-pagination-bar moderation-pagination-bar--bottom">
            <TablePagination
              ariaLabel="Moderation list pages (bottom)"
              statusText={pageStatusText}
              canPrev={canPrev}
              canNext={canNext}
              onPrev={goPrev}
              onNext={goNext}
              canFirst={canFirst}
              canLast={canLast}
              onFirst={goFirst}
              onLast={goLast}
            />
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Moderation;
