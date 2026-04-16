import '../styles/ModerationTable.css';

/**
 * @typedef {Object} ModerationTableRow
 * @property {string} id
 * @property {boolean} [hasNumericId]
 * @property {string} contentPreview
 * @property {string} productLabel
 * @property {string} collaborativeLabel
 * @property {string} likeCountDisplay
 * @property {string} aiScore
 * @property {'low'|'mid'|'high'|null} [aiScoreTone] — yüzde skor için renk bandı
 * @property {string} [aiScoreTitle] — ham skor / durum için tooltip
 */

/**
 * @param {{
 *   items: ModerationTableRow[];
 *   onApprove: (id: string) => void;
 *   onReject: (id: string) => void;
 *   actionBusyId: string | null;
 * }} props
 */
const ModerationTable = ({ items, onApprove, onReject, actionBusyId }) => {
  return (
    <section className="moderation-table-wrap" aria-label="Content moderation queue">
      <div className="moderation-table-scroll">
        <table className="moderation-table">
          <colgroup>
            <col className="moderation-table-col-preview" />
            <col className="moderation-table-col-product" />
            <col className="moderation-table-col-collab" />
            <col className="moderation-table-col-likes" />
            <col className="moderation-table-col-score" />
            <col className="moderation-table-col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Content Preview</th>
              <th scope="col">Product</th>
              <th scope="col">Collaborative</th>
              <th scope="col">Likes</th>
              <th scope="col">AI Toxicity</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(
              ({
                id,
                hasNumericId = true,
                contentPreview,
                productLabel,
                collaborativeLabel,
                likeCountDisplay,
                aiScore,
                aiScoreTone,
                aiScoreTitle,
              }) => {
                const rowBusy = actionBusyId === id;
                const actionsDisabled = rowBusy || !hasNumericId;
                const scoreClass =
                  aiScoreTone === 'low' || aiScoreTone === 'mid' || aiScoreTone === 'high'
                    ? `moderation-cell-score moderation-cell-score--${aiScoreTone}`
                    : 'moderation-cell-score';
                return (
                  <tr key={id}>
                    <td className="moderation-cell-preview">{contentPreview}</td>
                    <td className="moderation-cell-product">{productLabel}</td>
                    <td className="moderation-cell-collab">{collaborativeLabel}</td>
                    <td className="moderation-cell-likes">{likeCountDisplay}</td>
                    <td className={scoreClass} title={aiScoreTitle}>
                      {aiScore}
                    </td>
                    <td className="moderation-table-actions-cell">
                      <div className="moderation-action-group">
                        <button
                          type="button"
                          className="moderation-action-btn moderation-action-btn--approve"
                          aria-label="Approve — publish review"
                          disabled={actionsDisabled}
                          onClick={() => onApprove(id)}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          className="moderation-action-btn moderation-action-btn--reject"
                          aria-label="Reject — hide review"
                          disabled={actionsDisabled}
                          onClick={() => onReject(id)}
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ModerationTable;
