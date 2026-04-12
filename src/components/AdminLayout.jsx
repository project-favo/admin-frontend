import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const AdminLayout = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 769px)');
    const onChange = () => {
      if (mq.matches) setMenuOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <div className={`admin-shell${menuOpen ? ' admin-shell--nav-open' : ''}`}>
      <header className="admin-mobile-header">
        <button
          type="button"
          className="admin-mobile-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="admin-sidebar"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="admin-mobile-menu-toggle__icon" aria-hidden>
            <span className="admin-mobile-menu-toggle__line admin-mobile-menu-toggle__line--top" />
            <span className="admin-mobile-menu-toggle__line admin-mobile-menu-toggle__line--mid" />
            <span className="admin-mobile-menu-toggle__line admin-mobile-menu-toggle__line--bot" />
          </span>
          <span className="admin-mobile-menu-toggle__label">Menu</span>
        </button>
      </header>

      {menuOpen ? (
        <button
          type="button"
          className="admin-sidebar-backdrop"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={() => setMenuOpen(false)}
        />
      ) : null}

      <Sidebar id="admin-sidebar" onNavClick={() => setMenuOpen(false)} />
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
