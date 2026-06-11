import React, { useEffect, useState, useCallback } from 'react';
import {
  Camera, AlertTriangle, FolderOpen, TrendingUp,
  RefreshCw, Search, SlidersHorizontal,
} from 'lucide-react';
import { gasGet, gasBatchList } from '../lib/gasApi';
import { useAuthStore } from '../store/authStore';
import { ProjectCard } from '../components/ProjectCard';
import type { GasProject, GasPhoto, GasStats } from '../types/gas';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}

const StatsCard: React.FC<StatsCardProps> = ({ label, value, icon: Icon, color, sub }) => (
  <div className="bg-white rounded-2xl border border-gray-200 p-5">
    <div className="flex items-center justify-between mb-3">
      <p className="text-sm text-gray-500 font-medium">{label}</p>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
    </div>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
);

export const DashboardPage: React.FC = () => {
  const { session } = useAuthStore();
  const [projects, setProjects] = useState<GasProject[]>([]);
  const [photoCounts, setPhotoCounts] = useState<Record<string, number>>({});
  const [totalStats, setTotalStats] = useState<GasStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Batch load dự án + ảnh 360 cùng lúc (giảm số request GAS)
      const batchRes = await gasBatchList<Record<string, unknown[]>>(['duan', '360']);

      if (batchRes.status !== 'success' || !batchRes.data) throw new Error(batchRes.message);
      const batchData = batchRes.data as Record<string, unknown[]>;

      let list: GasProject[] = (batchData['duan'] ?? []) as GasProject[];
      const allPhotos: GasPhoto[] = (batchData['360'] ?? []) as GasPhoto[];

      // Lọc theo quyền
      if (session?.vaiTro !== 'Quản lý' && session?.duAn360?.length) {
        list = list.filter(p => session.duAn360.includes(p.maDA));
      }

      setProjects(list);

      // Đếm ảnh từng dự án từ batch data
      const counts: Record<string, number> = {};
      allPhotos.forEach((p: GasPhoto) => {
        if (p.maDA) counts[p.maDA] = (counts[p.maDA] ?? 0) + 1;
      });
      setPhotoCounts(counts);

      // Tổng thống kê từ dữ liệu batch
      const totalSuCo = allPhotos.reduce((s, p) => s + Number(p.pinsSuCo ?? 0), 0);
      setTotalStats({ tongAnh: allPhotos.length, pinsSuCo: totalSuCo });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = projects.filter(p => {
    const matchSearch = !search ||
      p.tenDA.toLowerCase().includes(search.toLowerCase()) ||
      p.maDA.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || p.trangThai === filterStatus;
    return matchSearch && matchStatus;
  });

  const statuses = [...new Set(projects.map(p => p.trangThai).filter(Boolean))];
  const totalPhotos = Object.values(photoCounts).reduce((a, b) => a + b, 0);
  const totalIssues = totalStats?.pinsSuCo ?? 0;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {greeting}, {session?.tenDN}!
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Tổng quan hoạt động giám sát hiện trường
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          label="Dự án phụ trách"
          value={loading ? '—' : projects.length}
          icon={FolderOpen}
          color="bg-blue-100 text-blue-600"
          sub="dự án được phân công"
        />
        <StatsCard
          label="Ảnh 360° tổng"
          value={loading ? '—' : totalPhotos}
          icon={Camera}
          color="bg-orange-100 text-orange-600"
          sub="ảnh hiện trường"
        />
        <StatsCard
          label="Sự cố mở"
          value={loading ? '—' : totalIssues}
          icon={AlertTriangle}
          color="bg-red-100 text-red-600"
          sub="cần xử lý"
        />
        <StatsCard
          label="Tiến độ"
          value={loading ? '—' : `${filtered.filter(p => p.trangThai === 'Đang thi công').length}/${projects.length}`}
          icon={TrendingUp}
          color="bg-green-100 text-green-600"
          sub="dự án đang thi công"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm kiếm dự án..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 appearance-none cursor-pointer"
            >
              <option value="">Tất cả trạng thái</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm hover:border-orange-300 hover:text-orange-600 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Project grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 h-48 animate-pulse">
              <div className="h-2 bg-gray-200 rounded-t-2xl" />
              <div className="p-5 space-y-3">
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">{search ? 'Không tìm thấy dự án phù hợp' : 'Chưa có dự án nào được phân công'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(p => (
            <ProjectCard key={p.maDA} project={p} photoCount={photoCounts[p.maDA] ?? 0} />
          ))}
        </div>
      )}
    </div>
  );
};
