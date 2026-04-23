import { useEffect, useState } from 'react';
import { createThreeLevelTagPath } from '../api/adminApi';

/**
 * Eski Add product kategori bölümüyle aynı: `createThreeLevelTagPath` (3× tag + yaprak).
 *
 * @param {{ open: boolean, onClose: () => void, onCreated?: (result: { categoryPath: string, id: number, name: string }) => void }} props
 */
export default function NewCategoryPathDialog({ open, onClose, onCreated }) {
  const [pathRoot, setPathRoot] = useState('');
  const [pathSub1, setPathSub1] = useState('');
  const [pathSub2, setPathSub2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    setPathRoot('');
    setPathSub1('');
    setPathSub2('');
  }, [open]);

  if (!open) return null;

  const preview = (() => {
    const a = pathRoot.trim();
    const b = pathSub1.trim();
    const c = pathSub2.trim();
    if (!a && !b && !c) return null;
    return [a, b, c].filter((s) => s !== '').join('.');
  })();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const root = pathRoot.trim();
    const s1 = pathSub1.trim();
    const s2 = pathSub2.trim();
    if (!root || !s1 || !s2 || submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const leaf = await createThreeLevelTagPath({ main: root, sub1: s1, sub2: s2 });
      onCreated?.(leaf);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create category path.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="products-modal-backdrop products-modal-backdrop--new-category"
      role="presentation"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="products-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-category-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="products-modal-header">
          <h3 id="new-category-title">New: main + 2 subcategories</h3>
          <p className="products-modal-subtitle">
            One main, two sub-levels; the leaf is where products attach (e.g.{' '}
            <span className="products-category-dotted-path">Electronics.Laptop.MSI</span>). If part of
            the path already exists (e.g. you already added a sibling leaf under the same main and
            sub), those segments are reused—only the missing one is created.
          </p>
        </div>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <div className="products-modal-body">
            {formError && (
              <div
                className="products-alert products-alert--error products-new-category-err"
                role="alert"
              >
                {formError}
              </div>
            )}
            <div className="products-modal-form-panel">
              <p className="products-modal-field-hint products-new-category-hint">
                The product is placed on the <strong>second</strong> subcategory (leaf).
              </p>
              <div className="products-modal-field">
                <label htmlFor="new-cat-root">Main category</label>
                <input
                  id="new-cat-root"
                  value={pathRoot}
                  onChange={(e) => setPathRoot(e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. Electronics"
                  autoComplete="off"
                />
              </div>
              <div className="products-modal-field">
                <label htmlFor="new-cat-s1">1st subcategory</label>
                <input
                  id="new-cat-s1"
                  value={pathSub1}
                  onChange={(e) => setPathSub1(e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. Laptop"
                  autoComplete="off"
                />
              </div>
              <div className="products-modal-field products-modal-field--last">
                <label htmlFor="new-cat-s2">2nd subcategory (leaf)</label>
                <input
                  id="new-cat-s2"
                  value={pathSub2}
                  onChange={(e) => setPathSub2(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    if (!pathRoot.trim() || !pathSub1.trim() || !pathSub2.trim() || submitting) {
                      return;
                    }
                    const form = e.currentTarget.closest('form');
                    if (form) form.requestSubmit();
                  }}
                  disabled={submitting}
                  placeholder="e.g. MSI"
                  autoComplete="off"
                />
              </div>
              {preview && (
                <p className="products-new-category-path-preview" role="status">
                  Path: <span className="products-category-dotted-path">{preview}</span>
                </p>
              )}
            </div>
          </div>
          <div className="products-modal-actions">
            <button
              type="button"
              className="products-modal-btn products-modal-btn--secondary"
              disabled={submitting}
              onClick={() => onClose()}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="products-modal-btn products-modal-btn--primary"
              disabled={submitting || !pathRoot.trim() || !pathSub1.trim() || !pathSub2.trim()}
            >
              {submitting ? 'Creating…' : 'Create path & use as product category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
