import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import '../styles/Sidebar.css';

const navLinkClass = ({ isActive }) =>
  `admin-nav-link${isActive ? ' admin-nav-link--active' : ''}`;

const Sidebar = ({ id, onNavClick }) => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const closeMobile = () => onNavClick?.();

  const handleLogout = async (e) => {
    e.preventDefault();
    closeMobile();
    await logout();
    navigate('/', { replace: true });
  };

  return (
    <aside className="admin-sidebar" id={id}>
      <h1 className="admin-sidebar-title">FAVO Admin</h1>
      <hr className="admin-sidebar-rule" />

      <nav className="admin-nav" aria-label="Admin">
        <NavLink className={navLinkClass} to="/dashboard" end onClick={closeMobile}>
          Dashboard
        </NavLink>
        <NavLink className={navLinkClass} to="/users" onClick={closeMobile}>
          Users
        </NavLink>
        <NavLink className={navLinkClass} to="/products" onClick={closeMobile}>
          Products
        </NavLink>
        <NavLink className={navLinkClass} to="/moderation" onClick={closeMobile}>
          Moderation
        </NavLink>
        <NavLink className={navLinkClass} to="/settings" onClick={closeMobile}>
          Settings
        </NavLink>
      </nav>

      <div className="admin-nav-spacer" aria-hidden />

      <button type="button" className="admin-logout" onClick={handleLogout}>
        Log out
      </button>
    </aside>
  );
};

export default Sidebar;
