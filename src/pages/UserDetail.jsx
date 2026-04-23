import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getAdminUser,
  getMyReviews,
  listReviewsByUserId,
  messageFromFailedResponse,
  normalizeAdminPageDto,
} from '../api/adminApi';
import { getUserWishlist } from '../api/interactionApi';
import { buildUserProfileImageUrl, resolveResourceUrl } from '../config/api';
import { useAuth } from '../hooks/useAuth';
import { statusLabelFromKind, toStatusKind, toUsernameLabel } from '../utils/adminUserRows';
import '../styles/UserDetail.css';
import loadingDots from '../assets/loading-dots.svg';

function formatDate(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string') {
    const t = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
      const d = new Date(t);
      if (!Number.isNaN(d.getTime())) {
        return new Intl.DateTimeFormat(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        }).format(d);
      }
    }
    return t;
  }
  return String(value);
}

function dateTimeLabel(value) {
  if (value == null) return '—';
  const d = new Date(
    typeof value === 'string' && !value.includes('T') ? `${value}T00:00:00Z` : value
  );
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function boolLabel(v) {
  if (v === true || v === 'true' || v === 1) return 'Yes';
  if (v === false || v === 'false' || v === 0) return 'No';
  return '—';
}

function productLabelFrom(p) {
  if (!p || typeof p !== 'object') return '—';
  const n = p.name != null ? String(p.name) : '';
  const id = p.id ?? p.productId;
  const idStr = id != null && String(id).trim() !== '' ? String(id) : '';
  if (n && idStr) return `${n} (#${idStr})`;
  if (n) return n;
  if (idStr) return `Product #${idStr}`;
  return '—';
}

function buildReviewPreview(r) {
  const title = r?.title != null ? String(r.title).trim() : '';
  const desc = r?.description != null ? String(r.description).trim() : '';
  if (title && desc) {
    if (title === desc) return title;
    if (desc.startsWith(title)) return desc;
    return `${title} — ${desc}`;
  }
  return title || desc || '—';
}

/**
 * GET /api/interactions/{userId}/wishlist hatalarını sarı satır metnine çevirir.
 * @param {Response} res
 * @param {string} routeHint
 * @param {string} fallback
 */
async function messageForUserWishlistError(res, routeHint, fallback) {
  const raw = await messageFromFailedResponse(res).catch(() => '');
  if (res.status === 404) {
    return `This list needs the API ${routeHint} (see project-favo/backend).`;
  }
  if (res.status === 401 || res.status === 403) {
    return `Sign in and refresh, or the route ${routeHint} is unavailable.`;
  }
  if (raw && /authentication\s*required/i.test(raw)) {
    return `Session issue — try refresh. (Expected ${routeHint}.)`;
  }
  if (!res.ok) {
    return raw.trim() || fallback;
  }
  return '';
}

const UserDetail = () => {
  const { id: idParam } = useParams();
  const { user: sessionUser } = useAuth();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [userReviews, setUserReviews] = useState(/** @type {unknown[]} */ ([]));
  const [reviewsError, setReviewsError] = useState(null);
  const [activityLoading, setActivityLoading] = useState(true);

  const [wishlistItems, setWishlistItems] = useState(/** @type {unknown[]} */ ([]));
  const [wishlistError, setWishlistError] = useState(null);

  const [avatarError, setAvatarError] = useState(false);
  const [avatarPhase, setAvatarPhase] = useState(0);

  useEffect(() => {
    if (idParam == null || idParam === '') {
      setLoading(false);
      setError('Invalid user id.');
      setUser(null);
      return;
    }
    setAvatarError(false);
    setAvatarPhase(0);
    const controller = new AbortController();
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const res = await getAdminUser(idParam, { signal: controller.signal });
        if (cancelled) return;
        if (!res.ok) {
          const msg = await messageFromFailedResponse(res);
          throw new Error(msg);
        }
        const data = await res.json();
        if (cancelled) return;
        setUser(data);
      } catch (e) {
        if (cancelled) return;
        if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') return;
        setUser(null);
        setError(e instanceof Error ? e.message : 'Could not load user.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [idParam]);

  useEffect(() => {
    if (idParam == null || idParam === '') {
      setActivityLoading(false);
      return;
    }
    if (loading) {
      return;
    }
    if (error || !user) {
      setActivityLoading(false);
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    setActivityLoading(true);
    setReviewsError(null);
    setWishlistError(null);

    (async () => {
      try {
        const selfId = sessionUser?.id ?? sessionUser?.userId;
        const isViewingSelf = selfId != null && idParam != null && String(selfId) === String(idParam);

        const rRev = isViewingSelf
          ? await getMyReviews({ signal: controller.signal })
          : await listReviewsByUserId(idParam, { signal: controller.signal });
        if (cancelled) return;

        if (rRev.ok) {
          const data = await rRev.json();
          setUserReviews(Array.isArray(data) ? data : []);
        } else {
          setUserReviews([]);
          setReviewsError(await messageFromFailedResponse(rRev).catch(() => 'Could not load reviews.'));
        }

        const rW = await getUserWishlist(idParam, {
          page: 0,
          size: 50,
          signal: controller.signal,
        });
        if (cancelled) return;
        if (rW.ok) {
          const dto = await rW.json();
          setWishlistItems(normalizeAdminPageDto(dto).content);
          setWishlistError(null);
        } else {
          setWishlistItems([]);
          setWishlistError(
            await messageForUserWishlistError(
              rW,
              `GET /api/interactions/${idParam}/wishlist`,
              'Could not load wishlist.'
            )
          );
        }
      } catch (e) {
        if (cancelled) return;
        if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') return;
        if (!cancelled) {
          setUserReviews([]);
          setWishlistItems([]);
          setReviewsError(e instanceof Error ? e.message : 'Activity load failed.');
        }
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [idParam, loading, error, user, sessionUser]);

  const displayName = user
    ? [user.name, user.surname].filter((x) => x != null && String(x).trim() !== '').join(' ') ||
      '—'
    : '—';
  const username = user ? toUsernameLabel(user) : '—';
  const email = user?.email != null ? String(user.email) : '—';
  const userType = user?.userType != null ? String(user.userType) : '—';
  const kind = user ? toStatusKind(user) : 'unknown';
  const statusLabel = user ? statusLabelFromKind(kind) : '—';

  const avatarResolved = user ? resolveResourceUrl(user.profileImageUrl) : null;
  const avatarSrc =
    avatarError || !idParam
      ? null
      : avatarPhase === 0
        ? avatarResolved || buildUserProfileImageUrl(idParam)
        : buildUserProfileImageUrl(idParam);

  const sessionId = sessionUser?.id ?? sessionUser?.userId;
  const viewingOwnProfile =
    sessionId != null && idParam != null && String(sessionId) === String(idParam);
  const reviewsSectionTitle = viewingOwnProfile
    ? 'My reviews'
    : 'Reviews by this user';

  return (
    <div className="user-detail-page">
      <div className="user-detail-inner">
        <p className="user-detail-back">
          <Link to="/users" className="user-detail-back-link">
            ← Back to users
          </Link>
        </p>
        <header className="user-detail-header">
          <h1 className="user-detail-title">User details</h1>
          {idParam && (
            <p className="user-detail-idline">
              <span className="user-detail-id">ID {String(user?.id ?? idParam)}</span>
            </p>
          )}
        </header>

        {loading ? (
          <div className="user-detail-loading" aria-live="polite" aria-busy="true">
            <img src={loadingDots} alt="" />
            <div>Loading user…</div>
          </div>
        ) : error ? (
          <div className="user-detail-alert user-detail-alert--error" role="alert">
            {error}
          </div>
        ) : user ? (
          <div className="user-detail-stack">
            <div className="user-detail-card user-detail-card--main">
              <div className="user-detail-hero">
                {avatarSrc && !avatarError ? (
                  <img
                    className="user-detail-photo"
                    src={avatarSrc}
                    alt=""
                    onError={() => {
                      if (avatarPhase === 0 && user?.profileImageUrl) {
                        setAvatarPhase(1);
                        return;
                      }
                      setAvatarError(true);
                    }}
                  />
                ) : (
                  <div className="user-detail-photo-placeholder" aria-hidden>
                    {String(username)
                      .replace(/^@/, '')
                      .trim()
                      .slice(0, 2)
                      .toUpperCase() || '?'}
                  </div>
                )}
                <div className="user-detail-hero-text">
                  <h2 className="user-detail-displayname">{displayName}</h2>
                  <p className="user-detail-username-line">{username}</p>
                  <p className="user-detail-email-line">{email}</p>
                  <p className="user-detail-status-line">
                    <span
                      className={
                        kind === 'active'
                          ? 'user-detail-badge user-detail-badge--active'
                          : kind === 'suspend'
                            ? 'user-detail-badge user-detail-badge--suspend'
                            : 'user-detail-badge user-detail-badge--unknown'
                      }
                    >
                      {statusLabel}
                    </span>
                  </p>
                </div>
              </div>

              <dl className="user-detail-dl">
                <div className="user-detail-row">
                  <dt>First name</dt>
                  <dd>{user.name != null && String(user.name).trim() ? user.name : '—'}</dd>
                </div>
                <div className="user-detail-row">
                  <dt>Last name</dt>
                  <dd>
                    {user.surname != null && String(user.surname).trim() ? user.surname : '—'}
                  </dd>
                </div>
                <div className="user-detail-row">
                  <dt>Birth date</dt>
                  <dd>{formatDate(user.birthdate)}</dd>
                </div>
                <div className="user-detail-row">
                  <dt>Account type</dt>
                  <dd>{userType}</dd>
                </div>
                <div className="user-detail-row">
                  <dt>Email verified</dt>
                  <dd>{boolLabel(user.emailVerified)}</dd>
                </div>
                <div className="user-detail-row">
                  <dt>Profile anonymous</dt>
                  <dd>{boolLabel(user.profileAnonymous)}</dd>
                </div>
              </dl>
            </div>

            {activityLoading ? (
              <div
                className="user-detail-activity-loading"
                aria-live="polite"
                aria-busy="true"
              >
                <img src={loadingDots} alt="" className="user-detail-activity-loading-dots" />
                <span>Loading activity…</span>
              </div>
            ) : (
              <>
                <section className="user-detail-activity" aria-label="User reviews">
              <h2 className="user-detail-activity-h">{reviewsSectionTitle}</h2>
              {reviewsError ? (
                <p className="user-detail-activity-err" role="alert">
                  {reviewsError}
                </p>
              ) : userReviews.length === 0 ? (
                <p className="user-detail-activity-empty">No reviews for this user.</p>
              ) : (
                <ul className="user-detail-activity-list">
                  {userReviews.map((r, idx) => {
                    const id = r?.id ?? r?.reviewId;
                    return (
                      <li
                        key={id != null ? String(id) : `rev-${String(idx)}`}
                        className="user-detail-activity-item"
                      >
                        <div className="user-detail-activity-item-top">
                          <span className="user-detail-activity-pill">
                            {productLabelFrom({ id: r?.productId, name: r?.productName })}
                          </span>
                          {r?.rating != null && (
                            <span className="user-detail-activity-meta">★ {String(r.rating)}</span>
                          )}
                        </div>
                        <p className="user-detail-activity-text">{buildReviewPreview(r)}</p>
                        <p className="user-detail-activity-sub">
                          {r?.likeCount != null
                            ? `${r.likeCount} like(s) · `
                            : ''}
                          {dateTimeLabel(r?.createdAt)} · review #{id ?? '—'}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
                </section>

                <section className="user-detail-activity" aria-label="Liked products">
                  <h2 className="user-detail-activity-h">Liked products (wishlist)</h2>
                  {(() => {
                    const missing = wishlistError && wishlistError.includes('see project-favo');
                    const hardErr = wishlistError && !missing;
                    if (hardErr) {
                      return (
                        <p className="user-detail-activity-err" role="alert">
                          {wishlistError}
                        </p>
                      );
                    }
                    return (
                      <>
                        {missing && (
                          <p className="user-detail-activity-warn" role="status">
                            {wishlistError}
                          </p>
                        )}
                        {wishlistItems.length === 0 ? (
                          <p className="user-detail-activity-empty">No liked products.</p>
                        ) : (
                          <ul className="user-detail-activity-list">
                            {wishlistItems.map((p) => {
                              const pid = p?.id;
                              return (
                                <li
                                  key={pid != null ? String(pid) : productLabelFrom(p)}
                                  className="user-detail-activity-item"
                                >
                                  <div className="user-detail-activity-item-top">
                                    <span className="user-detail-activity-title">
                                      {productLabelFrom(p)}
                                    </span>
                                  </div>
                                  {p?.tag?.categoryPath && (
                                    <p className="user-detail-activity-sub">
                                      {String(p.tag.categoryPath)}
                                    </p>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </>
                    );
                  })()}
                </section>

                <section className="user-detail-activity" aria-label="Flagged reviews">
                  <h2 className="user-detail-activity-h">Reviews this user reported (flags)</h2>
                  <p className="user-detail-activity-warn" role="status">
                    project-favo/backend has no GET endpoint to list which reviews a user reported. Review
                    reports are created with{' '}
                    <code className="user-detail-inline-code">POST /api/reviews/&#123;id&#125;/flag</code>{' '}
                    only. Use the Moderation page for review status.
                  </p>
                  <p className="user-detail-activity-empty">Not available via API.</p>
                </section>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default UserDetail;
