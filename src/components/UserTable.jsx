import '../styles/UserTable.css';
import { useEffect, useId, useState } from 'react';

/**
 * @typedef {Object} UserTableRow
 * @property {string} id
 * @property {string} username
 * @property {string} email
 * @property {string} status
 */

/**
 * @param {{ users: UserTableRow[] }} props
 */
const UserTable = ({ users }) => {
  const menuIdPrefix = useId();
  const [openRowId, setOpenRowId] = useState(null);

  function getStatusKind(status) {
    const s = String(status || '').toLowerCase();
    if (s.includes('active')) return 'active';
    if (s.includes('suspend')) return 'suspend';
    return 'unknown';
  }

  useEffect(() => {
    if (openRowId == null) return undefined;

    /** @param {MouseEvent} e */
    function onPointerDown(e) {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
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
              <th scope="col">Avatar</th>
              <th scope="col">Username</th>
              <th scope="col">Email</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(({ id, username, email, status }) => {
              const kind = getStatusKind(status);
              const menuId = `${menuIdPrefix}-${id}`;
              const isOpen = openRowId === id;
              return (
                <tr key={id}>
                <td>👤</td>
                <td>{username}</td>
                <td>{email}</td>
                <td>{status}</td>
                <td>
                  <details
                    className="users-actions"
                    aria-label="User actions"
                    open={isOpen}
                    data-users-actions-row-id={id}
                    onToggle={(e) => {
                      const nextOpen = e.currentTarget.open;
                      setOpenRowId(nextOpen ? id : null);
                    }}
                  >
                    <summary
                      className="users-actions-trigger"
                      aria-haspopup="menu"
                      aria-controls={menuId}
                      onClick={(e) => {
                        // prevent native <details> toggle; we control it
                        e.preventDefault();
                        setOpenRowId((prev) => (prev === id ? null : id));
                      }}
                    >
                      ⋮
                    </summary>
                    <div id={menuId} className="users-actions-menu" role="menu">
                      {kind === 'active' && (
                        <>
                          <button type="button" className="users-actions-item" role="menuitem">
                            Suspend
                          </button>
                          <button type="button" className="users-actions-item" role="menuitem">
                            Ban
                          </button>
                        </>
                      )}
                      {kind === 'suspend' && (
                        <button type="button" className="users-actions-item" role="menuitem">
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
                  </details>
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
