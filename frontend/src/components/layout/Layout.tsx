import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Camera, Map, ClipboardList, LogOut,
  Menu, X, HardHat, ChevronDown, Bell,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { gasPost } from '../../lib/gasApi';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tổng quan' },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, clear } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  const handleLogout = async () => {
    try {
      await gasPost('auth360', 'logout', { params: { token: session?.token } });
    } catch (_) { /* bỏ qua lỗi network */ }
    clear();
    navigate('/login');
  };

  const roleColor: Record<string, string> = {
    'Quản lý':   'bg-red-100 text-red-700',
    'Giám sát':  'bg-orange-100 text-orange-700',
    'Thành viên':'bg-blue-100 text-blue-700',
    'Xem':       'bg-gray-100 text-gray-600',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-white">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700">
          <div className="w-9 h-9 bg-orange-500 rounded-lg flex items-center justify-center">
            <HardHat className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">Site360</p>
            <p className="text-xs text-slate-400">Hiện trường</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-orange-500 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-slate-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold">
              {(session?.tenDN?.[0] ?? 'U').toUpperCase()}
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

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-slate-900 text-white flex flex-col z-50">
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <HardHat className="w-5 h-5 text-orange-400" />
                <span className="font-bold text-sm">Site360</span>
              </div>
              <button onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {NAV.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                    ${isActive ? 'bg-orange-500 text-white' : 'text-slate-300 hover:bg-slate-800'}`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </NavLink>
              ))}
            </nav>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 mx-4 mb-4 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg"
            >
              <LogOut className="w-4 h-4" />
              Đăng xuất
            </button>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between lg:px-6">
          <button onClick={() => setOpen(true)} className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <div className="hidden lg:flex items-center gap-2 text-sm text-gray-500">
            <HardHat className="w-4 h-4 text-orange-500" />
            <span className="font-semibold text-gray-800">Quản lý hiện trường</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button className="p-2 rounded-lg hover:bg-gray-100 relative">
              <Bell className="w-5 h-5 text-gray-500" />
            </button>
            <div className="relative">
              <button
                onClick={() => setUserMenu(!userMenu)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100"
              >
                <div className="w-7 h-7 bg-orange-500 rounded-full flex items-center justify-center text-xs font-bold text-white">
                  {(session?.tenDN?.[0] ?? 'U').toUpperCase()}
                </div>
                <span className="text-sm font-medium text-gray-700 hidden sm:block truncate max-w-32">
                  {session?.tenDN}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              {userMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-800">{session?.tenDN}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{session?.email}</p>
                  </div>
                  <button
                    onClick={() => { setUserMenu(false); handleLogout(); }}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
};
