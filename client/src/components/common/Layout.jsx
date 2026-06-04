import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import './Layout.css';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: 'DB' },
  { to: '/operations', label: 'Operations', icon: 'OP' },
  { to: '/roadmap', label: 'Roadmap', icon: 'RM' },
  { to: '/audits', label: 'Audits', icon: 'AU' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const logoSrc = `${process.env.PUBLIC_URL || ''}/method360-logo.png`;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-wrap">
            <img src={logoSrc} alt="Method360" className="logo-image" />
          </div>
          <button className="toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-avatar">{user?.name?.slice(0, 2).toUpperCase() || 'IE'}</span>
            <div className="user-details">
              <span className="user-name">{user?.name}</span>
              <span className="user-role">{user?.role}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
