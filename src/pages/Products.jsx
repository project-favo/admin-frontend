import '../styles/Products.css';
import ProductTable from '../components/ProductTable';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildProductUpdateBody,
  deleteProduct,
  getAdminProduct,
  listAdminProducts,
  messageFromFailedResponse,
  patchAdminProductActivate,
  patchAdminProductDeactivate,
  putProduct,
} from '../api/adminApi';
import loadingDots from '../assets/loading-dots.svg';

function formatInteger(value) {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function toCategoryLabel(product) {
  const tag = product?.tag;
  const path = tag?.categoryPath;
  if (path && typeof path === 'string') {
    const parts = path.split('.').filter(Boolean);
    if (parts.length > 0) return parts[0];
  }
  const name = tag?.name;
  return name ? String(name) : '—';
}

function toStatusLabel(product) {
  const active = product?.isActive ?? product?.active ?? product?.is_active;
  if (active === true) return '🟢 Active';
  if (active === false) return '🔴 Inactive';
  return '—';
}

function scrollToProductsTop() {
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

function mapProductDtoToRow(p, page, idx) {
  const idRaw = p?.id ?? `${page}-${idx}`;
  const raw = p?.isActive ?? p?.active ?? p?.is_active;
  let active = null;
  if (raw === true || raw === 'true' || raw === 1) active = true;
  else if (raw === false || raw === 'false' || raw === 0) active = false;

  return {
    id: String(idRaw),
    name: p?.name != null ? String(p.name) : '—',
    category: toCategoryLabel(p),
    status: toStatusLabel(p),
    active,
  };
}

function mapAdminProductsDtoToRows(dto, page) {
  const content = Array.isArray(dto?.content) ? dto.content : [];
  return content.map((p, idx) => mapProductDtoToRow(p, page, idx));
}

function readProductPageMeta(dto) {
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

function getProductImageUrl(product) {
  if (!product || typeof product !== 'object') return '';
  const u = product.imageURL ?? product.imageUrl ?? product.image_url;
  if (u == null || typeof u !== 'string') return '';
  const t = u.trim();
  return t;
}

/**
 * ISO / backend datetime → English (en-US) date + time, e.g. Jan 15, 2024, 2:30 PM.
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

function formatProductDetail(product) {
  if (!product || typeof product !== 'object') return [];
  const tag = product.tag;
  const tagLine =
    tag && typeof tag === 'object'
      ? [tag.name, tag.categoryPath].filter(Boolean).join(' · ') || '—'
      : '—';
  const activeRaw = product?.isActive ?? product?.active ?? product?.is_active;
  const activeLabel =
    activeRaw === true ? 'Yes' : activeRaw === false ? 'No' : '—';
  const createdRaw = product.createdAt ?? product.created_at;
  return [
    ['ID', String(product.id ?? '—')],
    ['Name', product.name != null ? String(product.name) : '—'],
    ['Description', product.description != null ? String(product.description) : '—'],
    ['Tag', tagLine],
    ['Active', activeLabel],
    ['Created', formatCreatedAt(createdRaw)],
  ];
}

/**
 * @param {{ url: string }} props
 */
function ProductImagePreview({ url, resetKey, alt }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [resetKey]);
  if (!url) return null;
  if (failed) {
    return (
      <p className="products-modal-view-image-fallback" role="status">
        Image could not be loaded.
      </p>
    );
  }
  return (
    <img
      className="products-modal-view-image"
      src={url}
      alt={alt || ''}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

/**
 * @param {{ product: object }} props
 */
function ProductViewImageSection({ product }) {
  const imageUrl = getProductImageUrl(product);
  if (!imageUrl) return null;
  const id = product?.id != null ? String(product.id) : imageUrl;
  const name = product?.name != null ? String(product.name) : 'Product';
  return (
    <div className="products-modal-view-image-block">
      <ProductImagePreview resetKey={id} url={imageUrl} alt={name} />
      <a
        className="products-modal-image-link"
        href={imageUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open image URL
      </a>
    </div>
  );
}

const Products = () => {
  const [page, setPage] = useState(0);
  const [size] = useState(15);
  const [rows, setRows] = useState([]);
  const [totalElements, setTotalElements] = useState(null);
  const [totalPages, setTotalPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [viewModal, setViewModal] = useState(
    /** @type {null | { status: 'loading' } | { status: 'ok', product: object } | { status: 'err', message: string }} */
    (null)
  );
  const [editModal, setEditModal] = useState(
    /** @type {null | { status: 'loading' } | { status: 'ok', id: string, name: string, description: string, imageURL: string, tagId: string } | { status: 'err', message: string }} */
    (null)
  );
  const [editSaving, setEditSaving] = useState(false);

  const refreshCurrentPage = useCallback(async () => {
    const res = await listAdminProducts({
      page,
      size,
      activeOnly: false,
    });
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }
    const dto = await res.json();
    setRows(mapAdminProductsDtoToRows(dto, page));
    const meta = readProductPageMeta(dto);
    setTotalElements(meta.totalElements);
    setTotalPages(meta.totalPages);
  }, [page, size]);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    scrollToProductsTop();
    (async () => {
      try {
        const res = await listAdminProducts({
          page,
          size,
          activeOnly: false,
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }
        const dto = await res.json();

        if (!alive) return;
        setRows(mapAdminProductsDtoToRows(dto, page));
        const meta = readProductPageMeta(dto);
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
  }, [page, size]);

  const handleView = async (id) => {
    setViewModal({ status: 'loading' });
    try {
      const res = await getAdminProduct(id);
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const product = await res.json();
      setViewModal({ status: 'ok', product });
    } catch (e) {
      setViewModal({
        status: 'err',
        message: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  };

  const openEdit = async (id) => {
    setEditModal({ status: 'loading' });
    try {
      const res = await getAdminProduct(id);
      if (!res.ok) {
        throw new Error(`Request failed (${res.status})`);
      }
      const p = await res.json();
      const tagId =
        p?.tag && typeof p.tag === 'object' && p.tag.id != null
          ? String(p.tag.id)
          : '';
      const img = p?.imageURL ?? p?.imageUrl ?? p?.image_url;
      setEditModal({
        status: 'ok',
        id,
        name: p?.name != null ? String(p.name) : '',
        description: p?.description != null ? String(p.description) : '',
        imageURL: img != null ? String(img) : '',
        tagId,
      });
    } catch (e) {
      setEditModal({
        status: 'err',
        message: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  };

  const handleEditFieldChange = (field, value) => {
    setEditModal((prev) => {
      if (!prev || prev.status !== 'ok') return prev;
      return { ...prev, [field]: value };
    });
  };

  const handleEditSave = async () => {
    if (!editModal || editModal.status !== 'ok') return;
    setEditSaving(true);
    setActionError(null);
    try {
      const body = buildProductUpdateBody({
        name: editModal.name,
        description: editModal.description,
        imageURL: editModal.imageURL,
        tagId: editModal.tagId,
      });

      const res = await putProduct(editModal.id, body);
      if (!res.ok) {
        const detail = await messageFromFailedResponse(res);
        throw new Error(
          detail ||
            `Update failed (${res.status}). Check PUT /api/products/{id} on the server.`
        );
      }
      setEditModal(null);
      await refreshCurrentPage();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setEditSaving(false);
    }
  };

  const runProductAction = async (id, fn) => {
    setActionBusyId(id);
    setActionError(null);
    try {
      const res = await fn(id);
      if (!res.ok) {
        const detail = await messageFromFailedResponse(res);
        throw new Error(detail || `Request failed (${res.status})`);
      }
      await refreshCurrentPage();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setActionBusyId(null);
    }
  };

  const handleActivate = (id) => runProductAction(id, patchAdminProductActivate);
  const handleDeactivate = (id) => runProductAction(id, patchAdminProductDeactivate);

  const handleDelete = async (id) => {
    const ok = window.confirm(
      'Delete this product? This soft-deletes the product and related reviews (per server rules).'
    );
    if (!ok) return;
    await runProductAction(id, deleteProduct);
  };

  useEffect(() => {
    if (totalPages == null || totalPages <= 0) return;
    if (page > totalPages - 1) {
      setPage(totalPages - 1);
    }
  }, [totalPages, page]);

  const formattedTotal = useMemo(() => formatInteger(totalElements), [totalElements]);
  const showingFrom =
    totalElements == null ? 0 : page * size + (rows.length > 0 ? 1 : 0);
  const showingTo = totalElements == null ? rows.length : page * size + rows.length;
  const canPrev = page > 0 && !loading;
  const canNext =
    !loading &&
    (typeof totalPages === 'number' ? page + 1 < totalPages : rows.length === size);
  const visiblePages = useMemo(
    () => getVisiblePages({ page, totalPages, maxButtons: 3 }),
    [page, totalPages]
  );

  return (
    <div className="products-page">
      <h2 className="products-main-title">Product Catalog Management</h2>

      <div className="products-toolbar" aria-label="Product list controls">
        <div className="products-toolbar-count">
          <span>
            All Products (
            {loading && formattedTotal == null ? 'Loading…' : formattedTotal ?? '—'})
          </span>
        </div>
        <span className="products-toolbar-meta">Filter: All ⌄</span>
        <span className="products-toolbar-meta">+ Add New</span>
      </div>

      {error && (
        <div role="alert" style={{ margin: '12px 0' }}>
          Failed to load products: {error}
        </div>
      )}

      {actionError && (
        <div role="alert" style={{ margin: '12px 0' }}>
          Action failed: {actionError}
        </div>
      )}

      {loading ? (
        <div className="products-loading" aria-live="polite" aria-busy="true">
          <img src={loadingDots} alt="Loading" />
          <div className="products-loading-text">Loading products…</div>
        </div>
      ) : (
        <ProductTable
          products={rows}
          onView={handleView}
          onEdit={openEdit}
          onActivate={handleActivate}
          onDeactivate={handleDeactivate}
          onDelete={handleDelete}
          actionBusyId={actionBusyId}
        />
      )}

      {viewModal != null && (
        <div
          className="products-modal-backdrop"
          role="presentation"
          onClick={() => setViewModal(null)}
        >
          <div
            className="products-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="products-view-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="products-view-title">Product detail</h3>
            {viewModal.status === 'loading' && (
              <div className="products-modal-body">Loading…</div>
            )}
            {viewModal.status === 'err' && (
              <div className="products-modal-body" role="alert">
                {viewModal.message}
              </div>
            )}
            {viewModal.status === 'ok' && (
              <div className="products-modal-body">
                <ProductViewImageSection product={viewModal.product} />
                <dl>
                  {formatProductDetail(viewModal.product).map(([k, v]) => (
                    <Fragment key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </Fragment>
                  ))}
                </dl>
              </div>
            )}
            <div className="products-modal-actions">
              <button type="button" onClick={() => setViewModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal != null && (
        <div
          className="products-modal-backdrop"
          role="presentation"
          onClick={() => !editSaving && setEditModal(null)}
        >
          <div
            className="products-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="products-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="products-edit-title">Edit product</h3>
            {editModal.status === 'loading' && (
              <div className="products-modal-body">Loading…</div>
            )}
            {editModal.status === 'err' && (
              <div className="products-modal-body" role="alert">
                {editModal.message}
              </div>
            )}
            {editModal.status === 'ok' && (
              <div className="products-modal-body">
                <div className="products-modal-field">
                  <label htmlFor="product-edit-name">Name</label>
                  <input
                    id="product-edit-name"
                    value={editModal.name}
                    onChange={(e) => handleEditFieldChange('name', e.target.value)}
                    disabled={editSaving}
                    autoComplete="off"
                  />
                </div>
                <div className="products-modal-field">
                  <label htmlFor="product-edit-desc">Description</label>
                  <textarea
                    id="product-edit-desc"
                    value={editModal.description}
                    onChange={(e) => handleEditFieldChange('description', e.target.value)}
                    disabled={editSaving}
                  />
                </div>
                <div className="products-modal-field">
                  <label htmlFor="product-edit-img">Image URL</label>
                  <input
                    id="product-edit-img"
                    value={editModal.imageURL}
                    onChange={(e) => handleEditFieldChange('imageURL', e.target.value)}
                    disabled={editSaving}
                    autoComplete="off"
                  />
                </div>
                <div className="products-modal-field">
                  <label htmlFor="product-edit-tag">Leaf tag ID</label>
                  <input
                    id="product-edit-tag"
                    value={editModal.tagId}
                    onChange={(e) => handleEditFieldChange('tagId', e.target.value)}
                    disabled={editSaving}
                    inputMode="numeric"
                    autoComplete="off"
                  />
                </div>
              </div>
            )}
            <div className="products-modal-actions">
              <button
                type="button"
                disabled={editSaving}
                onClick={() => setEditModal(null)}
              >
                Cancel
              </button>
              {editModal.status === 'ok' && (
                <button type="button" disabled={editSaving} onClick={handleEditSave}>
                  {editSaving ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <footer className="products-footer">
        <p className="products-footer-summary">
          Showing {showingFrom}-{showingTo} of{' '}
          {loading && formattedTotal == null ? 'Loading…' : formattedTotal ?? '—'} products
        </p>
        <nav className="products-pagination" aria-label="Pagination">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => {
              scrollToProductsTop();
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
                  ? 'products-pagination-page products-pagination-page--active'
                  : 'products-pagination-page'
              }
              aria-current={p === page ? 'page' : undefined}
              disabled={loading}
              onClick={() => {
                scrollToProductsTop();
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
              scrollToProductsTop();
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

export default Products;
