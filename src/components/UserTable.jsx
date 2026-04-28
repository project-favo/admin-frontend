import '../styles/ModerationTable.css';
import '../styles/UserTable.css';
import { useState } from 'react';
import { Link } from 'react-router-dom';

/**
 * @typedef {Object} UserTableRow
 * @property {string} id
 * @property {string} username
 * @property {string} email
 * @property {string} statusLabel
 * @property {'active' | 'suspend' | 'unknown'} statusKind
 */

function initialsFromUsernameLabel(label) {
  const s = String(label || '')
    .replace(/^@/, '')
    .trim();
  if (!s) return '?';
  const compact = s.replace(/[^a-zA-Z0-9]/g, '');
  if (compact.length >= 2) return compact.slice(0, 2).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

/**
 * @param {{ users: UserTableRow[], onUserAction?: (userId: string, action: 'activate' | 'suspend') => Promise<void> }} props
 */
const UserTable = ({ users, onUserAction }) => {
  const [actingRowId, setActingRowId] = useState(null);

  /**
   * @param {string} userId
   * @param {'activate' | 'suspend'} action
   */
  async function runAction(userId, action) {
    if (!onUserAction) return;
    setActingRowId(userId);
    try {
      await onUserAction(userId, action);
    } catch {
      /* hata mesajı üst sayfada */
    } finally {
      setActingRowId(null);
    }
  }

  return (
    <section className="users-table-wrap" aria-label="User list">
      <div className="users-table-scroll">
        <table className="users-table">
          <colgroup>
            <col className="users-table-col-avatar" />
            <col className="users-table-col-username" />
            <col className="users-table-col-email" />
            <col className="users-table-col-status" />
            <col className="users-table-col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">User</th>
              <th scope="col">Username</th>
              <th scope="col">Email</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(({ id, username, email, statusLabel, statusKind }) => {
              const kind = statusKind ?? 'unknown';
              const rowBusy = actingRowId === id;
              const initials = initialsFromUsernameLabel(username);
              return (
                <tr key={id}>
                  <td>
                    <span className="users-avatar" aria-hidden="true" title={username}>
                      {initials}
                    </span>
                  </td>
                  <td className="users-cell-username">
                    <Link
                      to={`/users/${encodeURIComponent(id)}`}
                      className="users-username-link"
                    >
                      {username}
                    </Link>
                  </td>
                  <td className="users-cell-email">{email}</td>
                  <td>
                    <span
                      className={
                        kind === 'active'
                          ? 'users-status-badge users-status-badge--active'
                          : kind === 'suspend'
                            ? 'users-status-badge users-status-badge--suspend'
                            : 'users-status-badge users-status-badge--unknown'
                      }
                    >
                      {statusLabel}
                    </span>
                  </td>
                  <td className="users-table-actions-cell">
                    <div className="moderation-action-group">
                      {kind === 'active' && (
                        <button
                          type="button"
                          className="moderation-action-btn moderation-action-btn--reject"
                          aria-label="Suspend user"
                          disabled={rowBusy || !onUserAction}
                          aria-busy={rowBusy}
                          onClick={() => runAction(id, 'suspend')}
                        >
                          Suspend
                        </button>
                      )}
                      {kind === 'suspend' && (
                        <button
                          type="button"
                          className="moderation-action-btn moderation-action-btn--approve"
                          aria-label="Set user active"
                          disabled={rowBusy || !onUserAction}
                          aria-busy={rowBusy}
                          onClick={() => runAction(id, 'activate')}
                        >
                          Active
                        </button>
                      )}
                      {kind === 'unknown' && (
                        <button
                          type="button"
                          className="moderation-action-btn"
                          title="Status unknown — no action available"
                          disabled
                        >
                          No actions
                        </button>
                      )}
                    </div>
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

export default UserTable;
