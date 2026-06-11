// ============================================================
// PHẦN 4: Media Storage Service
// Quản lý phân loại ảnh theo cây thư mục và query nâng cao
// ============================================================
import { Router, Response } from 'express';
import { query, queryOne } from '../config/database';
import { authenticate, authorizeProject } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// ============================================================
// SERVICE: Phân loại ảnh theo cây thư mục
// Cấu trúc: Project -> Zone -> Phase -> Ngày chụp
// ============================================================
export class MediaStorageService {
  /**
   * Lấy cây thư mục phân loại ảnh của project
   * Trả về dạng tree: { zones: [{ zone, phases: [{ phase, dates: [{ date, count }] }] }] }
   */
  static async getPhotoTree(projectId: string) {
    const treeData = await query<{
      zone_id: string | null;
      zone_name: string | null;
      phase: string | null;
      capture_date: string | null;
      photo_count: number;
    }>(
      `SELECT
        p.zone_id,
        z.name AS zone_name,
        p.phase,
        -- Nhóm theo ngày (không quan tâm giờ phút giây)
        TO_CHAR(p.captured_at AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS capture_date,
        COUNT(*) AS photo_count
       FROM photos_360 p
       LEFT JOIN zones z ON z.id = p.zone_id
       WHERE p.project_id = $1 AND p.status = 'active'
       GROUP BY p.zone_id, z.name, p.phase, capture_date
       ORDER BY z.name NULLS LAST, p.phase NULLS LAST, capture_date DESC`,
      [projectId]
    );

    // Chuyển flat array thành tree structure
    const tree: Record<string, {
      zone_id: string | null;
      zone_name: string;
      phases: Record<string, {
        phase: string;
        dates: Array<{ date: string; count: number }>;
        total: number;
      }>;
      total: number;
    }> = {};

    for (const row of treeData) {
      const zoneKey = row.zone_id || '__no_zone__';
      const zoneName = row.zone_name || 'Chưa phân khu vực';
      const phaseKey = row.phase || '__no_phase__';
      const phaseName = row.phase || 'Chưa phân giai đoạn';

      // Khởi tạo zone node
      if (!tree[zoneKey]) {
        tree[zoneKey] = { zone_id: row.zone_id, zone_name: zoneName, phases: {}, total: 0 };
      }

      // Khởi tạo phase node trong zone
      if (!tree[zoneKey].phases[phaseKey]) {
        tree[zoneKey].phases[phaseKey] = { phase: phaseName, dates: [], total: 0 };
      }

      // Thêm ngày vào phase
      if (row.capture_date) {
        tree[zoneKey].phases[phaseKey].dates.push({
          date: row.capture_date,
          count: Number(row.photo_count),
        });
      }

      tree[zoneKey].phases[phaseKey].total += Number(row.photo_count);
      tree[zoneKey].total += Number(row.photo_count);
    }

    return Object.values(tree).map((zone) => ({
      ...zone,
      phases: Object.values(zone.phases),
    }));
  }

  /**
   * Query ảnh nâng cao: Tìm theo bán kính GPS + bộ lọc thời gian
   * Sử dụng PostGIS ST_DWithin với Geography type để tính khoảng cách chính xác (mét)
   */
  static async searchPhotosByRadius(params: {
    projectId: string;
    centerLat: number;
    centerLng: number;
    radiusMeters: number;
    startDate?: string;
    endDate?: string;
    zoneId?: string;
    phase?: string;
    limit?: number;
    offset?: number;
  }) {
    const {
      projectId, centerLat, centerLng, radiusMeters,
      startDate, endDate, zoneId, phase,
      limit = 50, offset = 0,
    } = params;

    const conditions: string[] = [
      'p.project_id = $1',
      "p.status = 'active'",
      'p.geom IS NOT NULL',
      // ST_DWithin với geography: khoảng cách tính bằng mét (chính xác hơn geometry)
      `ST_DWithin(
        p.geom::geography,
        ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography,
        $4
      )`,
    ];
    const queryParams: unknown[] = [projectId, centerLat, centerLng, radiusMeters];
    let paramIdx = 5;

    if (startDate) {
      conditions.push(`p.captured_at >= $${paramIdx++}`);
      queryParams.push(startDate);
    }

    if (endDate) {
      conditions.push(`p.captured_at <= $${paramIdx++}`);
      queryParams.push(endDate);
    }

    if (zoneId) {
      conditions.push(`p.zone_id = $${paramIdx++}`);
      queryParams.push(zoneId);
    }

    if (phase) {
      conditions.push(`p.phase = $${paramIdx++}`);
      queryParams.push(phase);
    }

    const whereClause = conditions.join(' AND ');

    const [photos, countResult] = await Promise.all([
      query(
        `SELECT p.id, p.file_url, p.thumbnail_url, p.original_filename,
                p.latitude, p.longitude, p.altitude, p.captured_at,
                p.phase, z.name AS zone_name,
                u.full_name AS uploader_name,
                -- Khoảng cách thực tế từ tâm (mét)
                ROUND(ST_Distance(
                  p.geom::geography,
                  ST_SetSRID(ST_MakePoint($3, $2), 4326)::geography
                )::numeric, 1) AS distance_meters
         FROM photos_360 p
         LEFT JOIN zones z ON z.id = p.zone_id
         LEFT JOIN users u ON u.id = p.uploaded_by
         WHERE ${whereClause}
         ORDER BY distance_meters ASC, p.captured_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...queryParams, limit, offset]
      ),
      query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM photos_360 p WHERE ${whereClause}`,
        queryParams
      ),
    ]);

    return {
      photos,
      total: parseInt(countResult[0].count),
      center: { lat: centerLat, lng: centerLng },
      radius_meters: radiusMeters,
    };
  }

  /**
   * Thống kê ảnh theo thời gian (timeline chart)
   * Nhóm số lượng ảnh theo ngày/tuần/tháng
   */
  static async getPhotoTimeline(projectId: string, groupBy: 'day' | 'week' | 'month' = 'week') {
    const truncFormat = {
      day: 'day',
      week: 'week',
      month: 'month',
    }[groupBy];

    return query(
      `SELECT
        DATE_TRUNC($2, captured_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS period,
        COUNT(*) AS photo_count,
        COUNT(DISTINCT zone_id) AS zones_covered
       FROM photos_360
       WHERE project_id = $1 AND status = 'active' AND captured_at IS NOT NULL
       GROUP BY period
       ORDER BY period ASC`,
      [projectId, truncFormat]
    );
  }
}

// ============================================================
// API Routes cho Media Storage
// ============================================================

// GET /:projectId/media/tree - Lấy cây phân loại ảnh
router.get(
  '/:projectId/media/tree',
  authenticate,
  authorizeProject(['project_manager', 'member', 'viewer']),
  async (req: AuthRequest, res: Response) => {
    const tree = await MediaStorageService.getPhotoTree(req.params.projectId);
    return res.json({ success: true, data: tree });
  }
);

// GET /:projectId/media/search - Tìm kiếm ảnh theo bán kính GPS + thời gian
router.get(
  '/:projectId/media/search',
  authenticate,
  authorizeProject(['project_manager', 'member', 'viewer']),
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;
    const {
      lat, lng, radius = '50',
      start_date, end_date, zone_id, phase,
      page = '1', limit = '20',
    } = req.query as Record<string, string>;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        error: 'Cần cung cấp tọa độ lat và lng để tìm kiếm theo bán kính',
      });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    const result = await MediaStorageService.searchPhotosByRadius({
      projectId,
      centerLat: parseFloat(lat),
      centerLng: parseFloat(lng),
      radiusMeters: parseInt(radius),
      startDate: start_date,
      endDate: end_date,
      zoneId: zone_id,
      phase,
      limit: limitNum,
      offset: (pageNum - 1) * limitNum,
    });

    return res.json({
      success: true,
      data: result.photos,
      meta: {
        total: result.total,
        center: result.center,
        radius_meters: result.radius_meters,
      },
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        totalPages: Math.ceil(result.total / limitNum),
      },
    });
  }
);

// GET /:projectId/media/timeline - Timeline thống kê ảnh
router.get(
  '/:projectId/media/timeline',
  authenticate,
  authorizeProject(['project_manager', 'member', 'viewer']),
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;
    const { group_by = 'week' } = req.query as { group_by?: 'day' | 'week' | 'month' };

    const timeline = await MediaStorageService.getPhotoTimeline(projectId, group_by);
    return res.json({ success: true, data: timeline });
  }
);

// GET /:projectId/media/stats - Tổng quan thống kê project
router.get(
  '/:projectId/media/stats',
  authenticate,
  authorizeProject(['project_manager', 'member', 'viewer']),
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;

    const [photoStats, pinStats, taskStats] = await Promise.all([
      queryOne(
        `SELECT
          COUNT(*) AS total_photos,
          COUNT(*) FILTER (WHERE captured_at >= NOW() - INTERVAL '7 days') AS last_7days,
          COUNT(DISTINCT zone_id) AS zones_with_photos,
          COUNT(DISTINCT phase) AS phases,
          SUM(file_size) AS total_size_bytes
         FROM photos_360 WHERE project_id = $1 AND status = 'active'`,
        [projectId]
      ),
      queryOne(
        `SELECT
          COUNT(*) AS total_pins,
          COUNT(*) FILTER (WHERE status = 'open') AS open_pins,
          COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_pins,
          COUNT(*) FILTER (WHERE priority = 'critical' AND status = 'open') AS critical_open
         FROM pins_reports WHERE project_id = $1`,
        [projectId]
      ),
      queryOne(
        `SELECT
          COUNT(*) AS total_tasks,
          COUNT(*) FILTER (WHERE status = 'done') AS done_tasks,
          COUNT(*) FILTER (WHERE end_date < CURRENT_DATE AND status != 'done') AS overdue_tasks,
          ROUND(AVG(progress), 1) AS avg_progress
         FROM tasks WHERE project_id = $1`,
        [projectId]
      ),
    ]);

    return res.json({
      success: true,
      data: { photos: photoStats, pins: pinStats, tasks: taskStats },
    });
  }
);

export default router;
