import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  fetchAllAdminReviews,
  getAdminReview,
  messageFromFailedResponse,
} from '../api/adminApi';
import {
  buildTextForLocalToxicityEstimate,
  estimateToxicityPercentFromText,
  extractToxicityScore,
  toxicityToPercent,
} from '../utils/reviewToxicityScore';
import '../styles/ReviewDetail.css';
import loadingDots from '../assets/loading-dots.svg';

function truncateText(text, maxLen) {
  if (text == null) return '';
  const s = String(text).trim();
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
}

function buildReviewBody(review) {
  const title = review?.title != null ? String(review.title).trim() : '';
  const desc = review?.description != null ? String(review.description).trim() : '';
  if (title && desc) {
    if (title === desc) return title;
    if (desc.startsWith(title)) return desc;
    return `${title} — ${desc}`;
  }
  return title || desc || '—';
}

function formatDateTime(value) {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatProductLabel(review) {
  const nameRaw = review?.productName ?? review?.product_name;
  const idRaw = review?.productId ?? review?.product_id;
  const name = nameRaw != null ? String(nameRaw).trim() : '';
  const idStr = idRaw != null && String(idRaw).trim() !== '' ? String(idRaw).trim() : '';
  if (name && idStr) return `${name} (#${idStr})`;
  if (name) return name;
  if (idStr) return `Product #${idStr}`;
  return '—';
}

function formatReviewerLabel(review) {
  const nameRaw =
    review?.ownerUserName ??
    review?.owner_username ??
    review?.ownerUsername ??
    review?.userName ??
    review?.username ??
    review?.user_name ??
    review?.authorName ??
    review?.author_name ??
    review?.fullName ??
    review?.full_name ??
    review?.name;
  const idRaw = review?.userId ?? review?.user_id ?? review?.authorId ?? review?.author_id;
  const name = nameRaw != null ? String(nameRaw).trim() : '';
  const idStr = idRaw != null && String(idRaw).trim() !== '' ? String(idRaw).trim() : '';
  if (name && idStr) return `${name} (#${idStr})`;
  if (name) return name;
  if (idStr) return `User #${idStr}`;
  return '—';
}

function formatCollaborative(review) {
  const v = review?.isCollaborative ?? review?.is_collaborative;
  if (v == null) return '—';
  return v === true || v === 'true' || v === 1 ? 'Yes' : 'No';
}

function formatLikeCount(review) {
  const n = review?.likeCount ?? review?.like_count;
  if (n == null) return '—';
  const num = Number(n);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(num);
}

function normalizeModerationStatus(review) {
  return String(review?.moderationStatus ?? review?.moderation_status ?? '')
    .trim()
    .toUpperCase();
}

function moderationStatusLabel(review) {
  const s = normalizeModerationStatus(review);
  if (s === 'MANUALLY_FLAGGED') return 'Reported';
  if (!s) return '—';
  return s;
}

function formatAiScore(review) {
  const raw = extractToxicityScore(review);
  let pct = toxicityToPercent(raw);
  if (pct == null) {
    const est = estimateToxicityPercentFromText(buildTextForLocalToxicityEstimate(review));
    if (est != null) pct = est;
  }
  if (pct != null) return `${pct}%`;
  return '—';
}

async function loadReviewById(reviewId, signal) {
  const byId = await getAdminReview(reviewId, { signal });
  if (byId.ok) return byId.json();
  const byIdMessage = await messageFromFailedResponse(byId);

  const all = await fetchAllAdminReviews({ activeOnly: false, pageSize: 200, signal });
  const match = all.find((r) => String(r?.id ?? r?.reviewId) === String(reviewId));
  if (match) return match;

  throw new Error(byIdMessage || `Review not found (${byId.status})`);
}

const ReviewDetail = () => {
  const { id } = useParams();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
      setReview(null);
      setLoading(false);
      setError('Invalid review id.');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const data = await loadReviewById(id, controller.signal);
        if (cancelled) return;
        setReview(data);
      } catch (e) {
        if (cancelled) return;
        if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') return;
        setReview(null);
        setError(e instanceof Error ? e.message : 'Could not load review.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id]);

  const detailRows = useMemo(() => {
    if (!review) return [];
    return [
      ['Review ID', String(review?.id ?? review?.reviewId ?? id ?? '—')],
      ['User', formatReviewerLabel(review)],
      ['Product', formatProductLabel(review)],
      ['Reported', normalizeModerationStatus(review) === 'MANUALLY_FLAGGED' ? 'Yes' : 'No'],
      ['AI toxicity', formatAiScore(review)],
      ['Likes', formatLikeCount(review)],
      ['Collaborative', formatCollaborative(review)],
      ['Rating', review?.rating != null ? String(review.rating) : '—'],
      ['Moderation status', moderationStatusLabel(review)],
      ['Created', formatDateTime(review?.createdAt ?? review?.created_at)],
    ];
  }, [review, id]);

  return (
    <div className="review-detail-page">
      <div className="review-detail-inner">
        <p className="review-detail-back">
          <Link to="/moderation" className="review-detail-back-link">
            ← Back to moderation
          </Link>
        </p>

        <header className="review-detail-header">
          <h1 className="review-detail-title">Review detail</h1>
          {id ? <p className="review-detail-idline">ID {id}</p> : null}
        </header>

        {loading ? (
          <div className="review-detail-loading" aria-live="polite" aria-busy="true">
            <img src={loadingDots} alt="" />
            <div>Loading review…</div>
          </div>
        ) : error ? (
          <div className="review-detail-alert review-detail-alert--error" role="alert">
            {error}
          </div>
        ) : review ? (
          <div className="review-detail-stack">
            <section className="review-detail-card">
              <h2 className="review-detail-section-title">Content</h2>
              <p className="review-detail-content">
                {buildReviewBody(review) === '—'
                  ? '—'
                  : truncateText(buildReviewBody(review), 3000)}
              </p>
            </section>

            <section className="review-detail-card">
              <h2 className="review-detail-section-title">Metadata</h2>
              <dl className="review-detail-dl">
                {detailRows.map(([k, v]) => (
                  <div key={k} className="review-detail-row">
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ReviewDetail;
