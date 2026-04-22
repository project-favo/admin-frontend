import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createTag,
  fetchTagChildren,
  fetchTagRoots,
  messageFromFailedResponse,
  searchTags,
} from '../api/adminApi';

/**
 * @typedef {{ id: number, name: string, categoryPath?: string }} TagRef
 */

/**
 * @param {{
 *   value: TagRef | null,
 *   onChange: (tag: TagRef | null) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function ProductCategoryPicker({ value, onChange, disabled = false }) {
  const [stack, setStack] = useState(/** @type {TagRef[]} */ ([]));
  const [currentTags, setCurrentTags] = useState(/** @type {TagRef[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [pickerError, setPickerError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchResults, setSearchResults] = useState(/** @type {TagRef[]} */ ([]));
  const [searchLoading, setSearchLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creating, setCreating] = useState(false);
  const searchAbortRef = useRef(null);

  const loadRoots = useCallback(async () => {
    const res = await fetchTagRoots();
    if (!res.ok) {
      const msg = await messageFromFailedResponse(res);
      throw new Error(msg || `Could not load categories (${res.status})`);
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    setCurrentTags(list);
  }, []);

  const loadChildrenList = useCallback(async (parent) => {
    const res = await fetchTagChildren(parent.id);
    if (!res.ok) {
      const msg = await messageFromFailedResponse(res);
      throw new Error(msg || `Could not open category (${res.status})`);
    }
    const data = await res.json();
    const children = Array.isArray(data?.children) ? data.children : [];
    setCurrentTags(children);
  }, []);

  const applyStack = useCallback(
    async (nextStack) => {
      setPickerError(null);
      setLoading(true);
      try {
        if (nextStack.length === 0) {
          await loadRoots();
        } else {
          const last = nextStack[nextStack.length - 1];
          await loadChildrenList(last);
        }
      } catch (e) {
        setPickerError(e instanceof Error ? e.message : 'Failed to load categories.');
        setCurrentTags([]);
      } finally {
        setLoading(false);
      }
    },
    [loadChildrenList, loadRoots]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await applyStack([]);
    })();
    return () => {
      cancelled = true;
    };
    // Intentionally once on mount — avoid resetting navigation when callbacks change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refetchCurrentLevel = useCallback(async () => {
    await applyStack(stack);
  }, [applyStack, stack]);

  const goBreadcrumb = (index) => {
    if (disabled) return;
    onChange(null);
    const next = index === 0 ? [] : stack.slice(0, index);
    setStack(next);
    applyStack(next);
  };

  const pickTagRow = async (tag) => {
    if (disabled) return;
    setPickerError(null);
    setLoading(true);
    try {
      const res = await fetchTagChildren(tag.id);
      if (!res.ok) {
        const msg = await messageFromFailedResponse(res);
        throw new Error(msg || `Request failed (${res.status})`);
      }
      const data = await res.json();
      if (data.isLeaf === true) {
        onChange({
          id: data.id,
          name: data.name,
          categoryPath: data.categoryPath,
        });
      } else {
        const next = [
          ...stack,
          { id: data.id, name: data.name, categoryPath: data.categoryPath },
        ];
        setStack(next);
        const children = Array.isArray(data.children) ? data.children : [];
        setCurrentTags(children);
        onChange(null);
      }
    } catch (e) {
      setPickerError(e instanceof Error ? e.message : 'Could not open category.');
    } finally {
      setLoading(false);
    }
  };

  const pickSearchResult = async (tag) => {
    if (disabled) return;
    setSearchInput('');
    setSearchResults([]);
    setPickerError(null);
    setLoading(true);
    try {
      const res = await fetchTagChildren(tag.id);
      if (!res.ok) {
        const msg = await messageFromFailedResponse(res);
        throw new Error(msg || `Request failed (${res.status})`);
      }
      const data = await res.json();
      if (data.isLeaf === true) {
        onChange({
          id: data.id,
          name: data.name,
          categoryPath: data.categoryPath,
        });
        setStack([]);
        await applyStack([]);
      } else {
        const next = [{ id: data.id, name: data.name, categoryPath: data.categoryPath }];
        setStack(next);
        const children = Array.isArray(data.children) ? data.children : [];
        setCurrentTags(children);
        onChange(null);
      }
    } catch (e) {
      setPickerError(e instanceof Error ? e.message : 'Could not use search result.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const q = searchInput.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = window.setTimeout(() => {
      if (searchAbortRef.current) searchAbortRef.current.abort();
      const ac = new AbortController();
      searchAbortRef.current = ac;
      setSearchLoading(true);
      (async () => {
        try {
          const res = await searchTags(q, { signal: ac.signal });
          if (!res.ok) {
            setSearchResults([]);
            return;
          }
          const data = await res.json();
          setSearchResults(Array.isArray(data) ? data : []);
        } catch (e) {
          if (e && typeof e === 'object' && 'name' in e && e.name === 'AbortError') return;
          setSearchResults([]);
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 320);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const parentIdForNew =
    stack.length === 0 ? null : stack[stack.length - 1].id;

  /** Must not use a nested <form> — Add Product wraps this picker in its own form. */
  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (!name || disabled || creating) return;
    setCreating(true);
    setPickerError(null);
    try {
      const res = await createTag({ name, parentId: parentIdForNew });
      if (!res.ok) {
        const msg = await messageFromFailedResponse(res);
        throw new Error(msg || `Could not create category (${res.status})`);
      }
      const created = await res.json();
      const id = created?.id;
      if (id == null) {
        await refetchCurrentLevel();
        setNewCategoryName('');
        return;
      }
      const check = await fetchTagChildren(id);
      if (check.ok) {
        const data = await check.json();
        if (data.isLeaf === true) {
          onChange({
            id: data.id,
            name: data.name,
            categoryPath: data.categoryPath,
          });
        }
      }
      await refetchCurrentLevel();
      setNewCategoryName('');
    } catch (err) {
      setPickerError(err instanceof Error ? err.message : 'Create failed.');
    } finally {
      setCreating(false);
    }
  };

  const leafSummary =
    value && value.categoryPath
      ? value.categoryPath
      : value
        ? value.name
        : null;

  return (
    <div className="products-category-picker">
      <div className="products-modal-field">
        <label htmlFor="product-category-search">Search categories</label>
        <input
          id="product-category-search"
          type="search"
          placeholder="Type at least 2 characters…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          disabled={disabled}
          autoComplete="off"
        />
        {searchLoading && (
          <p className="products-category-hint" role="status">
            Searching…
          </p>
        )}
        {searchInput.trim().length >= 2 && searchResults.length > 0 && (
          <ul className="products-category-search-results" role="listbox">
            {searchResults.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="products-category-search-hit"
                  disabled={disabled || loading}
                  onClick={() => pickSearchResult(t)}
                >
                  <span className="products-category-search-name">{t.name}</span>
                  {t.categoryPath ? (
                    <span className="products-category-search-path">{t.categoryPath}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <nav className="products-category-bc" aria-label="Category path">
        <button
          type="button"
          className="products-category-bc-item"
          disabled={disabled}
          onClick={() => goBreadcrumb(0)}
        >
          All categories
        </button>
        {stack.map((t, i) => (
          <span key={`${t.id}-${i}`} className="products-category-bc-sep">
            <span aria-hidden="true">/</span>
            <button
              type="button"
              className="products-category-bc-item"
              disabled={disabled}
              onClick={() => goBreadcrumb(i + 1)}
            >
              {t.name}
            </button>
          </span>
        ))}
      </nav>

      {pickerError && (
        <div className="products-category-inline-err" role="alert">
          {pickerError}
        </div>
      )}

      <div className="products-category-list-wrap">
        {loading ? (
          <p className="products-category-hint" role="status">
            Loading…
          </p>
        ) : currentTags.length === 0 ? (
          <p className="products-category-hint">
            No subcategories here. Use “Add category” below or go back and pick a branch that has
            subcategories until you reach a leaf.
          </p>
        ) : (
          <ul className="products-category-list" role="list">
            {currentTags.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className="products-category-row"
                  disabled={disabled}
                  onClick={() => pickTagRow(t)}
                >
                  <span className="products-category-row-name">{t.name}</span>
                  {t.categoryPath ? (
                    <span className="products-category-row-path">{t.categoryPath}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {value && (
        <div className="products-category-selected">
          <span className="products-category-selected-label">Selected leaf category</span>
          <span className="products-category-selected-value">{leafSummary}</span>
          <button
            type="button"
            className="products-category-clear"
            disabled={disabled}
            onClick={() => onChange(null)}
          >
            Change
          </button>
        </div>
      )}

      <div
        className="products-category-new"
        role="group"
        aria-label={parentIdForNew == null ? 'New root category' : 'New subcategory'}
      >
        <div className="products-modal-field products-category-new-field">
          <label htmlFor="product-new-category-name">
            {parentIdForNew == null ? 'New root category' : 'New subcategory'}
          </label>
          <div className="products-category-new-row">
            <input
              id="product-new-category-name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                void createCategory();
              }}
              disabled={disabled || creating}
              placeholder={
                parentIdForNew == null ? 'e.g. Electronics' : 'e.g. Smartphones'
              }
              autoComplete="off"
            />
            <button
              type="button"
              disabled={disabled || creating || !newCategoryName.trim()}
              onClick={() => void createCategory()}
            >
              {creating ? 'Adding…' : 'Add category'}
            </button>
          </div>
          <p className="products-category-hint">
            {parentIdForNew == null
              ? 'Creates a top-level tag (POST /api/tags). New tags are usually leaf until you add children.'
              : `Will be created under “${stack[stack.length - 1]?.name}”.`}
          </p>
        </div>
      </div>
    </div>
  );
}
