import '../styles/ProductTable.css';
import '../styles/ModerationTable.css';
import { Link } from 'react-router-dom';

function initialsFromProductName(name) {
  const s = String(name || '')
    .replace(/^[\s—]+/, '')
    .trim();
  if (!s || s === '—') return '?';
  const compact = s.replace(/[^a-zA-Z0-9ğüşıöçĞÜŞİÖÇ]/g, '');
  if (compact.length >= 2) return compact.slice(0, 2).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

/**
 * @typedef {Object} ProductTableRow
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {string} statusLabel
 * @property {'active' | 'inactive' | 'unknown'} statusKind
 * @property {boolean|null} [active] — true: listede aktif; false: pasif/gizli; null: bilinmiyor
 */

/**
 * @param {{
 *   products: ProductTableRow[];
 *   onActivate: (id: string) => void;
 *   onDeactivate: (id: string) => void;
 *   actionBusyId: string | null;
 * }} props
 */
const ProductTable = ({ products, onActivate, onDeactivate, actionBusyId }) => {
  const anyActionBusy = actionBusyId != null;

  return (
    <section className="products-table-wrap" aria-label="Product list">
      <div className="products-table-scroll">
        <table className="products-table">
          <colgroup>
            <col className="products-table-col-thumb" />
            <col className="products-table-col-name" />
            <col className="products-table-col-category" />
            <col className="products-table-col-status" />
            <col className="products-table-col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Preview</th>
              <th scope="col">Product name</th>
              <th scope="col">Category</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(({ id, name, category, statusLabel, statusKind, active }) => {
              const isInactive = active === false;
              const rowBusy = actionBusyId === id;
              const kind = statusKind ?? 'unknown';
              const initials = initialsFromProductName(name);
              return (
                <tr key={id}>
                  <td>
                    <span className="products-thumb" aria-hidden="true" title={name}>
                      {initials}
                    </span>
                  </td>
                  <td className="products-cell-name">
                    <Link
                      to={`/products/${encodeURIComponent(id)}`}
                      className="products-name-link"
                    >
                      {name}
                    </Link>
                  </td>
                  <td className="products-cell-category">{category}</td>
                  <td>
                    <span
                      className={
                        kind === 'active'
                          ? 'products-status-badge products-status-badge--active'
                          : kind === 'inactive'
                            ? 'products-status-badge products-status-badge--inactive'
                            : 'products-status-badge products-status-badge--unknown'
                      }
                    >
                      {statusLabel}
                    </span>
                  </td>
                  <td className="products-table-actions-cell">
                    <div className="moderation-action-group">
                      {isInactive ? (
                        <button
                          type="button"
                          className="moderation-action-btn moderation-action-btn--approve"
                          aria-label="Activate product"
                          aria-busy={rowBusy}
                          disabled={anyActionBusy}
                          onClick={() => onActivate(id)}
                        >
                          Activate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="moderation-action-btn moderation-action-btn--reject"
                          aria-label="Deactivate product"
                          aria-busy={rowBusy}
                          disabled={anyActionBusy}
                          onClick={() => onDeactivate(id)}
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ProductTable;
