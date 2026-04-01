import '../styles/Users.css';
import UserTable from '../components/UserTable';
import { useEffect, useMemo, useState } from 'react';
import { listAdminUsers } from '../api/adminApi';
import loadingDots from '../assets/loading-dots.svg';

function formatInteger(value) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function toStatusLabel(user) {
  const active = user?.active ?? user?.isActive;
  if (active === true) return '🟢 Active';
  if (active === false) return '🔴 Suspend';
  return '—';
}

function toUsernameLabel(user) {
  const raw = user?.userName ?? user?.username ?? user?.handle ?? user?.name;
  if (!raw) return '—';
  return String(raw).startsWith('@') ? String(raw) : `@${raw}`;
}

function toEmailLabel(user) {
  const raw = user?.email ?? user?.mail;
  return raw ? String(raw) : '—';
}

function scrollToUsersTop() {
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

const Users = () => {
  const [page, setPage] = useState(0);
  const [size] = useState(15);
  const [filter, setFilter] = useState('all'); // 'all' | 'active'
  const [users, setUsers] = useState([]);
  const [totalElements, setTotalElements] = useState(null);
  const [totalPages, setTotalPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    scrollToUsersTop();
    (async () => {
      try {
        const res = await listAdminUsers({
          page,
          size,
          activeOnly: filter === 'active',
          signal: controller.signal,
        });
        if (!res.ok) {
          const msg = `Request failed (${res.status})`;
          throw new Error(msg);
        }
        const dto = await res.json();
        const content = Array.isArray(dto?.content) ? dto.content : [];
        const mapped = content.map((u, idx) => {
          const idRaw = u?.id ?? u?.userId ?? u?.uid ?? `${page}-${idx}`;
          return {
            id: String(idRaw),
            username: toUsernameLabel(u),
            email: toEmailLabel(u),
            status: toStatusLabel(u),
          };
        });

        if (!alive) return;
        setUsers(mapped);
        setTotalElements(
          typeof dto?.totalElements === 'number'
            ? dto.totalElements
            : dto?.totalElements != null
              ? Number(dto.totalElements)
              : null
        );
        setTotalPages(
          typeof dto?.totalPages === 'number'
            ? dto.totalPages
            : dto?.totalPages != null
              ? Number(dto.totalPages)
              : null
        );
      } catch (e) {
        if (!alive) return;
        setUsers([]);
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
  }, [filter, page, size]);

  const formattedTotal = useMemo(() => formatInteger(totalElements), [totalElements]);
  const showingFrom = totalElements == null ? 0 : page * size + (users.length > 0 ? 1 : 0);
  const showingTo = totalElements == null ? users.length : page * size + users.length;
  const canPrev = page > 0 && !loading;
  const canNext =
    !loading && (typeof totalPages === 'number' ? page + 1 < totalPages : users.length === size);
  const visiblePages = useMemo(
    () => getVisiblePages({ page, totalPages, maxButtons: 3 }),
    [page, totalPages]
  );

  return (
    <div className="users-page">
      <h2 className="users-main-title">User Management</h2>

      <div className="users-toolbar" aria-label="User list controls">
        <div className="users-toolbar-count">
          <span>
            {filter === 'active' ? 'Active Users' : 'All Users'} (
            {loading && formattedTotal == null ? 'Loading…' : formattedTotal ?? '—'})
          </span>
        </div>
        <span className="users-toolbar-meta">
          Filter:{' '}
          <button
            type="button"
            onClick={() => {
              setPage(0);
              setFilter((v) => (v === 'all' ? 'active' : 'all'));
            }}
            disabled={loading}
            aria-label="Toggle user filter"
          >
            {filter === 'active' ? 'Active' : 'All'} ⌄
          </button>
        </span>
        <span className="users-toolbar-meta">Export Data ⬇</span>
      </div>

      {error && (
        <div role="alert" style={{ margin: '12px 0' }}>
          Failed to load users: {error}
        </div>
      )}

      {loading ? (
        <div className="users-loading" aria-live="polite" aria-busy="true">
          <img src={loadingDots} alt="Loading" />
          <div className="users-loading-text">Loading users…</div>
        </div>
      ) : (
        <UserTable users={users} />
      )}

      <footer className="users-footer">
        <p className="users-footer-summary">
          Showing {showingFrom}-{showingTo} of{' '}
          {loading && formattedTotal == null ? 'Loading…' : formattedTotal ?? '—'} users
        </p>
        <nav className="users-pagination" aria-label="Pagination">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => {
              scrollToUsersTop();
              setPage((p) => Math.max(0, p - 1));
            }}
          >
            &lt; Prev
          </button>
          {visiblePages.map((p) => (
            <button
              key={p}
              type="button"
              className={p === page ? 'users-pagination-page users-pagination-page--active' : 'users-pagination-page'}
              aria-current={p === page ? 'page' : undefined}
              disabled={loading}
              onClick={() => {
                scrollToUsersTop();
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
              scrollToUsersTop();
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

export default Users;
