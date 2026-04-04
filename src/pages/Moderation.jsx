import '../styles/Moderation.css';
import ModerationTable from '../components/ModerationTable';
import { useEffect, useMemo, useState } from 'react';
import {
  listAdminReviews,
  patchAdminReviewActivate,
  patchAdminReviewDeactivate,
} from '../api/adminApi';
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

function toModerationStatusLabel(raw) {
  const s = String(raw || '')
    .trim()
    .toUpperCase();
  const map = {
    PENDING: 'Pending review',
    APPROVED: 'Approved',
    AUTO_FLAGGED: 'Auto-flagged (AI)',
    MANUALLY_FLAGGED: 'User-reported',
    REJECTED: 'Rejected',
  };
  return map[s] || (raw ? String(raw) : '—');
}

function toAiScoreLabel(toxicityScore) {
  if (toxicityScore == null) return '—';
  const n = Number(toxicityScore);
  if (!Number.isFinite(n)) return '—';
  const pct = n <= 1 ? Math.round(n * 100) : Math.round(n);
  let emoji = '🟡';
  if (pct >= 85) emoji = '🔴';
  else if (pct >= 60) emoji = '🟠';
  return `${emoji} ${pct}%`;
}

function scrollToModerationTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function getVisiblePages({ page, totalPages, maxButtons = 3 }) {
  if (typeof totalPages !== 'number' || !Number.isFinite(totalPages) || totalPages <= 0) {
    return [page];
  }
  const safeMax = Math.max(1, Math.floor(maxButtons));
  const last = totalPages - 1;
  let start = Math.max(0, page - Math.floor(safeMax / 2));
  let end = Math.min(last, start + safeMax - 1);
  start = Math.max(0, end - safeMax + 1);
  const pages = [];
  for (let p = start; p <= end; p += 1) pages.push(p);
  return pages;
}

function mapAdminPageDtoToRows(dto, pageNum) {
  const content = Array.isArray(dto?.content) ? dto.content : [];
  return content.map((r, idx) => ({
    id: String(r?.id ?? `${pageNum}-${idx}`),
    contentPreview: toContentPreview(r),
    flagReason: toModerationStatusLabel(r?.moderationStatus),
    aiScore: toAiScoreLabel(r?.toxicityScore),
  }));
}

function readPageMeta(dto) {
  return {
    totalElements:
      typeof dto?.totalElements === 'number'
        ? dto.totalElements
        : dto?.totalElements != null
          ? Number(dto.totalElements)
          : null,
    totalPages:
      typeof dto?.totalPages === 'number'
        ? dto.totalPages
        : dto?.totalPages != null
          ? Number(dto.totalPages)
          : null,
  };
}

const Moderation = () => {
  const [page, setPage] = useState(0);
  const [size] = useState(15);
  const [activeOnly, setActiveOnly] = useState(false);
  const [rows, setRows] = useState([]);
  const [totalElements, setTotalElements] = useState(null);
  const [totalPages, setTotalPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionBusyId, setActionBusyId] = useState(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    scrollToModerationTop();
    (async () => {
      try {
        const res = await listAdminReviews({
          page,
          size,
          activeOnly,
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }
        const dto = await res.json();
        if (!alive) return;
        setRows(mapAdminPageDtoToRows(dto, page));
        const meta = readPageMeta(dto);
        setTotalElements(meta.totalElements);
        setTotalPages(meta.totalPages);
      } catch (e) {
        if (!alive) return;
        if (e?.name === 'AbortError') return;
        setRows([]);
        setTotalElements(null);
        setTotalPages(null);
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [page, size, activeOnly]);

  const formattedTotal = useMemo(() => formatInteger(totalElements), [totalElements]);
  const showingFrom = totalElements == null ? 0 : page * size + (rows.length > 0 ? 1 : 0);
  const showingTo = totalElements == null ? rows.length : page * size + rows.length;
  const canPrev = page > 0 && !loading;
  const canNext =
    !loading && (typeof totalPages === 'number' ? page + 1 < totalPages : rows.length === size);
  const visiblePages = useMemo(
    () => getVisiblePages({ page, totalPages, maxButtons: 3 }),
    [page, totalPages]
  );

  const handleApprove = async (id) => {
    setActionBusyId(id);
    try {
      const res = await patchAdminReviewActivate(id);
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const refresh = await listAdminReviews({ page, size, activeOnly });
      if (refresh.ok) {
        const dto = await refresh.json();
        setRows(mapAdminPageDtoToRows(dto, page));
        const meta = readPageMeta(dto);
        setTotalElements(meta.totalElements);
        setTotalPages(meta.totalPages);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleReject = async (id) => {
    setActionBusyId(id);
    try {
      const res = await patchAdminReviewDeactivate(id);
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const refresh = await listAdminReviews({ page, size, activeOnly });
      if (refresh.ok) {
        const dto = await refresh.json();
        setRows(mapAdminPageDtoToRows(dto, page));
        const meta = readPageMeta(dto);
        setTotalElements(meta.totalElements);
        setTotalPages(meta.totalPages);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <div className="moderation-page">
      <h2 className="moderation-main-title">Content Moderation Queue</h2>

      <div className="moderation-toolbar" aria-label="Moderation queue controls">
        <div className="moderation-toolbar-count">
          <span>
            Reviews (
            {loading && formattedTotal == null ? 'Loading…' : formattedTotal ?? '—'})
          </span>
        </div>
        <span className="moderation-toolbar-meta">
          Filter:{' '}
          <button
            type="button"
            onClick={() => {
              setPage(0);
              setActiveOnly((v) => !v);
            }}
            disabled={loading}
            aria-label="Toggle active-only filter"
          >
            {activeOnly ? 'Active only' : 'All'} ⌄
          </button>
        </span>
        <span className="moderation-toolbar-meta">Approve / Reject</span>
      </div>

      {error && (
        <div role="alert" style={{ margin: '12px 0' }}>
          Failed to load reviews: {error}
        </div>
      )}

      {loading ? (
        <div className="moderation-loading" aria-live="polite" aria-busy="true">
          <img src={loadingDots} alt="Loading" />
          <div className="moderation-loading-text">Loading moderation queue…</div>
        </div>
      ) : (
        <ModerationTable
          items={rows}
          onApprove={handleApprove}
          onReject={handleReject}
          actionBusyId={actionBusyId}
        />
      )}

      <footer className="moderation-footer">
        <p className="moderation-footer-summary">
          Showing {showingFrom}-{showingTo} of{' '}
          {loading && formattedTotal == null ? 'Loading…' : formattedTotal ?? '—'} reviews
        </p>
        <nav className="moderation-pagination" aria-label="Pagination">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => {
              scrollToModerationTop();
              setPage((p) => Math.max(0, p - 1));
            }}
          >
            &lt; Prev
          </button>
          {visiblePages.map((p) => (
            <button
              key={p}
              type="button"
              className={
                p === page
                  ? 'moderation-pagination-page moderation-pagination-page--active'
                  : 'moderation-pagination-page'
              }
              aria-current={p === page ? 'page' : undefined}
              disabled={loading}
              onClick={() => {
                scrollToModerationTop();
                setPage(p);
              }}
            >
              {p + 1}
            </button>
          ))}
          <button
            type="button"
            disabled={!canNext}
            onClick={() => {
              scrollToModerationTop();
              setPage((p) => p + 1);
            }}
          >
            Next &gt;
          </button>
        </nav>
      </footer>
    </div>
  );
};

export default Moderation;
