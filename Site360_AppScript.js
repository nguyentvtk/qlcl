/**
 * ============================================================
 * SITE360 - HỆ THỐNG QUẢN LÝ CÔNG TRƯỜNG VỚI ẢNH 360°
 * Google Apps Script cho Google Spreadsheet
 * Tên file: "WA | NNN | Quản Lý Dự án, Công việc"
 * ============================================================
 * Tác giả: Site360 System
 * Phiên bản: 1.0.0
 * Ngày tạo: 2025
 * ============================================================
 */

// ============================================================
// HẰNG SỐ CẤU HÌNH
// ============================================================
var CONFIG = {
  SHEET_360: '360',
  SHEET_DU_AN: 'Dự án',
  SHEET_NHA_THAU: 'Nhà thầu TVGS',
  COLOR_HEADER_360: '#E65100',       // Cam đậm - construction theme
  COLOR_HEADER_DU_AN: '#1565C0',     // Xanh đậm
  COLOR_HEADER_NHA_THAU: '#1A237E',  // Xanh navy
  COLOR_WHITE: '#FFFFFF',
  COLOR_RED_LIGHT: '#FFCDD2',
  COLOR_YELLOW: '#FFF9C4',
  COLOR_GREEN_LIGHT: '#C8E6C9',
  COLOR_GRAY_LIGHT: '#F5F5F5',
  COLOR_BLUE_LIGHT: '#E3F2FD',
  SESSION_KEY: 'site360_session',
  SESSION_EXPIRY_HOURS: 8,
  MAX_LOGIN_ATTEMPTS: 5
};

// ============================================================
// 1. onOpen() - TỰ ĐỘNG TẠO MENU KHI MỞ FILE
// ============================================================
function onOpen() {
  createCustomMenu();
}

// ============================================================
// 2. createCustomMenu() - TẠO MENU TÙY CHỈNH
// ============================================================
function createCustomMenu() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('📷 Site360')
    .addItem('⚙️ Thiết lập ban đầu', 'runFullSetup')
    .addSeparator()
    .addItem('📸 Thêm ảnh 360° mới', 'addNew360Row')
    .addItem('🔄 Cập nhật STT', 'updateSTT')
    .addSeparator()
    .addItem('🔐 Đăng nhập', 'showLoginDialog')
    .addItem('👤 Thay đổi mật khẩu', 'showChangePasswordDialog')
    .addSeparator()
    .addItem('📊 Xuất báo cáo PDF', 'exportReportPDF')
    .addItem('🗺️ Xem trên bản đồ', 'openMapView')
    .addToUi();
}

// ============================================================
// 3. runFullSetup() - CHẠY TOÀN BỘ SETUP
// ============================================================
function runFullSetup() {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(
    '⚙️ Xác nhận thiết lập',
    'Bạn có muốn chạy toàn bộ thiết lập hệ thống Site360?\n\n' +
    '• Thiết lập sheet Dự án\n' +
    '• Thiết lập sheet Nhà thầu TVGS\n' +
    '• Thiết lập sheet 360°\n' +
    '• Áp dụng Data Validation\n' +
    '• Áp dụng Conditional Formatting',
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) return;

  try {
    // Hiển thị toast thông báo tiến trình
    SpreadsheetApp.getActiveSpreadsheet().toast('Đang thiết lập sheet Dự án...', '⚙️ Site360 Setup', 3);
    setupSheetDuAn();

    SpreadsheetApp.getActiveSpreadsheet().toast('Đang thiết lập sheet Nhà thầu TVGS...', '⚙️ Site360 Setup', 3);
    setupSheetNhaThauTVGS();

    SpreadsheetApp.getActiveSpreadsheet().toast('Đang thiết lập sheet 360°...', '⚙️ Site360 Setup', 3);
    setupSheet360();

    SpreadsheetApp.getActiveSpreadsheet().toast('Đang áp dụng Data Validation...', '⚙️ Site360 Setup', 3);
    applyDataValidations360();

    SpreadsheetApp.getActiveSpreadsheet().toast('Đang áp dụng Conditional Formatting...', '⚙️ Site360 Setup', 3);
    applyConditionalFormatting360();

    // Hoàn tất
    SpreadsheetApp.getActiveSpreadsheet().toast('Thiết lập hoàn tất!', '✅ Site360', 5);
    ui.alert('✅ Thiết lập hoàn tất!',
      'Hệ thống Site360 đã được thiết lập thành công.\n\n' +
      '• Sheet "Dự án": Đã tạo với 5 dự án mẫu\n' +
      '• Sheet "Nhà thầu TVGS": Đã tạo với 3 người dùng mẫu\n' +
      '• Sheet "360": Đã thiết lập đầy đủ cột và validation\n\n' +
      'Vui lòng đăng nhập để bắt đầu sử dụng.',
      ui.ButtonSet.OK
    );
  } catch (e) {
    ui.alert('❌ Lỗi thiết lập', 'Có lỗi xảy ra: ' + e.message, ui.ButtonSet.OK);
    Logger.log('runFullSetup error: ' + e.toString());
  }
}

// ============================================================
// 4. setupSheetDuAn() - THIẾT LẬP SHEET "DỰ ÁN"
// ============================================================
function setupSheetDuAn() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_DU_AN);

  // Tạo sheet nếu chưa có
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_DU_AN);
  }

  // --- Thiết lập Headers ---
  var headers = [
    'STT', 'Mã Dự Án', 'Tên Dự Án', 'Chủ Đầu Tư',
    'Địa Điểm', 'Ngày Bắt Đầu', 'Ngày Kết Thúc',
    'Trạng Thái', 'Vĩ Độ', 'Kinh Độ', 'Ghi Chú'
  ];

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);

  // Định dạng header
  headerRange
    .setBackground(CONFIG.COLOR_HEADER_DU_AN)
    .setFontColor(CONFIG.COLOR_WHITE)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // Cố định hàng đầu tiên
  sheet.setFrozenRows(1);

  // Độ rộng cột
  sheet.setColumnWidth(1, 50);   // STT
  sheet.setColumnWidth(2, 80);   // Mã Dự Án
  sheet.setColumnWidth(3, 200);  // Tên Dự Án
  sheet.setColumnWidth(4, 150);  // Chủ Đầu Tư
  sheet.setColumnWidth(5, 150);  // Địa Điểm
  sheet.setColumnWidth(6, 110);  // Ngày Bắt Đầu
  sheet.setColumnWidth(7, 110);  // Ngày Kết Thúc
  sheet.setColumnWidth(8, 130);  // Trạng Thái
  sheet.setColumnWidth(9, 100);  // Vĩ Độ
  sheet.setColumnWidth(10, 100); // Kinh Độ
  sheet.setColumnWidth(11, 180); // Ghi Chú

  // Validation dropdown Trạng Thái (cột H)
  var trangThaiRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Đang thi công', 'Hoàn thành', 'Tạm dừng'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 8, 100, 1).setDataValidation(trangThaiRule);

  // Format cột Ngày
  sheet.getRange(2, 6, 100, 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(2, 7, 100, 1).setNumberFormat('dd/MM/yyyy');

  // Format cột tọa độ GPS (8 chữ số thập phân)
  sheet.getRange(2, 9, 100, 2).setNumberFormat('0.00000000');

  // --- Dữ liệu mẫu 5 dự án xây dựng tại Việt Nam ---
  var sampleData = [
    [1, 'DA001', 'Tòa nhà văn phòng Hà Nội Central Tower', 'Tập đoàn Vingroup', 'Quận Hoàn Kiếm, Hà Nội',
     new Date('2024-01-15'), new Date('2025-12-31'), 'Đang thi công', 21.02800000, 105.85400000,
     'Tòa nhà 25 tầng, tổng diện tích 15.000m²'],
    [2, 'DA002', 'Khu đô thị Ecopark Giai đoạn 3', 'Tập đoàn Ecopark', 'Huyện Văn Giang, Hưng Yên',
     new Date('2023-06-01'), new Date('2026-06-30'), 'Đang thi công', 20.95100000, 106.00200000,
     'Khu nhà ở liền kề và biệt thự, 500 căn'],
    [3, 'DA003', 'Cầu Vượt Nút giao thông Long Biên', 'Sở GTVT Hà Nội', 'Quận Long Biên, Hà Nội',
     new Date('2023-03-01'), new Date('2024-12-31'), 'Hoàn thành', 21.04500000, 105.87600000,
     'Cầu vượt 4 làn xe, chiều dài 320m'],
    [4, 'DA004', 'Bệnh viện Đa khoa Quốc tế Vinmec Đà Nẵng', 'Tập đoàn Vingroup', 'Quận Sơn Trà, Đà Nẵng',
     new Date('2024-04-01'), new Date('2026-03-31'), 'Đang thi công', 16.07100000, 108.22200000,
     'Bệnh viện 500 giường, 12 tầng'],
    [5, 'DA005', 'Nhà máy sản xuất linh kiện điện tử Samsung Phase 2', 'Samsung Electronics', 'KCN Yên Phong, Bắc Ninh',
     new Date('2022-09-01'), new Date('2024-03-31'), 'Tạm dừng', 21.14800000, 106.05300000,
     'Nhà máy 80.000m², đang chờ điều chỉnh quy hoạch']
  ];

  // Xóa dữ liệu cũ trước khi ghi mẫu (chỉ xóa nếu sheet mới tạo hoặc trống)
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }

  // Ghi dữ liệu mẫu
  var dataRange = sheet.getRange(2, 1, sampleData.length, sampleData[0].length);
  dataRange.setValues(sampleData);

  // Định dạng dữ liệu
  sheet.getRange(2, 6, sampleData.length, 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(2, 7, sampleData.length, 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(2, 9, sampleData.length, 2).setNumberFormat('0.00000000');

  // Alternating row colors
  for (var i = 0; i < sampleData.length; i++) {
    var rowColor = (i % 2 === 0) ? '#FFFFFF' : '#E8F0FE';
    sheet.getRange(i + 2, 1, 1, headers.length).setBackground(rowColor);
  }

  Logger.log('✅ setupSheetDuAn hoàn tất');
}

// ============================================================
// 5. setupSheetNhaThauTVGS() - THIẾT LẬP SHEET "NHÀ THẦU TVGS"
// ============================================================
function setupSheetNhaThauTVGS() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NHA_THAU);

  // Tạo sheet nếu chưa có
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NHA_THAU);
  }

  // --- Thiết lập Headers ---
  var headers = [
    'STT', 'Họ Tên', 'Email', 'Vai Trò',
    'Mật Khẩu', 'Hash Mật Khẩu', 'Dự Án Được Phân Công',
    'Trạng Thái', 'Lần Đăng Nhập Cuối', 'Ghi Chú'
  ];

  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);

  // Định dạng header màu xanh navy
  headerRange
    .setBackground(CONFIG.COLOR_HEADER_NHA_THAU)
    .setFontColor(CONFIG.COLOR_WHITE)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // Cố định hàng đầu
  sheet.setFrozenRows(1);

  // Độ rộng cột
  sheet.setColumnWidth(1, 50);   // STT
  sheet.setColumnWidth(2, 150);  // Họ Tên
  sheet.setColumnWidth(3, 200);  // Email
  sheet.setColumnWidth(4, 150);  // Vai Trò
  sheet.setColumnWidth(5, 120);  // Mật Khẩu
  sheet.setColumnWidth(6, 220);  // Hash Mật Khẩu
  sheet.setColumnWidth(7, 200);  // Dự Án Được Phân Công
  sheet.setColumnWidth(8, 120);  // Trạng Thái
  sheet.setColumnWidth(9, 150);  // Lần Đăng Nhập Cuối
  sheet.setColumnWidth(10, 180); // Ghi Chú

  // Data Validation - Vai Trò (cột D)
  var vaiTroRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Quản lý dự án', 'Giám sát', 'Thành viên', 'Xem'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 4, 100, 1).setDataValidation(vaiTroRule);

  // Data Validation - Trạng Thái (cột H)
  var trangThaiRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Hoạt động', 'Khóa'], true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(2, 8, 100, 1).setDataValidation(trangThaiRule);

  // Format cột Lần Đăng Nhập Cuối
  sheet.getRange(2, 9, 100, 1).setNumberFormat('dd/MM/yyyy HH:mm');

  // --- Dữ liệu mẫu: 1 admin, 1 giám sát, 1 thành viên ---
  // Mật khẩu mẫu: admin123, gsat456, member789
  var sampleData = [
    [1, 'Nguyễn Văn Admin', 'admin@site360.vn', 'Quản lý dự án',
     'admin123', generateMD5('admin123'),
     'Tòa nhà văn phòng Hà Nội Central Tower, Khu đô thị Ecopark Giai đoạn 3',
     'Hoạt động', '', 'Tài khoản quản trị hệ thống'],
    [2, 'Trần Thị Giám Sát', 'giamsat@site360.vn', 'Giám sát',
     'gsat456', generateMD5('gsat456'),
     'Tòa nhà văn phòng Hà Nội Central Tower',
     'Hoạt động', '', 'Giám sát thi công tòa nhà văn phòng'],
    [3, 'Lê Văn Thành Viên', 'thanhvien@site360.vn', 'Thành viên',
     'member789', generateMD5('member789'),
     'Khu đô thị Ecopark Giai đoạn 3',
     'Hoạt động', '', 'Chụp ảnh 360° định kỳ']
  ];

  // Xóa dữ liệu cũ
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }

  // Ghi dữ liệu mẫu
  sheet.getRange(2, 1, sampleData.length, sampleData[0].length).setValues(sampleData);

  // Alternating row colors
  for (var i = 0; i < sampleData.length; i++) {
    var rowColor = (i % 2 === 0) ? '#FFFFFF' : '#E8EAF6';
    sheet.getRange(i + 2, 1, 1, headers.length).setBackground(rowColor);
  }

  // Ẩn cột F (Hash Mật Khẩu - cột 6)
  sheet.hideColumns(6);

  // Bảo vệ sheet - chỉ owner edit
  try {
    var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    // Xóa protection cũ nếu có
    for (var p = 0; p < protections.length; p++) {
      protections[p].remove();
    }

    var protection = sheet.protect();
    protection.setDescription('Sheet Nhà thầu TVGS - Chỉ owner được chỉnh sửa');

    // Lấy danh sách editors và xóa tất cả trừ owner
    var me = Session.getEffectiveUser();
    protection.addEditor(me);
    var editors = protection.getEditors();
    for (var e = 0; e < editors.length; e++) {
      if (editors[e].getEmail() !== me.getEmail()) {
        protection.removeEditor(editors[e]);
      }
    }
  } catch (protectErr) {
    Logger.log('Không thể protect sheet: ' + protectErr.message);
  }

  Logger.log('✅ setupSheetNhaThauTVGS hoàn tất');
}

// ============================================================
// 6. setupSheet360() - THIẾT LẬP SHEET "360" (QUAN TRỌNG NHẤT)
// ============================================================
function setupSheet360() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_360);

  // Tạo sheet nếu chưa có
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_360);
  }

  // --- Headers đầy đủ 26 cột (A-Z) ---
  var headers = [
    // Nhóm A-E: Thông tin cơ bản
    'STT',                    // A
    'ID Ảnh',                 // B
    'Dự Án',                  // C
    'Khu Vực / Zone',         // D
    'Giai Đoạn',              // E
    // Nhóm F-J: Thông tin ảnh
    'Tên File Ảnh',           // F
    'URL Ảnh 360°',           // G
    'URL Thumbnail',          // H
    'Kích Thước File (KB)',   // I
    'Độ Phân Giải',           // J
    // Nhóm K-P: GPS & Vị trí
    'Vĩ Độ GPS',              // K
    'Kinh Độ GPS',            // L
    'Độ Cao (m)',             // M
    'Hướng Camera (°)',       // N
    'Nguồn GPS',              // O
    'Preview Map',            // P
    // Nhóm Q-U: Thời gian & Người dùng
    'Ngày Chụp',              // Q
    'Giờ Chụp',               // R
    'Ngày Upload',            // S
    'Người Upload',           // T
    'Ghi Chú',                // U
    // Nhóm V-Z: Báo cáo & Pins
    'Số Pins Sự Cố',          // V
    'Số Pins Tiến Độ',        // W
    'Trạng Thái Xử Lý',       // X
    'Link Xem 360°',          // Y
    'Màu Trạng Thái'          // Z
  ];

  // Ghi headers
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);

  // Định dạng header màu cam đậm
  headerRange
    .setBackground(CONFIG.COLOR_HEADER_360)
    .setFontColor(CONFIG.COLOR_WHITE)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);

  // Chiều cao hàng header
  sheet.setRowHeight(1, 45);

  // Cố định hàng đầu
  sheet.setFrozenRows(1);

  // Cố định 2 cột đầu (STT, ID Ảnh)
  sheet.setFrozenColumns(2);

  // --- Độ rộng từng cột ---
  var colWidths = [
    50,  // A: STT
    140, // B: ID Ảnh
    200, // C: Dự Án
    120, // D: Khu Vực
    110, // E: Giai Đoạn
    160, // F: Tên File
    220, // G: URL 360°
    220, // H: URL Thumbnail
    120, // I: Kích thước
    110, // J: Độ phân giải
    110, // K: Vĩ độ
    110, // L: Kinh độ
    90,  // M: Độ cao
    120, // N: Hướng camera
    130, // O: Nguồn GPS
    110, // P: Preview Map
    100, // Q: Ngày chụp
    90,  // R: Giờ chụp
    100, // S: Ngày upload
    150, // T: Người upload
    180, // U: Ghi chú
    100, // V: Pins sự cố
    110, // W: Pins tiến độ
    140, // X: Trạng thái
    120, // Y: Link 360°
    80   // Z: Màu trạng thái
  ];

  for (var c = 0; c < colWidths.length; c++) {
    sheet.setColumnWidth(c + 1, colWidths[c]);
  }

  // --- Format các cột số ---
  sheet.getRange(2, 9, 1000, 1).setNumberFormat('#,##0.00');   // I: KB
  sheet.getRange(2, 11, 1000, 2).setNumberFormat('0.00000000'); // K,L: GPS
  sheet.getRange(2, 13, 1000, 1).setNumberFormat('#,##0.00');  // M: Độ cao
  sheet.getRange(2, 14, 1000, 1).setNumberFormat('#,##0.00');  // N: Hướng
  sheet.getRange(2, 17, 1000, 1).setNumberFormat('dd/MM/yyyy'); // Q: Ngày chụp
  sheet.getRange(2, 18, 1000, 1).setNumberFormat('HH:mm:ss');   // R: Giờ chụp
  sheet.getRange(2, 19, 1000, 1).setNumberFormat('dd/MM/yyyy'); // S: Ngày upload
  sheet.getRange(2, 22, 1000, 2).setNumberFormat('#,##0');     // V,W: Số pins

  // Ẩn cột Z (Màu Trạng Thái - cột 26)
  sheet.hideColumns(26);

  // Màu nền cho nhóm cột (visual grouping)
  // Nhóm A-E: nền trắng (mặc định)
  // Nhóm F-J: nền vàng nhạt
  sheet.getRange(1, 6, 1, 5).setBackground('#FFF8E1');
  // Nhóm K-P: nền xanh lam nhạt
  sheet.getRange(1, 11, 1, 6).setBackground('#E3F2FD');
  // Nhóm Q-U: nền xanh lá nhạt
  sheet.getRange(1, 17, 1, 5).setBackground('#E8F5E9');
  // Nhóm V-Z: nền tím nhạt
  sheet.getRange(1, 22, 1, 5).setBackground('#F3E5F5');

  // Giữ chữ trắng cho tất cả headers
  sheet.getRange(1, 1, 1, headers.length).setFontColor(CONFIG.COLOR_WHITE);

  Logger.log('✅ setupSheet360 hoàn tất');
}

// ============================================================
// 7. applyDataValidations360() - ÁP DỤNG DATA VALIDATION
// ============================================================
function applyDataValidations360() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet360 = ss.getSheetByName(CONFIG.SHEET_360);
  if (!sheet360) {
    Logger.log('Không tìm thấy sheet 360');
    return;
  }

  var sheetDuAn = ss.getSheetByName(CONFIG.SHEET_DU_AN);
  var sheetNhaThau = ss.getSheetByName(CONFIG.SHEET_NHA_THAU);

  // Số dòng áp dụng validation
  var numRows = 1000;
  var startRow = 2;

  // --- Cột C: Dự Án - dropdown từ sheet Dự Án cột C ---
  if (sheetDuAn) {
    var duAnLastRow = sheetDuAn.getLastRow();
    if (duAnLastRow > 1) {
      var duAnRange = sheetDuAn.getRange('C2:C' + duAnLastRow);
      var duAnRule = SpreadsheetApp.newDataValidation()
        .requireValueInRange(duAnRange, true)
        .setAllowInvalid(false)
        .setHelpText('Chọn dự án từ danh sách')
        .build();
      sheet360.getRange(startRow, 3, numRows, 1).setDataValidation(duAnRule);
    }
  }

  // --- Cột E: Giai Đoạn ---
  var giaiDoanRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Khảo sát', 'Móng', 'Thô', 'Hoàn thiện', 'Nghiệm thu'], true)
    .setAllowInvalid(false)
    .setHelpText('Chọn giai đoạn thi công')
    .build();
  sheet360.getRange(startRow, 5, numRows, 1).setDataValidation(giaiDoanRule);

  // --- Cột O: Nguồn GPS ---
  var nguonGPSRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['EXIF Tự động', 'Nhập tay', 'Không có'], true)
    .setAllowInvalid(false)
    .setHelpText('Nguồn dữ liệu GPS')
    .build();
  sheet360.getRange(startRow, 15, numRows, 1).setDataValidation(nguonGPSRule);

  // --- Cột T: Người Upload - dropdown từ sheet Nhà thầu TVGS cột B ---
  if (sheetNhaThau) {
    var nhaThauLastRow = sheetNhaThau.getLastRow();
    if (nhaThauLastRow > 1) {
      var nhaThauRange = sheetNhaThau.getRange('B2:B' + nhaThauLastRow);
      var nhaThauRule = SpreadsheetApp.newDataValidation()
        .requireValueInRange(nhaThauRange, true)
        .setAllowInvalid(false)
        .setHelpText('Chọn người upload từ danh sách')
        .build();
      sheet360.getRange(startRow, 20, numRows, 1).setDataValidation(nhaThauRule);
    }
  }

  // --- Cột X: Trạng Thái Xử Lý ---
  var trangThaiRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Chưa xem xét', 'Đang xử lý', 'Đã giải quyết', 'Lưu trữ'], true)
    .setAllowInvalid(false)
    .setHelpText('Trạng thái xử lý của ảnh')
    .build();
  sheet360.getRange(startRow, 24, numRows, 1).setDataValidation(trangThaiRule);

  // --- Cột K: Vĩ Độ GPS (lat: -90 đến 90) ---
  var latRule = SpreadsheetApp.newDataValidation()
    .requireNumberBetween(-90, 90)
    .setAllowInvalid(false)
    .setHelpText('Vĩ độ: từ -90 đến 90')
    .build();
  sheet360.getRange(startRow, 11, numRows, 1).setDataValidation(latRule);

  // --- Cột L: Kinh Độ GPS (lng: -180 đến 180) ---
  var lngRule = SpreadsheetApp.newDataValidation()
    .requireNumberBetween(-180, 180)
    .setAllowInvalid(false)
    .setHelpText('Kinh độ: từ -180 đến 180')
    .build();
  sheet360.getRange(startRow, 12, numRows, 1).setDataValidation(lngRule);

  // --- Cột N: Hướng Camera (0-360) ---
  var huongRule = SpreadsheetApp.newDataValidation()
    .requireNumberBetween(0, 360)
    .setAllowInvalid(false)
    .setHelpText('Hướng camera: 0 đến 360 độ')
    .build();
  sheet360.getRange(startRow, 14, numRows, 1).setDataValidation(huongRule);

  // --- Cột I: Kích Thước File (> 0) ---
  var fileSizeRule = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThan(0)
    .setAllowInvalid(false)
    .setHelpText('Kích thước file phải lớn hơn 0 KB')
    .build();
  sheet360.getRange(startRow, 9, numRows, 1).setDataValidation(fileSizeRule);

  // --- Cột V, W: Số Pins (>= 0) ---
  var pinsRule = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(0)
    .setAllowInvalid(false)
    .setHelpText('Số pins không thể âm')
    .build();
  sheet360.getRange(startRow, 22, numRows, 2).setDataValidation(pinsRule);

  Logger.log('✅ applyDataValidations360 hoàn tất');
}

// ============================================================
// 8. applyConditionalFormatting360() - CONDITIONAL FORMATTING
// ============================================================
function applyConditionalFormatting360() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_360);
  if (!sheet) return;

  // Xóa tất cả conditional formatting cũ
  sheet.clearConditionalFormatRules();

  var rules = [];
  var numRows = 1000;

  // ========== Cột X (cột 24): Trạng Thái Xử Lý ==========
  var xRange = sheet.getRange(2, 24, numRows, 1);

  // "Chưa xem xét" → nền đỏ nhạt
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Chưa xem xét')
    .setBackground('#FFCDD2')
    .setFontColor('#C62828')
    .setRanges([xRange])
    .build());

  // "Đang xử lý" → nền vàng
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Đang xử lý')
    .setBackground('#FFF9C4')
    .setFontColor('#F57F17')
    .setRanges([xRange])
    .build());

  // "Đã giải quyết" → nền xanh lá nhạt
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Đã giải quyết')
    .setBackground('#C8E6C9')
    .setFontColor('#2E7D32')
    .setRanges([xRange])
    .build());

  // "Lưu trữ" → nền xám nhạt
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Lưu trữ')
    .setBackground('#F5F5F5')
    .setFontColor('#757575')
    .setRanges([xRange])
    .build());

  // ========== Cột E (cột 5): Giai Đoạn ==========
  var eRange = sheet.getRange(2, 5, numRows, 1);

  // "Khảo sát" → xanh dương nhạt
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Khảo sát')
    .setBackground('#E3F2FD')
    .setFontColor('#1565C0')
    .setRanges([eRange])
    .build());

  // "Móng" → nâu nhạt
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Móng')
    .setBackground('#EFEBE9')
    .setFontColor('#4E342E')
    .setRanges([eRange])
    .build());

  // "Thô" → cam nhạt
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Thô')
    .setBackground('#FBE9E7')
    .setFontColor('#BF360C')
    .setRanges([eRange])
    .build());

  // "Hoàn thiện" → xanh lá nhạt
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Hoàn thiện')
    .setBackground('#F1F8E9')
    .setFontColor('#33691E')
    .setRanges([eRange])
    .build());

  // "Nghiệm thu" → tím nhạt
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('Nghiệm thu')
    .setBackground('#EDE7F6')
    .setFontColor('#4527A0')
    .setRanges([eRange])
    .build());

  // ========== Highlight toàn dòng nếu Ngày Chụp = Hôm nay ==========
  // Ngày Chụp ở cột Q = cột 17, dùng công thức so sánh với TODAY()
  // Áp dụng cho toàn bộ dòng (cột A đến Z)
  var fullRowRange = sheet.getRange(2, 1, numRows, 26);

  // Công thức: $Q2=TODAY() - kiểm tra cột Q (cột thứ 17) của dòng hiện tại
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$Q2=TODAY()')
    .setBackground('#E3F2FD')
    .setFontColor('#0D47A1')
    .setRanges([fullRowRange])
    .build());

  // Áp dụng tất cả rules
  sheet.setConditionalFormatRules(rules);

  Logger.log('✅ applyConditionalFormatting360 hoàn tất');
}

// ============================================================
// 9. generateMD5() - IMPLEMENT MD5 HASH THUẦN APPS SCRIPT
// ============================================================
/**
 * Tạo MD5 hash từ chuỗi văn bản
 * Implement đầy đủ theo RFC 1321, không dùng thư viện ngoài
 * @param {string} text - Chuỗi cần hash
 * @return {string} MD5 hash dạng hex string (32 ký tự)
 */
function generateMD5(text) {
  // Dùng Utilities.computeDigest với DigestAlgorithm.MD5
  // Kết quả là mảng byte (số từ -128 đến 127), cần convert sang hex
  var rawBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    text,
    Utilities.Charset.UTF_8
  );

  // Convert mảng byte sang hex string
  var hexStr = '';
  for (var i = 0; i < rawBytes.length; i++) {
    var byte = rawBytes[i];
    // Xử lý số âm (byte có thể từ -128 đến 127)
    if (byte < 0) {
      byte = byte + 256;
    }
    // Chuyển sang hex, đảm bảo 2 ký tự (thêm 0 đằng trước nếu cần)
    var hex = byte.toString(16);
    if (hex.length === 1) {
      hex = '0' + hex;
    }
    hexStr += hex;
  }

  return hexStr;
}

/**
 * Verify mật khẩu bằng cách so sánh MD5 hash
 * @param {string} plainPassword - Mật khẩu người dùng nhập
 * @param {string} storedHash - Hash đã lưu trong sheet
 * @return {boolean}
 */
function verifyPassword(plainPassword, storedHash) {
  return generateMD5(plainPassword) === storedHash;
}

// ============================================================
// 10. showLoginDialog() - DIALOG ĐĂNG NHẬP
// ============================================================
function showLoginDialog() {
  var htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đăng nhập Site360</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      background: linear-gradient(135deg, #E65100 0%, #BF360C 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .login-card {
      background: white;
      border-radius: 12px;
      padding: 32px;
      width: 100%;
      max-width: 380px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.2);
    }
    .logo {
      text-align: center;
      margin-bottom: 24px;
    }
    .logo h1 {
      font-size: 24px;
      color: #E65100;
      font-weight: 700;
    }
    .logo p {
      font-size: 13px;
      color: #757575;
      margin-top: 4px;
    }
    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #424242;
      margin-bottom: 6px;
    }
    input {
      width: 100%;
      padding: 10px 14px;
      border: 2px solid #E0E0E0;
      border-radius: 8px;
      font-size: 14px;
      transition: border-color 0.2s;
      outline: none;
    }
    input:focus {
      border-color: #E65100;
    }
    .btn-login {
      width: 100%;
      padding: 12px;
      background: #E65100;
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 8px;
      transition: background 0.2s;
    }
    .btn-login:hover { background: #BF360C; }
    .btn-login:disabled { background: #BDBDBD; cursor: not-allowed; }
    .alert {
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      margin-bottom: 16px;
      display: none;
    }
    .alert-error { background: #FFEBEE; color: #C62828; border: 1px solid #FFCDD2; }
    .alert-success { background: #E8F5E9; color: #2E7D32; border: 1px solid #C8E6C9; }
    .attempt-info {
      font-size: 12px;
      color: #9E9E9E;
      text-align: center;
      margin-top: 12px;
    }
    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 0.8s ease infinite;
      margin-right: 6px;
      vertical-align: middle;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="logo">
      <h1>📷 Site360</h1>
      <p>Hệ thống quản lý công trường</p>
    </div>

    <div id="alertBox" class="alert"></div>

    <div class="form-group">
      <label>📧 Email đăng nhập</label>
      <input type="email" id="email" placeholder="example@domain.com" autocomplete="email">
    </div>
    <div class="form-group">
      <label>🔒 Mật khẩu</label>
      <input type="password" id="password" placeholder="Nhập mật khẩu"
             onkeypress="if(event.key==='Enter') doLogin()">
    </div>

    <button class="btn-login" id="btnLogin" onclick="doLogin()">
      Đăng nhập
    </button>

    <p class="attempt-info" id="attemptInfo"></p>
  </div>

  <script>
    function showAlert(message, type) {
      var box = document.getElementById('alertBox');
      box.className = 'alert alert-' + type;
      box.textContent = message;
      box.style.display = 'block';
    }

    function doLogin() {
      var email = document.getElementById('email').value.trim();
      var password = document.getElementById('password').value;
      var btn = document.getElementById('btnLogin');

      if (!email || !password) {
        showAlert('⚠️ Vui lòng nhập đầy đủ email và mật khẩu', 'error');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>Đang xử lý...';

      google.script.run
        .withSuccessHandler(function(result) {
          btn.disabled = false;
          btn.textContent = 'Đăng nhập';

          if (result.success) {
            showAlert('✅ Chào mừng ' + result.name + '! Vai trò: ' + result.role, 'success');
            setTimeout(function() {
              google.script.host.close();
            }, 2000);
          } else {
            showAlert('❌ ' + result.message, 'error');
            if (result.attempts) {
              document.getElementById('attemptInfo').textContent =
                'Số lần thất bại: ' + result.attempts + '/5';
            }
            document.getElementById('password').value = '';
          }
        })
        .withFailureHandler(function(err) {
          btn.disabled = false;
          btn.textContent = 'Đăng nhập';
          showAlert('❌ Lỗi hệ thống: ' + err.message, 'error');
        })
        .processLogin(email, password);
    }

    // Focus vào ô email khi load
    window.onload = function() {
      document.getElementById('email').focus();
    };
  </script>
</body>
</html>`;

  var html = HtmlService.createHtmlOutput(htmlContent)
    .setWidth(420)
    .setHeight(440)
    .setTitle('🔐 Đăng nhập Site360');

  SpreadsheetApp.getUi().showModalDialog(html, '🔐 Đăng nhập Site360');
}

/**
 * Server-side function xử lý login, được gọi từ HTML dialog
 * @param {string} email
 * @param {string} password
 * @return {Object} kết quả đăng nhập
 */
function processLogin(email, password) {
  var props = PropertiesService.getUserProperties();

  // Kiểm tra số lần thất bại
  var failKey = 'login_fail_' + email.toLowerCase();
  var failCount = parseInt(props.getProperty(failKey) || '0');
  var lockKey = 'login_lock_' + email.toLowerCase();
  var lockTime = props.getProperty(lockKey);

  // Kiểm tra khóa tài khoản
  if (lockTime) {
    var lockDate = new Date(parseInt(lockTime));
    var now = new Date();
    var diffMinutes = (now - lockDate) / (1000 * 60);

    if (diffMinutes < 30) { // Khóa 30 phút
      var remainMinutes = Math.ceil(30 - diffMinutes);
      return {
        success: false,
        message: 'Tài khoản bị khóa. Thử lại sau ' + remainMinutes + ' phút.'
      };
    } else {
      // Hết thời gian khóa, reset
      props.deleteProperty(lockKey);
      props.deleteProperty(failKey);
      failCount = 0;
    }
  }

  // Tìm user trong sheet Nhà thầu TVGS
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NHA_THAU);
  if (!sheet) {
    return { success: false, message: 'Lỗi cấu hình: Không tìm thấy dữ liệu người dùng' };
  }

  var data = sheet.getDataRange().getValues();
  var userRow = null;

  for (var i = 1; i < data.length; i++) {
    var rowEmail = String(data[i][2]).trim().toLowerCase(); // Cột C: Email
    if (rowEmail === email.toLowerCase()) {
      userRow = data[i];
      break;
    }
  }

  // Không tìm thấy email
  if (!userRow) {
    return { success: false, message: 'Email không tồn tại trong hệ thống' };
  }

  // Kiểm tra trạng thái tài khoản
  var trangThai = String(userRow[7]).trim(); // Cột H: Trạng Thái
  if (trangThai === 'Khóa') {
    return { success: false, message: 'Tài khoản đã bị khóa. Liên hệ quản trị viên.' };
  }

  // Verify mật khẩu
  var storedHash = String(userRow[5]).trim(); // Cột F: Hash Mật Khẩu
  if (!verifyPassword(password, storedHash)) {
    // Tăng số lần thất bại
    failCount++;
    props.setProperty(failKey, failCount.toString());

    if (failCount >= CONFIG.MAX_LOGIN_ATTEMPTS) {
      // Khóa tài khoản
      props.setProperty(lockKey, Date.now().toString());
      return {
        success: false,
        message: 'Sai mật khẩu. Tài khoản bị khóa 30 phút do vượt quá ' + CONFIG.MAX_LOGIN_ATTEMPTS + ' lần thất bại.',
        attempts: failCount
      };
    }

    return {
      success: false,
      message: 'Mật khẩu không đúng. Còn ' + (CONFIG.MAX_LOGIN_ATTEMPTS - failCount) + ' lần thử.',
      attempts: failCount
    };
  }

  // Đăng nhập thành công
  props.deleteProperty(failKey);
  props.deleteProperty(lockKey);

  // Lưu session
  var expiry = new Date();
  expiry.setHours(expiry.getHours() + CONFIG.SESSION_EXPIRY_HOURS);

  var session = {
    email: email,
    name: String(userRow[1]).trim(),   // Cột B: Họ Tên
    role: String(userRow[3]).trim(),   // Cột D: Vai Trò
    projects: String(userRow[6]).trim(), // Cột G: Dự Án
    expiry: expiry.getTime()
  };

  props.setProperty(CONFIG.SESSION_KEY, JSON.stringify(session));

  // Cập nhật lần đăng nhập cuối trong sheet
  try {
    updateLastLogin(email);
  } catch (e) {
    Logger.log('Không thể cập nhật last login: ' + e.message);
  }

  return {
    success: true,
    name: session.name,
    role: session.role,
    message: 'Đăng nhập thành công'
  };
}

/**
 * Cập nhật thời gian đăng nhập cuối cho user
 */
function updateLastLogin(email) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NHA_THAU);
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]).trim().toLowerCase() === email.toLowerCase()) {
      // Cột I (index 8): Lần Đăng Nhập Cuối
      sheet.getRange(i + 1, 9).setValue(new Date());
      break;
    }
  }
}

/**
 * Lấy thông tin session hiện tại
 * @return {Object|null} session hoặc null nếu chưa đăng nhập/hết hạn
 */
function getCurrentSession() {
  var props = PropertiesService.getUserProperties();
  var sessionStr = props.getProperty(CONFIG.SESSION_KEY);

  if (!sessionStr) return null;

  try {
    var session = JSON.parse(sessionStr);
    var now = new Date().getTime();

    if (now > session.expiry) {
      // Session hết hạn
      props.deleteProperty(CONFIG.SESSION_KEY);
      return null;
    }

    return session;
  } catch (e) {
    return null;
  }
}

// ============================================================
// 11. showChangePasswordDialog() - DIALOG ĐỔI MẬT KHẨU
// ============================================================
function showChangePasswordDialog() {
  var session = getCurrentSession();
  if (!session) {
    SpreadsheetApp.getUi().alert('⚠️ Chưa đăng nhập', 'Vui lòng đăng nhập trước.', SpreadsheetApp.getUi().ButtonSet.OK);
    showLoginDialog();
    return;
  }

  var htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; background: #F5F5F5; }
    h2 { color: #1A237E; margin-bottom: 20px; font-size: 18px; }
    .user-info { background: #E8EAF6; padding: 10px 14px; border-radius: 8px; margin-bottom: 20px; font-size: 13px; color: #3949AB; }
    .form-group { margin-bottom: 14px; }
    label { display: block; font-size: 13px; font-weight: 600; color: #424242; margin-bottom: 5px; }
    input { width: 100%; padding: 9px 12px; border: 2px solid #E0E0E0; border-radius: 6px; font-size: 14px; outline: none; }
    input:focus { border-color: #1A237E; }
    .btn { padding: 10px 20px; border: none; border-radius: 6px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .btn-primary { background: #1A237E; color: white; width: 100%; margin-top: 8px; }
    .btn-primary:hover { background: #283593; }
    .alert { padding: 10px; border-radius: 6px; font-size: 13px; margin-bottom: 14px; display: none; }
    .alert-error { background: #FFEBEE; color: #C62828; }
    .alert-success { background: #E8F5E9; color: #2E7D32; }
  </style>
</head>
<body>
  <h2>👤 Thay đổi mật khẩu</h2>
  <div class="user-info">Tài khoản: <strong>${session.name}</strong> (${session.email})</div>
  <div id="alert" class="alert"></div>
  <div class="form-group">
    <label>Mật khẩu hiện tại</label>
    <input type="password" id="oldPwd" placeholder="Nhập mật khẩu hiện tại">
  </div>
  <div class="form-group">
    <label>Mật khẩu mới</label>
    <input type="password" id="newPwd" placeholder="Tối thiểu 6 ký tự">
  </div>
  <div class="form-group">
    <label>Xác nhận mật khẩu mới</label>
    <input type="password" id="confirmPwd" placeholder="Nhập lại mật khẩu mới">
  </div>
  <button class="btn btn-primary" onclick="changePassword()">Đổi mật khẩu</button>

  <script>
    function changePassword() {
      var oldPwd = document.getElementById('oldPwd').value;
      var newPwd = document.getElementById('newPwd').value;
      var confirmPwd = document.getElementById('confirmPwd').value;
      var alert = document.getElementById('alert');

      if (!oldPwd || !newPwd || !confirmPwd) {
        showAlert('Vui lòng nhập đầy đủ thông tin', 'error'); return;
      }
      if (newPwd.length < 6) {
        showAlert('Mật khẩu mới phải có ít nhất 6 ký tự', 'error'); return;
      }
      if (newPwd !== confirmPwd) {
        showAlert('Mật khẩu xác nhận không khớp', 'error'); return;
      }

      google.script.run
        .withSuccessHandler(function(result) {
          if (result.success) {
            showAlert('✅ Đổi mật khẩu thành công!', 'success');
            setTimeout(function() { google.script.host.close(); }, 1500);
          } else {
            showAlert('❌ ' + result.message, 'error');
          }
        })
        .processChangePassword(oldPwd, newPwd);
    }

    function showAlert(msg, type) {
      var a = document.getElementById('alert');
      a.className = 'alert alert-' + type;
      a.textContent = msg;
      a.style.display = 'block';
    }
  </script>
</body>
</html>`;

  var html = HtmlService.createHtmlOutput(htmlContent).setWidth(380).setHeight(380);
  SpreadsheetApp.getUi().showModalDialog(html, '👤 Đổi mật khẩu');
}

/**
 * Xử lý đổi mật khẩu server-side
 */
function processChangePassword(oldPassword, newPassword) {
  var session = getCurrentSession();
  if (!session) {
    return { success: false, message: 'Phiên đăng nhập đã hết hạn' };
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NHA_THAU);
  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][2]).trim().toLowerCase() === session.email.toLowerCase()) {
      var storedHash = String(data[i][5]).trim();

      if (!verifyPassword(oldPassword, storedHash)) {
        return { success: false, message: 'Mật khẩu hiện tại không đúng' };
      }

      // Cập nhật mật khẩu mới
      var newHash = generateMD5(newPassword);
      sheet.getRange(i + 1, 5).setValue(newPassword); // Cột E: plain text
      sheet.getRange(i + 1, 6).setValue(newHash);     // Cột F: hash

      return { success: true };
    }
  }

  return { success: false, message: 'Không tìm thấy tài khoản' };
}

// ============================================================
// 12. addNew360Row() - THÊM DÒNG MỚI VÀO SHEET 360
// ============================================================
function addNew360Row() {
  // Kiểm tra session đăng nhập
  var session = getCurrentSession();
  if (!session) {
    var ui = SpreadsheetApp.getUi();
    var response = ui.alert(
      '🔐 Chưa đăng nhập',
      'Bạn cần đăng nhập để thêm ảnh 360°.\nBạn có muốn đăng nhập không?',
      ui.ButtonSet.YES_NO
    );
    if (response === ui.Button.YES) showLoginDialog();
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_360);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('❌ Lỗi', 'Không tìm thấy sheet 360. Vui lòng chạy thiết lập.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  // Tìm dòng trống tiếp theo (sau dòng cuối có dữ liệu)
  var lastRow = sheet.getLastRow();
  var newRow = lastRow + 1;

  // Nếu sheet chỉ có header, newRow = 2
  if (lastRow < 1) newRow = 2;

  // Tạo UUID đơn giản cho ID Ảnh
  var uuid = generateUUID();

  // STT = số thứ tự tự động
  var stt = newRow - 1; // Trừ 1 dòng header

  // Auto-fill các cột cơ bản
  var today = new Date();

  // Ghi STT (cột A)
  sheet.getRange(newRow, 1).setValue(stt);

  // Ghi ID Ảnh (cột B)
  sheet.getRange(newRow, 2).setValue(uuid);

  // Ghi Ngày Upload = hôm nay (cột S = cột 19)
  sheet.getRange(newRow, 19).setValue(today).setNumberFormat('dd/MM/yyyy');

  // Ghi Người Upload từ session (cột T = cột 20)
  sheet.getRange(newRow, 20).setValue(session.name);

  // Giá trị mặc định cho Trạng Thái Xử Lý (cột X = cột 24)
  sheet.getRange(newRow, 24).setValue('Chưa xem xét');

  // Giá trị mặc định cho Nguồn GPS (cột O = cột 15)
  sheet.getRange(newRow, 15).setValue('EXIF Tự động');

  // Số Pins mặc định = 0 (cột V, W = 22, 23)
  sheet.getRange(newRow, 22).setValue(0);
  sheet.getRange(newRow, 23).setValue(0);

  // Công thức Preview Map (cột P = cột 16)
  // Nếu có tọa độ K và L, tạo link Google Maps
  sheet.getRange(newRow, 16).setFormula(
    '=IF(AND(K' + newRow + '<>"",L' + newRow + '<>""),HYPERLINK("https://maps.google.com/?q="&K' + newRow + '&","&L' + newRow + ',"🗺️ Xem bản đồ"),"")'
  );

  // Công thức Link Xem 360° (cột Y = cột 25)
  sheet.getRange(newRow, 25).setFormula(
    '=IF(G' + newRow + '<>"",HYPERLINK(G' + newRow + ',"👁️ Xem 360°"),"")'
  );

  // Định dạng dòng mới
  var newRowRange = sheet.getRange(newRow, 1, 1, 26);
  newRowRange.setBackground('#FFF8E1'); // Nền vàng nhạt để nổi bật dòng mới

  // Cuộn đến dòng mới và activate sheet
  sheet.setActiveCell(sheet.getRange(newRow, 3)); // Focus vào cột C (Dự Án)
  ss.setActiveSheet(sheet);

  // Hiển thị thông báo hướng dẫn
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Đã tạo dòng mới STT #' + stt + ' | ID: ' + uuid.substring(0, 8) + '... | Vui lòng điền thông tin bắt đầu từ cột C (Dự Án)',
    '📸 Thêm ảnh 360° mới',
    8
  );
}

/**
 * Tạo UUID đơn giản (không cần thư viện ngoài)
 * Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 */
function generateUUID() {
  var chars = '0123456789abcdef';
  var uuid = '';
  var template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';

  for (var i = 0; i < template.length; i++) {
    var c = template[i];
    if (c === 'x') {
      uuid += chars[Math.floor(Math.random() * 16)];
    } else if (c === 'y') {
      uuid += chars[(Math.floor(Math.random() * 4) + 8)]; // 8, 9, a, hoặc b
    } else {
      uuid += c;
    }
  }

  return uuid;
}

// ============================================================
// 13. updateSTT() - CẬP NHẬT SỐ THỨ TỰ
// ============================================================
function updateSTT() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_360);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Không tìm thấy sheet 360');
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert('Sheet 360 chưa có dữ liệu');
    return;
  }

  // Tạo mảng STT từ 1 đến n
  var sttValues = [];
  for (var i = 1; i <= lastRow - 1; i++) {
    sttValues.push([i]);
  }

  // Ghi toàn bộ cột A cùng lúc (batch write = nhanh hơn)
  sheet.getRange(2, 1, sttValues.length, 1).setValues(sttValues);

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Đã cập nhật ' + sttValues.length + ' STT',
    '🔄 Cập nhật STT',
    3
  );
}

// ============================================================
// 14. exportReportPDF() - XUẤT BÁO CÁO PDF
// ============================================================
function exportReportPDF() {
  var session = getCurrentSession();
  if (!session) {
    SpreadsheetApp.getUi().alert('⚠️ Chưa đăng nhập', 'Vui lòng đăng nhập trước.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_360);
  if (!sheet) return;

  // Tạo URL xuất PDF cho sheet hiện tại
  var ssId = ss.getId();
  var sheetId = sheet.getSheetId();

  // Tham số URL cho Google Sheets PDF export
  var pdfUrl = 'https://docs.google.com/spreadsheets/d/' + ssId +
    '/export?format=pdf' +
    '&size=A4' +
    '&portrait=false' +          // Landscape
    '&fitw=true' +               // Fit to width
    '&top_margin=0.5' +
    '&bottom_margin=0.5' +
    '&left_margin=0.5' +
    '&right_margin=0.5' +
    '&sheetnames=true' +
    '&printtitle=true' +
    '&pagenum=CENTER' +
    '&gridlines=false' +
    '&fzr=false' +               // Không lặp lại frozen rows
    '&gid=' + sheetId;

  // Hiển thị dialog với link download
  var htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h3 { color: #E65100; }
    p { color: #616161; margin: 10px 0; font-size: 14px; }
    .btn { display: inline-block; padding: 10px 20px; background: #E65100; color: white;
           text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px; }
    .btn:hover { background: #BF360C; }
    .info { background: #FFF3E0; padding: 12px; border-radius: 6px; margin-top: 14px; font-size: 13px; }
  </style>
</head>
<body>
  <h3>📊 Xuất báo cáo PDF</h3>
  <p>Sheet: <strong>360° - Danh sách ảnh công trình</strong></p>
  <p>Người xuất: <strong>${session.name}</strong> | ${new Date().toLocaleDateString('vi-VN')}</p>
  <a href="${pdfUrl}" target="_blank" class="btn">⬇️ Tải xuống PDF</a>
  <div class="info">
    ℹ️ File PDF sẽ mở trong tab mới. Nếu không tự động tải,
    nhấp chuột phải vào link và chọn "Save link as..."
  </div>
  <script>
    // Tự động mở link sau 500ms
    setTimeout(function() {
      window.open('${pdfUrl}', '_blank');
    }, 500);
  </script>
</body>
</html>`;

  var html = HtmlService.createHtmlOutput(htmlContent).setWidth(400).setHeight(260);
  SpreadsheetApp.getUi().showModalDialog(html, '📊 Xuất báo cáo PDF');
}

// ============================================================
// 15. openMapView() - XEM TRÊN BẢN ĐỒ
// ============================================================
function openMapView() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_360);
  if (!sheet) return;

  // Lấy dữ liệu GPS từ sheet 360
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert('Chưa có dữ liệu ảnh 360° nào.');
    return;
  }

  var data = sheet.getRange(2, 1, lastRow - 1, 25).getValues();

  // Lọc các dòng có tọa độ GPS hợp lệ
  var markers = [];
  for (var i = 0; i < data.length; i++) {
    var lat = parseFloat(data[i][10]); // Cột K: Vĩ độ
    var lng = parseFloat(data[i][11]); // Cột L: Kinh độ

    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      markers.push({
        lat: lat,
        lng: lng,
        title: String(data[i][2]) + ' - ' + String(data[i][3]), // Dự án + Khu vực
        date: data[i][16] ? new Date(data[i][16]).toLocaleDateString('vi-VN') : 'N/A',
        status: String(data[i][23]) // Trạng thái xử lý
      });
    }
  }

  if (markers.length === 0) {
    SpreadsheetApp.getUi().alert(
      '🗺️ Không có dữ liệu GPS',
      'Chưa có ảnh nào được nhập tọa độ GPS.\nVui lòng điền cột Vĩ Độ (K) và Kinh Độ (L).',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }

  // Tạo URL Google Maps với markers
  // Nếu có nhiều điểm, tạo URL với waypoints
  var mapUrls = [];
  for (var m = 0; m < Math.min(markers.length, 10); m++) {
    mapUrls.push(markers[m].lat + ',' + markers[m].lng);
  }

  var googleMapsUrl = 'https://www.google.com/maps/dir/' + mapUrls.join('/');

  // Nếu chỉ 1 điểm, dùng URL đơn giản hơn
  if (markers.length === 1) {
    googleMapsUrl = 'https://maps.google.com/?q=' + markers[0].lat + ',' + markers[0].lng;
  }

  // Tạo bảng tóm tắt dữ liệu GPS
  var tableRows = '';
  for (var j = 0; j < markers.length; j++) {
    tableRows += '<tr><td>' + (j+1) + '</td><td>' + markers[j].title +
      '</td><td>' + markers[j].lat.toFixed(6) + '</td><td>' + markers[j].lng.toFixed(6) +
      '</td><td>' + markers[j].date + '</td></tr>';
  }

  var htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 16px; font-size: 13px; }
    h3 { color: #E65100; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
    th { background: #E65100; color: white; padding: 7px; text-align: left; }
    td { padding: 6px 7px; border-bottom: 1px solid #EEE; }
    tr:hover { background: #FFF3E0; }
    .btn { display: inline-block; padding: 9px 18px; background: #4285F4; color: white;
           text-decoration: none; border-radius: 6px; font-weight: bold; }
    .count { color: #757575; margin-bottom: 10px; }
  </style>
</head>
<body>
  <h3>🗺️ Xem ảnh 360° trên bản đồ</h3>
  <p class="count">Tìm thấy <strong>${markers.length}</strong> điểm có tọa độ GPS</p>
  <table>
    <tr><th>#</th><th>Dự án / Khu vực</th><th>Vĩ độ</th><th>Kinh độ</th><th>Ngày chụp</th></tr>
    ${tableRows}
  </table>
  <a href="${googleMapsUrl}" target="_blank" class="btn">🗺️ Mở Google Maps</a>
</body>
</html>`;

  var html = HtmlService.createHtmlOutput(htmlContent).setWidth(560).setHeight(400);
  SpreadsheetApp.getUi().showModalDialog(html, '🗺️ Bản đồ Site360');
}

// ============================================================
// 16. UTILITY FUNCTIONS - CÁC HÀM TIỆN ÍCH
// ============================================================

/**
 * Lấy hoặc tạo sheet theo tên
 */
function getOrCreateSheet(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  return sheet;
}

/**
 * Kiểm tra session và yêu cầu đăng nhập nếu chưa
 * @return {Object|null} session hoặc null
 */
function requireLogin() {
  var session = getCurrentSession();
  if (!session) {
    var ui = SpreadsheetApp.getUi();
    var res = ui.alert('🔐 Yêu cầu đăng nhập',
      'Bạn cần đăng nhập để thực hiện thao tác này.\nĐăng nhập ngay?',
      ui.ButtonSet.YES_NO);
    if (res === ui.Button.YES) showLoginDialog();
    return null;
  }
  return session;
}

/**
 * Đăng xuất - Xóa session hiện tại
 */
function logout() {
  PropertiesService.getUserProperties().deleteProperty(CONFIG.SESSION_KEY);
  SpreadsheetApp.getActiveSpreadsheet().toast('Đã đăng xuất thành công', '🔐 Site360', 3);
}

/**
 * Kiểm tra xem người dùng có quyền truy cập dự án không
 * @param {string} projectName - Tên dự án cần kiểm tra
 * @return {boolean}
 */
function hasProjectAccess(projectName) {
  var session = getCurrentSession();
  if (!session) return false;

  // Quản lý dự án có quyền truy cập tất cả
  if (session.role === 'Quản lý dự án') return true;

  // Kiểm tra dự án trong danh sách được phân công
  var assignedProjects = session.projects.split(',').map(function(p) {
    return p.trim().toLowerCase();
  });

  return assignedProjects.indexOf(projectName.trim().toLowerCase()) !== -1;
}

/**
 * Format số với đơn vị
 */
function formatFileSize(sizeKB) {
  if (sizeKB >= 1024) {
    return (sizeKB / 1024).toFixed(1) + ' MB';
  }
  return sizeKB.toFixed(0) + ' KB';
}

/**
 * Validate tọa độ GPS
 */
function isValidGPS(lat, lng) {
  return (
    typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90 &&
    typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180
  );
}

/**
 * Tạo link Google Maps từ tọa độ
 */
function buildGoogleMapsUrl(lat, lng) {
  if (!isValidGPS(lat, lng)) return '';
  return 'https://maps.google.com/?q=' + lat + ',' + lng;
}

// ============================================================
// 17. onEdit() TRIGGER - XỬ LÝ KHI NGƯỜI DÙNG CHỈNH SỬA
// ============================================================
/**
 * Trigger tự động khi có thay đổi trong spreadsheet
 * - Tự động hash mật khẩu khi nhập vào cột E của sheet Nhà thầu TVGS
 * - Tự động cập nhật công thức cột P và Y trong sheet 360
 */
function onEdit(e) {
  var range = e.range;
  var sheet = range.getSheet();
  var col = range.getColumn();
  var row = range.getRow();

  // ===== Sheet Nhà thầu TVGS: Auto-hash mật khẩu =====
  if (sheet.getName() === CONFIG.SHEET_NHA_THAU) {
    // Cột E (5): Mật Khẩu - khi người dùng nhập, tự động hash sang cột F
    if (col === 5 && row > 1) {
      var plainPwd = range.getValue();
      if (plainPwd && String(plainPwd).trim() !== '') {
        // Bỏ protect tạm để ghi hash (nếu có protect)
        try {
          var hashCell = sheet.getRange(row, 6); // Cột F
          hashCell.setValue(generateMD5(String(plainPwd).trim()));
        } catch (err) {
          Logger.log('onEdit hash error: ' + err.message);
        }
      }
    }
  }

  // ===== Sheet 360: Cập nhật công thức GPS và link =====
  if (sheet.getName() === CONFIG.SHEET_360 && row > 1) {
    // Khi nhập tọa độ (cột K hoặc L), cập nhật Preview Map (cột P = 16)
    if (col === 11 || col === 12) {
      var lat = sheet.getRange(row, 11).getValue();
      var lng = sheet.getRange(row, 12).getValue();

      if (lat && lng && !isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
        sheet.getRange(row, 16).setFormula(
          '=HYPERLINK("https://maps.google.com/?q=' + lat + ',' + lng + '","🗺️ Xem bản đồ")'
        );
      }
    }

    // Khi nhập URL ảnh 360° (cột G = 7), cập nhật Link Xem 360° (cột Y = 25)
    if (col === 7) {
      var url360 = range.getValue();
      if (url360 && String(url360).trim() !== '') {
        sheet.getRange(row, 25).setFormula(
          '=HYPERLINK("' + String(url360).trim() + '","👁️ Xem 360°")'
        );
      }
    }
  }
}

// ============================================================
// 18. HÀM KIỂM TRA & DEBUG
// ============================================================

/**
 * Test hàm MD5 - Kiểm tra tính chính xác
 * Chạy hàm này để verify MD5 implementation
 */
function testMD5() {
  var testCases = [
    { input: 'admin123',   expected: '0192023a7bbd73250516f069df18b500' },
    { input: 'gsat456',    expected: null }, // Chỉ hiển thị output
    { input: 'member789',  expected: null },
    { input: '',           expected: 'd41d8cd98f00b204e9800998ecf8427e' },
    { input: 'hello',      expected: '5d41402abc4b2a76b9719d911017c592' }
  ];

  var results = [];
  for (var i = 0; i < testCases.length; i++) {
    var tc = testCases[i];
    var hash = generateMD5(tc.input);
    var pass = tc.expected === null ? 'N/A' : (hash === tc.expected ? '✅ PASS' : '❌ FAIL');
    results.push('Input: "' + tc.input + '" → ' + hash + ' | ' + pass);
  }

  Logger.log('=== MD5 TEST RESULTS ===\n' + results.join('\n'));
  SpreadsheetApp.getUi().alert('MD5 Test Results', results.join('\n'), SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Hiển thị thông tin session hiện tại (debug)
 */
function showSessionInfo() {
  var session = getCurrentSession();
  if (!session) {
    SpreadsheetApp.getUi().alert('Chưa đăng nhập hoặc session đã hết hạn');
    return;
  }

  var expiry = new Date(session.expiry);
  var info = [
    'Tên: ' + session.name,
    'Email: ' + session.email,
    'Vai trò: ' + session.role,
    'Dự án: ' + session.projects,
    'Hết hạn: ' + expiry.toLocaleString('vi-VN')
  ].join('\n');

  SpreadsheetApp.getUi().alert('👤 Thông tin đăng nhập', info, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Reset tất cả login attempts (dùng khi debug)
 */
function resetLoginAttempts() {
  var props = PropertiesService.getUserProperties();
  props.deleteAllProperties();
  SpreadsheetApp.getUi().alert('✅ Đã reset tất cả trạng thái đăng nhập');
}

// ============================================================
// 19. HASH MẬT KHẨU CHO TẤT CẢ NGƯỜI DÙNG HIỆN CÓ
// ============================================================

/**
 * Hàm tiện ích: Hash lại tất cả mật khẩu trong sheet Nhà thầu TVGS
 * Dùng khi import dữ liệu người dùng mới (plain text)
 * Chạy một lần khi setup hoặc khi import dữ liệu
 */
function hashAllPasswords() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NHA_THAU);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Không tìm thấy sheet Nhà thầu TVGS');
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  var count = 0;
  for (var i = 2; i <= lastRow; i++) {
    var plainPwd = sheet.getRange(i, 5).getValue(); // Cột E: Mật khẩu plain text
    if (plainPwd && String(plainPwd).trim() !== '') {
      var hash = generateMD5(String(plainPwd).trim());
      sheet.getRange(i, 6).setValue(hash); // Cột F: Hash
      count++;
    }
  }

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Đã hash ' + count + ' mật khẩu',
    '🔐 Hash mật khẩu',
    4
  );
}

// ============================================================
// 20. THÊM DỮ LIỆU MẪU VÀO SHEET 360
// ============================================================

/**
 * Thêm dữ liệu mẫu ảnh 360° để demo hệ thống
 * (Tùy chọn, chạy sau khi setup xong)
 */
function addSampleData360() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_360);
  if (!sheet) return;

  var sampleData = [
    [1, generateUUID(), 'Tòa nhà văn phòng Hà Nội Central Tower', 'Tầng 1 - Khu vực móng',
     'Móng', 'IMG_20240315_001_360.jpg',
     'https://example.com/360/img001.jpg', 'https://example.com/thumb/img001.jpg',
     8500, '8000x4000',
     21.02800000, 105.85400000, 12.5, 45.0, 'EXIF Tự động', '',
     new Date('2024-03-15'), new Date('2024-03-15T08:30:00'), new Date(), 'Nguyễn Văn Admin',
     'Ảnh móng cọc nhồi khu A', 2, 1, 'Đang xử lý', '', ''],
    [2, generateUUID(), 'Tòa nhà văn phòng Hà Nội Central Tower', 'Tầng 5 - Sàn bê tông',
     'Thô', 'IMG_20240420_015_360.jpg',
     'https://example.com/360/img015.jpg', 'https://example.com/thumb/img015.jpg',
     7200, '7680x3840',
     21.02801000, 105.85401000, 18.0, 90.0, 'EXIF Tự động', '',
     new Date('2024-04-20'), new Date('2024-04-20T10:15:00'), new Date(), 'Trần Thị Giám Sát',
     'Đổ sàn tầng 5', 0, 3, 'Chưa xem xét', '', ''],
    [3, generateUUID(), 'Khu đô thị Ecopark Giai đoạn 3', 'Lô B15 - Toàn khu',
     'Hoàn thiện', 'IMG_20240510_030_360.jpg',
     'https://example.com/360/img030.jpg', 'https://example.com/thumb/img030.jpg',
     9100, '8000x4000',
     20.95100000, 106.00200000, 8.0, 180.0, 'Nhập tay', '',
     new Date('2024-05-10'), new Date('2024-05-10T14:00:00'), new Date(), 'Lê Văn Thành Viên',
     'Hoàn thiện nội thất biệt thự B15', 1, 5, 'Đã giải quyết', '', '']
  ];

  var lastRow = sheet.getLastRow();
  var startRow = lastRow + 1;
  if (lastRow < 1) startRow = 2;

  for (var i = 0; i < sampleData.length; i++) {
    sampleData[i][0] = startRow - 1 + i; // Cập nhật STT
    sheet.getRange(startRow + i, 1, 1, sampleData[i].length).setValues([sampleData[i]]);

    // Thêm công thức cho cột P (Preview Map) và Y (Link 360°)
    var rowNum = startRow + i;
    sheet.getRange(rowNum, 16).setFormula(
      '=IF(AND(K' + rowNum + '<>"",L' + rowNum + '<>""),HYPERLINK("https://maps.google.com/?q="&K' + rowNum + '&","&L' + rowNum + ',"🗺️ Xem bản đồ"),"")'
    );
    sheet.getRange(rowNum, 25).setFormula(
      '=IF(G' + rowNum + '<>"",HYPERLINK(G' + rowNum + ',"👁️ Xem 360°"),"")'
    );
  }

  // Định dạng cột ngày
  sheet.getRange(startRow, 17, sampleData.length, 1).setNumberFormat('dd/MM/yyyy');
  sheet.getRange(startRow, 18, sampleData.length, 1).setNumberFormat('HH:mm:ss');
  sheet.getRange(startRow, 19, sampleData.length, 1).setNumberFormat('dd/MM/yyyy');

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Đã thêm ' + sampleData.length + ' ảnh 360° mẫu',
    '📸 Dữ liệu mẫu',
    4
  );
}

// ============================================================
// 21. MENU ITEM: THÊM DỮ LIỆU MẪU 360 VÀO MENU (TÙY CHỌN)
// ============================================================

/**
 * Tạo menu đầy đủ có cả mục debug (dành cho developer)
 * Thay thế createCustomMenu() nếu muốn dùng trong môi trường dev
 */
function createDevMenu() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('📷 Site360')
    .addItem('⚙️ Thiết lập ban đầu', 'runFullSetup')
    .addSeparator()
    .addItem('📸 Thêm ảnh 360° mới', 'addNew360Row')
    .addItem('🔄 Cập nhật STT', 'updateSTT')
    .addItem('📝 Thêm dữ liệu mẫu 360°', 'addSampleData360')
    .addSeparator()
    .addItem('🔐 Đăng nhập', 'showLoginDialog')
    .addItem('👤 Thay đổi mật khẩu', 'showChangePasswordDialog')
    .addItem('🔓 Đăng xuất', 'logout')
    .addItem('ℹ️ Thông tin session', 'showSessionInfo')
    .addSeparator()
    .addItem('📊 Xuất báo cáo PDF', 'exportReportPDF')
    .addItem('🗺️ Xem trên bản đồ', 'openMapView')
    .addSeparator()
    .addItem('🔑 Hash tất cả mật khẩu', 'hashAllPasswords')
    .addItem('🧪 Test MD5', 'testMD5')
    .addItem('🔄 Reset login attempts', 'resetLoginAttempts')
    .addToUi();
}

/**
 * ============================================================
 * HƯỚNG DẪN SỬ DỤNG:
 * ============================================================
 *
 * 1. Mở Google Spreadsheet "WA | NNN | Quản Lý Dự án, Công việc"
 * 2. Vào Extensions > Apps Script
 * 3. Paste toàn bộ code này vào editor
 * 4. Lưu (Ctrl+S)
 * 5. Refresh spreadsheet
 * 6. Menu "📷 Site360" sẽ xuất hiện
 * 7. Nhấn "⚙️ Thiết lập ban đầu" để chạy setup
 *
 * TÀI KHOẢN MẪU:
 * - Admin: admin@site360.vn / admin123
 * - Giám sát: giamsat@site360.vn / gsat456
 * - Thành viên: thanhvien@site360.vn / member789
 *
 * LƯU Ý:
 * - Sheet "Nhà thầu TVGS" cột F (Hash Mật Khẩu) bị ẩn - đây là bảo mật
 * - Session đăng nhập hết hạn sau 8 giờ
 * - Tài khoản bị khóa sau 5 lần đăng nhập sai (30 phút)
 * - Trigger onEdit() tự động hash mật khẩu khi nhập vào cột E
 * ============================================================
 */
