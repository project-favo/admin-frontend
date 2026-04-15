import '../styles/Products.css';
import ProductTable from '../components/ProductTable';
import TablePagination from '../components/TablePagination';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  buildProductUpdateBody,
  fetchAllAdminProducts,
  getAdminProduct,
  listAdminProducts,
  messageFromFailedResponse,
  normalizeAdminPageDto,
  patchAdminProductActivate,
  patchAdminProductDeactivate,
  putProduct,
} from '../api/adminApi';
import { downloadProductsPdf } from '../utils/productsPdfExport';
import { getTablePageSize } from '../utils/adminPreferences';
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

/** @returns {'active' | 'inactive' | 'unknown'} */
function toProductStatusKind(product) {
  const active = product?.isActive ?? product?.active ?? product?.is_active;
  if (active === true || active === 'true' || active === 1) return 'active';
  if (active === false || active === 'false' || active === 0) return 'inactive';
  return 'unknown';
}

function statusLabelFromProductKind(kind) {
  if (kind === 'active') return 'Active';
  if (kind === 'inactive') return 'Inactive';
  return '—';
}

const PRODUCTS_POLL_MS = 5000;

function mapProductDtoToRow(p, page, idx) {
  const idRaw = p?.id ?? `${page}-${idx}`;
  const raw = p?.isActive ?? p?.active ?? p?.is_active;
  let active = null;
  if (raw === true || raw === 'true' || raw === 1) active = true;
  else if (raw === false || raw === 'false' || raw === 0) active = false;

  const statusKind = toProductStatusKind(p);
  return {
    id: String(idRaw),
    name: p?.name != null ? String(p.name) : '—',
    category: toCategoryLabel(p),
    statusKind,
    statusLabel: statusLabelFromProductKind(statusKind),
    active,
  };
}

function mapAdminProductsDtoToRows(dto, page) {
  const { content } = normalizeAdminPageDto(dto);
  return content.map((p, idx) => mapProductDtoToRow(p, page, idx));
}

/** @param {{ id: string, name: string, category: string, statusLabel: string }} row */
function productRowMatchesQuery(row, qLower) {
  if (!qLower) return true;
  return [row.id, row.name, row.category, row.statusLabel].some((field) =>
    String(field).toLowerCase().includes(qLower)
  );
}

function readProductPageMeta(dto) {
  const n = normalizeAdminPageDto(dto);
  return { totalElements: n.totalElements, totalPages: n.totalPages };
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
  const navigate = useNavigate();
  const location = useLocation();
  const [page, setPage] = useState(0);
  const [size] = useState(() => getTablePageSize());
  const [filter, setFilter] = useState('all'); // 'all' | 'active'
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
  const [pollTick, setPollTick] = useState(0);
  const pollSilentRef = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(
    /** @type {null | { ok: boolean, message: string }} */
    (null)
  );
  const [searchInput, setSearchInput] = useState('');
  const [listRefreshKey, setListRefreshKey] = useState(0);

  const searchTrim = useMemo(() => searchInput.trim().toLowerCase(), [searchInput]);
  const isSearchActive = searchTrim.length > 0;

  /** After creating a product: refetch list and open the page that contains the new row (often last page). */
  useEffect(() => {
    const st = location.state;
    if (!st || typeof st !== 'object' || !st.refreshProducts) return;

    const newId = st.newProductId;
    navigate(location.pathname, { replace: true, state: {} });

    setSearchInput('');
    setFilter('all');
    setPollTick((n) => n + 1);
    setListRefreshKey((k) => k + 1);

    if (newId == null) {
      setPage(0);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await listAdminProducts({
          page: 0,
          size,
          activeOnly: false,
        });
        if (cancelled || !res.ok) return;
        const dto = await res.json();
        const { content } = normalizeAdminPageDto(dto);
        if (content.some((p) => String(p?.id) === String(newId))) {
          setPage(0);
          return;
        }
        const meta = readProductPageMeta(dto);
        const tp = meta.totalPages;
        if (typeof tp === 'number' && Number.isFinite(tp) && tp > 1) {
          setPage(tp - 1);
        } else {
          setPage(0);
        }
      } catch {
        setPage(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, location.state, navigate, size]);

  const refreshCurrentPage = useCallback(async () => {
    if (isSearchActive) {
      setListRefreshKey((k) => k + 1);
      return;
    }
    const res = await listAdminProducts({
      page,
      size,
      activeOnly: filter === 'active',
    });
    if (!res.ok) {
      throw new Error(`Request failed (${res.status})`);
    }
    const dto = await res.json();
    setRows(mapAdminProductsDtoToRows(dto, page));
    const meta = readProductPageMeta(dto);
    setTotalElements(meta.totalElements);
    setTotalPages(meta.totalPages);
  }, [page, size, filter, isSearchActive]);

  useEffect(() => {
    const t = window.setInterval(() => {
      pollSilentRef.current = true;
      setPollTick((n) => n + 1);
    }, PRODUCTS_POLL_MS);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        pollSilentRef.current = true;
        setPollTick((n) => n + 1);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const silent = pollSilentRef.current;
    pollSilentRef.current = false;

    if (isSearchActive) return;

    if (!silent) {
      setLoading(true);
      setError(null);
    }

    (async () => {
      try {
        const res = await listAdminProducts({
          page,
          size,
          activeOnly: filter === 'active',
          signal: controller.signal,
        });
        if (cancelled) return;
        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }
        const dto = await res.json();
        if (cancelled) return;
        setError(null);
        setRows(mapAdminProductsDtoToRows(dto, page));
        const meta = readProductPageMeta(dto);
        setTotalElements(meta.totalElements);
        setTotalPages(meta.totalPages);
      } catch (e) {
        if (cancelled) return;
        if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') return;
        setRows([]);
        setTotalElements(null);
        setTotalPages(null);
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, size, filter, pollTick, isSearchActive]);

  useEffect(() => {
    if (!isSearchActive) return;
    let cancelled = false;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    (async () => {
      try {
        const dtos = await fetchAllAdminProducts({
          activeOnly: filter === 'active',
          signal: controller.signal,
        });
        if (cancelled) return;
        const allRows = dtos.map((p, idx) => mapProductDtoToRow(p, 0, idx));
        const filtered = allRows.filter((row) => productRowMatchesQuery(row, searchTrim));
        const n = filtered.length;
        const tp = n === 0 ? 0 : Math.ceil(n / size);
        const slice = filtered.slice(page * size, page * size + size);
        if (cancelled) return;
        setError(null);
        setRows(slice);
        setTotalElements(n);
        setTotalPages(tp);
      } catch (e) {
        if (cancelled) return;
        if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') return;
        setRows([]);
        setTotalElements(null);
        setTotalPages(null);
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filter, page, size, listRefreshKey, searchTrim, isSearchActive]);

  useEffect(() => {
    setPage(0);
  }, [searchTrim]);

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
  const showingFrom = rows.length === 0 ? 0 : page * size + 1;
  const showingTo = page * size + rows.length;
  const canPrev = page > 0 && !loading;
  const canNext =
    !loading &&
    (typeof totalPages === 'number' ? page + 1 < totalPages : rows.length === size);
  const pageStatusText = useMemo(() => {
    const tp =
      typeof totalPages === 'number' && totalPages > 0 ? String(totalPages) : '—';
    return `Page ${page + 1} of ${tp}`;
  }, [page, totalPages]);

  const goPrev = () => setPage((p) => Math.max(0, p - 1));
  const goNext = () => setPage((p) => p + 1);
  const goToNewestPage = () => {
    if (typeof totalPages === 'number' && totalPages > 0) setPage(totalPages - 1);
  };

  async function handleExportPdf() {
    if (exporting) return;
    setExportFeedback(null);
    setExporting(true);
    try {
      const dtos = await fetchAllAdminProducts({
        activeOnly: filter === 'active',
      });
      let rows = dtos.map((p, idx) => mapProductDtoToRow(p, 0, idx));
      if (isSearchActive) {
        rows = rows.filter((r) => productRowMatchesQuery(r, searchTrim));
      }
      const filterLabel = filter === 'active' ? 'Active only' : 'All products';
      const searchSuffix = isSearchActive ? ` · Search: "${searchInput.trim()}"` : '';
      downloadProductsPdf({
        rows: rows.map(({ id, name, category, statusLabel }) => ({
          id,
          name,
          category,
          statusLabel,
        })),
        filterLabel: `${filterLabel}${searchSuffix}`,
      });
      setExportFeedback({ ok: true, message: 'PDF downloaded.' });
    } catch (e) {
      setExportFeedback({
        ok: false,
        message: e instanceof Error ? e.message : 'Export failed.',
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="products-page">
      <div className="products-page-inner">
        <header className="products-header">
          <h2 className="products-main-title">Product catalog</h2>
          <p className="products-subtitle">
            Browse listings, filter by availability, and edit or change product availability.
          </p>
        </header>

        <div className="products-toolbar" aria-label="Product list controls">
          <div
            className="products-total-pill"
            title={
              filter === 'active'
                ? 'Total active listings'
                : 'Total products (all statuses)'
            }
          >
            <span className="products-total-pill-label">
              {filter === 'active' ? 'Active' : 'All'} products
            </span>
            <span className="products-total-pill-value" aria-live="polite">
              {loading && formattedTotal == null ? '…' : formattedTotal ?? '—'}
            </span>
          </div>
          <div
            className="products-filter-segment"
            role="group"
            aria-label="Filter by listing status"
          >
            <button
              type="button"
              className={
                filter === 'all'
                  ? 'products-filter-segment-btn products-filter-segment-btn--active'
                  : 'products-filter-segment-btn'
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
                  ? 'products-filter-segment-btn products-filter-segment-btn--active'
                  : 'products-filter-segment-btn'
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
          <div className="products-toolbar-search">
            <input
              type="search"
              className="products-toolbar-search-input"
              placeholder="Search by name, ID, category…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search products"
              autoComplete="off"
            />
          </div>
          <div className="products-toolbar-actions">
            <button
              type="button"
              className="products-toolbar-newest"
              title="Jump to the last page (newest products by ID)"
              onClick={goToNewestPage}
              disabled={loading || typeof totalPages !== 'number' || totalPages <= 1}
            >
              Newest
            </button>
            <button
              type="button"
              className="products-toolbar-add"
              onClick={() => navigate('/products/new')}
            >
              Add product
            </button>
            <button
              type="button"
              className="products-toolbar-export"
              title="Download PDF of all products matching the current filter"
              onClick={handleExportPdf}
              disabled={loading || exporting}
            >
              {exporting ? 'Exporting…' : 'Export'}
            </button>
          </div>
        </div>

        {error && (
          <div className="products-alert products-alert--error" role="alert">
            Failed to load products: {error}
          </div>
        )}

        {actionError && (
          <div className="products-alert products-alert--error" role="alert">
            Action failed: {actionError}
          </div>
        )}

        {exportFeedback && (
          <div
            className={
              exportFeedback.ok
                ? 'products-alert products-alert--success'
                : 'products-alert products-alert--error'
            }
            role="status"
          >
            {exportFeedback.message}
          </div>
        )}

        {loading ? (
          <div className="products-loading" aria-live="polite" aria-busy="true">
            <img src={loadingDots} alt="" />
            <div className="products-loading-text">Loading products…</div>
          </div>
        ) : !error && rows.length === 0 ? (
          <div className="products-empty" role="status">
            <p className="products-empty-title">No products to show</p>
            <p className="products-empty-hint">
              {isSearchActive
                ? 'No products match this search. Try different keywords.'
                : filter === 'active'
                  ? 'There are no active listings matching this filter.'
                  : 'No product records were returned for this page.'}
            </p>
          </div>
        ) : !error ? (
          <>
            <div className="products-pagination-bar products-pagination-bar--top">
              <TablePagination
                ariaLabel="Product list pages (top)"
                statusText={pageStatusText}
                canPrev={canPrev}
                canNext={canNext}
                onPrev={goPrev}
                onNext={goNext}
              />
            </div>
            <ProductTable
              products={rows}
              onView={handleView}
              onEdit={openEdit}
              onActivate={handleActivate}
              onDeactivate={handleDeactivate}
              actionBusyId={actionBusyId}
            />
          </>
        ) : null}

        <footer className="products-footer">
          <p className="products-footer-summary">
            Showing {showingFrom}-{showingTo} of{' '}
            {loading && formattedTotal == null ? '…' : formattedTotal ?? '—'} products
          </p>
          <div className="products-pagination-bar products-pagination-bar--bottom">
            <TablePagination
              ariaLabel="Product list pages (bottom)"
              statusText={pageStatusText}
              canPrev={canPrev}
              canNext={canNext}
              onPrev={goPrev}
              onNext={goNext}
            />
          </div>
        </footer>

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
              <div className="products-modal-header">
                <h3 id="products-view-title">Product detail</h3>
                {viewModal.status === 'ok' && viewModal.product?.name != null && (
                  <p className="products-modal-subtitle">{String(viewModal.product.name)}</p>
                )}
              </div>
              {viewModal.status === 'loading' && (
                <div className="products-modal-body">
                  <div className="products-modal-state products-modal-state--loading" role="status">
                    Loading product…
                  </div>
                </div>
              )}
              {viewModal.status === 'err' && (
                <div className="products-modal-body">
                  <div className="products-modal-state products-modal-state--error" role="alert">
                    {viewModal.message}
                  </div>
                </div>
              )}
              {viewModal.status === 'ok' && (
                <div className="products-modal-body">
                  <div className="products-modal-panel">
                    <ProductViewImageSection product={viewModal.product} />
                    <div className="products-modal-detail">
                      {formatProductDetail(viewModal.product).map(([k, v]) => (
                        <div key={k} className="products-modal-detail-row">
                          <span className="products-modal-detail-key">{k}</span>
                          <span className="products-modal-detail-val">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="products-modal-actions">
                <button
                  type="button"
                  className="products-modal-btn products-modal-btn--primary"
                  onClick={() => setViewModal(null)}
                >
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
              className="products-modal products-modal--edit"
              role="dialog"
              aria-modal="true"
              aria-labelledby="products-edit-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="products-modal-header">
                <h3 id="products-edit-title">Edit product</h3>
                {editModal.status === 'ok' && (
                  <p className="products-modal-subtitle">ID {editModal.id}</p>
                )}
              </div>
              {editModal.status === 'loading' && (
                <div className="products-modal-body">
                  <div className="products-modal-state products-modal-state--loading" role="status">
                    Loading product…
                  </div>
                </div>
              )}
              {editModal.status === 'err' && (
                <div className="products-modal-body">
                  <div className="products-modal-state products-modal-state--error" role="alert">
                    {editModal.message}
                  </div>
                </div>
              )}
              {editModal.status === 'ok' && (
                <div className="products-modal-body">
                  <div className="products-modal-form-panel">
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
                    <div className="products-modal-field products-modal-field--last">
                      <label htmlFor="product-edit-tag">Leaf tag ID</label>
                      <input
                        id="product-edit-tag"
                        className="products-modal-input-readonly"
                        value={editModal.tagId}
                        readOnly
                        aria-readonly="true"
                        aria-describedby="product-edit-tag-hint"
                        title="Category (leaf tag) cannot be changed when editing"
                        disabled={editSaving}
                        inputMode="numeric"
                        autoComplete="off"
                      />
                      <p className="products-modal-field-hint" id="product-edit-tag-hint">
                        Category is fixed for this listing. To use another category, add a new
                        product.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="products-modal-actions">
                <button
                  type="button"
                  className="products-modal-btn products-modal-btn--secondary"
                  disabled={editSaving}
                  onClick={() => setEditModal(null)}
                >
                  Cancel
                </button>
                {editModal.status === 'ok' && (
                  <button
                    type="button"
                    className="products-modal-btn products-modal-btn--primary"
                    disabled={editSaving}
                    onClick={handleEditSave}
                  >
                    {editSaving ? 'Saving…' : 'Save changes'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;
