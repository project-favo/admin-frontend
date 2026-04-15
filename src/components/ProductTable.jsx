import '../styles/ProductTable.css';
import AdminFloatingMenu, { isInsideAdminFloatingMenu } from './AdminFloatingMenu';
import { useEffect, useId, useRef, useState } from 'react';

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
 *   onView: (id: string) => void;
 *   onEdit: (id: string) => void;
 *   onActivate: (id: string) => void;
 *   onDeactivate: (id: string) => void;
 *   actionBusyId: string | null;
 * }} props
 */
const ProductTable = ({
  products,
  onView,
  onEdit,
  onActivate,
  onDeactivate,
  actionBusyId,
}) => {
  const menuIdPrefix = useId();
  const [openRowId, setOpenRowId] = useState(null);
  const openTriggerRef = useRef(null);

  const busy = actionBusyId != null;

  /** @param {() => void} fn */
  function runAndClose(fn) {
    fn();
    setOpenRowId(null);
  }

  useEffect(() => {
    if (openRowId == null) return undefined;

    /** @param {MouseEvent} e */
    function onPointerDown(e) {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      if (isInsideAdminFloatingMenu(target)) return;
      const container = document.querySelector(
        `[data-products-actions-row-id="${openRowId}"]`
      );
      if (!container) {
        setOpenRowId(null);
        return;
      }
      if (!container.contains(target)) setOpenRowId(null);
    }

    document.addEventListener('mousedown', onPointerDown, true);
    return () => document.removeEventListener('mousedown', onPointerDown, true);
  }, [openRowId]);

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
              const menuId = `${menuIdPrefix}-${id}`;
              const isOpen = openRowId === id;
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
                  <td className="products-cell-name">{name}</td>
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
                  <td>
                    <div className="products-actions" data-products-actions-row-id={id}>
                      <button
                        type="button"
                        ref={openRowId === id ? openTriggerRef : undefined}
                        className="products-actions-trigger"
                        aria-haspopup="menu"
                        aria-expanded={isOpen}
                        aria-controls={menuId}
                        aria-busy={rowBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (rowBusy) return;
                          setOpenRowId((prev) => (prev === id ? null : id));
                        }}
                      >
                        ⋮
                      </button>
                      {isOpen ? (
                        <AdminFloatingMenu open triggerRef={openTriggerRef} id={menuId}>
                          <div className="products-actions-menu-inner">
                            {!isInactive && (
                              <>
                                <button
                                  type="button"
                                  className="products-actions-item"
                                  role="menuitem"
                                  disabled={busy}
                                  onClick={() => runAndClose(() => onView(id))}
                                >
                                  View
                                </button>
                                <button
                                  type="button"
                                  className="products-actions-item"
                                  role="menuitem"
                                  disabled={busy}
                                  onClick={() => runAndClose(() => onEdit(id))}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="products-actions-item"
                                  role="menuitem"
                                  disabled={busy}
                                  onClick={() => runAndClose(() => onDeactivate(id))}
                                >
                                  Deactivate
                                </button>
                              </>
                            )}
                            {isInactive && (
                              <button
                                type="button"
                                className="products-actions-item"
                                role="menuitem"
                                disabled={busy}
                                onClick={() => runAndClose(() => onActivate(id))}
                              >
                                Activate
                              </button>
                            )}
                          </div>
                        </AdminFloatingMenu>
                      ) : null}
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
