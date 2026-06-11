// ============================================================
// SiteMap.tsx - Bản đồ công trường với react-leaflet
// Hiển thị markers vị trí ảnh 360° và pins báo cáo
// ============================================================
import React, { useState, useCallback, useRef } from 'react';
import {
  MapContainer, TileLayer, Marker, Popup, useMap,
  Circle, ZoomControl, LayersControl, LayerGroup,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Camera, AlertTriangle, Search, Filter, Layers, Navigation } from 'lucide-react';
import { Photo360, PinReport, PIN_TYPE_COLORS } from '../types';
import Photo360Viewer from './Photo360Viewer';

// Fix lỗi icon mặc định của Leaflet khi dùng với Webpack/Vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ---- Custom icon cho ảnh 360° ----
const createPhotoIcon = (hasPin: boolean, isSelected: boolean) => L.divIcon({
  className: 'site360-photo-marker',
  html: `
    <div style="
      width: 36px; height: 36px;
      background: ${isSelected ? '#2563eb' : '#1e40af'};
      border: 3px solid ${isSelected ? '#93c5fd' : 'white'};
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      transform: ${isSelected ? 'scale(1.3)' : 'scale(1)'};
      transition: transform 0.2s;
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
      </svg>
      ${hasPin ? `<div style="
        position:absolute; top:-3px; right:-3px;
        width:10px; height:10px;
        background:#ef4444; border:1.5px solid white; border-radius:50%;
      "></div>` : ''}
    </div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
  popupAnchor: [0, -20],
});

// ---- Custom icon cho Pin báo cáo ----
const createPinIcon = (type: string, status: string) => L.divIcon({
  className: 'site360-pin-marker',
  html: `
    <div style="
      width: 28px; height: 28px;
      background: ${PIN_TYPE_COLORS[type as keyof typeof PIN_TYPE_COLORS] || '#6b7280'};
      border: 2.5px solid white;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      opacity: ${status === 'resolved' || status === 'closed' ? '0.5' : '1'};
    "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -30],
});

interface Props {
  photos: Photo360[];
  pins?: PinReport[];
  projectCenter?: [number, number]; // [lat, lng]
  onPhotoSelect?: (photo: Photo360) => void;
  onRadiusSearch?: (lat: number, lng: number, radius: number) => void;
}

// Sub-component: flyTo khi chọn ảnh từ bên ngoài
const MapController: React.FC<{ target?: [number, number] }> = ({ target }) => {
  const map = useMap();
  React.useEffect(() => {
    if (target) map.flyTo(target, 18, { duration: 1 });
  }, [target, map]);
  return null;
};

const SiteMap: React.FC<Props> = ({
  photos,
  pins = [],
  projectCenter,
  onPhotoSelect,
  onRadiusSearch,
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo360 | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const [showPins, setShowPins] = useState(true);
  const [showRadius, setShowRadius] = useState(false);
  const [radiusCenter, setRadiusCenter] = useState<[number, number] | null>(null);
  const [radiusMeters, setRadiusMeters] = useState(50);
  const mapRef = useRef<L.Map | null>(null);

  // Tâm bản đồ mặc định: Hà Nội nếu không có dữ liệu
  const mapCenter: [number, number] = projectCenter ||
    (photos[0]?.latitude && photos[0]?.longitude
      ? [photos[0].latitude, photos[0].longitude]
      : [21.0285, 105.8542]);

  const handlePhotoClick = useCallback((photo: Photo360) => {
    setSelectedPhoto(photo);
    onPhotoSelect?.(photo);
  }, [onPhotoSelect]);

  const handleMapClick = useCallback((e: L.LeafletMouseEvent) => {
    if (!showRadius) return;
    const { lat, lng } = e.latlng;
    setRadiusCenter([lat, lng]);
    onRadiusSearch?.(lat, lng, radiusMeters);
  }, [showRadius, radiusMeters, onRadiusSearch]);

  // Lọc photos có tọa độ GPS
  const geoPhotos = photos.filter(p => p.latitude && p.longitude);
  const geoPins = pins.filter(p => p.coordinates);

  return (
    <div className="relative flex flex-col h-full bg-gray-100 rounded-xl overflow-hidden">
      {/* ---- Toolbar ---- */}
      <div className="absolute top-3 left-3 right-3 z-[1000] flex items-center gap-2 flex-wrap">
        {/* Thống kê nhanh */}
        <div className="bg-white rounded-xl shadow-lg px-4 py-2 flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 text-blue-700 font-semibold">
            <Camera size={16} />
            {geoPhotos.length} ảnh
          </span>
          {pins.length > 0 && (
            <span className="flex items-center gap-1.5 text-red-600 font-semibold">
              <AlertTriangle size={16} />
              {pins.filter(p => p.status === 'open').length} sự cố mở
            </span>
          )}
        </div>

        {/* Nút bán kính tìm kiếm */}
        <button
          onClick={() => setShowRadius(!showRadius)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-lg text-sm font-medium transition-all ${
            showRadius ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Search size={16} />
          Tìm theo bán kính
        </button>

        {showRadius && (
          <div className="bg-white rounded-xl shadow-lg px-3 py-2 flex items-center gap-2 text-sm">
            <span className="text-gray-600">Bán kính:</span>
            <select
              value={radiusMeters}
              onChange={e => {
                setRadiusMeters(parseInt(e.target.value));
                if (radiusCenter) onRadiusSearch?.(radiusCenter[0], radiusCenter[1], parseInt(e.target.value));
              }}
              className="border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-blue-400"
            >
              {[10, 25, 50, 100, 200, 500].map(r => (
                <option key={r} value={r}>{r}m</option>
              ))}
            </select>
            {radiusCenter && (
              <button
                onClick={() => { setRadiusCenter(null); }}
                className="text-red-500 hover:text-red-700 text-xs"
              >
                Xóa
              </button>
            )}
            <span className="text-gray-400 text-xs">Click bản đồ để đặt tâm</span>
          </div>
        )}

        {/* Toggle pins */}
        <button
          onClick={() => setShowPins(!showPins)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl shadow-lg text-sm font-medium ${
            showPins ? 'bg-orange-500 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Filter size={16} />
          {showPins ? 'Ẩn pins' : 'Hiện pins'}
        </button>
      </div>

      {/* ---- Leaflet Map ---- */}
      <MapContainer
        center={mapCenter}
        zoom={17}
        className="flex-1 w-full"
        zoomControl={false}
        ref={mapRef}
        // @ts-expect-error - event handler
        onClick={handleMapClick}
      >
        <ZoomControl position="bottomright" />
        <MapController target={
          selectedPhoto?.latitude && selectedPhoto?.longitude
            ? [selectedPhoto.latitude, selectedPhoto.longitude]
            : undefined
        } />

        <LayersControl position="topright">
          {/* Lớp bản đồ OpenStreetMap */}
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              maxZoom={22}
            />
          </LayersControl.BaseLayer>

          {/* Lớp vệ tinh (Esri) - hữu ích cho công trường */}
          <LayersControl.BaseLayer name="Ảnh vệ tinh">
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="&copy; Esri"
              maxZoom={22}
            />
          </LayersControl.BaseLayer>

          {/* Layer ảnh 360° */}
          <LayersControl.Overlay checked name="Ảnh 360°">
            <LayerGroup>
              {geoPhotos.map(photo => (
                <Marker
                  key={photo.id}
                  position={[photo.latitude!, photo.longitude!]}
                  icon={createPhotoIcon(
                    (photo.pin_count ?? 0) > 0,
                    selectedPhoto?.id === photo.id
                  )}
                  eventHandlers={{ click: () => handlePhotoClick(photo) }}
                >
                  <Popup maxWidth={280} className="site360-popup">
                    <div className="p-1">
                      {/* Thumbnail preview */}
                      {photo.thumbnail_url && (
                        <div
                          className="relative rounded-lg overflow-hidden mb-2 cursor-pointer group"
                          style={{ height: 140 }}
                          onClick={() => { setSelectedPhoto(photo); setShowViewer(true); }}
                        >
                          <img
                            src={photo.thumbnail_url}
                            alt={photo.original_filename}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          {/* Play button overlay */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
                            <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center">
                              <Camera size={20} className="text-blue-700 ml-0.5" />
                            </div>
                          </div>
                          <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
                            360°
                          </div>
                        </div>
                      )}

                      <h4 className="font-semibold text-sm text-gray-800 truncate">
                        {photo.original_filename}
                      </h4>

                      {photo.zone_name && (
                        <span className="inline-block bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded mt-1">
                          {photo.zone_name}
                          {photo.phase && ` · ${photo.phase}`}
                        </span>
                      )}

                      {photo.captured_at && (
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(photo.captured_at).toLocaleString('vi-VN')}
                        </p>
                      )}

                      {(photo.pin_count ?? 0) > 0 && (
                        <p className="text-xs text-red-600 mt-1 font-medium">
                          ⚠ {photo.pin_count} báo cáo sự cố
                        </p>
                      )}

                      <button
                        className="mt-2 w-full bg-blue-600 text-white text-sm py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                        onClick={() => { setSelectedPhoto(photo); setShowViewer(true); }}
                      >
                        Xem ảnh 360°
                      </button>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </LayerGroup>
          </LayersControl.Overlay>

          {/* Layer pins/báo cáo */}
          {showPins && (
            <LayersControl.Overlay checked name="Báo cáo sự cố">
              <LayerGroup>
                {geoPins.map(pin => (
                  <Marker
                    key={pin.id}
                    position={[pin.coordinates!.lat, pin.coordinates!.lng]}
                    icon={createPinIcon(pin.type, pin.status)}
                  >
                    <Popup>
                      <div className="p-1 min-w-[200px]">
                        <div className="flex items-start gap-2">
                          <span
                            className="w-3 h-3 rounded-full mt-0.5 flex-shrink-0"
                            style={{ background: PIN_TYPE_COLORS[pin.type] }}
                          />
                          <div>
                            <p className="font-semibold text-sm">{pin.title}</p>
                            <p className="text-xs text-gray-500 capitalize">{pin.type} · {pin.priority}</p>
                            <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${
                              pin.status === 'open' ? 'bg-red-100 text-red-700' :
                              pin.status === 'resolved' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {pin.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </LayerGroup>
            </LayersControl.Overlay>
          )}
        </LayersControl>

        {/* Vòng tròn bán kính tìm kiếm */}
        {radiusCenter && (
          <Circle
            center={radiusCenter}
            radius={radiusMeters}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.1,
              weight: 2,
              dashArray: '6, 4',
            }}
          />
        )}
      </MapContainer>

      {/* ---- Modal xem ảnh 360° ---- */}
      {showViewer && selectedPhoto && (
        <div className="absolute inset-0 z-[2000] bg-black/90 flex flex-col">
          <Photo360Viewer
            photo={selectedPhoto}
            onClose={() => setShowViewer(false)}
            onPinCreate={(pinData) => {
              console.log('Pin tạo từ ảnh:', { photoId: selectedPhoto.id, ...pinData });
              // TODO: gọi API tạo pin
            }}
          />
        </div>
      )}

      {/* Chú thích bản đồ */}
      <div className="absolute bottom-10 left-3 z-[999] bg-white/90 backdrop-blur rounded-xl shadow p-3 text-xs space-y-1.5">
        <p className="font-semibold text-gray-700 mb-2 flex items-center gap-1"><Layers size={12} /> Chú thích</p>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-700 rounded-full border-2 border-white" />
          <span className="text-gray-600">Ảnh 360°</span>
        </div>
        {Object.entries(PIN_TYPE_COLORS).slice(0, 3).map(([type, color]) => (
          <div key={type} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: color }} />
            <span className="text-gray-600 capitalize">{type}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SiteMap;
