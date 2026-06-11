import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { gasLogin } from '../lib/gasApi';
import { useAuthStore } from '../store/authStore';
import type { AuthSession } from '../types/gas';

/* ───── Animated background dots ───── */
const Dots: React.FC = () => (
  <div
    className="absolute inset-0 opacity-[0.07]"
    style={{
      backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)',
      backgroundSize: '28px 28px',
    }}
  />
);

/* ───── Feature bullet ───── */
const Feature: React.FC<{ icon: string; text: string; sub: string }> = ({ icon, text, sub }) => (
  <div className="flex items-start gap-3">
    <span className="text-2xl leading-none mt-0.5">{icon}</span>
    <div>
      <p className="text-white font-semibold text-sm">{text}</p>
      <p className="text-white/50 text-xs mt-0.5">{sub}</p>
    </div>
  </div>
);

export const LoginPage: React.FC = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { setSession, isAuthenticated } = useAuthStore();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [mounted,  setMounted]  = useState(false);

  useEffect(() => { setMounted(true); }, []);

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
      const res = await gasLogin<AuthSession>(email.trim().toLowerCase(), password.trim());
      if (res.status === 'success' && res.data) {
        setSession(res.data);
        const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? '/dashboard';
        navigate(from, { replace: true });
      } else {
        setError(res.message || 'Đăng nhập thất bại. Kiểm tra lại thông tin.');
      }
    } catch {
      setError('Không thể kết nối đến server. Kiểm tra kết nối mạng.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel: branding ── */}
      <div className="hidden lg:flex lg:w-[52%] relative bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#7c2d12] flex-col justify-between overflow-hidden">
        <Dots />

        {/* Decorative arcs */}
        <svg className="absolute -right-24 -top-24 w-96 h-96 opacity-10" viewBox="0 0 400 400" fill="none">
          <circle cx="200" cy="200" r="180" stroke="#f97316" strokeWidth="1.5" />
          <circle cx="200" cy="200" r="120" stroke="#f97316" strokeWidth="1" />
          <circle cx="200" cy="200" r="60"  stroke="#f97316" strokeWidth="0.5" />
        </svg>
        <svg className="absolute -left-20 -bottom-20 w-72 h-72 opacity-10" viewBox="0 0 400 400" fill="none">
          <circle cx="200" cy="200" r="180" stroke="#fb923c" strokeWidth="1.5" />
        </svg>

        {/* Top logo */}
        <div className="relative z-10 p-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shadow-lg">
              <span className="text-white text-lg font-black">S</span>
            </div>
            <span className="text-white text-lg font-bold tracking-wide">Site360</span>
          </div>
        </div>

        {/* Center content */}
        <div className="relative z-10 px-10 pb-4">
          {/* 360 badge */}
          <div className="inline-flex items-center gap-2 bg-orange-500/20 border border-orange-500/30 rounded-full px-3 py-1 mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-orange-300 text-xs font-medium">Hệ thống giám sát trực quan</span>
          </div>

          <h2 className="text-4xl font-extrabold text-white leading-tight mb-3">
            Quản lý hiện trường<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">
              360°
            </span>{' '}thông minh
          </h2>
          <p className="text-white/50 text-sm mb-10 leading-relaxed max-w-sm">
            Giám sát công trình mọi lúc mọi nơi với ảnh 360° độ phân giải cao,
            bản đồ GPS thực địa và theo dõi tiến độ theo thời gian thực.
          </p>

          <div className="space-y-4">
            <Feature icon="🌐" text="Ảnh 360° chất lượng cao" sub="Xem toàn cảnh hiện trường từ bất kỳ đâu" />
            <Feature icon="📍" text="Bản đồ GPS thực địa" sub="Định vị chính xác từng điểm chụp trên công trường" />
            <Feature icon="📊" text="Theo dõi tiến độ" sub="Dashboard tổng hợp báo cáo và cảnh báo sự cố" />
          </div>
        </div>

        {/* Bottom */}
        <div className="relative z-10 px-10 py-6">
          <p className="text-white/30 text-xs">
            Site360 © {new Date().getFullYear()} — Nền tảng giám sát công trường số
          </p>
        </div>
      </div>

      {/* ── Right panel: form ── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-[#f8fafc] px-6 py-10 relative">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg mb-3">
            <span className="text-white text-2xl font-black">S</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Site360</h1>
          <p className="text-gray-400 text-sm">Quản lý hiện trường công trình</p>
        </div>

        {/* Card */}
        <div
          className={`w-full max-w-sm transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
        >
          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Chào mừng trở lại</h2>
            <p className="text-gray-400 text-sm mt-1">Nhập thông tin tài khoản để tiếp tục</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="email@congty.vn"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-300
                  focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
                  transition-all shadow-sm disabled:opacity-50"
                autoComplete="email"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-300
                    focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent
                    transition-all shadow-sm disabled:opacity-50"
                  autoComplete="current-password"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
                  tabIndex={-1}
                >
                  {showPass
                    ? <EyeOff className="w-4.5 h-4.5" />
                    : <Eye     className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-xl px-3.5 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-600 leading-snug">{error}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2.5
                bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700
                disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed
                text-white font-semibold py-3 px-4 rounded-xl transition-all text-sm shadow-lg shadow-orange-500/20
                hover:shadow-orange-500/30 active:scale-[0.98] mt-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Đang xác thực...
                </>
              ) : (
                <>
                  Đăng nhập
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <p className="text-center text-xs text-gray-400 mt-8 leading-relaxed">
            Quên mật khẩu? Liên hệ{' '}
            <span className="text-orange-500 font-medium">Ban quản lý dự án</span>
            <br />để được hỗ trợ cấp lại tài khoản.
          </p>
        </div>
      </div>
    </div>
  );
};
