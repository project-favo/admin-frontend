import '../styles/Dashboard.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  listAdminProducts,
  listAdminReviews,
  listAdminUsers,
  normalizeAdminPageDto,
} from '../api/adminApi';

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

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.min(1, Math.max(0, x));
}

/** İncelemeler: sponsor / organik oranı (aktif incelemeler üzerinden) */
function SponsoredDonut({ pctSponsored, loading }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const p = typeof pctSponsored === 'number' && Number.isFinite(pctSponsored) ? clamp01(pctSponsored / 100) : 0;
  const dash = p * c;
  const gap = c - dash;
  const organicPct =
    typeof pctSponsored === 'number' && Number.isFinite(pctSponsored)
      ? Math.max(0, 100 - pctSponsored)
      : null;

  return (
    <div className="dashboard-viz-donut-wrap">
      <div className="dashboard-viz-donut" role="img" aria-label="Sponsored share donut chart">
        <svg viewBox="0 0 100 100" className="dashboard-viz-donut-svg" aria-hidden="true">
          <circle className="dashboard-viz-donut-ring-bg" cx="50" cy="50" r={r} />
          <circle
            className="dashboard-viz-donut-ring-fg"
            cx="50"
            cy="50"
            r={r}
            strokeDasharray={`${dash} ${gap}`}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="dashboard-viz-donut-center">
          {loading ? (
            <MiniStatLoading />
          ) : (
            <>
              <span className="dashboard-viz-donut-pct">
                {typeof pctSponsored === 'number' && Number.isFinite(pctSponsored)
                  ? `${pctSponsored.toFixed(1)}%`
                  : '—'}
              </span>
              <span className="dashboard-viz-donut-caption">sponsored / collab.</span>
            </>
          )}
        </div>
      </div>
      <ul className="dashboard-viz-donut-legend" aria-hidden="true">
        <li className="dashboard-viz-donut-legend-item">
          <span className="dashboard-viz-donut-legend-swatch dashboard-viz-donut-legend-swatch--accent" />
          <span className="dashboard-viz-donut-legend-label">Sponsored or collaborative</span>
        </li>
        <li className="dashboard-viz-donut-legend-item">
          <span className="dashboard-viz-donut-legend-swatch dashboard-viz-donut-legend-swatch--muted" />
          <span className="dashboard-viz-donut-legend-label">
            Organic
            {organicPct != null ? ` (${organicPct.toFixed(1)}%)` : ''}
          </span>
        </li>
      </ul>
    </div>
  );
}

function SnapshotCard({ title, value, valueLoading, detail, detailLoading }) {
  return (
    <article className="dashboard-snap-card">
      <h3 className="dashboard-snap-title">{title}</h3>
      <div className="dashboard-snap-value" aria-live="polite">
        {valueLoading ? <MiniStatLoading /> : value ?? '—'}
      </div>
      <p className="dashboard-snap-detail">
        {detailLoading ? <MiniStatLoading /> : detail ?? '\u00a0'}
      </p>
    </article>
  );
}

/** Son 7 gün (bugün dahil) günlük inceleme sayıları — listelerden örneklenmiş veri */
function ReviewActivityBars({ buckets, dayLabels, loading, cappedNote }) {
  const max = Math.max(1, ...buckets.map((n) => (Number.isFinite(n) ? n : 0)));

  return (
    <div className="dashboard-viz-activity">
      <div className="dashboard-viz-activity-head">
        <div className="dashboard-viz-activity-head-text">
          <span className="dashboard-viz-activity-title">Daily volume</span>
          <span className="dashboard-viz-activity-sub">Last 7 days · rightmost is today</span>
        </div>
      </div>
      <div
        className="dashboard-viz-activity-chart"
        role="img"
        aria-label="Bar chart of review counts for the last seven days"
      >
        {loading
          ? Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="dashboard-viz-activity-col">
                <span className="dashboard-viz-activity-value dashboard-viz-activity-value--skeleton" aria-hidden="true">
                  ··
                </span>
                <div className="dashboard-viz-activity-bar dashboard-viz-activity-bar--skeleton" />
                <span className="dashboard-viz-activity-tick">·</span>
              </div>
            ))
          : buckets.map((n, i) => {
              const count = Number.isFinite(n) ? n : 0;
              const h = clamp01(count / max) * 100;
              return (
                <div key={dayLabels[i] ?? i} className="dashboard-viz-activity-col">
                  <span className="dashboard-viz-activity-value" title={`${dayLabels[i]}: ${count}`}>
                    {formatInteger(count) ?? '0'}
                  </span>
                  <div
                    className="dashboard-viz-activity-bar"
                    style={{ height: `${h}%` }}
                    aria-hidden="true"
                  />
                  <span className="dashboard-viz-activity-tick">{dayLabels[i]}</span>
                </div>
              );
            })}
      </div>
      {cappedNote ? <p className="dashboard-viz-hint">{cappedNote}</p> : null}
    </div>
  );
}

/** Ürün → leaf kategori etiketi (Products.jsx toCategoryLabel ile uyumlu) */
function categoryLabelFromProduct(p) {
  const tag = p?.tag;
  if (tag && typeof tag === 'object') {
    const path = tag.categoryPath;
    const name = tag.name;
    if (path != null && String(path).trim() !== '') return String(path).trim();
    if (name != null && String(name).trim() !== '') return String(name).trim();
  }
  return 'Uncategorized';
}

const TOPIC_BAR_HUES = [200, 328, 152, 42, 265, 12, 95, 220, 55, 310];

function TopicRankedBars({ title, sub, rows, loading, emptyHint, cappedHint }) {
  const max = Math.max(1, ...rows.map((r) => (Number.isFinite(r.count) ? r.count : 0)));

  return (
    <div className="dashboard-topic-panel">
      <div className="dashboard-viz-block-head">
        <span className="dashboard-viz-block-title">{title}</span>
        <span className="dashboard-viz-block-sub">{sub}</span>
      </div>
      {loading ? (
        <div className="dashboard-topic-list dashboard-topic-list--loading" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="dashboard-topic-row">
              <div className="dashboard-topic-skeleton-label" />
              <div className="dashboard-topic-track">
                <div className="dashboard-topic-skeleton-bar" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="dashboard-viz-hint dashboard-topic-empty">{emptyHint}</p>
      ) : (
        <ul className="dashboard-topic-list" role="list">
          {rows.map((row, i) => {
            const n = Number.isFinite(row.count) ? row.count : 0;
            const pct = clamp01(n / max) * 100;
            const hue = TOPIC_BAR_HUES[i % TOPIC_BAR_HUES.length];
            return (
              <li key={`${row.label}-${i}`} className="dashboard-topic-row">
                <div className="dashboard-topic-meta">
                  <span className="dashboard-topic-label" title={row.label}>
                    {row.label}
                  </span>
                  <span className="dashboard-topic-count">{formatInteger(n)}</span>
                </div>
                <div className="dashboard-topic-track">
                  <div
                    className="dashboard-topic-bar"
                    style={{
                      width: `${pct}%`,
                      background: `hsl(${hue} 52% 40%)`,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {cappedHint ? <p className="dashboard-viz-hint dashboard-topic-capped">{cappedHint}</p> : null}
    </div>
  );
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
  const [sponsoredRatioPct, setSponsoredRatioPct] = useState(null);
  const [reviewsMiniLoading, setReviewsMiniLoading] = useState(true);
  const [reviewLast7Days, setReviewLast7Days] = useState(() => Array(7).fill(0));
  const [reviewsSampleCapped, setReviewsSampleCapped] = useState(false);
  const [topicTotals, setTopicTotals] = useState(/** @type {{ label: string, count: number }[]} */ ([]));
  const [topicNew7d, setTopicNew7d] = useState(/** @type {{ label: string, count: number }[]} */ ([]));
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsSampleCapped, setTopicsSampleCapped] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(/** @type {Date | null} */ (null));

  const usersLoadingSettled = useRef(false);
  const productsLoadingSettled = useRef(false);
  const reviewsLoadingSettled = useRef(false);
  const topicsLoadingSettled = useRef(false);
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
          const { totalElements: t } = normalizeAdminPageDto(dto);
          const n = typeof t === 'number' ? t : Number(t);
          if (alive) setUserCountTotal(Number.isFinite(n) ? n : null);
        }
        if (resActive.ok) {
          const dto = await resActive.json();
          const { totalElements: t } = normalizeAdminPageDto(dto);
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
          const { totalElements: t } = normalizeAdminPageDto(dto);
          const n = typeof t === 'number' ? t : Number(t);
          if (alive) setProductCountTotal(Number.isFinite(n) ? n : null);
        }
        if (resActive.ok) {
          const dto = await resActive.json();
          const { totalElements: t } = normalizeAdminPageDto(dto);
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

    function mapToTopRows(map, limit) {
      return [...map.entries()]
        .map(([label, count]) => ({ label, count: Number(count) || 0 }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    }

    async function fetchProductTopics(signal) {
      try {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        const rangeStart7 = new Date(todayStart);
        rangeStart7.setDate(rangeStart7.getDate() - 6);

        let page = 0;
        let totalPages = 1;
        const maxPages = 18;
        const pageSize = 100;
        const categoryTotal = new Map();
        const categoryNew7d = new Map();

        while (page < totalPages && page < maxPages) {
          const res = await listAdminProducts({
            page,
            size: pageSize,
            activeOnly: true,
            signal,
          });
          if (!res.ok) break;
          const dto = await res.json();
          const norm = normalizeAdminPageDto(dto);
          totalPages = Number(norm.totalPages ?? totalPages);
          const content = norm.content;

          for (const p of content) {
            const label = categoryLabelFromProduct(p);
            categoryTotal.set(label, (categoryTotal.get(label) ?? 0) + 1);
            const raw = p?.createdAt ?? p?.created_at;
            if (raw) {
              const d = raw instanceof Date ? raw : new Date(raw);
              if (!Number.isNaN(d.getTime()) && d >= rangeStart7 && d < tomorrowStart) {
                categoryNew7d.set(label, (categoryNew7d.get(label) ?? 0) + 1);
              }
            }
          }
          page += 1;
        }

        const tpSafe = Number(totalPages);
        const hitPageCap =
          page >= maxPages && Number.isFinite(tpSafe) && tpSafe > maxPages;

        if (!alive) return;
        setTopicTotals(mapToTopRows(categoryTotal, 10));
        setTopicNew7d(mapToTopRows(categoryNew7d, 10));
        setTopicsSampleCapped(Boolean(hitPageCap));
      } catch {
        // ignore
      } finally {
        if (alive && !topicsLoadingSettled.current) {
          topicsLoadingSettled.current = true;
          setTopicsLoading(false);
        }
      }
    }

    async function fetchReviews(signal) {
      try {
        const resTotalAll = await listAdminReviews({
          page: 0,
          size: 1,
          activeOnly: false,
          signal,
        });
        if (resTotalAll.ok) {
          const dtoTotal = await resTotalAll.json();
          const { totalElements: teRaw } = normalizeAdminPageDto(dtoTotal);
          const teAll = Number(teRaw);
          if (alive && Number.isFinite(teAll) && teAll >= 0) {
            setReviewCountTotal(teAll);
          }
        }

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrowStart = new Date(todayStart);
        tomorrowStart.setDate(tomorrowStart.getDate() + 1);
        const rangeStart7 = new Date(todayStart);
        rangeStart7.setDate(rangeStart7.getDate() - 6);
        const last7Buckets = Array(7).fill(0);

        let page = 0;
        let totalPages = 1;
        let sponsoredCount = 0;
        /** Aktif review sayısı (sponsored oranı paydası); Moderation “All” ile karıştırılmaz */
        let totalActiveReviewsHint = null;
        let scannedActiveReviews = 0;
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
          const norm = normalizeAdminPageDto(dto);
          totalPages = Number(norm.totalPages ?? totalPages);
          const content = norm.content;
          if (page === 0 && norm.totalElements != null) {
            const te = Number(norm.totalElements);
            if (Number.isFinite(te)) totalActiveReviewsHint = te;
          }
          scannedActiveReviews += content.length;

          for (const r of content) {
            if (isReviewSponsoredLike(r)) sponsoredCount += 1;
            const raw = r?.createdAt ?? r?.created_at ?? r?.createdDate ?? r?.created_date;
            if (!raw) continue;
            const d = raw instanceof Date ? raw : new Date(raw);
            if (Number.isNaN(d.getTime())) continue;
            if (d >= rangeStart7 && d < tomorrowStart) {
              const idx = Math.floor((d.getTime() - rangeStart7.getTime()) / (24 * 60 * 60 * 1000));
              if (idx >= 0 && idx < 7) last7Buckets[idx] += 1;
            }
          }
          page += 1;
        }

        const tpSafe = Number(totalPages);
        const hitPageCap =
          page >= maxPages && Number.isFinite(tpSafe) && tpSafe > maxPages;

        if (!alive) return;
        setReviewLast7Days([...last7Buckets]);
        setReviewsSampleCapped(Boolean(hitPageCap));

        const totalForSponsoredRatio =
          typeof totalActiveReviewsHint === 'number' && totalActiveReviewsHint >= 0
            ? totalActiveReviewsHint
            : scannedActiveReviews;
        if (totalForSponsoredRatio > 0) {
          setSponsoredRatioPct((sponsoredCount / totalForSponsoredRatio) * 100);
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
        await Promise.all([
          fetchUsers(signal),
          fetchProducts(signal),
          fetchReviews(signal),
          fetchProductTopics(signal),
        ]);
      } catch {
        // aborted veya ağ hatası — state güncellemesi fetch içinde korunuyor
      } finally {
        pollInFlight.current = false;
        if (currentPollAbort === controller) currentPollAbort = null;
        if (alive) setLastSyncedAt(new Date());
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

  const dayLabelsLast7 = useMemo(() => {
    const now = lastSyncedAt ?? new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const rangeStart = new Date(todayStart);
    rangeStart.setDate(rangeStart.getDate() - 6);
    const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(rangeStart);
      d.setDate(rangeStart.getDate() + i);
      return fmt.format(d);
    });
  }, [lastSyncedAt]);

  const reviewsWeekSum = useMemo(
    () => reviewLast7Days.reduce((a, n) => a + (Number.isFinite(n) ? n : 0), 0),
    [reviewLast7Days]
  );

  const usersDetail =
    userCountTotal != null && userCountTotal > 0 && userCountActive != null && suspendedUsers != null
      ? `${formatInteger(userCountActive)} active · ${formatInteger(suspendedUsers)} susp. · ${(
          (userCountActive / userCountTotal) *
          100
        ).toFixed(1)}% of registered`
      : userCountActive != null && suspendedUsers != null
        ? `${formatInteger(userCountActive)} active · ${formatInteger(suspendedUsers)} suspended`
        : null;
  const productsDetail =
    productCountTotal != null && productCountTotal > 0 && productCountActive != null && inactiveProducts != null
      ? `${formatInteger(productCountActive)} live · ${formatInteger(inactiveProducts)} off · ${(
          (productCountActive / productCountTotal) *
          100
        ).toFixed(1)}% published`
      : productCountActive != null && inactiveProducts != null
        ? `${formatInteger(productCountActive)} live · ${formatInteger(inactiveProducts)} off`
        : null;
  const reviewsDetailText =
    reviewCountTotal != null && reviewCountTotal >= 0
      ? reviewCountTotal > 0
        ? `${formatInteger(reviewsWeekSum)} in last 7d · ${((reviewsWeekSum / reviewCountTotal) * 100).toFixed(
            1
          )}% of ${formatInteger(reviewCountTotal)} all-time`
        : `${formatInteger(reviewsWeekSum)} in last 7d`
      : '—';

  return (
    <div className="dashboard">
      <div className="dashboard-inner">
        <header className="dashboard-header">
          <div className="dashboard-header-row">
            <div>
              <h1 className="dashboard-main-title">Operations overview</h1>
              <p className="dashboard-tagline">Headline totals first; sections below show review and catalog shape.</p>
            </div>
            <div className="dashboard-meta" aria-live="polite">
              <span className="dashboard-meta-label">Last synced</span>
              <time className="dashboard-meta-time" dateTime={lastSyncedAt?.toISOString() ?? undefined}>
                {lastSyncedAt
                  ? new Intl.DateTimeFormat(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'medium',
                    }).format(lastSyncedAt)
                  : '—'}
              </time>
              <span className="dashboard-meta-pill">Every {DASHBOARD_POLL_MS / 1000}s</span>
            </div>
          </div>
        </header>

        <section className="dashboard-snapshot" aria-label="Key metrics">
          <h2 className="dashboard-sr-only">Key metrics</h2>
          <div className="dashboard-snapshot-grid">
            <SnapshotCard
              title="Users"
              value={formatInteger(userCountTotal)}
              valueLoading={usersMiniLoading && userCountTotal == null}
              detail={usersMiniLoading && userCountTotal == null ? null : usersDetail ?? '—'}
              detailLoading={usersMiniLoading && userCountTotal == null}
            />
            <SnapshotCard
              title="Products"
              value={formatInteger(productCountTotal)}
              valueLoading={productsMiniLoading && productCountTotal == null}
              detail={productsMiniLoading && productCountTotal == null ? null : productsDetail ?? '—'}
              detailLoading={productsMiniLoading && productCountTotal == null}
            />
            <SnapshotCard
              title="Reviews"
              value={formatInteger(reviewCountTotal)}
              valueLoading={reviewsMiniLoading && reviewCountTotal == null}
              detail={
                reviewsMiniLoading && reviewCountTotal == null ? null : reviewsDetailText
              }
              detailLoading={reviewsMiniLoading && reviewCountTotal == null}
            />
          </div>
        </section>

        <section
          className="dashboard-section dashboard-engage"
          aria-labelledby="dashboard-engage-title"
        >
          <div className="dashboard-section-head">
            <h2 id="dashboard-engage-title" className="dashboard-section-heading">
              Reviews
            </h2>
            <p className="dashboard-section-dek dashboard-section-dek--tight">
              Sponsored mix and daily volume (active reviews; sampling may cap extremes).
            </p>
          </div>
          <div className="dashboard-viz-split dashboard-viz-split--flush">
            <SponsoredDonut
              pctSponsored={sponsoredRatioPct}
              loading={reviewsMiniLoading && sponsoredRatioPct == null}
            />
            <ReviewActivityBars
              buckets={reviewLast7Days}
              dayLabels={dayLabelsLast7}
              loading={reviewsMiniLoading}
              cappedNote={
                reviewsSampleCapped ? 'Daily counts from a partial sample of active reviews.' : null
              }
            />
          </div>
        </section>

        <section
          className="dashboard-section dashboard-section--topics"
          aria-labelledby="dashboard-topics-title"
        >
          <div className="dashboard-section-head">
            <h2 id="dashboard-topics-title" className="dashboard-section-heading">
              Catalog by category
            </h2>
            <p className="dashboard-section-dek dashboard-section-dek--tight">
              Leaf paths from sampled active products — volume vs. new in the last 7 days.
            </p>
          </div>
          <div className="dashboard-topics-grid">
            <TopicRankedBars
              title="Volume"
              sub="Top leaf paths"
              rows={topicTotals}
              loading={topicsLoading && topicTotals.length === 0}
              emptyHint="No categories in sample."
              cappedHint={null}
            />
            <TopicRankedBars
              title="New (7d)"
              sub="By first-seen date"
              rows={topicNew7d}
              loading={topicsLoading && topicNew7d.length === 0}
              emptyHint="None or dates missing."
              cappedHint={null}
            />
          </div>
          {topicsSampleCapped ? (
            <p className="dashboard-data-footnote">Category charts use an early slice of the active product list.</p>
          ) : null}
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
