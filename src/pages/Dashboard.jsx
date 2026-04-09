import '../styles/Dashboard.css';
import { useEffect, useRef, useState } from 'react';
import { listAdminProducts, listAdminReviews, listAdminUsers } from '../api/adminApi';

const DASHBOARD_POLL_MS = 5000;

function MiniStatLoading() {
  return (
    <span className="dashboard-bounce-dots" aria-hidden="true">
      <span className="dashboard-bounce-dots-dot" />
      <span className="dashboard-bounce-dots-dot" />
      <span className="dashboard-bounce-dots-dot" />
    </span>
  );
}

function formatInteger(value) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

/** Backend: isCollaborative; ileride isSponsored eklenirse öncelikli kullanılır */
function isReviewSponsoredLike(r) {
  if (!r || typeof r !== 'object') return false;
  const v =
    r.isSponsored ??
    r.sponsored ??
    r.is_sponsored ??
    r.isCollaborative ??
    r.is_collaborative;
  return v === true || v === 'true' || v === 1;
}

const Dashboard = () => {
  const [userCountTotal, setUserCountTotal] = useState(null);
  const [userCountActive, setUserCountActive] = useState(null);
  const [usersMiniLoading, setUsersMiniLoading] = useState(true);
  const [productCountTotal, setProductCountTotal] = useState(null);
  const [productCountActive, setProductCountActive] = useState(null);
  const [productsMiniLoading, setProductsMiniLoading] = useState(true);
  const [reviewCountTotal, setReviewCountTotal] = useState(null);
  const [dailyReviewsToday, setDailyReviewsToday] = useState(null);
  const [sponsoredRatioPct, setSponsoredRatioPct] = useState(null);
  const [reviewsMiniLoading, setReviewsMiniLoading] = useState(true);

  const usersLoadingSettled = useRef(false);
  const productsLoadingSettled = useRef(false);
  const reviewsLoadingSettled = useRef(false);
  const pollInFlight = useRef(false);

  useEffect(() => {
    let alive = true;
    let currentPollAbort = null;

    async function fetchUsers(signal) {
      try {
        const [resAll, resActive] = await Promise.all([
          listAdminUsers({
            page: 0,
            size: 1,
            activeOnly: false,
            signal,
          }),
          listAdminUsers({
            page: 0,
            size: 1,
            activeOnly: true,
            signal,
          }),
        ]);
        if (!alive) return;
        if (resAll.ok) {
          const dto = await resAll.json();
          const t = dto?.totalElements;
          const n = typeof t === 'number' ? t : Number(t);
          if (alive) setUserCountTotal(Number.isFinite(n) ? n : null);
        }
        if (resActive.ok) {
          const dto = await resActive.json();
          const t = dto?.totalElements;
          const n = typeof t === 'number' ? t : Number(t);
          if (alive) setUserCountActive(Number.isFinite(n) ? n : null);
        }
      } catch {
        // ignore
      } finally {
        if (alive && !usersLoadingSettled.current) {
          usersLoadingSettled.current = true;
          setUsersMiniLoading(false);
        }
      }
    }

    async function fetchProducts(signal) {
      try {
        const [resAll, resActive] = await Promise.all([
          listAdminProducts({
            page: 0,
            size: 1,
            activeOnly: false,
            signal,
          }),
          listAdminProducts({
            page: 0,
            size: 1,
            activeOnly: true,
            signal,
          }),
        ]);
        if (!alive) return;
        if (resAll.ok) {
          const dto = await resAll.json();
          const t = dto?.totalElements;
          const n = typeof t === 'number' ? t : Number(t);
          if (alive) setProductCountTotal(Number.isFinite(n) ? n : null);
        }
        if (resActive.ok) {
          const dto = await resActive.json();
          const t = dto?.totalElements;
          const n = typeof t === 'number' ? t : Number(t);
          if (alive) setProductCountActive(Number.isFinite(n) ? n : null);
        }
      } catch {
        // ignore
      } finally {
        if (alive && !productsLoadingSettled.current) {
          productsLoadingSettled.current = true;
          setProductsMiniLoading(false);
        }
      }
    }

    async function fetchReviews(signal) {
      try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);

        let page = 0;
        let totalPages = 1;
        let todayCount = 0;
        let sponsoredCount = 0;
        let totalReviewsHint = null;
        let scannedReviews = 0;
        const maxPages = 25;

        while (page < totalPages && page < maxPages) {
          const res = await listAdminReviews({
            page,
            size: 100,
            activeOnly: true,
            signal,
          });
          if (!res.ok) break;
          const dto = await res.json();
          totalPages = Number(dto?.totalPages ?? totalPages);
          const content = Array.isArray(dto?.content) ? dto.content : [];
          if (page === 0 && dto?.totalElements != null) {
            const te = Number(dto.totalElements);
            if (Number.isFinite(te)) totalReviewsHint = te;
          }
          scannedReviews += content.length;

          for (const r of content) {
            if (isReviewSponsoredLike(r)) sponsoredCount += 1;
            const raw = r?.createdAt ?? r?.created_at ?? r?.createdDate ?? r?.created_date;
            if (!raw) continue;
            const d = raw instanceof Date ? raw : new Date(raw);
            if (Number.isNaN(d.getTime())) continue;
            if (d >= todayStart && d < tomorrowStart) todayCount += 1;
          }
          page += 1;
        }

        if (!alive) return;
        setDailyReviewsToday(todayCount);

        const totalForRatio =
          typeof totalReviewsHint === 'number' && totalReviewsHint >= 0
            ? totalReviewsHint
            : scannedReviews;
        if (alive) {
          setReviewCountTotal(
            typeof totalForRatio === 'number' && totalForRatio >= 0 ? totalForRatio : null
          );
        }
        if (totalForRatio > 0) {
          setSponsoredRatioPct((sponsoredCount / totalForRatio) * 100);
        } else {
          setSponsoredRatioPct(0);
        }
      } catch {
        // ignore
      } finally {
        if (alive && !reviewsLoadingSettled.current) {
          reviewsLoadingSettled.current = true;
          setReviewsMiniLoading(false);
        }
      }
    }

    async function poll() {
      if (!alive || pollInFlight.current) return;
      pollInFlight.current = true;
      currentPollAbort?.abort();
      const controller = new AbortController();
      currentPollAbort = controller;
      const { signal } = controller;
      try {
        await Promise.all([fetchUsers(signal), fetchProducts(signal), fetchReviews(signal)]);
      } catch {
        // aborted veya ağ hatası — state güncellemesi fetch içinde korunuyor
      } finally {
        pollInFlight.current = false;
        if (currentPollAbort === controller) currentPollAbort = null;
      }
    }

    poll();
    const intervalId = window.setInterval(poll, DASHBOARD_POLL_MS);

    return () => {
      alive = false;
      currentPollAbort?.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  const suspendedUsers =
    userCountTotal != null && userCountActive != null
      ? Math.max(0, userCountTotal - userCountActive)
      : null;

  const inactiveProducts =
    productCountTotal != null && productCountActive != null
      ? Math.max(0, productCountTotal - productCountActive)
      : null;

  return (
    <div className="dashboard">
      <div className="dashboard-inner">
        <header className="dashboard-header">
          <h2 className="dashboard-main-title">Dashboard Overview</h2>
        </header>

        <nav className="dashboard-pillar-headings" aria-label="Dashboard areas">
        <div className="dashboard-pillar-block dashboard-section">
          <h3 className="dashboard-pillar-title">Users</h3>
          <div
            className="dashboard-user-mini-stats"
            role="group"
            aria-label="User counts"
          >
            <div className="dashboard-mini-stat">
              <div className="dashboard-mini-stat-label">Total Users</div>
              <div className="dashboard-mini-stat-value">
                {usersMiniLoading && userCountTotal == null ? (
                  <MiniStatLoading />
                ) : (
                  formatInteger(userCountTotal) ?? '—'
                )}
              </div>
            </div>
            <div className="dashboard-mini-stat">
              <div className="dashboard-mini-stat-label">Active Users</div>
              <div className="dashboard-mini-stat-value">
                {usersMiniLoading && userCountActive == null ? (
                  <MiniStatLoading />
                ) : (
                  formatInteger(userCountActive) ?? '—'
                )}
              </div>
            </div>
            <div className="dashboard-mini-stat">
              <div className="dashboard-mini-stat-label">Suspended Users</div>
              <div className="dashboard-mini-stat-value">
                {usersMiniLoading && suspendedUsers == null ? (
                  <MiniStatLoading />
                ) : (
                  formatInteger(suspendedUsers) ?? '—'
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="dashboard-pillar-block dashboard-section">
          <h3 className="dashboard-pillar-title">Products</h3>
          <div
            className="dashboard-user-mini-stats"
            role="group"
            aria-label="Product counts"
          >
            <div className="dashboard-mini-stat">
              <div className="dashboard-mini-stat-label">Total Products</div>
              <div className="dashboard-mini-stat-value">
                {productsMiniLoading && productCountTotal == null ? (
                  <MiniStatLoading />
                ) : (
                  formatInteger(productCountTotal) ?? '—'
                )}
              </div>
            </div>
            <div className="dashboard-mini-stat">
              <div className="dashboard-mini-stat-label">Active Products</div>
              <div className="dashboard-mini-stat-value">
                {productsMiniLoading && productCountActive == null ? (
                  <MiniStatLoading />
                ) : (
                  formatInteger(productCountActive) ?? '—'
                )}
              </div>
            </div>
            <div className="dashboard-mini-stat">
              <div className="dashboard-mini-stat-label">Inactive Products</div>
              <div className="dashboard-mini-stat-value">
                {productsMiniLoading && inactiveProducts == null ? (
                  <MiniStatLoading />
                ) : (
                  formatInteger(inactiveProducts) ?? '—'
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="dashboard-pillar-block dashboard-section">
          <h3 className="dashboard-pillar-title">Reviews</h3>
          <div
            className="dashboard-user-mini-stats"
            role="group"
            aria-label="Review metrics"
          >
            <div className="dashboard-mini-stat">
              <div className="dashboard-mini-stat-label">Total Reviews</div>
              <div className="dashboard-mini-stat-value">
                {reviewsMiniLoading && reviewCountTotal == null ? (
                  <MiniStatLoading />
                ) : (
                  formatInteger(reviewCountTotal) ?? '—'
                )}
              </div>
            </div>
            <div className="dashboard-mini-stat">
              <div className="dashboard-mini-stat-label">Sponsored Content Ratio</div>
              <div className="dashboard-mini-stat-value">
                {reviewsMiniLoading && sponsoredRatioPct == null ? (
                  <MiniStatLoading />
                ) : typeof sponsoredRatioPct === 'number' && Number.isFinite(sponsoredRatioPct) ? (
                  `${sponsoredRatioPct.toFixed(1)}%`
                ) : (
                  '—'
                )}
              </div>
            </div>
            <div className="dashboard-mini-stat">
              <div className="dashboard-mini-stat-label">Today&apos;s Reviews</div>
              <div className="dashboard-mini-stat-value">
                {reviewsMiniLoading ? (
                  <MiniStatLoading />
                ) : (
                  formatInteger(dailyReviewsToday) ?? '—'
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>
      </div>
    </div>
  );
};

export default Dashboard;
