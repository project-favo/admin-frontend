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
import loadingDots from '../assets/loading-dots.svg';

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

function toContentPreview(review) {
  const title = review?.title != null ? String(review.title).trim() : '';
  const desc = review?.description != null ? String(review.description).trim() : '';
  const mediaCount = Array.isArray(review?.mediaList) ? review.mediaList.length : 0;
  const mediaPrefix = mediaCount > 0 ? '🖼️ ' : '';

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

/**
 * ReviewResponseDto / JSON: toxicityScore (Double 0–1). Bazı ortamlar snake_case dönebilir.
 * @see https://github.com/project-favo/backend/blob/main/src/main/java/com/favo/backend/Domain/review/ReviewResponseDto.java
 */
function extractToxicityScore(review) {
  if (!review || typeof review !== 'object') return null;
  const nested =
    review.toxicity && typeof review.toxicity === 'object' ? review.toxicity.score : undefined;
  const v =
    review.toxicityScore ??
    review.toxicity_score ??
    review.toxicScore ??
    nested;
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Backend HF analizi yalnızca description üzerinde; tahminde de ağırlık buna yakın. */
function buildTextForLocalToxicityEstimate(review) {
  const title = review?.title != null ? String(review.title).trim() : '';
  const desc = review?.description != null ? String(review.description).trim() : '';
  if (desc && title && desc !== title) return `${desc}\n${title}`;
  return desc || title || '';
}

/**
 * API skoru yokken (DB'de null — çoğunlukla HUGGINGFACE_API_TOKEN eksik veya eski kayıt) gösterilebilir bir 0–100 tahmin.
 * Gerçek model skoru değildir; ToxicityService ile aynı değeri vermez.
 */
function estimateToxicityPercentFromText(text) {
  const s = text != null ? String(text).trim() : '';
  if (!s) return null;
  const lower = s.toLowerCase();
  let hits = 0;
  const wordPatterns = [
    /\b(siktir|sikerim|orospu|piç|aptal|salak|gerizekalı|şerefsiz|kahpe|öldür|katil)\b/giu,
    /\b(fuck|shit|bitch|asshole|crap|damn|hate|kill|idiot|stupid|moron|dumb)\b/giu,
  ];
  for (const p of wordPatterns) {
    const m = lower.match(p);
    if (m) hits += m.length;
  }
  const chaos =
    (s.match(/[!]{3,}/g) || []).length + (s.match(/[A-Za-z]{20,}/g) || []).length;
  hits += chaos;
  const raw = Math.min(95, hits * 16 + (s.length > 800 ? 8 : 0));
  return Math.round(raw);
}

/** 0–1 veya 0–100 değerini yüzde tamsayıya çevirir (HuggingFace "toxic" skoru 0–1). */
function toxicityToPercent(raw) {
  if (raw == null) return null;
  if (raw >= 0 && raw <= 1) return Math.round(raw * 100);
  if (raw > 1 && raw <= 100) return Math.round(raw);
  return null;
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

/** formatAiScoreFromReview ile aynı yüzde kaynağı; filtre eşlemesi için */
function getPercentForFilter(review) {
  const raw = extractToxicityScore(review);
  let pct = toxicityToPercent(raw);
  if (pct == null) {
    const text = buildTextForLocalToxicityEstimate(review);
    pct = estimateToxicityPercentFromText(text);
  }
  return pct != null && Number.isFinite(pct) ? pct : null;
}

function getReviewScoreTone(review) {
  const pct = getPercentForFilter(review);
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

function mapReviewDtoToRow(r, pageNum, idx) {
  const rawId = r?.id ?? r?.reviewId;
  const { display, title, scoreTone } = formatAiScoreFromReview(r);
  return {
    id: rawId != null ? String(rawId) : `${pageNum}-${idx}`,
    hasNumericId: rawId != null && String(rawId).trim() !== '' && Number.isFinite(Number(rawId)),
    contentPreview: toContentPreview(r),
    productLabel: formatProductLabel(r),
    collaborativeLabel: formatCollaborativeLabel(r),
    likeCountDisplay: formatReviewLikeCount(r),
    aiScore: display,
    aiScoreTitle: title,
    aiScoreTone: scoreTone,
  };
}

function mapAdminPageDtoToRows(dto, pageNum) {
  const content = Array.isArray(dto?.content) ? dto.content : [];
  return content.map((r, idx) => mapReviewDtoToRow(r, pageNum, idx));
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
  const id = review?.id != null ? String(review.id) : '';
  const title = review?.title != null ? String(review.title) : '';
  const desc = review?.description != null ? String(review.description) : '';
  const productName = String(review?.productName ?? review?.product_name ?? '').trim();
  const pid = review?.productId ?? review?.product_id;
  const productIdStr = pid != null ? String(pid) : '';
  const hay = `${id} ${title} ${desc} ${productName} ${productIdStr}`.toLowerCase();
  return hay.includes(qLower);
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
          setRows(slice.map((r, idx) => mapReviewDtoToRow(r, page, idx)));
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
          setRows(mapAdminPageDtoToRows(dto, page));
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
          setRows(slice.map((r, idx) => mapReviewDtoToRow(r, page, idx)));
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
      const rows = filtered.map((r, idx) => mapReviewDtoToRow(r, 0, idx));
      const filterLabel =
        scoreFilter === 'all'
          ? 'All reviews'
          : scoreFilter === 'low'
            ? 'AI score: Low (0–30)'
            : scoreFilter === 'mid'
              ? 'AI score: Mid (31–69)'
              : 'AI score: High (70–100)';
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
            aria-label="Filter by AI score band"
          >
            {[
              ['all', 'All', 'All reviews'],
              ['low', '🟢 Low', 'AI score band 0–30'],
              ['mid', '🟠 Mid', 'AI score band 31–69'],
              ['high', '🔴 High', 'AI score band 70–100'],
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
              placeholder="Search by product, text, review ID…"
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
                  : 'No reviews match this AI score filter (or scores are still pending).'}
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
