import '../styles/UserTable.css';

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
            {users.map(({ id, username, email, status }) => (
              <tr key={id}>
                <td>👤</td>
                <td>{username}</td>
                <td>{email}</td>
                <td>{status}</td>
                <td>⋮</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default UserTable;
