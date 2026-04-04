import '../styles/ProductTable.css';
import { useEffect, useId, useState } from 'react';

/**
 * @typedef {Object} ProductTableRow
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {string} status
 * @property {boolean|null} [active] — true: listede aktif; false: pasif/gizli; null: bilinmiyor
 */

/**
 * @param {boolean|null} active
 * @returns {'active' | 'inactive' | 'unknown'}
 */
function getProductActivityKind(active) {
  if (active === true) return 'active';
  if (active === false) return 'inactive';
  return 'unknown';
}

/**
 * @param {{ products: ProductTableRow[] }} props
 */
const ProductTable = ({ products }) => {
  const menuIdPrefix = useId();
  const [openRowId, setOpenRowId] = useState(null);

  useEffect(() => {
    if (openRowId == null) return undefined;

    /** @param {MouseEvent} e */
    function onPointerDown(e) {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
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
            <col className="products-table-col-image" />
            <col className="products-table-col-name" />
            <col className="products-table-col-category" />
            <col className="products-table-col-status" />
            <col className="products-table-col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Image</th>
              <th scope="col">Product Name</th>
              <th scope="col">Category</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(({ id, name, category, status, active }) => {
              const kind = getProductActivityKind(active ?? null);
              const menuId = `${menuIdPrefix}-${id}`;
              const isOpen = openRowId === id;
              return (
                <tr key={id}>
                  <td>🖼️</td>
                  <td>{name}</td>
                  <td>{category}</td>
                  <td>{status}</td>
                  <td>
                    <details
                      className="products-actions"
                      aria-label="Product actions"
                      open={isOpen}
                      data-products-actions-row-id={id}
                      onToggle={(e) => {
                        const nextOpen = e.currentTarget.open;
                        setOpenRowId(nextOpen ? id : null);
                      }}
                    >
                      <summary
                        className="products-actions-trigger"
                        aria-haspopup="menu"
                        aria-controls={menuId}
                        onClick={(e) => {
                          e.preventDefault();
                          setOpenRowId((prev) => (prev === id ? null : id));
                        }}
                      >
                        ⋮
                      </summary>
                      <div id={menuId} className="products-actions-menu" role="menu">
                        <button type="button" className="products-actions-item" role="menuitem">
                          Edit
                        </button>
                        <button type="button" className="products-actions-item" role="menuitem">
                          View
                        </button>
                        {kind === 'active' && (
                          <>
                            <button
                              type="button"
                              className="products-actions-item"
                              role="menuitem"
                            >
                              Deactivate
                            </button>
                            <button
                              type="button"
                              className="products-actions-item"
                              role="menuitem"
                            >
                              Hide
                            </button>
                          </>
                        )}
                        {kind === 'inactive' && (
                          <>
                            <button
                              type="button"
                              className="products-actions-item"
                              role="menuitem"
                            >
                              Aktifleştir (Activate)
                            </button>
                            <button
                              type="button"
                              className="products-actions-item"
                              role="menuitem"
                            >
                              Yayınla (Publish)
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="products-actions-item products-actions-item--danger"
                          role="menuitem"
                        >
                          Delete
                        </button>
                      </div>
                    </details>
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
