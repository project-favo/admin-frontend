import '../styles/Users.css';
import TablePagination from '../components/TablePagination';
import UserTable from '../components/UserTable';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchAllAdminUsers,
  listAdminUsers,
  patchAdminUserActivate,
  patchAdminUserDeactivate,
} from '../api/adminApi';
import { mapAdminUserDtoToTableRow } from '../utils/adminUserRows';
import { downloadUsersPdf } from '../utils/usersPdfExport';
import { getTablePageSize } from '../utils/adminPreferences';
import loadingDots from '../assets/loading-dots.svg';

function formatInteger(value) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

/** Spring Page: totalElements / totalPages (camelCase, snake_case veya total) */
function parseSpringPageMeta(dto) {
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

const USERS_POLL_MS = 5000;

const Users = () => {
  const [page, setPage] = useState(0);
  const [size] = useState(() => getTablePageSize());
  const [filter, setFilter] = useState('all'); // 'all' | 'active'
  const [users, setUsers] = useState([]);
  const [totalElements, setTotalElements] = useState(null);
  const [totalPages, setTotalPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [pollTick, setPollTick] = useState(0);
  const pollSilentRef = useRef(false);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [exporting, setExporting] = useState(false);

  /** @param {string} userId @param {'activate' | 'suspend'} action */
  async function handleUserAction(userId, action) {
    setActionFeedback(null);
    try {
      let res;
      if (action === 'activate') {
        res = await patchAdminUserActivate(userId);
      } else {
        res = await patchAdminUserDeactivate(userId);
      }
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(body.trim() || `Request failed (${res.status})`);
      }
      const label = action === 'activate' ? 'activated' : 'suspended';
      setActionFeedback({ ok: true, message: `User ${label}.` });
      setListRefreshKey((k) => k + 1);
    } catch (e) {
      setActionFeedback({
        ok: false,
        message: e instanceof Error ? e.message : 'Action failed.',
      });
      throw e;
    }
  }

  useEffect(() => {
    const t = window.setInterval(() => {
      pollSilentRef.current = true;
      setPollTick((n) => n + 1);
    }, USERS_POLL_MS);
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
    }

    (async () => {
      try {
        const res = await listAdminUsers({
          page,
          size,
          activeOnly: filter === 'active',
          inactiveOnly: false,
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!res.ok) {
          const msg = `Request failed (${res.status})`;
          throw new Error(msg);
        }
        const dto = await res.json();
        if (cancelled) return;
        const content = Array.isArray(dto?.content) ? dto.content : [];
        const rowsForTable = content.map((u, idx) => mapAdminUserDtoToTableRow(u, idx, page));

        const { totalElements: nextTotalElements, totalPages: nextTotalPages } =
          parseSpringPageMeta(dto);

        if (cancelled) return;
        setError(null);
        setUsers(rowsForTable);
        setTotalElements(nextTotalElements);
        setTotalPages(nextTotalPages);
      } catch (e) {
        if (cancelled) return;
        if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') return;
        setUsers([]);
        setTotalElements(null);
        setTotalPages(null);
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        // Poll yenilemeleri `silent` olsa da, önceki istek iptal edildiyse loading açık kalmasın
        // (yavaş sayfalarda poll, tamamlanmamış isteği keser; aksi halde spinner takılır).
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filter, page, size, listRefreshKey, pollTick]);

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
  const showingFrom = users.length === 0 ? 0 : page * size + 1;
  const showingTo = page * size + users.length;
  const canPrev = page > 0 && !loading;
  const canNext =
    !loading && (typeof totalPages === 'number' ? page + 1 < totalPages : users.length === size);
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
      const dtos = await fetchAllAdminUsers({
        activeOnly: filter === 'active',
        inactiveOnly: false,
      });
      const rows = dtos.map((u, idx) => mapAdminUserDtoToTableRow(u, idx, 0));
      const filterLabel = filter === 'active' ? 'Active only' : 'All users';
      downloadUsersPdf({
        rows: rows.map(({ username, email, statusLabel }) => ({ username, email, statusLabel })),
        filterLabel,
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

  return (
    <div className="users-page">
      <div className="users-page-inner">
        <header className="users-header">
          <h2 className="users-main-title">User management</h2>
          <p className="users-subtitle">
            View accounts, filter by active status, and suspend or reactivate users.
          </p>
        </header>

        <div className="users-toolbar" aria-label="User list controls">
          <div
            className="users-total-pill"
            title={filter === 'active' ? 'Total active accounts' : 'Total accounts (all statuses)'}
          >
            <span className="users-total-pill-label">
              {filter === 'active' ? 'Active' : 'All'} users
            </span>
            <span className="users-total-pill-value" aria-live="polite">
              {loading && formattedTotal == null ? '…' : formattedTotal ?? '—'}
            </span>
          </div>
          <div
            className="users-filter-segment"
            role="group"
            aria-label="Filter by account status"
          >
            <button
              type="button"
              className={
                filter === 'all'
                  ? 'users-filter-segment-btn users-filter-segment-btn--active'
                  : 'users-filter-segment-btn'
              }
              onClick={() => {
                if (filter === 'all') return;
                setPage(0);
                setFilter('all');
              }}
              disabled={loading}
            >
              All
            </button>
            <button
              type="button"
              className={
                filter === 'active'
                  ? 'users-filter-segment-btn users-filter-segment-btn--active'
                  : 'users-filter-segment-btn'
              }
              onClick={() => {
                if (filter === 'active') return;
                setPage(0);
                setFilter('active');
              }}
              disabled={loading}
            >
              Active only
            </button>
          </div>
          <button
            type="button"
            className="users-toolbar-export"
            title="Download PDF of all users matching the current filter"
            onClick={handleExportPdf}
            disabled={loading || exporting}
          >
            {exporting ? 'Exporting…' : 'Export'}
          </button>
        </div>

        {error && (
          <div className="users-alert users-alert--error" role="alert">
            Failed to load users: {error}
          </div>
        )}

        {actionFeedback && (
          <div
            className={
              actionFeedback.ok ? 'users-alert users-alert--success' : 'users-alert users-alert--error'
            }
            role="status"
          >
            {actionFeedback.message}
          </div>
        )}

        {loading ? (
          <div className="users-loading" aria-live="polite" aria-busy="true">
            <img src={loadingDots} alt="" />
            <div className="users-loading-text">Loading users…</div>
          </div>
        ) : !error && users.length === 0 ? (
          <div className="users-empty" role="status">
            <p className="users-empty-title">No users to show</p>
            <p className="users-empty-hint">
              {filter === 'active'
                ? 'There are no active users matching this filter.'
                : 'No user records were returned for this page.'}
            </p>
          </div>
        ) : !error ? (
          <>
            <div className="users-pagination-bar users-pagination-bar--top">
              <TablePagination
                ariaLabel="User list pages (top)"
                statusText={pageStatusText}
                canPrev={canPrev}
                canNext={canNext}
                onPrev={goPrev}
                onNext={goNext}
              />
            </div>
            <UserTable users={users} onUserAction={handleUserAction} />
          </>
        ) : null}

        <footer className="users-footer">
          <p className="users-footer-summary">
            Showing {showingFrom}-{showingTo} of{' '}
            {loading && formattedTotal == null ? '…' : formattedTotal ?? '—'} users
          </p>
          <div className="users-pagination-bar users-pagination-bar--bottom">
            <TablePagination
              ariaLabel="User list pages (bottom)"
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

export default Users;
