import '../styles/TablePagination.css';

/**
 * Sade sayfalama: Previous / durum metni / Next (numaralı sayfa düğümleri yok).
 *
 * @param {{
 *   ariaLabel: string;
 *   statusText: string;
 *   canPrev: boolean;
 *   canNext: boolean;
 *   onPrev: () => void;
 *   onNext: () => void;
 * }} props
 */
export default function TablePagination({ ariaLabel, statusText, canPrev, canNext, onPrev, onNext }) {
  return (
    <nav className="admin-table-pagination" aria-label={ariaLabel}>
      <button type="button" className="admin-table-pagination__btn" disabled={!canPrev} onClick={onPrev}>
        Prev
      </button>
      <span className="admin-table-pagination__status" aria-live="polite">
        {statusText}
      </span>
      <button type="button" className="admin-table-pagination__btn" disabled={!canNext} onClick={onNext}>
        Next
      </button>
    </nav>
  );
}
