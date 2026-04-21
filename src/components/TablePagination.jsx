import '../styles/TablePagination.css';

/**
 * Sade sayfalama: First / Previous / durum metni / Next / Last (numaralı sayfa düğümleri yok).
 *
 * @param {{
 *   ariaLabel: string;
 *   statusText: string;
 *   canPrev: boolean;
 *   canNext: boolean;
 *   onPrev: () => void;
 *   onNext: () => void;
 *   canFirst?: boolean;
 *   canLast?: boolean;
 *   onFirst?: () => void;
 *   onLast?: () => void;
 * }} props
 */
export default function TablePagination({
  ariaLabel,
  statusText,
  canPrev,
  canNext,
  onPrev,
  onNext,
  canFirst,
  canLast,
  onFirst,
  onLast,
}) {
  const showEnds = typeof onFirst === 'function' && typeof onLast === 'function';

  return (
    <nav className="admin-table-pagination" aria-label={ariaLabel}>
      {showEnds ? (
        <button
          type="button"
          className="admin-table-pagination__btn"
          title="Go to first page"
          disabled={!canFirst}
          onClick={onFirst}
        >
          First
        </button>
      ) : null}
      <button type="button" className="admin-table-pagination__btn" disabled={!canPrev} onClick={onPrev}>
        Prev
      </button>
      <span className="admin-table-pagination__status" aria-live="polite">
        {statusText}
      </span>
      <button type="button" className="admin-table-pagination__btn" disabled={!canNext} onClick={onNext}>
        Next
      </button>
      {showEnds ? (
        <button
          type="button"
          className="admin-table-pagination__btn"
          title="Go to last page"
          disabled={!canLast}
          onClick={onLast}
        >
          Last
        </button>
      ) : null}
    </nav>
  );
}
