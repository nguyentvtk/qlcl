import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HardHat, Mail, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { gasPost } from '../lib/gasApi';
import { useAuthStore } from '../store/authStore';
import type { AuthSession } from '../types/gas';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession, isAuthenticated } = useAuthStore();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  // Đã đăng nhập → chuyển trang
  if (isAuthenticated()) {
    const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';
    navigate(from, { replace: true });
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Vui lòng nhập đầy đủ thông tin'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await gasPost<AuthSession>('auth360', 'login', {
        params: { email: email.trim().toLowerCase(), password: password.trim() },
      });
      if (res.status === 'success' && res.data) {
        setSession(res.data);
        const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';
        navigate(from, { replace: true });
      } else {
        setError(res.message || 'Đăng nhập thất bại');
      }
    } catch (err) {
      setError('Không thể kết nối đến server. Kiểm tra kết nối mạng.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-orange-900 flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '40px 40px' }}
      />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl mb-4 shadow-2xl">
            <HardHat className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Site360</h1>
          <p className="text-slate-400 mt-1 text-sm">Quản lý hiện trường công trình</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Đăng nhập</h2>
          <p className="text-gray-500 text-sm mb-6">Dành cho Nhà thầu Tư vấn Giám sát</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@congty.vn"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                  autoComplete="email"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Mật khẩu</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300
                text-white font-semibold py-2.5 px-4 rounded-xl transition-colors text-sm mt-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" />Đang đăng nhập...</>
              ) : 'Đăng nhập'}
            </button>
          </form>

          <p className="text-xs text-gray-400 text-center mt-6">
            Liên hệ Ban quản lý dự án nếu quên mật khẩu
          </p>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Site360 © 2024 — Hệ thống giám sát công trường
        </p>
      </div>
    </div>
  );
};
