import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  HiOutlineHome,
  HiOutlineDocumentText,
  HiOutlineUsers,
  HiOutlineBookOpen,
  HiOutlineChartBar,
  HiOutlineCog,
  HiOutlineLogout,
  HiOutlinePlus,
  HiOutlineMenu,
  HiOutlineX,
} from 'react-icons/hi';

const NAV_ITEMS = [
  { path: '/', label: 'דשבורד', icon: HiOutlineHome },
  { path: '/documents', label: 'מסמכים', icon: HiOutlineDocumentText },
  { path: '/customers', label: 'לקוחות', icon: HiOutlineUsers },
  { path: '/cashbook', label: 'ספר תקבולים', icon: HiOutlineBookOpen },
  { path: '/reports', label: 'דוחות', icon: HiOutlineChartBar },
  { path: '/settings', label: 'הגדרות', icon: HiOutlineCog },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, business, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
            zIndex: 40, display: 'none',
          }}
          className="mobile-overlay"
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: 260,
        background: 'var(--bg-card)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        transform: sidebarOpen ? 'translateX(0)' : undefined,
      }}>
        {/* Logo area */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
        }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-primary)' }}>
            EladInvoice
          </h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
            מערכת חשבוניות
          </p>
        </div>

        {/* New document button */}
        <div style={{ padding: '16px 20px' }}>
          <button
            onClick={() => navigate('/documents/new')}
            style={{
              width: '100%',
              padding: '10px 16px',
              background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <HiOutlinePlus size={18} />
            מסמך חדש
          </button>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0 12px' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path !== '/' && location.pathname.startsWith(item.path));
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 16px',
                  borderRadius: 'var(--radius-sm)',
                  color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'rgba(108, 99, 255, 0.1)' : 'transparent',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  marginBottom: 4,
                  transition: 'all 0.2s',
                }}
              >
                <Icon size={20} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User area */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--accent-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 14,
            }}>
              {user?.name?.charAt(0) || '?'}
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{user?.name}</p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{business?.name}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '8px',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-xs)',
              color: 'var(--text-secondary)',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <HiOutlineLogout size={16} />
            התנתק
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        flex: 1,
        marginRight: 260,
        minHeight: '100vh',
      }}>
        {/* Mobile header */}
        <div style={{
          display: 'none',
          padding: '12px 16px',
          background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)',
          alignItems: 'center',
          justifyContent: 'space-between',
        }} className="mobile-header">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ background: 'none', border: 'none', color: 'var(--text-primary)' }}
          >
            {sidebarOpen ? <HiOutlineX size={24} /> : <HiOutlineMenu size={24} />}
          </button>
          <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>EladInvoice</span>
          <div style={{ width: 24 }} />
        </div>

        <div style={{ padding: '24px 32px', maxWidth: 1280, margin: '0 auto' }}>
          {children}
        </div>
      </main>

      <style>{`
        @media (max-width: 768px) {
          .mobile-header { display: flex !important; }
          .mobile-overlay { display: block !important; }
          aside {
            transform: translateX(${sidebarOpen ? '0' : '100%'}) !important;
            transition: transform 0.3s ease;
          }
          main { margin-right: 0 !important; }
          main > div:last-child { padding: 16px !important; }
        }
      `}</style>
    </div>
  );
}
