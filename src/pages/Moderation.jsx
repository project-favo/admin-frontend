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
  computeModerationRowFlags,
  loadAutoRejectedIdSet,
  loadBrowserHiddenIdSet,
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

  let moderationStatusKind = /** @type {'published' | 'rejected' | 'auto_rejected'} */ (
    'published'
  );
  if (hasNumericId) {
    const flags = computeModerationRowFlags(
      r,
      idStr,
      tracking.autoRejected,
      tracking.browserHidden
    );
    if (flags.hidden) {
      moderationStatusKind = flags.isAutoRejected ? 'auto_rejected' : 'rejected';
    }
  }

  return {
    id: idStr,
    hasNumericId,
    moderationStatusKind,
    contentPreview: toContentPreview(r),
    productLabel: formatProductLabel(r),
    collaborativeLabel: formatCollaborativeLabel(r),
    likeCountDisplay: formatReviewLikeCount(r),
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

function reviewMatchesSearch(review, qLower) {
  if (!qLower) return true;
  const previewBody = buildReviewPreviewBody(review).toLowerCase();
  const productName = String(review?.productName ?? review?.product_name ?? '')
    .trim()
    .toLowerCase();
  return previewBody.includes(qLower) || productName.includes(qLower);
}

const Moderation = () => {
  const [page, setPage] = useState(0);
  const [size] = useState(() => getTablePageSize());
  const [scoreFilter, setScoreFilter] = useState(
    /** @type {'all' | 'low' | 'mid' | 'high'} */ ('all')
  );
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

    if (isSearchActive && silent) return;

    if (!silent && !isSearchActive) {
      setLoading(true);
      setError(null);
      setActionFeedback(null);
    }
    if (!silent && isSearchActive) {
      setLoading(true);
      setError(null);
    }

    (async () => {
      try {
        if (isSearchActive) {
          const all = await fetchAllAdminReviews({
            activeOnly: false,
            pageSize: 200,
            signal: controller.signal,
          });
          if (cancelled) return;
          let filtered = all;
          if (scoreFilter !== 'all') {
            filtered = filtered.filter((r) => getReviewScoreTone(r) === scoreFilter);
          }
          filtered = filtered.filter((r) => reviewMatchesSearch(r, searchTrim));
          const n = filtered.length;
          const tp = n === 0 ? 0 : Math.ceil(n / size);
          const slice = filtered.slice(page * size, page * size + size);
          setError(null);
          const setsSearch = loadModerationTrackingSets();
          setRows(slice.map((r, idx) => mapReviewDtoToRow(r, page, idx, setsSearch)));
          setTotalElements(n);
          setTotalPages(tp);
        } else if (scoreFilter === 'all') {
          const res = await listAdminReviews({
            page,
            size,
            activeOnly: false,
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
        } else {
          const all = await fetchAllAdminReviews({
            activeOnly: false,
            pageSize: 200,
            signal: controller.signal,
          });
          if (cancelled) return;
          const filtered = all.filter((r) => getReviewScoreTone(r) === scoreFilter);
          const n = filtered.length;
          const tp = n === 0 ? 0 : Math.ceil(n / size);
          const slice = filtered.slice(page * size, page * size + size);
          setError(null);
          const setsBand = loadModerationTrackingSets();
          setRows(slice.map((r, idx) => mapReviewDtoToRow(r, page, idx, setsBand)));
          setTotalElements(n);
          setTotalPages(tp);
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
  }, [page, size, scoreFilter, pollTick, listVersion, isSearchActive, searchTrim]);

  useEffect(() => {
    setPage(0);
  }, [searchTrim]);

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
      : !isSearchActive && scoreFilter === 'all' && rows.length === size);
  const pageStatusText = useMemo(() => {
    const tp =
      typeof totalPages === 'number' && totalPages > 0 ? String(totalPages) : '—';
    return `Page ${page + 1} of ${tp}`;
  }, [page, totalPages]);

  const goPrev = () => setPage((p) => Math.max(0, p - 1));
  const goNext = () => setPage((p) => p + 1);

  async function handleExportPdf() {
    if (exporting) return;
    setActionFeedback(null);
    setExporting(true);
    try {
      const reviews = await fetchAllAdminReviews({
        activeOnly: false,
      });
      let filtered =
        scoreFilter === 'all'
          ? reviews
          : reviews.filter((r) => getReviewScoreTone(r) === scoreFilter);
      if (isSearchActive) {
        filtered = filtered.filter((r) => reviewMatchesSearch(r, searchTrim));
      }
      const setsPdf = loadModerationTrackingSets();
      const rows = filtered.map((r, idx) => mapReviewDtoToRow(r, 0, idx, setsPdf));
      const filterLabel =
        scoreFilter === 'all'
          ? 'All reviews'
          : scoreFilter === 'low'
            ? 'AI toxicity: Low (0–30)'
            : scoreFilter === 'mid'
              ? 'AI toxicity: Mid (31–69)'
              : 'AI toxicity: High (70–100)';
      const searchSuffix = isSearchActive ? ` · Search: "${searchInput.trim()}"` : '';
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
        filterLabel: `${filterLabel}${searchSuffix}`,
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
      setActionFeedback({ ok: true, message: 'Review approved (published).' });
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
            Review queued content, filter by AI toxicity score band, and publish or hide reviews.
          </p>
        </header>

        <div className="moderation-toolbar" aria-label="Moderation queue controls">
          <div
            className="moderation-total-pill"
            title="Total reviews matching the current filter"
          >
            <span className="moderation-total-pill-label">
              {scoreFilter === 'all'
                ? 'All reviews'
                : scoreFilter === 'low'
                  ? 'Low (0–30)'
                  : scoreFilter === 'mid'
                    ? 'Mid (31–69)'
                    : 'High (70–100)'}
            </span>
            <span className="moderation-total-pill-value" aria-live="polite">
              {loading && formattedTotal == null ? '…' : formattedTotal ?? '—'}
            </span>
          </div>
          <div
            className="moderation-filter-segment moderation-filter-segment--score"
            role="group"
            aria-label="Filter by AI toxicity band"
          >
            {[
              ['all', 'All', 'All reviews'],
              ['low', '🟢 Low', 'AI toxicity band 0–30'],
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
              type="search"
              className="moderation-toolbar-search-input"
              placeholder="Search by content preview or product name…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search reviews"
              autoComplete="off"
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
            <p className="moderation-empty-hint">
              {isSearchActive
                ? 'No reviews match this search. Try different keywords.'
                : scoreFilter === 'all'
                  ? 'No review records were returned for this page.'
                  : 'No reviews match this AI toxicity filter (or scores are still pending).'}
            </p>
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
            />
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Moderation;
