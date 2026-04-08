import '../styles/Dashboard.css';
import { useEffect, useMemo, useState } from 'react';
import { listAdminReviews, listAdminUsers } from '../api/adminApi';

const DASHBOARD_METRICS_PLACEHOLDER = [
  {
    id: 'total-users',
    label: 'Total Users',
    value: '',
    deltaPrimary: '+5.2',
    //deltaSecondary: '% this week',
    labelMultiline: false,
  },
  {
    id: 'daily-reviews',
    label: 'Daily Reviews',
    value: '',
    deltaPrimary: '+12',
    deltaSecondary: 'vs yesterday',
    labelMultiline: false,
  },
  {
    id: 'sponsored-ratio',
    label: 'Sponsored Content Ratio',
    value: '',
    deltaPrimary: null,
    deltaSecondary: null,
    labelMultiline: true,
  },
];

/** Şimdilik mock; backend gelince GET /admin/flagged-content vb. ile doldurulacak */
const MOCK_FLAGGED_CONTENT = [
  {
    id: 'fc-1',
    userHandle: '@johndoe',
    contentSnippet: '"Best product ever!!"',
    aiScoreLabel: '98% Spam',
  },
  {
    id: 'fc-2',
    userHandle: '@mark_t',
    contentSnippet: 'Suspicious Image.jpg',
    aiScoreLabel: '85% NSFW',
  },
  {
    id: 'fc-3',
    userHandle: '@sara12',
    contentSnippet: '"Click here to buy..."',
    aiScoreLabel: '92% Scam',
  },
];

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
  const [totalUsers, setTotalUsers] = useState(null);
  const [totalUsersLoading, setTotalUsersLoading] = useState(true);
  const [dailyReviewsToday, setDailyReviewsToday] = useState(null);
  const [dailyReviewsDeltaPct, setDailyReviewsDeltaPct] = useState(null);
  const [dailyReviewsLoading, setDailyReviewsLoading] = useState(true);
  const [sponsoredRatioPct, setSponsoredRatioPct] = useState(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await listAdminUsers({
          page: 0,
          size: 1,
          activeOnly: true,
          signal: controller.signal,
        });
        if (!res.ok) return;
        const dto = await res.json();
        const total = dto?.totalElements;
        if (alive) setTotalUsers(typeof total === 'number' ? total : Number(total));
      } catch {
        // ignore (keep placeholder)
      } finally {
        if (alive) setTotalUsersLoading(false);
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    (async () => {
      try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);

        let page = 0;
        let totalPages = 1;
        let todayCount = 0;
        let yesterdayCount = 0;
        let sponsoredCount = 0;
        let totalReviewsHint = null;
        let scannedReviews = 0;
        const maxPages = 25;

        while (page < totalPages && page < maxPages) {
          const res = await listAdminReviews({
            page,
            size: 100,
            activeOnly: true,
            signal: controller.signal,
          });
          if (!res.ok) return;
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
            else if (d >= yesterdayStart && d < todayStart) yesterdayCount += 1;
          }
          page += 1;
        }

        if (!alive) return;
        setDailyReviewsToday(todayCount);
        if (yesterdayCount <= 0) {
          setDailyReviewsDeltaPct(null);
        } else {
          setDailyReviewsDeltaPct(((todayCount - yesterdayCount) / yesterdayCount) * 100);
        }

        const totalForRatio =
          typeof totalReviewsHint === 'number' && totalReviewsHint >= 0
            ? totalReviewsHint
            : scannedReviews;
        if (totalForRatio > 0) {
          setSponsoredRatioPct((sponsoredCount / totalForRatio) * 100);
        } else {
          setSponsoredRatioPct(0);
        }
      } catch {
        // ignore (keep placeholder)
      } finally {
        if (alive) setDailyReviewsLoading(false);
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  const metrics = useMemo(() => {
    return DASHBOARD_METRICS_PLACEHOLDER.map((m) => {
      if (m.id === 'total-users') {
        const formatted = formatInteger(totalUsers);
        if (totalUsersLoading && formatted == null) {
          return {
            ...m,
            value: 'Loading…',
            deltaPrimary: '—',
            deltaSecondary: '',
          };
        }
        return {
          ...m,
          value: formatted ?? m.value,
          //deltaPrimary: formatted == null ? m.deltaPrimary : '—',
          deltaSecondary: formatted == null ? m.deltaSecondary : '% this week',
        };
      }
      if (m.id === 'daily-reviews') {
        const formatted = formatInteger(dailyReviewsToday);
        if (dailyReviewsLoading && formatted == null) {
          return {
            ...m,
            value: 'Loading…',
            deltaPrimary: '—',
            deltaSecondary: '',
          };
        }
        const pct = dailyReviewsDeltaPct;
        const pctLabel =
          typeof pct === 'number' && Number.isFinite(pct)
            ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`
            : '—';
        return {
          ...m,
          value: formatted ?? m.value,
          deltaPrimary: formatted == null ? m.deltaPrimary : pctLabel,
          deltaSecondary: formatted == null ? m.deltaSecondary : 'vs yesterday',
        };
      }
      if (m.id === 'sponsored-ratio') {
        if (dailyReviewsLoading && sponsoredRatioPct == null) {
          return {
            ...m,
            value: 'Loading…',
            deltaPrimary: '—',
            deltaSecondary: '',
          };
        }
        const pct =
          typeof sponsoredRatioPct === 'number' && Number.isFinite(sponsoredRatioPct)
            ? sponsoredRatioPct
            : 0;
        return {
          ...m,
          value: `${pct.toFixed(1)}% total`,
          deltaPrimary: m.deltaPrimary,
          deltaSecondary: m.deltaSecondary,
        };
      }
      return m;
    });
  }, [
    dailyReviewsDeltaPct,
    dailyReviewsLoading,
    dailyReviewsToday,
    sponsoredRatioPct,
    totalUsers,
    totalUsersLoading,
  ]);

  return (
    <div className="dashboard">
      <h2 className="dashboard-main-title">Dashboard Overview</h2>

      <section className="dashboard-stats" aria-label="Key metrics">
        {metrics.map(
          ({ id, label, value, deltaPrimary, deltaSecondary, labelMultiline }) => (
            <div key={id} className="dashboard-stat">
              <div className="dashboard-stat-chart">
                <div
                  className={
                    labelMultiline
                      ? 'dashboard-stat-label dashboard-stat-label--multiline'
                      : 'dashboard-stat-label'
                  }
                >
                  {label}
                </div>
                {value != null && (
                  <div className="dashboard-stat-value">{value}</div>
                )}
                <div
                  className={
                    value == null
                      ? 'dashboard-stat-delta dashboard-stat-delta--trailing'
                      : 'dashboard-stat-delta'
                  }
                >
                  <span>{deltaPrimary}</span>
                  <span>{deltaSecondary}</span>
                </div>
              </div>
            </div>
          )
        )}
      </section>

      <h3 className="dashboard-section-title">Action Required: AI-Flagged Content</h3>

      <section className="dashboard-flagged" aria-label="Flagged content">
        <div className="dashboard-flagged-scroll">
          <table className="dashboard-flagged-table">
            <colgroup>
              <col className="dashboard-flagged-col dashboard-flagged-col--user" />
              <col className="dashboard-flagged-col dashboard-flagged-col--snippet" />
              <col className="dashboard-flagged-col dashboard-flagged-col--score" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Content Snippet</th>
                <th scope="col">AI Score</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_FLAGGED_CONTENT.map(
                ({ id, userHandle, contentSnippet, aiScoreLabel }) => (
                  <tr key={id}>
                    <td>{userHandle}</td>
                    <td className="dashboard-flagged-cell-snippet">{contentSnippet}</td>
                    <td>{aiScoreLabel}</td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
