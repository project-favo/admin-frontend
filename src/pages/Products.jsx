import '../styles/Products.css';
import NewCategoryPathDialog from '../components/NewCategoryPathDialog';
import ProductTable from '../components/ProductTable';
import TablePagination from '../components/TablePagination';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  fetchAllAdminProducts,
  listAdminProducts,
  messageFromFailedResponse,
  normalizeAdminPageDto,
  patchAdminProductActivate,
  patchAdminProductDeactivate,
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
const PRODUCTS_NAME_SEARCH_DEBOUNCE_MS = 300;

/**
 * I / İ (TR) gibi farklar için; Unicode NFC ile birleşik formlar eşleşir.
 * @param {string} s
 */
function foldForNameSearch(s) {
  if (s == null) return '';
  return String(s)
    .normalize('NFC')
    .toLocaleLowerCase('tr-TR');
}

/**
 * DTO farklı alanlarda isim tutabildiği için arama tüm adaylarda.
 * @param {unknown} p
 */
function productNameSearchBlob(p) {
  if (p == null || typeof p !== 'object') return '';
  return [
    p.name,
    p.title,
    p.productName,
    p.product_name,
  ]
    .filter((x) => x != null && String(x).trim() !== '')
    .map((x) => String(x))
    .join(' ');
}

/**
 * Tabloda gösterim — öncelik sırayla ilk dolu isim.
 * @param {unknown} p
 */
function productTableDisplayName(p) {
  if (p == null || typeof p !== 'object') return '—';
  const pick = p.name ?? p.title ?? p.productName ?? p.product_name;
  if (pick == null || String(pick).trim() === '') return '—';
  return String(pick);
}

/**
 * @param {string} q
 * @param {ReturnType<typeof mapProductDtoToRow>[]} rows
 */
function filterRowsByNameQuery(q, rows) {
  const needle = foldForNameSearch(q.trim());
  if (needle === '') return rows;
  return rows.filter((r) => {
    const hay = r._nameSearchBlob
      ? foldForNameSearch(r._nameSearchBlob)
      : foldForNameSearch(r.name);
    return hay.includes(needle);
  });
}

function mapProductDtoToRow(p, page, idx) {
  const idRaw = p?.id ?? `${page}-${idx}`;
  const raw = p?.isActive ?? p?.active ?? p?.is_active;
  let active = null;
  if (raw === true || raw === 'true' || raw === 1) active = true;
  else if (raw === false || raw === 'false' || raw === 0) active = false;

  const statusKind = toProductStatusKind(p);
  return {
    id: String(idRaw),
    name: productTableDisplayName(p),
    _nameSearchBlob: productNameSearchBlob(p),
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

function readProductPageMeta(dto) {
  const n = normalizeAdminPageDto(dto);
  return { totalElements: n.totalElements, totalPages: n.totalPages };
}

const Products = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [page, setPage] = useState(0);
  const [size] = useState(() => getTablePageSize());
  const [nameQuery, setNameQuery] = useState('');
  /** Tüm sorguyla eşleşen satırlar (sadece arama modu; yokta sunucu sayfalaması kullanılır). */
  const [nameSearchFull, setNameSearchFull] = useState(/** @type {null | ReturnType<typeof mapProductDtoToRow>[]} */(null));
  const [filter, setFilter] = useState('all'); // 'all' | 'active'
  const [rows, setRows] = useState([]);
  const [totalElements, setTotalElements] = useState(null);
  const [totalPages, setTotalPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [actionBusyId, setActionBusyId] = useState(null);
  const [pollTick, setPollTick] = useState(0);
  const pollSilentRef = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [exportFeedback, setExportFeedback] = useState(
    /** @type {null | { ok: boolean, message: string }} */
    (null)
  );
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [newCategoryFeedback, setNewCategoryFeedback] = useState(
    /** @type {null | { ok: boolean, message: string }} */ (null)
  );

  /** After creating a product: refetch list and open the page that contains the new row (often last page). */
  useEffect(() => {
    const st = location.state;
    if (!st || typeof st !== 'object' || !st.refreshProducts) return;

    const newId = st.newProductId;
    navigate(location.pathname, { replace: true, state: {} });

    setFilter('all');
    setNameQuery('');
    setPollTick((n) => n + 1);

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
    const q = nameQuery.trim();
    if (q) {
      const res = await fetchAllAdminProducts({
        activeOnly: filter === 'active',
      });
      const all = res.map((p, idx) => mapProductDtoToRow(p, 0, idx));
      const filtered = filterRowsByNameQuery(q, all);
      setNameSearchFull(filtered);
      const tp = filtered.length === 0 ? 0 : Math.ceil(filtered.length / size);
      const maxPage = tp > 0 ? tp - 1 : 0;
      const p = Math.min(page, maxPage);
      setTotalElements(filtered.length);
      setTotalPages(tp);
      setRows(filtered.slice(p * size, p * size + size));
      if (p !== page) setPage(p);
    } else {
      setNameSearchFull(null);
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
    }
  }, [page, size, filter, nameQuery]);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (nameQuery.trim() !== '') return;
      pollSilentRef.current = true;
      setPollTick((n) => n + 1);
    }, PRODUCTS_POLL_MS);
    return () => window.clearInterval(t);
  }, [nameQuery]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && nameQuery.trim() === '') {
        pollSilentRef.current = true;
        setPollTick((n) => n + 1);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [nameQuery]);

  useEffect(() => {
    if (nameQuery.trim() === '') {
      setNameSearchFull(null);
    }
  }, [nameQuery]);

  useEffect(() => {
    if (nameQuery.trim() !== '') return undefined;

    let cancelled = false;
    const controller = new AbortController();
    const silent = pollSilentRef.current;
    pollSilentRef.current = false;

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
  }, [page, size, filter, pollTick, nameQuery]);

  useEffect(() => {
    if (nameQuery.trim() === '') return;

    let cancelled = false;
    const controller = new AbortController();
    const t = window.setTimeout(() => {
      if (!nameQuery.trim()) return;
      setLoading(true);
      setPage(0);
      setError(null);
      const q = nameQuery.trim();
      (async () => {
        try {
          const res = await fetchAllAdminProducts({
            activeOnly: filter === 'active',
            signal: controller.signal,
          });
          if (cancelled) return;
          if (q !== nameQuery.trim()) return;
          const all = res.map((p, idx) => mapProductDtoToRow(p, 0, idx));
          const filtered = filterRowsByNameQuery(q, all);
          setNameSearchFull(filtered);
          setError(null);
        } catch (e) {
          if (cancelled) return;
          if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') return;
          setNameSearchFull(null);
          setRows([]);
          setTotalElements(null);
          setTotalPages(null);
          setError(e instanceof Error ? e.message : 'Unknown error');
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, PRODUCTS_NAME_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(t);
    };
  }, [nameQuery, filter]);

  useEffect(() => {
    if (nameQuery.trim() === '' || nameSearchFull == null) return;
    setTotalElements(nameSearchFull.length);
    const tp = nameSearchFull.length === 0 ? 0 : Math.ceil(nameSearchFull.length / size);
    setTotalPages(tp);
    const maxPage = tp > 0 ? tp - 1 : 0;
    const p = page > maxPage ? maxPage : page;
    if (p !== page) {
      setPage(p);
      return;
    }
    setRows(nameSearchFull.slice(p * size, p * size + size));
  }, [nameQuery, page, size, nameSearchFull]);

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
  const goFirst = () => setPage(0);
  const goLast = () => {
    if (typeof totalPages === 'number' && totalPages > 0) setPage(totalPages - 1);
  };
  const canFirst = page > 0 && !loading;
  const canLast =
    !loading &&
    typeof totalPages === 'number' &&
    totalPages > 1 &&
    page < totalPages - 1;

  async function handleExportPdf() {
    if (exporting) return;
    setExportFeedback(null);
    setExporting(true);
    try {
      const dtos = await fetchAllAdminProducts({
        activeOnly: filter === 'active',
      });
      let rowData = dtos.map((p, idx) => mapProductDtoToRow(p, 0, idx));
      if (nameQuery.trim()) {
        rowData = filterRowsByNameQuery(nameQuery, rowData);
      }
      const filterLabel = filter === 'all' ? 'All products' : 'Active only';
      const nameNote = nameQuery.trim() ? ` · name contains “${nameQuery.trim()}”` : '';
      downloadProductsPdf({
        rows: rowData.map(({ id, name, category, statusLabel }) => ({
          id,
          name,
          category,
          statusLabel,
        })),
        filterLabel: `${filterLabel}${nameNote}`,
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
            Browse listings, filter by availability, and manage product availability. Click a
            product name to view and edit details.
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
              id="products-name-search"
              type="search"
              className="products-toolbar-search-input"
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
              placeholder="Search by product name…"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              enterKeyHint="search"
              aria-label="Search by product name"
            />
          </div>
          <div className="products-toolbar-actions">
            <button
              type="button"
              className="products-toolbar-new-category"
              onClick={() => setNewCategoryOpen(true)}
            >
              New category
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

        {newCategoryFeedback && (
          <div
            className={
              newCategoryFeedback.ok
                ? 'products-alert products-alert--success'
                : 'products-alert products-alert--error'
            }
            role="status"
          >
            {newCategoryFeedback.message}
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
              {nameQuery.trim()
                ? 'No product names match your search. Try a shorter or different term.'
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
                canFirst={canFirst}
                canLast={canLast}
                onFirst={goFirst}
                onLast={goLast}
              />
            </div>
            <ProductTable
              products={rows}
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
              canFirst={canFirst}
              canLast={canLast}
              onFirst={goFirst}
              onLast={goLast}
            />
          </div>
        </footer>

        <NewCategoryPathDialog
          open={newCategoryOpen}
          onClose={() => setNewCategoryOpen(false)}
          onCreated={({ categoryPath }) => {
            setNewCategoryFeedback({
              ok: true,
              message: `Category created: ${categoryPath}`,
            });
            window.setTimeout(() => setNewCategoryFeedback(null), 8000);
          }}
        />
      </div>
    </div>
  );
};

export default Products;
