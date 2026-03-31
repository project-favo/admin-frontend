import '../styles/Dashboard.css';
import { useEffect, useMemo, useState } from 'react';
import { listAdminUsers } from '../api/adminApi';

const DASHBOARD_METRICS_PLACEHOLDER = [
  {
    id: 'total-users',
    label: 'Total Users',
    value: '',
    deltaPrimary: '+5.2',
    deltaSecondary: '% this week',
    labelMultiline: false,
  },
  {
    id: 'daily-reviews',
    label: 'Daily Reviews',
    value: '845',
    deltaPrimary: '+12',
    deltaSecondary: '% this week',
    labelMultiline: false,
  },
  {
    id: 'sponsored-ratio',
    label: 'Sponsored Content Ratio',
    value: '18' + '% total',
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

const Dashboard = () => {
  const [totalUsers, setTotalUsers] = useState(null);
  const [totalUsersLoading, setTotalUsersLoading] = useState(true);

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

  const metrics = useMemo(() => {
    return DASHBOARD_METRICS_PLACEHOLDER.map((m) => {
      if (m.id !== 'total-users') return m;
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
        deltaPrimary: formatted == null ? m.deltaPrimary : '—',
        deltaSecondary: formatted == null ? m.deltaSecondary : '% this week',
      };
    });
  }, [totalUsers, totalUsersLoading]);

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
