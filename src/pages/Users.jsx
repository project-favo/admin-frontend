import '../styles/Users.css';
import UserTable from '../components/UserTable';

const TOTAL_USERS = 12_450;

const MOCK_USERS = [
  {
    id: '1',
    username: '@johndoe',
    email: 'john@example.com',
    status: '🟢 Active',
  },
  {
    id: '2',
    username: '@mark_t',
    email: 'mark@test.com',
    status: '🔴 Suspend',
  },
  {
    id: '3',
    username: '@sara12',
    email: 'sara@mail.com',
    status: '🟠 Warned',
  },
  {
    id: '4',
    username: '@alex_99',
    email: 'alex@sample.com',
    status: '🟢 Active',
  },
  {
    id: '5',
    username: '@emily_r',
    email: 'emily@domain.com',
    status: '🟢 Active',
  },
  {
    id: '6',
    username: '@chris_b',
    email: 'chris@web.com',
    status: '🔴 Suspend',
  },
];

const Users = () => {
  const formattedTotal = TOTAL_USERS.toLocaleString('en-US');
  const showingFrom = 1;
  const showingTo = MOCK_USERS.length;

  return (
    <div className="users-page">
      <h2 className="users-main-title">User Management</h2>

      <div className="users-toolbar" aria-label="User list controls">
        <div className="users-toolbar-count">
          <span>All Users ({formattedTotal})</span>
        </div>
        <span className="users-toolbar-meta">Filter: All ⌄</span>
        <span className="users-toolbar-meta">Export Data ⬇</span>
      </div>

      <UserTable users={MOCK_USERS} />

      <footer className="users-footer">
        <p className="users-footer-summary">
          Showing {showingFrom}-{showingTo} of {formattedTotal} users
        </p>
        <nav className="users-pagination" aria-label="Pagination">
          <button type="button" disabled>
            &lt; Prev
          </button>
          <span className="users-pagination-page" aria-current="page">
            1
          </span>
          <span className="users-pagination-page">2</span>
          <button type="button">Next &gt;</button>
        </nav>
      </footer>
    </div>
  );
};

export default Users;
