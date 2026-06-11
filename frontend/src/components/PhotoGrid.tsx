import React, { useState } from 'react';
import {
  Camera, MapPin, Calendar, Tag, AlertCircle, CheckCircle2,
  ExternalLink, Clock, Eye,
} from 'lucide-react';
import type { GasPhoto } from '../types/gas';

interface Props {
  photos: GasPhoto[];
  onSelect: (photo: GasPhoto) => void;
}

const PHASE_COLOR: Record<string, string> = {
  'Nền móng':  'bg-amber-100 text-amber-700',
  'Thân':      'bg-blue-100 text-blue-700',
  'Hoàn thiện':'bg-green-100 text-green-700',
  'Tổng thể':  'bg-purple-100 text-purple-700',
};

export const PhotoGrid: React.FC<Props> = ({ photos, onSelect }) => {
  const [hovered, setHovered] = useState<string | null>(null);

  if (photos.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <Camera className="w-12 h-12 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Chưa có ảnh 360° nào</p>
        <p className="text-xs mt-1">Thêm ảnh bằng nút "Tải ảnh lên" ở trên</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {photos.map(photo => {
        const isHovered = hovered === photo.id;
        const hasSuCo = Number(photo.pinsSuCo ?? 0) > 0;
        const hasTienDo = Number(photo.pinsTienDo ?? 0) > 0;
        const phaseStyle = PHASE_COLOR[photo.giaiDoan ?? ''] ?? 'bg-gray-100 text-gray-600';

        return (
          <div
            key={photo.id}
            onClick={() => onSelect(photo)}
            onMouseEnter={() => setHovered(photo.id)}
            onMouseLeave={() => setHovered(null)}
            className="relative bg-gray-900 rounded-xl overflow-hidden cursor-pointer group aspect-[4/3]
              hover:ring-2 hover:ring-orange-400 transition-all"
          >
            {/* Thumbnail */}
            {photo.urlThumb || photo.url360 ? (
              <img
                src={photo.urlThumb || photo.url360}
                alt={photo.tenFile || photo.id}
                className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Camera className="w-8 h-8 text-gray-600" />
              </div>
            )}

            {/* Overlay on hover */}
            <div className={`absolute inset-0 bg-black/60 flex items-center justify-center transition-opacity
              ${isHovered ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-center">
                <Eye className="w-8 h-8 text-white mx-auto mb-1" />
                <p className="text-white text-xs font-medium">Xem 360°</p>
              </div>
            </div>

            {/* Badges */}
            <div className="absolute top-2 left-2 flex flex-wrap gap-1">
              {photo.giaiDoan && (
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium leading-none ${phaseStyle}`}>
                  {photo.giaiDoan}
                </span>
              )}
            </div>

            {/* Pin badges */}
            {(hasSuCo || hasTienDo) && (
              <div className="absolute top-2 right-2 flex flex-col gap-1">
                {hasSuCo && (
                  <span className="flex items-center gap-0.5 text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-medium">
                    <AlertCircle className="w-3 h-3" />
                    {photo.pinsSuCo}
                  </span>
                )}
                {hasTienDo && (
                  <span className="flex items-center gap-0.5 text-xs bg-green-500 text-white px-1.5 py-0.5 rounded font-medium">
                    <CheckCircle2 className="w-3 h-3" />
                    {photo.pinsTienDo}
                  </span>
                )}
              </div>
            )}

            {/* GPS dot */}
            {photo.viDo && photo.kinhDo && (
              <div className="absolute bottom-2 right-2">
                <MapPin className="w-3.5 h-3.5 text-orange-400 drop-shadow" />
              </div>
            )}

            {/* Footer info */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
              <p className="text-white text-xs font-medium truncate">
                {photo.hangMuc || photo.khuVuc || photo.tenFile || photo.id}
              </p>
              {photo.ngayChup && (
                <div className="flex items-center gap-1 mt-0.5">
                  <Calendar className="w-2.5 h-2.5 text-gray-300" />
                  <p className="text-gray-300 text-xs">{photo.ngayChup}</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
