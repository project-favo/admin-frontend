import '../styles/ModerationTable.css';

/**
 * @typedef {Object} ModerationTableRow
 * @property {string} id
 * @property {string} contentPreview
 * @property {string} flagReason
 * @property {string} aiScore
 */

/**
 * @param {{ items: ModerationTableRow[] }} props
 */
const ModerationTable = ({ items }) => {
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
            {items.map(({ id, contentPreview, flagReason, aiScore }) => (
              <tr key={id}>
                <td>{contentPreview}</td>
                <td>{flagReason}</td>
                <td>{aiScore}</td>
                <td className="moderation-table-actions-cell">
                  <button type="button" className="moderation-action-btn" aria-label="Approve">
                    ✅
                  </button>
                  <button type="button" className="moderation-action-btn" aria-label="Reject">
                    ❌
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default ModerationTable;
