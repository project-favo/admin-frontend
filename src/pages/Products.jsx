import '../styles/Products.css';
import ProductTable from '../components/ProductTable';
import { useEffect, useMemo, useState } from 'react';
import { listProducts } from '../api/adminApi';
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
    if (parts.length > 0) return parts[parts.length - 1];
  }
  const name = tag?.name;
  return name ? String(name) : '—';
}

function toStatusLabel(product) {
  const active = product?.isActive ?? product?.active;
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
  const [allProducts, setAllProducts] = useState([]);
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
        const res = await listProducts({ signal: controller.signal });
        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }
        const dto = await res.json();
        const list = Array.isArray(dto) ? dto : [];
        if (!alive) return;
        setAllProducts(list);
        setPage(0);
      } catch (e) {
        if (!alive) return;
        setAllProducts([]);
        setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  const totalElements = allProducts.length;
  const totalPages = totalElements > 0 ? Math.ceil(totalElements / size) : 0;

  useEffect(() => {
    if (totalPages <= 0) return;
    if (page > totalPages - 1) {
      setPage(totalPages - 1);
    }
  }, [totalPages, page]);

  const effectivePage = useMemo(() => {
    if (totalPages <= 0) return 0;
    return Math.min(page, totalPages - 1);
  }, [page, totalPages]);

  const pageSlice = useMemo(() => {
    const start = effectivePage * size;
    return allProducts.slice(start, start + size);
  }, [allProducts, effectivePage, size]);

  const rows = useMemo(
    () =>
      pageSlice.map((p, idx) => {
        const idRaw = p?.id ?? `${effectivePage}-${idx}`;
        const raw = p?.isActive ?? p?.active;
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
      }),
    [pageSlice, effectivePage]
  );

  const formattedTotal = useMemo(() => formatInteger(totalElements), [totalElements]);
  const showingFrom =
    totalElements === 0 ? 0 : effectivePage * size + (rows.length > 0 ? 1 : 0);
  const showingTo = effectivePage * size + rows.length;
  const canPrev = effectivePage > 0 && !loading;
  const canNext = !loading && totalPages > 0 && effectivePage + 1 < totalPages;
  const visiblePages = useMemo(() => {
    if (totalPages <= 0) return [];
    return getVisiblePages({ page: effectivePage, totalPages, maxButtons: 3 });
  }, [effectivePage, totalPages]);

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
              setPage(Math.max(0, effectivePage - 1));
            }}
          >
            &lt; Prev
          </button>
          {visiblePages.map((p) => (
            <button
              key={p}
              type="button"
              className={
                p === effectivePage
                  ? 'products-pagination-page products-pagination-page--active'
                  : 'products-pagination-page'
              }
              aria-current={p === effectivePage ? 'page' : undefined}
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
              setPage(Math.min(totalPages - 1, effectivePage + 1));
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
