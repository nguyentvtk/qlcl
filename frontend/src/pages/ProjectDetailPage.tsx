import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Camera, Map, LayoutGrid, AlertCircle, Plus,
  RefreshCw, Filter, ChevronDown, X, Loader2,
  BarChart2, MapPin, Calendar, Eye,
} from 'lucide-react';
import { gasGet } from '../lib/gasApi';
import { useAuthStore } from '../store/authStore';
import { PhotoGrid } from '../components/PhotoGrid';
import { UploadPhotoModal } from '../components/UploadPhotoModal';
import type { GasProject, GasPhoto, GasStats, GasTask } from '../types/gas';
import type { Task, KanbanColumns, TaskStatus, Priority } from '../types';
import KanbanGanttWorkspace from '../components/KanbanGanttWorkspace';

// Lazy-load SiteMap để tránh lỗi SSR với leaflet
const SiteMap = React.lazy(() => import('../components/SiteMap'));

// ─── Tab types ───────────────────────────────────────────────
type TabKey = 'photos' | 'map' | 'tasks' | 'stats';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'photos', label: 'Ảnh 360°',  icon: Camera },
  { key: 'map',    label: 'Bản đồ',    icon: Map },
  { key: 'tasks',  label: 'Công việc', icon: LayoutGrid },
  { key: 'stats',  label: 'Thống kê',  icon: BarChart2 },
];

// ─── GAS Task → App Task adapter ─────────────────────────────
const STATUS_MAP: Record<string, TaskStatus> = {
  'Chờ': 'todo', 'Cần làm': 'todo', 'Mới': 'todo',
  'Đang làm': 'doing', 'Đang thực hiện': 'doing', 'Đang thi công': 'doing',
  'Kiểm tra': 'review', 'Đang kiểm tra': 'review', 'Chờ duyệt': 'review',
  'Hoàn thành': 'done', 'Xong': 'done',
  'Bị chặn': 'blocked', 'Tạm dừng': 'blocked', 'Vướng mắc': 'blocked',
};
const PRIORITY_MAP: Record<string, Priority> = {
  'Thấp': 'low', 'Bình thường': 'medium', 'Cao': 'high', 'Khẩn': 'critical',
};

function adaptTask(g: GasTask, idx: number): Task {
  const status: TaskStatus = STATUS_MAP[g.trangThai ?? ''] ?? 'todo';
  const priority: Priority = PRIORITY_MAP[g.uuTien ?? ''] ?? 'medium';
  return {
    id:           g.maNV || `task-${idx}`,
    project_id:   g.maDA,
    title:        g.nhomNV ? `[${g.nhomNV}] ${g.moTa ?? g.maNV}` : (g.moTa ?? g.maNV),
    description:  g.ghiChu,
    status,
    priority,
    start_date:   g.ngayBatDau,
    end_date:     g.hanChot,
    progress:     Math.min(100, Math.max(0, Number(g.tiDo ?? 0))),
    dependencies: [],
    assigned_to:  undefined,
    assignee_name: g.nguoiThucHien,
    kanban_order: idx,
    color:        '#f97316',
    tags:         g.nhomNV ? [g.nhomNV] : [],
    photo_evidence: [],
    created_at:   g.ngayBatDau ?? new Date().toISOString(),
  };
}

function buildColumns(tasks: Task[]): KanbanColumns {
  const cols: KanbanColumns = { todo: [], doing: [], review: [], done: [], blocked: [] };
  tasks.forEach(t => { if (cols[t.status]) cols[t.status].push(t); });
  return cols;
}

// ─── Stats tab ────────────────────────────────────────────────
const StatsTab: React.FC<{ stats: GasStats | null; photos: GasPhoto[] }> = ({ stats, photos }) => {
  const zones = [...new Set(photos.map(p => p.khuVuc).filter(Boolean))];
  const phases = [...new Set(photos.map(p => p.giaiDoan).filter(Boolean))];
  const totalSuCo = photos.reduce((s, p) => s + Number(p.pinsSuCo ?? 0), 0);
  const totalTienDo = photos.reduce((s, p) => s + Number(p.pinsTienDo ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Tổng ảnh 360°',  value: stats?.tongAnh ?? photos.length, color: 'bg-blue-50 text-blue-700' },
          { label: 'Khu vực',        value: zones.length,    color: 'bg-purple-50 text-purple-700' },
          { label: 'Sự cố gắn thẻ', value: totalSuCo,       color: 'bg-red-50 text-red-700' },
          { label: 'Tiến độ gắn thẻ',value: totalTienDo,    color: 'bg-green-50 text-green-700' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-gray-200 rounded-2xl p-4">
            <p className="text-sm text-gray-500">{label}</p>
            <p className={`text-3xl font-bold mt-1 ${color.split(' ')[1]}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Giai đoạn */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm">Ảnh theo giai đoạn</h3>
          {phases.length === 0 ? (
            <p className="text-sm text-gray-400">Chưa phân giai đoạn</p>
          ) : phases.map(phase => {
            const count = photos.filter(p => p.giaiDoan === phase).length;
            const pct = Math.round((count / photos.length) * 100);
            return (
              <div key={phase} className="mb-3">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{phase}</span>
                  <span>{count} ảnh ({pct}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Khu vực */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm">Ảnh theo khu vực</h3>
          {zones.length === 0 ? (
            <p className="text-sm text-gray-400">Chưa phân khu vực</p>
          ) : zones.map(zone => {
            const count = photos.filter(p => p.khuVuc === zone).length;
            const pct = Math.round((count / photos.length) * 100);
            return (
              <div key={zone} className="mb-3">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{zone}</span>
                  <span>{count} ảnh ({pct}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Viewer overlay ────────────────────────────────────────────
// Dùng lại Photo360Viewer component từ phiên trước
const PhotoViewerOverlay = React.lazy(() => import('../components/Photo360Viewer'));

// ─── Main page ────────────────────────────────────────────────
export const ProjectDetailPage: React.FC = () => {
  const { maDA } = useParams<{ maDA: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { session } = useAuthStore();

  const tab = (searchParams.get('tab') ?? 'photos') as TabKey;
  const setTab = (t: TabKey) => setSearchParams({ tab: t }, { replace: true });

  const [project, setProject]     = useState<GasProject | null>(null);
  const [photos, setPhotos]       = useState<GasPhoto[]>([]);
  const [filteredPhotos, setFiltered] = useState<GasPhoto[]>([]);
  const [stats, setStats]         = useState<GasStats | null>(null);
  const [tasks, setTasks]         = useState<Task[]>([]);
  const [columns, setColumns]     = useState<KanbanColumns>({ todo: [], doing: [], review: [], done: [], blocked: [] });
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  // Filters
  const [filterKhuVuc, setFilterKV]    = useState('');
  const [filterPhase, setFilterPhase]  = useState('');
  const [showFilter, setShowFilter]    = useState(false);

  // Modals
  const [showUpload, setShowUpload]         = useState(false);
  const [viewerPhoto, setViewerPhoto]       = useState<GasPhoto | null>(null);

  const canEdit = session?.vaiTro === 'Quản lý' || session?.vaiTro === 'Giám sát';

  const loadData = useCallback(async () => {
    if (!maDA) return;
    setLoading(true);
    setError('');
    try {
      const [projRes, photoRes, statsRes, taskRes] = await Promise.all([
        gasGet<GasProject>('duan', 'get', { id: maDA }),
        gasGet<GasPhoto[]>('pano360', 'list', { maDA }),
        gasGet<GasStats>('pano360', 'stats', { maDA }),
        gasGet<GasTask[]>('nhiemvu', 'list', { maDA }),
      ]);

      if (projRes.status === 'success' && projRes.data) setProject(projRes.data);
      if (photoRes.status === 'success' && photoRes.data) {
        const list = photoRes.data;
        setPhotos(list);
        setFiltered(list);
      }
      if (statsRes.status === 'success' && statsRes.data) setStats(statsRes.data);
      if (taskRes.status === 'success' && taskRes.data) {
        const adapted = taskRes.data.map(adaptTask);
        setTasks(adapted);
        setColumns(buildColumns(adapted));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tải dữ liệu');
    } finally {
      setLoading(false);
    }
  }, [maDA]);

  useEffect(() => { loadData(); }, [loadData]);

  // Apply filters
  useEffect(() => {
    let list = photos;
    if (filterKhuVuc) list = list.filter(p => p.khuVuc === filterKhuVuc);
    if (filterPhase)  list = list.filter(p => p.giaiDoan === filterPhase);
    setFiltered(list);
  }, [photos, filterKhuVuc, filterPhase]);

  const zones  = [...new Set(photos.map(p => p.khuVuc).filter(Boolean))];
  const phases = [...new Set(photos.map(p => p.giaiDoan).filter(Boolean))];

  const handleTaskUpdate = async (_id: string, _updates: Partial<Task>) => {
    // Cập nhật local state (GAS update gọi qua gasPost)
  };
  const handleTaskCreate = () => {};
  const handleReorder = async () => {};

  // Adapt GasPhoto to SiteMap Photo360 shape
  const mapPhotos = filteredPhotos
    .filter(p => p.viDo && p.kinhDo)
    .map(p => ({
      id: p.id,
      project_id: p.maDA,
      file_url: p.url360,
      thumbnail_url: p.urlThumb,
      original_filename: p.tenFile || p.id,
      latitude: Number(p.viDo),
      longitude: Number(p.kinhDo),
      heading: Number(p.huongCamera ?? 0),
      captured_at: p.ngayChup,
      zone_name: p.khuVuc,
      phase: p.giaiDoan,
      pin_count: Number(p.pinsSuCo ?? 0) + Number(p.pinsTienDo ?? 0),
      coordinates: { lat: Number(p.viDo), lng: Number(p.kinhDo) },
      pins: [],
    }));

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-orange-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Tổng quan</span>
          </button>
          <span className="text-gray-300">/</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                {maDA}
              </span>
              {loading ? (
                <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
              ) : (
                <h1 className="font-semibold text-gray-900 text-sm truncate">
                  {project?.tenDA ?? maDA}
                </h1>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-orange-600 transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            {canEdit && tab === 'photos' && (
              <button
                onClick={() => setShowUpload(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-xl transition"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Thêm ảnh</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 lg:px-6">
        <div className="flex gap-0">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                ${tab === key
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
              {key === 'photos' && photos.length > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium
                  ${tab === key ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-600'}`}>
                  {photos.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-auto">

        {/* ── Ảnh 360° ── */}
        {tab === 'photos' && (
          <div className="p-4 lg:p-6">
            {/* Filter bar */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setShowFilter(!showFilter)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-xl transition
                  ${showFilter || filterKhuVuc || filterPhase
                    ? 'border-orange-400 text-orange-600 bg-orange-50'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
              >
                <Filter className="w-4 h-4" />
                Lọc
                {(filterKhuVuc || filterPhase) && (
                  <span className="ml-1 bg-orange-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                    {[filterKhuVuc, filterPhase].filter(Boolean).length}
                  </span>
                )}
              </button>
              <span className="text-sm text-gray-400">
                {filteredPhotos.length} / {photos.length} ảnh
              </span>
              {(filterKhuVuc || filterPhase) && (
                <button
                  onClick={() => { setFilterKV(''); setFilterPhase(''); }}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500"
                >
                  <X className="w-3.5 h-3.5" />
                  Xóa lọc
                </button>
              )}
            </div>

            {showFilter && (
              <div className="flex flex-wrap gap-3 mb-4 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Khu vực:</label>
                  <select
                    value={filterKhuVuc}
                    onChange={e => setFilterKV(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    <option value="">Tất cả</option>
                    {zones.map(z => <option key={z}>{z}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-medium text-gray-600 whitespace-nowrap">Giai đoạn:</label>
                  <select
                    value={filterPhase}
                    onChange={e => setFilterPhase(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    <option value="">Tất cả</option>
                    {phases.map(p => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="aspect-[4/3] bg-gray-200 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <PhotoGrid photos={filteredPhotos} onSelect={setViewerPhoto} />
            )}
          </div>
        )}

        {/* ── Bản đồ ── */}
        {tab === 'map' && (
          <div className="h-full min-h-[500px]">
            {loading ? (
              <div className="h-full bg-gray-200 animate-pulse rounded-none" />
            ) : mapPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 py-20">
                <MapPin className="w-12 h-12 mb-3 opacity-40" />
                <p className="text-sm">Chưa có ảnh nào có tọa độ GPS</p>
                <p className="text-xs mt-1">Thêm ảnh với thông tin GPS để hiển thị trên bản đồ</p>
              </div>
            ) : (
              <React.Suspense fallback={<div className="h-full bg-gray-100 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-orange-500" /></div>}>
                <SiteMap
                  photos={mapPhotos as any}
                  onPhotoSelect={(p: any) => {
                    const match = photos.find(ph => ph.id === p.id);
                    if (match) setViewerPhoto(match);
                  }}
                />
              </React.Suspense>
            )}
          </div>
        )}

        {/* ── Công việc ── */}
        {tab === 'tasks' && (
          <div className="p-4 lg:p-6">
            {loading ? (
              <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
            ) : (
              <KanbanGanttWorkspace
                tasks={tasks}
                columns={columns}
                projectId={maDA!}
                onTaskUpdate={handleTaskUpdate}
                onTaskCreate={handleTaskCreate}
                onReorder={handleReorder}
              />
            )}
          </div>
        )}

        {/* ── Thống kê ── */}
        {tab === 'stats' && (
          <div className="p-4 lg:p-6">
            {loading ? (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 bg-gray-200 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : (
              <StatsTab stats={stats} photos={photos} />
            )}
          </div>
        )}
      </div>

      {/* 360° Viewer Overlay */}
      {viewerPhoto && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-black/80 border-b border-white/10">
            <div className="text-white text-sm">
              <span className="font-medium">{viewerPhoto.hangMuc || viewerPhoto.khuVuc || viewerPhoto.id}</span>
              {viewerPhoto.ngayChup && (
                <span className="ml-2 text-white/60">· {viewerPhoto.ngayChup}</span>
              )}
            </div>
            <button
              onClick={() => setViewerPhoto(null)}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm px-3 py-1.5 hover:bg-white/10 rounded-lg transition"
            >
              <X className="w-4 h-4" />
              Đóng
            </button>
          </div>
          <div className="flex-1">
            <React.Suspense fallback={
              <div className="h-full flex items-center justify-center bg-gray-900">
                <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
              </div>
            }>
              <PhotoViewerOverlay
                photo={{
                  id: viewerPhoto.id,
                  project_id: viewerPhoto.maDA,
                  file_url: viewerPhoto.url360,
                  thumbnail_url: viewerPhoto.urlThumb,
                  original_filename: viewerPhoto.tenFile || viewerPhoto.id,
                  latitude: viewerPhoto.viDo ? Number(viewerPhoto.viDo) : undefined,
                  longitude: viewerPhoto.kinhDo ? Number(viewerPhoto.kinhDo) : undefined,
                  heading: viewerPhoto.huongCamera ? Number(viewerPhoto.huongCamera) : undefined,
                  captured_at: viewerPhoto.ngayChup,
                  notes: viewerPhoto.ghiChu,
                  coordinates: viewerPhoto.viDo && viewerPhoto.kinhDo
                    ? { lat: Number(viewerPhoto.viDo), lng: Number(viewerPhoto.kinhDo) }
                    : null,
                  pins: [],
                }}
                readOnly={!canEdit}
              />
            </React.Suspense>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && project && (
        <UploadPhotoModal
          maDA={maDA!}
          tenDA={project.tenDA}
          onClose={() => setShowUpload(false)}
          onSuccess={() => { setShowUpload(false); loadData(); }}
        />
      )}
    </div>
  );
};
