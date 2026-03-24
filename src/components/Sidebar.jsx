import { NavLink } from 'react-router-dom';
import '../styles/Sidebar.css';

const navLinkClass = ({ isActive }) =>
  `admin-nav-link${isActive ? ' admin-nav-link--active' : ''}`;

const Sidebar = () => {
  return (
    <aside className="admin-sidebar">
      <h1 className="admin-sidebar-title">FAVO Admin</h1>
      <hr className="admin-sidebar-rule" />

      <nav className="admin-nav" aria-label="Admin">
        <NavLink className={navLinkClass} to="/dashboard" end>
          Dashboard
        </NavLink>
        <NavLink className={navLinkClass} to="/users">
          Users
        </NavLink>
        <NavLink className={navLinkClass} to="/products">
          Products
        </NavLink>
        <NavLink className={navLinkClass} to="/moderation">
          Moderation
        </NavLink>
        <NavLink className={navLinkClass} to="/settings">
          Settings
        </NavLink>
      </nav>

      <div className="admin-nav-spacer" aria-hidden />

      <NavLink className="admin-logout" to="/">
        Log out
      </NavLink>
    </aside>
  );
};

export default Sidebar;
