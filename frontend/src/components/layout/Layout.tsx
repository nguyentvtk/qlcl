import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, LogOut,
  Menu, X, ChevronDown, Bell,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { gasLogout } from '../../lib/gasApi';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, clear } = useAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [open,     setOpen]     = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => { setOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    try { await gasLogout(); } catch (_) { /* ignore */ }
    clear();
    navigate('/login');
  };

  const roleColor: Record<string, string> = {
    'Quản lý':    'bg-red-100 text-red-700',
    'Giám sát':   'bg-orange-100 text-orange-700',
    'Thành viên': 'bg-blue-100 text-blue-700',
    'Xem':        'bg-gray-100 text-gray-600',
  };

  const initial = (session?.tenDN?.[0] ?? 'U').toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-white shrink-0">
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center shadow">
            <span className="text-white text-sm font-black">S</span>
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Site360</p>
            <p className="text-xs text-slate-400">Quản lý hiện trường</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="px-4 py-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{session?.tenDN}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${roleColor[session?.vaiTro ?? 'Xem']}`}>
                {session?.vaiTro}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* ── Mobile Drawer overlay ── */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <aside
            className="absolute left-0 top-0 bottom-0 w-72 bg-slate-900 text-white flex flex-col z-50 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-black">S</span>
                </div>
                <span className="font-bold">Site360</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User info mobile */}
            <div className="px-5 py-4 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center font-bold text-sm shrink-0">
                  {initial}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{session?.tenDN}</p>
                  <p className="text-xs text-slate-400 truncate">{session?.email}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-0.5 inline-block ${roleColor[session?.vaiTro ?? 'Xem']}`}>
                    {session?.vaiTro}
                  </span>
                </div>
              </div>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                    ${isActive ? 'bg-orange-500 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="px-4 pb-6">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-4 py-3 text-sm text-red-400 hover:text-white hover:bg-red-500/20 rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Đăng xuất
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">

        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center gap-3 lg:px-6">
          {/* Hamburger – mobile only */}
          <button
            onClick={() => setOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-xl hover:bg-gray-100 text-gray-600 shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Brand – desktop */}
          <div className="hidden lg:flex items-center gap-2 text-sm text-gray-500">
            <div className="w-6 h-6 bg-gradient-to-br from-orange-400 to-orange-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-black">S</span>
            </div>
            <span className="font-semibold text-gray-800">Quản lý hiện trường</span>
          </div>

          {/* Site360 title – mobile center */}
          <span className="lg:hidden text-base font-bold text-gray-900 flex-1 text-center">
            Site360
          </span>

          {/* Right actions */}
          <div className="flex items-center gap-1 ml-auto">
            <button className="p-2 rounded-xl hover:bg-gray-100 relative">
              <Bell className="w-5 h-5 text-gray-500" />
            </button>

            {/* User menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenu(v => !v)}
                className="flex items-center gap-1.5 pl-1.5 pr-2 py-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {initial}
                </div>
                <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[120px] truncate">
                  {session?.tenDN}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${userMenu ? 'rotate-180' : ''}`} />
              </button>

              {userMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-800 truncate">{session?.tenDN}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{session?.email}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium mt-1.5 inline-block ${roleColor[session?.vaiTro ?? 'Xem']}`}>
                      {session?.vaiTro}
                    </span>
                  </div>
                  <button
                    onClick={() => { setUserMenu(false); handleLogout(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 lg:hidden bg-white border-t border-gray-200 safe-area-inset-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 px-6 py-1.5 rounded-xl transition-colors min-w-[64px]
                ${isActive ? 'text-orange-500' : 'text-gray-400'}`
              }
            >
              {({ isActive }) => (
                <>
                  <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-orange-50' : ''}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium">{label}</span>
                </>
              )}
            </NavLink>
          ))}
          {/* Logout shortcut on mobile bottom bar */}
          <button
            onClick={handleLogout}
            className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-gray-400 min-w-[64px]"
          >
            <div className="p-1.5 rounded-xl">
              <LogOut className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-medium">Thoát</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
