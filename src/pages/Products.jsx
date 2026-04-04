import '../styles/Products.css';
import ProductTable from '../components/ProductTable';
import { useEffect, useMemo, useState } from 'react';
import { listAdminProducts } from '../api/adminApi';
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

const Products = () => {
  const [page, setPage] = useState(0);
  const [size] = useState(15);
  const [rows, setRows] = useState([]);
  const [totalElements, setTotalElements] = useState(null);
  const [totalPages, setTotalPages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        const content = Array.isArray(dto?.content) ? dto.content : [];
        const mapped = content.map((p, idx) => {
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
        });

        if (!alive) return;
        setRows(mapped);
        setTotalElements(
          typeof dto?.totalElements === 'number'
            ? dto.totalElements
            : dto?.totalElements != null
              ? Number(dto.totalElements)
              : null
        );
        setTotalPages(
          typeof dto?.totalPages === 'number'
            ? dto.totalPages
            : dto?.totalPages != null
              ? Number(dto.totalPages)
              : null
        );
      } catch (e) {
        if (!alive) return;
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

      {loading ? (
        <div className="products-loading" aria-live="polite" aria-busy="true">
          <img src={loadingDots} alt="Loading" />
          <div className="products-loading-text">Loading products…</div>
        </div>
      ) : (
        <ProductTable products={rows} />
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
