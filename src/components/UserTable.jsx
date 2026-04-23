import '../styles/UserTable.css';
import AdminFloatingMenu, { isInsideAdminFloatingMenu } from './AdminFloatingMenu';
import { useEffect, useId, useRef, useState } from 'react';
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
  const menuIdPrefix = useId();
  const [openRowId, setOpenRowId] = useState(null);
  const [actingRowId, setActingRowId] = useState(null);
  const openTriggerRef = useRef(null);

  useEffect(() => {
    if (openRowId == null) return undefined;

    /** @param {MouseEvent} e */
    function onPointerDown(e) {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      if (isInsideAdminFloatingMenu(target)) return;
      const container = document.querySelector(`[data-users-actions-row-id="${openRowId}"]`);
      if (!container) {
        setOpenRowId(null);
        return;
      }
      if (!container.contains(target)) setOpenRowId(null);
    }

    document.addEventListener('mousedown', onPointerDown, true);
    return () => document.removeEventListener('mousedown', onPointerDown, true);
  }, [openRowId]);

  /**
   * @param {string} userId
   * @param {'activate' | 'suspend'} action
   */
  async function runAction(userId, action) {
    if (!onUserAction) return;
    setActingRowId(userId);
    try {
      await onUserAction(userId, action);
      setOpenRowId(null);
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
              const menuId = `${menuIdPrefix}-${id}`;
              const isOpen = openRowId === id;
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
                  <td>
                    <div className="users-actions" data-users-actions-row-id={id}>
                      <button
                        type="button"
                        ref={openRowId === id ? openTriggerRef : undefined}
                        className="users-actions-trigger"
                        aria-haspopup="menu"
                        aria-expanded={isOpen}
                        aria-controls={menuId}
                        aria-busy={rowBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (rowBusy) return;
                          setOpenRowId((prev) => (prev === id ? null : id));
                        }}
                      >
                        ⋮
                      </button>
                      {isOpen ? (
                        <AdminFloatingMenu open triggerRef={openTriggerRef} id={menuId}>
                          <div className="users-actions-menu-inner">
                            {kind === 'active' && (
                              <button
                                type="button"
                                className="users-actions-item"
                                role="menuitem"
                                disabled={rowBusy || !onUserAction}
                                onClick={() => runAction(id, 'suspend')}
                              >
                                Suspend
                              </button>
                            )}
                            {kind === 'suspend' && (
                              <button
                                type="button"
                                className="users-actions-item"
                                role="menuitem"
                                disabled={rowBusy || !onUserAction}
                                onClick={() => runAction(id, 'activate')}
                              >
                                Activate
                              </button>
                            )}
                            {kind === 'unknown' && (
                              <button
                                type="button"
                                className="users-actions-item"
                                role="menuitem"
                                disabled
                              >
                                No actions available
                              </button>
                            )}
                          </div>
                        </AdminFloatingMenu>
                      ) : null}
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
