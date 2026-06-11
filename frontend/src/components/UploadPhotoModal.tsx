import React, { useState, useRef } from 'react';
import { X, Upload, Link2, MapPin, Calendar, Tag, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { gasPost } from '../lib/gasApi';
import { useAuthStore } from '../store/authStore';

interface Props {
  maDA: string;
  tenDA: string;
  onClose: () => void;
  onSuccess: () => void;
}

const GIAI_DOAN = ['Nền móng', 'Thân', 'Hoàn thiện', 'Tổng thể', 'Khác'];
const TRANG_THAI = ['Hoạt động', 'Lưu trữ'];

export const UploadPhotoModal: React.FC<Props> = ({ maDA, tenDA, onClose, onSuccess }) => {
  const { session } = useAuthStore();
  const [url360, setUrl360]       = useState('');
  const [urlThumb, setUrlThumb]   = useState('');
  const [khuVuc, setKhuVuc]       = useState('');
  const [giaiDoan, setGiaiDoan]   = useState('');
  const [hangMuc, setHangMuc]     = useState('');
  const [viDo, setViDo]           = useState('');
  const [kinhDo, setKinhDo]       = useState('');
  const [ngayChup, setNgayChup]   = useState('');
  const [ghiChu, setGhiChu]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState(false);

  // Upload file qua Express backend (nếu có)
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) {
      setError('VITE_API_URL chưa cấu hình — Vui lòng dán URL trực tiếp hoặc dùng Google Drive');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('photo', file);
      const res = await fetch(`${apiUrl}/photos/upload`, { method: 'POST', body: form });
      const json = await res.json();
      if (json.data?.url) {
        setUrl360(json.data.url);
        if (json.data.thumbnail) setUrlThumb(json.data.thumbnail);
      } else throw new Error(json.message ?? 'Upload thất bại');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi upload');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url360) { setError('Vui lòng cung cấp URL ảnh 360°'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await gasPost('pano360', 'create', {
        data: {
          maDA,
          tenDA,
          url360:       url360.trim(),
          urlThumb:     urlThumb.trim() || url360.trim(),
          khuVuc:       khuVuc.trim(),
          giaiDoan:     giaiDoan.trim(),
          hangMuc:      hangMuc.trim(),
          viDo:         viDo ? Number(viDo) : '',
          kinhDo:       kinhDo ? Number(kinhDo) : '',
          ngayChup:     ngayChup,
          nguoiUpload:  session?.email ?? '',
          trangThai:    'Hoạt động',
          ghiChu:       ghiChu.trim(),
        },
      });
      if (res.status === 'success') {
        setSuccess(true);
        setTimeout(() => { onSuccess(); onClose(); }, 1200);
      } else {
        setError(res.message || 'Lưu thất bại');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Thêm ảnh 360° mới</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Project info */}
          <div className="bg-orange-50 rounded-xl px-3 py-2 text-sm">
            <span className="text-orange-600 font-medium">{maDA}</span>
            <span className="text-gray-500 mx-1.5">—</span>
            <span className="text-gray-700">{tenDA}</span>
          </div>

          {/* URL / Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              URL ảnh 360° <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  value={url360}
                  onChange={e => setUrl360(e.target.value)}
                  placeholder="https://drive.google.com/... hoặc URL ảnh"
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-2.5 border border-gray-300 rounded-xl text-sm hover:border-orange-400 hover:text-orange-600 transition whitespace-nowrap"
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Tải lên
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </div>
          </div>

          {/* Thumbnail URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">URL Thumbnail (tùy chọn)</label>
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="url"
                value={urlThumb}
                onChange={e => setUrlThumb(e.target.value)}
                placeholder="Để trống = dùng chung URL ảnh 360°"
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          {/* Row: Khu vực + Giai đoạn */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <Tag className="w-3.5 h-3.5 inline mr-1" />Khu vực
              </label>
              <input
                type="text"
                value={khuVuc}
                onChange={e => setKhuVuc(e.target.value)}
                placeholder="A1, Khu nhà ở..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Giai đoạn</label>
              <select
                value={giaiDoan}
                onChange={e => setGiaiDoan(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">— Chọn —</option>
                {GIAI_DOAN.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
          </div>

          {/* Hạng mục */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Hạng mục thi công</label>
            <input
              type="text"
              value={hangMuc}
              onChange={e => setHangMuc(e.target.value)}
              placeholder="Cột bê tông, Lắp ghép khung..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* GPS */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                <MapPin className="w-3.5 h-3.5 inline mr-1 text-orange-500" />Vĩ độ
              </label>
              <input
                type="number"
                step="0.000001"
                value={viDo}
                onChange={e => setViDo(e.target.value)}
                placeholder="16.054826"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Kinh độ</label>
              <input
                type="number"
                step="0.000001"
                value={kinhDo}
                onChange={e => setKinhDo(e.target.value)}
                placeholder="108.202167"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>
          </div>

          {/* Ngày chụp */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Calendar className="w-3.5 h-3.5 inline mr-1" />Ngày chụp
            </label>
            <input
              type="date"
              value={ngayChup}
              onChange={e => setNgayChup(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Ghi chú</label>
            <textarea
              value={ghiChu}
              onChange={e => setGhiChu(e.target.value)}
              rows={2}
              placeholder="Ghi chú thêm về ảnh..."
              className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <p className="text-sm text-green-700">Lưu thành công!</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || uploading || success}
            className="flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300
              text-white font-medium text-sm rounded-xl transition"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Đang lưu...</> : 'Lưu ảnh'}
          </button>
        </div>
      </div>
    </div>
  );
};
