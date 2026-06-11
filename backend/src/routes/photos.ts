// ============================================================
// Photo Upload & Management API
// Nhận file ảnh 360°, trích xuất GPS EXIF, lưu vào PostgreSQL
// ============================================================
import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import sharp from 'sharp';
import * as exifr from 'exifr';
import { body, query as queryValidator, validationResult } from 'express-validator';
import { authenticate, authorizeProject } from '../middleware/auth';
import { AuthRequest, Photo360, PhotoQueryParams } from '../types';
import { query, queryOne, withTransaction } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================================
// Cấu hình Multer - xử lý file upload
// ============================================================
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '100') * 1024 * 1024;

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    // Tạo thư mục nếu chưa tồn tại
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    // Tên file: uuid + extension gốc (tránh trùng tên, tránh path traversal)
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ hỗ trợ ảnh JPEG, PNG và WebP'));
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_FILE_SIZE } });

// ============================================================
// Helper: Trích xuất GPS từ EXIF metadata của ảnh
// ============================================================
async function extractGPSFromEXIF(filePath: string): Promise<{
  latitude?: number;
  longitude?: number;
  altitude?: number;
  heading?: number;
  capturedAt?: Date;
} | null> {
  try {
    const exifData = await exifr.parse(filePath, {
      gps: true,
      // Các field EXIF cần thiết
      pick: ['latitude', 'longitude', 'altitude', 'GPSImgDirection', 'DateTimeOriginal', 'CreateDate'],
    });

    if (!exifData) return null;

    return {
      latitude: exifData.latitude,
      longitude: exifData.longitude,
      altitude: exifData.altitude,
      heading: exifData.GPSImgDirection,
      capturedAt: exifData.DateTimeOriginal || exifData.CreateDate,
    };
  } catch {
    // EXIF parsing thất bại không phải lỗi nghiêm trọng
    return null;
  }
}

// ============================================================
// Helper: Tạo thumbnail từ ảnh gốc
// ============================================================
async function generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
  await sharp(inputPath)
    .resize(400, 200, { fit: 'cover' })
    .jpeg({ quality: 80 })
    .toFile(outputPath);
}

// ============================================================
// POST /:projectId/photos - Upload ảnh 360°
// ============================================================
router.post(
  '/:projectId/photos',
  authenticate,
  authorizeProject(['project_manager', 'member']),
  upload.single('photo'),
  [
    body('zone_id').optional().isUUID(),
    body('phase').optional().trim().isLength({ max: 100 }),
    body('notes').optional().trim().isLength({ max: 1000 }),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('captured_at').optional().isISO8601(),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // Xóa file đã upload nếu validation thất bại
      if (req.file) await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Vui lòng chọn file ảnh để upload' });
    }

    const { projectId } = req.params;
    const { zone_id, phase, notes, captured_at } = req.body;
    const filePath = req.file.path;

    try {
      // Xử lý song song: lấy metadata ảnh + trích xuất EXIF GPS
      const [imageMetadata, exifGPS] = await Promise.all([
        sharp(filePath).metadata(),
        extractGPSFromEXIF(filePath),
      ]);

      // Ưu tiên tọa độ từ form body (nhập tay), fallback về EXIF
      const latitude = req.body.latitude ? parseFloat(req.body.latitude) : exifGPS?.latitude;
      const longitude = req.body.longitude ? parseFloat(req.body.longitude) : exifGPS?.longitude;
      const altitude = req.body.altitude ? parseFloat(req.body.altitude) : exifGPS?.altitude;
      const heading = req.body.heading ? parseFloat(req.body.heading) : exifGPS?.heading;
      const capturedAt = captured_at || exifGPS?.capturedAt?.toISOString();

      // Tạo thumbnail
      const thumbFilename = `thumb_${path.basename(req.file.filename)}`;
      const thumbPath = path.join(UPLOAD_DIR, thumbFilename);
      await generateThumbnail(filePath, thumbPath);

      // Tính URL file (trong production sẽ là CDN URL)
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;
      const thumbnailUrl = `${baseUrl}/uploads/${thumbFilename}`;

      // Lưu vào database trong transaction
      const photo = await withTransaction(async (client) => {
        // Tạo geometry Point PostGIS nếu có tọa độ GPS
        const geomExpression = latitude && longitude
          ? `ST_SetSRID(ST_MakePoint($10, $9), 4326)` // Point(lng, lat) - PostGIS dùng (x=lng, y=lat)
          : 'NULL';

        const params: unknown[] = [
          uuidv4(), projectId, zone_id || null, phase || null,
          fileUrl, req.file!.originalname, req.file!.size,
          imageMetadata.width, imageMetadata.height,
        ];

        if (latitude && longitude) {
          params.push(latitude, longitude, altitude || null, heading || null, capturedAt || null, thumbnailUrl, req.user!.id, notes || null);
        } else {
          params.push(null, null, null, null, capturedAt || null, thumbnailUrl, req.user!.id, notes || null);
        }

        const result = await client.query(
          `INSERT INTO photos_360
             (id, project_id, zone_id, phase, file_url, original_filename, file_size,
              width, height, latitude, longitude, altitude, heading, captured_at,
              ${latitude && longitude ? `geom, ` : ''}thumbnail_url, uploaded_by, notes, status)
           VALUES
             ($1, $2, $3, $4, $5, $6, $7, $8, $9,
              ${latitude && longitude ? geomExpression + ', ' : 'NULL, NULL, NULL, NULL, '}
              $${params.length - 2}, $${params.length - 1}, $${params.length}, 'active')
           RETURNING *`,
          params
        );

        // Sử dụng query đơn giản hơn
        const insertResult = await client.query(
          `INSERT INTO photos_360
             (id, project_id, zone_id, phase, file_url, original_filename, file_size,
              width, height, latitude, longitude, altitude, heading, captured_at,
              geom, thumbnail_url, uploaded_by, notes, status)
           VALUES
             ($1, $2, $3, $4, $5, $6, $7, $8, $9,
              $10, $11, $12, $13, $14,
              CASE WHEN $10 IS NOT NULL AND $11 IS NOT NULL
                THEN ST_SetSRID(ST_MakePoint($11, $10), 4326)
                ELSE NULL
              END,
              $15, $16, $17, 'active')
           RETURNING *`,
          [
            uuidv4(), projectId, zone_id || null, phase || null,
            fileUrl, req.file!.originalname, req.file!.size,
            imageMetadata.width || null, imageMetadata.height || null,
            latitude || null, longitude || null, altitude || null, heading || null,
            capturedAt || null, thumbnailUrl, req.user!.id, notes || null,
          ]
        );

        // Ghi activity log
        await client.query(
          `INSERT INTO activity_logs (project_id, user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'photo.upload', 'photo', $3, $4)`,
          [projectId, req.user!.id, insertResult.rows[0].id, JSON.stringify({
            filename: req.file!.originalname,
            hasGPS: !!(latitude && longitude),
          })]
        );

        return insertResult.rows[0];
      });

      return res.status(201).json({
        success: true,
        data: photo,
        message: 'Upload ảnh 360° thành công',
      });

    } catch (error) {
      // Dọn file nếu có lỗi DB
      await fs.unlink(filePath).catch(() => {});
      throw error;
    }
  }
);

// ============================================================
// GET /:projectId/photos - Lấy danh sách ảnh (có filter + pagination)
// ============================================================
router.get(
  '/:projectId/photos',
  authenticate,
  authorizeProject(['project_manager', 'member', 'viewer']),
  [
    queryValidator('page').optional().isInt({ min: 1 }),
    queryValidator('limit').optional().isInt({ min: 1, max: 100 }),
    queryValidator('lat').optional().isFloat({ min: -90, max: 90 }),
    queryValidator('lng').optional().isFloat({ min: -180, max: 180 }),
    queryValidator('radius').optional().isInt({ min: 1, max: 10000 }),
  ],
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;
    const {
      zone_id, phase, start_date, end_date,
      lat, lng, radius,
      page = '1', limit = '20'
    } = req.query as Record<string, string>;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const offset = (pageNum - 1) * limitNum;

    // Xây dựng query động với các điều kiện filter
    const conditions: string[] = ['p.project_id = $1', "p.status = 'active'"];
    const params: unknown[] = [projectId];
    let paramIdx = 2;

    if (zone_id) {
      conditions.push(`p.zone_id = $${paramIdx++}`);
      params.push(zone_id);
    }

    if (phase) {
      conditions.push(`p.phase = $${paramIdx++}`);
      params.push(phase);
    }

    if (start_date) {
      conditions.push(`p.captured_at >= $${paramIdx++}`);
      params.push(start_date);
    }

    if (end_date) {
      conditions.push(`p.captured_at <= $${paramIdx++}`);
      params.push(end_date);
    }

    // QUERY BÁN KÍNH GPS (PostGIS) - tìm ảnh trong bán kính X mét
    if (lat && lng && radius) {
      // ST_DWithin với geography type tính bán kính bằng mét chính xác
      conditions.push(
        `ST_DWithin(
          p.geom::geography,
          ST_SetSRID(ST_MakePoint($${paramIdx + 1}, $${paramIdx}), 4326)::geography,
          $${paramIdx + 2}
        )`
      );
      params.push(parseFloat(lat), parseFloat(lng), parseInt(radius));
      paramIdx += 3;
    }

    const whereClause = conditions.join(' AND ');

    // Đếm tổng số bản ghi
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) as count FROM photos_360 p WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0].count);

    // Lấy dữ liệu với phân trang
    const photos = await query<Photo360>(
      `SELECT p.*,
        u.full_name AS uploader_name,
        z.name AS zone_name,
        -- Trả về tọa độ dạng JSON thay vì geometry binary
        CASE WHEN p.geom IS NOT NULL
          THEN json_build_object('lat', ST_Y(p.geom), 'lng', ST_X(p.geom))
          ELSE NULL
        END AS coordinates,
        COUNT(pr.id) AS pin_count
       FROM photos_360 p
       LEFT JOIN users u ON u.id = p.uploaded_by
       LEFT JOIN zones z ON z.id = p.zone_id
       LEFT JOIN pins_reports pr ON pr.photo_id = p.id
       WHERE ${whereClause}
       GROUP BY p.id, u.full_name, z.name
       ORDER BY p.captured_at DESC NULLS LAST, p.uploaded_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, limitNum, offset]
    );

    return res.json({
      success: true,
      data: photos,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  }
);

// ============================================================
// GET /:projectId/photos/:photoId - Lấy chi tiết 1 ảnh
// ============================================================
router.get(
  '/:projectId/photos/:photoId',
  authenticate,
  authorizeProject(['project_manager', 'member', 'viewer']),
  async (req: AuthRequest, res: Response) => {
    const { projectId, photoId } = req.params;

    const photo = await queryOne(
      `SELECT p.*,
        u.full_name AS uploader_name,
        z.name AS zone_name,
        CASE WHEN p.geom IS NOT NULL
          THEN json_build_object('lat', ST_Y(p.geom), 'lng', ST_X(p.geom))
          ELSE NULL
        END AS coordinates,
        -- Lấy kèm danh sách pins
        COALESCE(
          json_agg(
            json_build_object(
              'id', pr.id, 'title', pr.title, 'type', pr.type,
              'status', pr.status, 'priority', pr.priority,
              'pin_yaw', pr.pin_yaw, 'pin_pitch', pr.pin_pitch
            )
          ) FILTER (WHERE pr.id IS NOT NULL),
          '[]'
        ) AS pins
       FROM photos_360 p
       LEFT JOIN users u ON u.id = p.uploaded_by
       LEFT JOIN zones z ON z.id = p.zone_id
       LEFT JOIN pins_reports pr ON pr.photo_id = p.id
       WHERE p.id = $1 AND p.project_id = $2
       GROUP BY p.id, u.full_name, z.name`,
      [photoId, projectId]
    );

    if (!photo) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy ảnh' });
    }

    return res.json({ success: true, data: photo });
  }
);

// ============================================================
// DELETE /:projectId/photos/:photoId - Xóa ảnh
// ============================================================
router.delete(
  '/:projectId/photos/:photoId',
  authenticate,
  authorizeProject(['project_manager']),
  async (req: AuthRequest, res: Response) => {
    const { projectId, photoId } = req.params;

    const photo = await queryOne<{ file_url: string; thumbnail_url: string }>(
      'SELECT file_url, thumbnail_url FROM photos_360 WHERE id = $1 AND project_id = $2',
      [photoId, projectId]
    );

    if (!photo) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy ảnh' });
    }

    // Soft delete: chỉ đổi status thành archived
    await query(
      "UPDATE photos_360 SET status = 'archived' WHERE id = $1",
      [photoId]
    );

    return res.json({ success: true, message: 'Đã xóa ảnh thành công' });
  }
);

export default router;
