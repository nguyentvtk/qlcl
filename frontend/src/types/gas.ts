// Types tương ứng với dữ liệu trong Google Spreadsheet (CPM 5.0 schema)

export interface GasProject {
  maDA: string;
  tenDA: string;
  moTa?: string;
  namThucHien?: string | number;
  phuTrachKT?: string;
  ngayBatDau?: string;
  ngayKetThuc?: string;
  trangThai?: string;
  tongMucDauTu?: number | string;
  loaiDA?: string;
  ghiChu?: string;
  // Cột mở rộng 360° (thêm vào cuối sheet "Dự án")
  viDo?: number | string;
  kinhDo?: number | string;
  kichHoat360?: string | boolean;
}

export interface GasPhoto {
  stt?: number;
  id: string;
  maDA: string;
  tenDA?: string;
  khuVuc?: string;
  giaiDoan?: string;
  hangMuc?: string;
  tenFile?: string;
  url360: string;
  urlThumb?: string;
  kichThuocKB?: number | string;
  doPhanGiai?: string;
  viDo?: number | string;
  kinhDo?: number | string;
  doCao?: number | string;
  huongCamera?: number | string;
  nguonGPS?: string;
  linkMaps?: string;
  ngayChup?: string;
  gioChup?: string;
  ngayUpload?: string;
  nguoiUpload?: string;
  pinsSuCo?: number | string;
  pinsTienDo?: number | string;
  trangThai?: string;
  ghiChu?: string;
}

export interface GasStats {
  tongAnh: number;
  anhHomNay?: number;
  pinsSuCo?: number;
  pinsTienDo?: number;
  khuVucList?: string[];
  giaiDoanList?: string[];
}

export interface GasMapPoint {
  id: string;
  tenFile?: string;
  urlThumb?: string;
  viDo: number;
  kinhDo: number;
  huongCamera?: number;
  ngayChup?: string;
  khuVuc?: string;
  giaiDoan?: string;
  pinsSuCo?: number;
  pinsTienDo?: number;
}

export interface GasTask {
  maNV: string;
  maDA: string;
  tenDA?: string;
  nhomNV?: string;
  moTa?: string;
  nguoiThucHien?: string;
  trangThai?: string;
  uuTien?: string;
  ngayBatDau?: string;
  hanChot?: string;
  tiDo?: number | string;
  ghiChu?: string;
}

export type VaiTro360 = 'Quản lý' | 'Giám sát' | 'Thành viên' | 'Xem';

export interface AuthSession {
  token: string;
  email: string;
  tenDN: string;
  vaiTro: VaiTro360;
  duAn360: string[];
  expiresAt: string;
}
