import '../styles/ModerationTable.css';

/**
 * @typedef {Object} ModerationTableRow
 * @property {string} id
 * @property {boolean} [hasNumericId]
 * @property {string} contentPreview
 * @property {string} flagReason
 * @property {string} aiScore
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
            <col className="moderation-table-col-reason" />
            <col className="moderation-table-col-score" />
            <col className="moderation-table-col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Content Preview</th>
              <th scope="col">Flag Reason</th>
              <th scope="col">AI Score</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(
              ({
                id,
                hasNumericId = true,
                contentPreview,
                flagReason,
                aiScore,
                aiScoreTitle,
              }) => {
                const rowBusy = actionBusyId === id;
                const actionsDisabled = rowBusy || !hasNumericId;
                return (
                  <tr key={id}>
                    <td>{contentPreview}</td>
                    <td>{flagReason}</td>
                    <td title={aiScoreTitle}>{aiScore}</td>
                    <td className="moderation-table-actions-cell">
                      <button
                        type="button"
                        className="moderation-action-btn"
                        aria-label="Approve — publish review"
                        disabled={actionsDisabled}
                        onClick={() => onApprove(id)}
                      >
                        ✅
                      </button>
                      <button
                        type="button"
                        className="moderation-action-btn"
                        aria-label="Reject — hide review"
                        disabled={actionsDisabled}
                        onClick={() => onReject(id)}
                      >
                        ❌
                      </button>
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
