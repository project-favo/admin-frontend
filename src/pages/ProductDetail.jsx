import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ProductCategoryPicker from '../components/ProductCategoryPicker';
import {
  buildProductUpdateBody,
  fetchAllAdminReviews,
  getAdminProduct,
  messageFromFailedResponse,
  putProduct,
} from '../api/adminApi';
import '../styles/ProductDetail.css';
import '../styles/Products.css';
import loadingDots from '../assets/loading-dots.svg';

function getProductImageUrl(product) {
  if (!product || typeof product !== 'object') return '';
  const u = product.imageURL ?? product.imageUrl ?? product.image_url;
  if (u == null || typeof u !== 'string') return '';
  return u.trim();
}

/**
 * @param {unknown} value
 */
function formatCreatedAt(value) {
  if (value == null || value === '') return '—';
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) {
    return String(value);
  }
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

/**
 * Backend ürün DTO’sunda varsa review sayısını oku; yoksa client tarafı yorum listesinden hesaplanır.
 * @param {object} product
 * @returns {{ reviewCount: number } | null}
 */
function tryEmbeddedProductReviewStats(product) {
  if (!product || typeof product !== 'object') return null;
  const rc =
    product.reviewCount ??
    product.review_count ??
    product.reviewsCount ??
    product.numberOfReviews;
  const nRev = rc != null && String(rc).trim() !== '' ? Number(rc) : NaN;
  if (Number.isFinite(nRev)) {
    return { reviewCount: Math.max(0, Math.floor(nRev)) };
  }
  return null;
}

/**
 * @param {object} product
 * @param {null | { status: 'loading' } | { status: 'error' } | { status: 'ok', reviewCount: number }} reviewStats
 * @returns {Array<[string, string]>}
 */
function productMetadataRows(product, reviewStats) {
  if (!product || typeof product !== 'object') return [];
  const tag = product.tag;
  const tagLine =
    tag && typeof tag === 'object'
      ? [tag.name, tag.categoryPath].filter(Boolean).join(' · ') || '—'
      : '—';
  const tagId =
    tag && typeof tag === 'object' && tag.id != null ? String(tag.id) : '—';
  const activeRaw = product?.isActive ?? product?.active ?? product?.is_active;
  const statusLabel =
    activeRaw === true || activeRaw === 'true' || activeRaw === 1
      ? 'Active'
      : activeRaw === false || activeRaw === 'false' || activeRaw === 0
        ? 'Inactive'
        : '—';
  const createdRaw = product.createdAt ?? product.created_at;
  const imageUrl = getProductImageUrl(product);

  let reviewsLabel = '—';
  if (reviewStats) {
    if (reviewStats.status === 'loading') {
      reviewsLabel = '…';
    } else if (reviewStats.status === 'error') {
      reviewsLabel = '—';
    } else {
      reviewsLabel = String(reviewStats.reviewCount);
    }
  }

  return [
    ['ID', String(product.id ?? '—')],
    ['Name', product.name != null ? String(product.name) : '—'],
    ['Category', tagLine],
    ['Category ID', tagId],
    ['Status', statusLabel],
    ['Reviews', reviewsLabel],
    ['Image URL', imageUrl || '—'],
    ['Created', formatCreatedAt(createdRaw)],
  ];
}

/**
 * @param {object | null} p
 * @returns {null | { id: number, name: string, categoryPath?: string }}
 */
function categoryFromProduct(p) {
  if (!p || typeof p !== 'object') return null;
  const tag = p.tag;
  const tagIdNum = tag && typeof tag === 'object' && tag.id != null ? Number(tag.id) : NaN;
  if (tag && typeof tag === 'object' && tag.id != null && Number.isFinite(tagIdNum)) {
    return {
      id: tagIdNum,
      name: tag.name != null ? String(tag.name) : '',
      categoryPath: tag.categoryPath != null ? String(tag.categoryPath) : undefined,
    };
  }
  return null;
}

const ProductDetail = () => {
  const { id } = useParams();
  const formId = useId();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImageURL, setEditImageURL] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(
    /** @type {null | { id: number, name: string, categoryPath?: string }} */ (null)
  );
  const [saveError, setSaveError] = useState(/** @type {string | null} */ (null));
  const [saving, setSaving] = useState(false);
  const [reviewStats, setReviewStats] = useState(
    /** @type {null | { status: 'loading' } | { status: 'error' } | { status: 'ok', reviewCount: number }} */
    (null)
  );

  useEffect(() => {
    if (!product || String(product.id ?? '') !== String(id)) return;
    setEditName(product.name != null ? String(product.name) : '');
    setEditDescription(product.description != null ? String(product.description) : '');
    const img = product.imageURL ?? product.imageUrl ?? product.image_url;
    setEditImageURL(img != null ? String(img) : '');
    setSelectedCategory(categoryFromProduct(product));
  }, [id, product]);

  useEffect(() => {
    if (!id) {
      setProduct(null);
      setLoading(false);
      setError('Invalid product id.');
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setSaveError(null);

    (async () => {
      try {
        const res = await getAdminProduct(id, { signal: controller.signal });
        if (cancelled) return;
        if (!res.ok) {
          const msg = await messageFromFailedResponse(res);
          throw new Error(msg || `Request failed (${res.status})`);
        }
        const data = await res.json();
        if (cancelled) return;
        setProduct(data);
      } catch (e) {
        if (cancelled) return;
        if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') return;
        setProduct(null);
        setError(e instanceof Error ? e.message : 'Could not load product.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id]);

  useEffect(() => {
    if (!id || !product) {
      setReviewStats(null);
      return;
    }
    if (String(product.id ?? '') !== String(id)) {
      setReviewStats(null);
      return;
    }

    const embedded = tryEmbeddedProductReviewStats(product);
    if (embedded) {
      setReviewStats({ status: 'ok', reviewCount: embedded.reviewCount });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setReviewStats({ status: 'loading' });

    (async () => {
      try {
        const all = await fetchAllAdminReviews({
          activeOnly: false,
          pageSize: 200,
          signal: controller.signal,
        });
        if (cancelled) return;
        const pid = String(id);
        const forProduct = all.filter((r) => {
          const rid = r?.productId ?? r?.product_id;
          return rid != null && String(rid) === pid;
        });
        const reviewCount = forProduct.length;
        if (!cancelled) {
          setReviewStats({ status: 'ok', reviewCount });
        }
      } catch (e) {
        if (cancelled) return;
        if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') return;
        setReviewStats({ status: 'error' });
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id, product]);

  const metaRows = useMemo(
    () => productMetadataRows(product ?? {}, reviewStats),
    [product, reviewStats]
  );

  const imagePreviewUrl =
    editImageURL && String(editImageURL).trim() !== ''
      ? String(editImageURL).trim()
      : product
        ? getProductImageUrl(product) || ''
        : '';

  useEffect(() => {
    setImageFailed(false);
  }, [id, product?.id, imagePreviewUrl]);

  const displayNameForImg =
    editName && String(editName).trim() !== ''
      ? String(editName).trim()
      : product && product.name != null && String(product.name).trim() !== ''
        ? String(product.name)
        : '—';

  async function handleSave() {
    if (!id) return;
    if (!selectedCategory) {
      setSaveError('Choose a leaf category (search or browse until a category is selected).');
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const body = buildProductUpdateBody({
        name: editName,
        description: editDescription,
        imageURL: editImageURL,
        tagId: String(selectedCategory.id),
      });
      const res = await putProduct(String(id), body);
      if (!res.ok) {
        const detail = await messageFromFailedResponse(res);
        throw new Error(
          detail || `Update failed (${res.status}). Check PUT /api/products/{id} on the server.`
        );
      }
      const refreshed = await getAdminProduct(id);
      if (!refreshed.ok) {
        const msg = await messageFromFailedResponse(refreshed);
        throw new Error(msg || `Could not reload product (${refreshed.status}).`);
      }
      const data = await refreshed.json();
      setProduct(data);
      setImageFailed(false);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="product-detail-page">
      <div className="product-detail-inner">
        <p className="product-detail-back">
          <Link to="/products" className="product-detail-back-link">
            ← Back to products
          </Link>
        </p>

        <header className="product-detail-header">
          <h1 className="product-detail-title">Product detail</h1>
          {id ? <p className="product-detail-idline">ID {id}</p> : null}
        </header>

        {loading ? (
          <div className="product-detail-loading" aria-live="polite" aria-busy="true">
            <img src={loadingDots} alt="" />
            <div>Loading product…</div>
          </div>
        ) : error ? (
          <div className="product-detail-alert product-detail-alert--error" role="alert">
            {error}
          </div>
        ) : product ? (
          <div className="product-detail-stack">
            <div
              className={
                imagePreviewUrl
                  ? 'product-detail-top'
                  : 'product-detail-top product-detail-top--no-image'
              }
            >
              {imagePreviewUrl ? (
                <div className="product-detail-top-left">
                  {imagePreviewUrl && !imageFailed ? (
                    <section className="product-detail-card product-detail-card--image">
                      <h2 className="product-detail-section-title">Image</h2>
                      <div className="product-detail-image-block">
                        <img
                          className="product-detail-image"
                          key={imagePreviewUrl}
                          src={imagePreviewUrl}
                          alt={displayNameForImg !== '—' ? displayNameForImg : ''}
                          loading="lazy"
                          decoding="async"
                          onError={() => setImageFailed(true)}
                        />
                      </div>
                    </section>
                  ) : null}
                  {imagePreviewUrl && imageFailed ? (
                    <div
                      className="product-detail-card product-detail-card--image product-detail-image-fallback"
                      role="status"
                    >
                      <h2 className="product-detail-section-title">Image</h2>
                      <p className="product-detail-image-fallback-text">Image could not be loaded.</p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="product-detail-top-right">
                <section className="product-detail-card product-detail-card--metadata">
                  <h2 className="product-detail-section-title">Metadata</h2>
                  <dl className="product-detail-dl">
                    {metaRows.map((row) => {
                      const k = row[0];
                      const v = row[1];
                      return (
                        <div key={k} className="product-detail-row">
                          <dt>{k}</dt>
                          <dd>
                            {k === 'Image URL' && v !== '—' ? (
                              <a
                                href={v}
                                className="product-detail-external"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {v}
                              </a>
                            ) : (
                              v
                            )}
                          </dd>
                        </div>
                      );
                    })}
                  </dl>
                </section>
              </div>
            </div>

            <section className="product-detail-card" aria-label="Edit product form">
              <h2 className="product-detail-section-title">Edit product</h2>
              {saveError && (
                <div className="product-detail-alert product-detail-alert--error" role="alert">
                  {saveError}
                </div>
              )}
              <div className="products-page product-detail-form-scope">
                <div className="products-modal-form-panel">
                  <div className="products-modal-field">
                    <label htmlFor={`${formId}-name`}>Name</label>
                    <input
                      id={`${formId}-name`}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={saving}
                      autoComplete="off"
                    />
                  </div>
                  <div className="products-modal-field">
                    <label htmlFor={`${formId}-desc`}>Description</label>
                    <textarea
                      id={`${formId}-desc`}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      disabled={saving}
                    />
                  </div>
                  <div className="products-modal-field">
                    <label htmlFor={`${formId}-img`}>Image URL</label>
                    <input
                      id={`${formId}-img`}
                      value={editImageURL}
                      onChange={(e) => setEditImageURL(e.target.value)}
                      disabled={saving}
                      autoComplete="off"
                      placeholder="https://…"
                    />
                  </div>
                  <div className="products-modal-field products-modal-field--last">
                    <span
                      className="products-category-section-label"
                      id={`${formId}-category-label`}
                    >
                      Change category
                    </span>
                    <div aria-labelledby={`${formId}-category-label`}>
                      <ProductCategoryPicker
                        key={String(id)}
                        value={selectedCategory}
                        onChange={setSelectedCategory}
                        disabled={saving}
                      />
                    </div>
                  </div>
                </div>
                <div className="product-detail-edit-actions">
                  <button
                    type="button"
                    className="products-modal-btn products-modal-btn--primary"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ProductDetail;
