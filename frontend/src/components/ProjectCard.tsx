import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Camera, ChevronRight, Building2 } from 'lucide-react';
import type { GasProject } from '../types/gas';

const STATUS_STYLE: Record<string, string> = {
  'Đang thi công':  'bg-blue-100 text-blue-700',
  'Hoàn thành':     'bg-green-100 text-green-700',
  'Tạm dừng':       'bg-yellow-100 text-yellow-700',
  'Chuẩn bị':       'bg-purple-100 text-purple-700',
};

interface Props {
  project: GasProject;
  photoCount?: number;
}

function fmtCurrency(val?: number | string) {
  const n = Number(val);
  if (!n || isNaN(n)) return '—';
  if (n >= 1e9) return (n / 1e9).toFixed(1) + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(0) + ' triệu';
  return n.toLocaleString('vi-VN') + ' đ';
}

export const ProjectCard: React.FC<Props> = ({ project, photoCount = 0 }) => {
  const navigate = useNavigate();
  const statusStyle = STATUS_STYLE[project.trangThai ?? ''] ?? 'bg-gray-100 text-gray-600';
  const hasGPS = !!(project.viDo && project.kinhDo);

  return (
    <div
      onClick={() => navigate(`/projects/${project.maDA}`)}
      className="bg-white rounded-2xl border border-gray-200 hover:border-orange-300 hover:shadow-lg
        transition-all cursor-pointer group overflow-hidden"
    >
      {/* Header bar */}
      <div className="h-2 bg-gradient-to-r from-orange-400 to-orange-600" />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                {project.maDA}
              </span>
              {project.kichHoat360 && (
                <span className="text-xs bg-slate-800 text-white px-1.5 py-0.5 rounded font-medium">
                  360°
                </span>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 text-sm leading-snug line-clamp-2">
              {project.tenDA}
            </h3>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap flex-shrink-0 ${statusStyle}`}>
            {project.trangThai ?? 'N/A'}
          </span>
        </div>

        {project.moTa && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-3">{project.moTa}</p>
        )}

        <div className="space-y-1.5 text-xs text-gray-500">
          {(project.ngayBatDau || project.ngayKetThuc) && (
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>{project.ngayBatDau ?? '?'} → {project.ngayKetThuc ?? '?'}</span>
            </div>
          )}
          {project.tongMucDauTu && (
            <div className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>{fmtCurrency(project.tongMucDauTu)}</span>
            </div>
          )}
          {hasGPS && (
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
              <span className="text-orange-600">Có tọa độ GPS</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Camera className="w-3.5 h-3.5 text-orange-400" />
            <span>{photoCount} ảnh 360°</span>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
        </div>
      </div>
    </div>
  );
};
