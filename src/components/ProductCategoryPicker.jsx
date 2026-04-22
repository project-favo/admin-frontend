import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
            No subcategories here. On the Product catalog (toolbar: New category), add a main
            category plus two subcategory levels, or go back and pick a branch with subcategories until
            you reach a leaf.
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
    </div>
  );
}
