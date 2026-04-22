import { useEffect, useState } from 'react';
import {
  createTag,
  fetchTagChildren,
  messageFromFailedResponse,
} from '../api/adminApi';

/**
 * @param {{ open: boolean, onClose: () => void, onCreated?: (categoryPath: string) => void }} props
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
      let res = await createTag({ name: root, parentId: null });
      if (!res.ok) {
        const msg = await messageFromFailedResponse(res);
        throw new Error(msg || `Could not create main category “${root}” (${res.status})`);
      }
      let data = await res.json();
      const idRoot = data?.id;
      if (idRoot == null) throw new Error('Missing id for main category.');

      res = await createTag({ name: s1, parentId: idRoot });
      if (!res.ok) {
        const msg = await messageFromFailedResponse(res);
        throw new Error(msg || `Could not create 1st subcategory “${s1}” (${res.status})`);
      }
      data = await res.json();
      const id1 = data?.id;
      if (id1 == null) throw new Error('Missing id for 1st subcategory.');

      res = await createTag({ name: s2, parentId: id1 });
      if (!res.ok) {
        const msg = await messageFromFailedResponse(res);
        throw new Error(msg || `Could not create 2nd subcategory “${s2}” (${res.status})`);
      }
      data = await res.json();
      const id2 = data?.id;
      if (id2 == null) throw new Error('Missing id for 2nd subcategory.');

      const check = await fetchTagChildren(id2);
      if (!check.ok) {
        const msg = await messageFromFailedResponse(check);
        throw new Error(msg || 'Could not load the new leaf tag.');
      }
      const leaf = await check.json();
      if (leaf.isLeaf !== true) {
        throw new Error('The last level is not a leaf. Try again or contact support.');
      }
      const path = leaf.categoryPath
        ? String(leaf.categoryPath)
        : [root, s1, s2].join('.');
      onCreated?.(path);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create category path.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="products-modal-backdrop"
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
          <h3 id="new-category-title">New category</h3>
          <p className="products-modal-subtitle">Main category + 2 subcategories (leaf for listings)</p>
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
                Example path:{' '}
                <span className="products-category-dotted-path">Electronics.Laptop.MSI</span>
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
              {submitting ? 'Creating…' : 'Create category'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
