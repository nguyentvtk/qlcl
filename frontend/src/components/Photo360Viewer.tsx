// ============================================================
// Photo360Viewer.tsx - Hiển thị ảnh 360° với Pannellum
// Cho phép click để tạo Pin Report tại điểm bất kỳ trên ảnh
// ============================================================
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { X, MapPin, AlertTriangle, CheckCircle2, FileText, ShieldAlert, Star, Info } from 'lucide-react';
import { Photo360, PinReport, PinType, Priority, PIN_TYPE_COLORS } from '../types';

// Pannellum được load qua CDN trong index.html
// Khai báo type cho window.pannellum
declare global {
  interface Window {
    pannellum: {
      viewer: (container: string | HTMLElement, config: PannellumConfig) => PannellumViewer;
    };
  }
}

interface PannellumConfig {
  type: string;
  panorama: string;
  autoLoad: boolean;
  showControls: boolean;
  mouseZoom: boolean;
  hfov: number;
  minHfov: number;
  maxHfov: number;
  hotSpots?: PannellumHotspot[];
  onLoad?: () => void;
}

interface PannellumViewer {
  destroy: () => void;
  getYaw: () => number;
  getPitch: () => number;
  on: (event: string, callback: (e: MouseEvent) => void) => void;
}

interface PannellumHotspot {
  id: string;
  pitch: number;
  yaw: number;
  type: 'info';
  text: string;
  cssClass: string;
}

interface Props {
  photo: Photo360;
  onPinCreate?: (pinData: { yaw: number; pitch: number }) => void;
  onClose?: () => void;
  readOnly?: boolean;
}

// Form tạo Pin Report khi click vào ảnh
interface PinFormData {
  title: string;
  description: string;
  type: PinType;
  priority: Priority;
}

const PIN_TYPE_OPTIONS: { value: PinType; label: string; icon: React.ReactNode }[] = [
  { value: 'issue',    label: 'Sự cố',        icon: <AlertTriangle size={16} /> },
  { value: 'safety',  label: 'An toàn LĐ',   icon: <ShieldAlert size={16} /> },
  { value: 'quality', label: 'Chất lượng',   icon: <Star size={16} /> },
  { value: 'progress',label: 'Tiến độ',      icon: <CheckCircle2 size={16} /> },
  { value: 'rfi',     label: 'Yêu cầu TT',  icon: <Info size={16} /> },
  { value: 'note',    label: 'Ghi chú',      icon: <FileText size={16} /> },
];

const Photo360Viewer: React.FC<Props> = ({ photo, onPinCreate, onClose, readOnly = false }) => {
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const pannellumRef = useRef<PannellumViewer | null>(null);

  // Trạng thái UI
  const [isLoading, setIsLoading] = useState(true);
  const [clickCoords, setClickCoords] = useState<{ yaw: number; pitch: number } | null>(null);
  const [showPinForm, setShowPinForm] = useState(false);
  const [pinMode, setPinMode] = useState(false); // Chế độ đặt pin
  const [formData, setFormData] = useState<PinFormData>({
    title: '', description: '', type: 'issue', priority: 'medium',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Chuyển đổi pins hiện có thành Pannellum hotspots
  const buildHotspots = (pins: PinReport[]): PannellumHotspot[] => {
    return pins
      .filter(p => p.pin_yaw !== undefined && p.pin_pitch !== undefined)
      .map(p => ({
        id: p.id,
        pitch: p.pin_pitch!,
        yaw: p.pin_yaw!,
        type: 'info' as const,
        text: `[${p.type.toUpperCase()}] ${p.title}`,
        cssClass: `pannellum-hotspot-${p.type}`,
      }));
  };

  // Khởi tạo Pannellum viewer
  useEffect(() => {
    if (!viewerContainerRef.current || !window.pannellum) return;

    const hotspots = photo.pins ? buildHotspots(photo.pins) : [];

    pannellumRef.current = window.pannellum.viewer(viewerContainerRef.current, {
      type: 'equirectangular',
      panorama: photo.file_url,
      autoLoad: true,
      showControls: true,
      mouseZoom: true,
      hfov: 100,
      minHfov: 50,
      maxHfov: 120,
      hotSpots: hotspots,
      onLoad: () => setIsLoading(false),
    });

    // Lắng nghe sự kiện click để lấy tọa độ yaw/pitch
    pannellumRef.current.on('mousedown', (_e: MouseEvent) => {
      if (!pinMode || !pannellumRef.current) return;
      // Lấy góc nhìn tại thời điểm click
      const yaw = pannellumRef.current.getYaw();
      const pitch = pannellumRef.current.getPitch();
      setClickCoords({ yaw, pitch });
      setShowPinForm(true);
    });

    return () => {
      pannellumRef.current?.destroy();
      pannellumRef.current = null;
    };
  }, [photo.file_url, photo.pins, pinMode]);

  const handleFormSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clickCoords || !formData.title.trim()) return;

    setIsSubmitting(true);
    try {
      onPinCreate?.({ ...clickCoords, ...formData } as Parameters<NonNullable<typeof onPinCreate>>[0]);
      setShowPinForm(false);
      setClickCoords(null);
      setFormData({ title: '', description: '', type: 'issue', priority: 'medium' });
      setPinMode(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [clickCoords, formData, onPinCreate]);

  return (
    <div className="relative flex flex-col bg-black rounded-xl overflow-hidden" style={{ height: '70vh' }}>
      {/* ---- Header ---- */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-2 bg-gradient-to-b from-black/70 to-transparent">
        <div className="text-white">
          <h3 className="font-semibold text-sm truncate max-w-xs">{photo.original_filename}</h3>
          {photo.captured_at && (
            <p className="text-xs text-gray-300">
              {new Date(photo.captured_at).toLocaleString('vi-VN')}
            </p>
          )}
          {photo.zone_name && (
            <span className="inline-block bg-blue-600/80 text-white text-xs px-2 py-0.5 rounded mt-1">
              {photo.zone_name} {photo.phase && `• ${photo.phase}`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Nút chế độ đặt pin */}
          {!readOnly && (
            <button
              onClick={() => { setPinMode(!pinMode); setShowPinForm(false); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                pinMode
                  ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                  : 'bg-white/20 text-white hover:bg-white/30'
              }`}
            >
              <MapPin size={16} />
              {pinMode ? 'Click để đặt pin...' : 'Đặt pin báo cáo'}
            </button>
          )}

          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* ---- Pannellum Viewer ---- */}
      <div
        ref={viewerContainerRef}
        className="flex-1 w-full"
        style={{ cursor: pinMode ? 'crosshair' : 'grab' }}
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-900">
          <div className="flex flex-col items-center gap-3 text-white">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Đang tải ảnh 360°...</span>
          </div>
        </div>
      )}

      {/* Thông báo chế độ pin */}
      {pinMode && !showPinForm && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg animate-pulse pointer-events-none">
          Click vào bất kỳ điểm nào trên ảnh để tạo báo cáo
        </div>
      )}

      {/* ---- Form tạo Pin Report ---- */}
      {showPinForm && clickCoords && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 px-5 py-4 text-white">
              <h4 className="font-semibold text-lg">Tạo báo cáo sự cố</h4>
              <p className="text-orange-100 text-xs mt-0.5">
                Yaw: {clickCoords.yaw.toFixed(1)}° | Pitch: {clickCoords.pitch.toFixed(1)}°
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
              {/* Tiêu đề */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(d => ({ ...d, title: e.target.value }))}
                  placeholder="Mô tả ngắn gọn sự cố..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                  required
                  autoFocus
                />
              </div>

              {/* Loại báo cáo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Loại báo cáo</label>
                <div className="grid grid-cols-3 gap-2">
                  {PIN_TYPE_OPTIONS.map(({ value, label, icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormData(d => ({ ...d, type: value }))}
                      className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border-2 text-xs font-medium transition-all ${
                        formData.type === value
                          ? 'border-orange-400 bg-orange-50 text-orange-700'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      <span style={{ color: formData.type === value ? PIN_TYPE_COLORS[value] : undefined }}>
                        {icon}
                      </span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mức ưu tiên */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mức độ ưu tiên</label>
                <select
                  value={formData.priority}
                  onChange={e => setFormData(d => ({ ...d, priority: e.target.value as Priority }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none"
                >
                  <option value="low">Thấp</option>
                  <option value="medium">Trung bình</option>
                  <option value="high">Cao</option>
                  <option value="critical">Nghiêm trọng</option>
                </select>
              </div>

              {/* Mô tả */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả chi tiết</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(d => ({ ...d, description: e.target.value }))}
                  rows={2}
                  placeholder="Mô tả thêm về sự cố..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 outline-none resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowPinForm(false); setClickCoords(null); }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.title.trim()}
                  className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Tạo báo cáo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSS cho Pannellum hotspots theo loại */}
      <style>{`
        .pannellum-hotspot-issue    .pnlm-hotspot-base { background: #ef4444 !important; }
        .pannellum-hotspot-safety   .pnlm-hotspot-base { background: #f97316 !important; }
        .pannellum-hotspot-quality  .pnlm-hotspot-base { background: #eab308 !important; }
        .pannellum-hotspot-progress .pnlm-hotspot-base { background: #22c55e !important; }
        .pannellum-hotspot-rfi      .pnlm-hotspot-base { background: #3b82f6 !important; }
        .pannellum-hotspot-note     .pnlm-hotspot-base { background: #6b7280 !important; }
      `}</style>
    </div>
  );
};

export default Photo360Viewer;
