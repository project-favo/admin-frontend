import '../styles/AdminFloatingMenu.css';
import { createPortal } from 'react-dom';
import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Dışarı tıklama denetimi: portallı menü içi tıklamaları kapatma sayma.
 * @param {EventTarget | null} target
 */
export function isInsideAdminFloatingMenu(target) {
  return target instanceof Element && target.closest('[data-admin-floating-menu]');
}

/**
 * Tablo / overflow: hidden üstlerinden taşan aksiyon menüleri için body’ye sabitlenmiş menü.
 *
 * @param {{
 *   open: boolean;
 *   triggerRef: React.RefObject<HTMLElement | null>;
 *   children: React.ReactNode;
 *   className?: string;
 *   id?: string;
 * }} props
 */
export default function AdminFloatingMenu({ open, triggerRef, children, className = '', id }) {
  const menuRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef?.current;
    if (!trigger) return;

    function place() {
      const t = triggerRef.current;
      const menu = menuRef.current;
      if (!t) return;
      const r = t.getBoundingClientRect();
      const gap = 6;
      const margin = 8;
      const w = menu ? menu.offsetWidth : 180;
      const h = menu ? menu.offsetHeight : 0;

      let left = r.right - w;
      left = Math.max(margin, Math.min(left, window.innerWidth - w - margin));

      const spaceBelow = window.innerHeight - r.bottom - gap - margin;
      const spaceAbove = r.top - gap - margin;
      let top = r.bottom + gap;
      if (h > 0 && h > spaceBelow && spaceAbove > spaceBelow) {
        top = r.top - h - gap;
      }
      if (h > 0) {
        top = Math.max(margin, Math.min(top, window.innerHeight - h - margin));
      }

      setCoords({ top, left });
    }

    place();
    const id0 = requestAnimationFrame(() => {
      requestAnimationFrame(place);
    });
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      cancelAnimationFrame(id0);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, triggerRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      id={id}
      className={`admin-actions-floating-menu ${className}`.trim()}
      style={{ position: 'fixed', top: coords.top, left: coords.left, zIndex: 10000 }}
      role="menu"
      data-admin-floating-menu=""
    >
      {children}
    </div>,
    document.body
  );
}
