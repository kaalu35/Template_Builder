// src/components/layout/Sidebar.tsx

import { NavLink } from 'react-router-dom';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" fill="currentColor" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m12 4 7.5 4.25L12 12.5 4.5 8.25 12 4Zm-7.5 7L12 15.25 19.5 11M4.5 13.75 12 18l7.5-4.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14.8 9.2 13 13l-3.8 1.8L11 11l3.8-1.8ZM12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 12h3l2-5 4 10 2-5h5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="m6 6 12 12M18 6 6 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

const NAV_ITEMS = [
  { label: 'Templates',            path: '/templates',             icon: <GridIcon /> },
  { label: 'Placeholder Registry', path: '/registry/placeholders', icon: <LayersIcon /> },
  { label: 'Documents',            path: '/documents',             icon: <DocumentIcon /> },
  { label: 'Marketplace',          path: '/marketplace',           icon: <CompassIcon /> },
  { label: 'Audit Log',            path: '/audit',                 icon: <ActivityIcon /> },
];

export default function Sidebar({ open = false, onClose }: SidebarProps) {
  // Always use dev_user
  localStorage.setItem('tb_user_id', 'dev_user');
  return (
    <>
      <div
        className={`app-sidebar__backdrop ${open ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside className={`app-sidebar ${open ? 'is-open' : ''}`}>
        <div className="app-sidebar__brand">
          <div className="app-sidebar__logo">TB</div>
          <div>
            <div className="app-sidebar__eyebrow">Document Studio</div>
            <div className="app-sidebar__name">TemplateBuilder</div>
          </div>

          <button
            type="button"
            className="app-sidebar__close"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="app-sidebar__nav">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={({ isActive }) =>
                `app-sidebar__link ${isActive ? 'is-active' : ''}`
              }
            >
              <span className="app-sidebar__link-icon">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="app-sidebar__footer">
          <div className="app-sidebar__user">
            <div className="app-sidebar__user-avatar">DU</div>
            <div className="app-sidebar__user-info">
              <div className="app-sidebar__user-title">dev_user</div>
              <div className="app-sidebar__user-caption">Local workspace</div>
            </div>
            <div className="app-sidebar__user-badge" title="Online" />
          </div>
        </div>
      </aside>
    </>
  );
}