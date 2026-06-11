// ============================================================
// Pins/Reports API: Báo cáo sự cố gắn trên ảnh 360° hoặc bản đồ
// ============================================================
import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorizeProject } from '../middleware/auth';
import { AuthRequest, PinReport } from '../types';
import { query, queryOne, withTransaction } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================================
// GET /:projectId/pins - Lấy tất cả pins của project
// ============================================================
router.get(
  '/:projectId/pins',
  authenticate,
  authorizeProject(['project_manager', 'member', 'viewer']),
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;
    const { photo_id, status, type, priority } = req.query as Record<string, string>;

    const conditions: string[] = ['pr.project_id = $1'];
    const params: unknown[] = [projectId];
    let pidx = 2;

    if (photo_id) { conditions.push(`pr.photo_id = $${pidx++}`); params.push(photo_id); }
    if (status) { conditions.push(`pr.status = $${pidx++}`); params.push(status); }
    if (type) { conditions.push(`pr.type = $${pidx++}`); params.push(type); }
    if (priority) { conditions.push(`pr.priority = $${pidx++}`); params.push(priority); }

    const pins = await query<PinReport>(
      `SELECT pr.*,
        u_creator.full_name AS creator_name,
        u_assignee.full_name AS assignee_name,
        u_assignee.avatar_url AS assignee_avatar,
        ph.thumbnail_url AS photo_thumbnail,
        CASE WHEN pr.geom IS NOT NULL
          THEN json_build_object('lat', ST_Y(pr.geom), 'lng', ST_X(pr.geom))
          ELSE NULL
        END AS coordinates
       FROM pins_reports pr
       LEFT JOIN users u_creator ON u_creator.id = pr.created_by
       LEFT JOIN users u_assignee ON u_assignee.id = pr.assigned_to
       LEFT JOIN photos_360 ph ON ph.id = pr.photo_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY pr.created_at DESC`,
      params
    );

    return res.json({ success: true, data: pins });
  }
);

// ============================================================
// POST /:projectId/pins - Tạo pin mới (từ ảnh 360° hoặc bản đồ)
// ============================================================
router.post(
  '/:projectId/pins',
  authenticate,
  authorizeProject(['project_manager', 'member']),
  [
    body('title').trim().isLength({ min: 1, max: 255 }),
    body('type').isIn(['issue', 'progress', 'safety', 'quality', 'rfi', 'note']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('photo_id').optional().isUUID(),
    // Tọa độ trên ảnh 360 (spherical)
    body('pin_yaw').optional().isFloat({ min: -180, max: 180 }),
    body('pin_pitch').optional().isFloat({ min: -90, max: 90 }),
    // Tọa độ GPS thực tế
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('assigned_to').optional().isUUID(),
    body('due_date').optional().isDate(),
    body('task_id').optional().isUUID(),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { projectId } = req.params;
    const {
      title, description, type, priority = 'medium',
      photo_id, pin_yaw, pin_pitch,
      latitude, longitude, assigned_to, due_date, task_id,
    } = req.body;

    // Nếu gắn pin vào ảnh 360 nhưng không có tọa độ GPS,
    // thì dùng tọa độ GPS của ảnh đó
    let lat = latitude;
    let lng = longitude;

    if (photo_id && !lat) {
      const photo = await queryOne<{ latitude: number; longitude: number }>(
        'SELECT latitude, longitude FROM photos_360 WHERE id = $1',
        [photo_id]
      );
      lat = photo?.latitude;
      lng = photo?.longitude;
    }

    const pin = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO pins_reports
           (id, project_id, photo_id, title, description, type, priority,
            pin_yaw, pin_pitch, geom, assigned_to, due_date, task_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
           CASE WHEN $10 IS NOT NULL AND $11 IS NOT NULL
             THEN ST_SetSRID(ST_MakePoint($11, $10), 4326)
             ELSE NULL
           END,
           $12,$13,$14,$15)
         RETURNING *`,
        [
          uuidv4(), projectId, photo_id || null, title, description || null,
          type, priority, pin_yaw || null, pin_pitch || null,
          lat || null, lng || null,
          assigned_to || null, due_date || null, task_id || null, req.user!.id,
        ]
      );

      await client.query(
        `INSERT INTO activity_logs (project_id, user_id, action, entity_type, entity_id)
         VALUES ($1, $2, 'pin.create', 'pin', $3)`,
        [projectId, req.user!.id, result.rows[0].id]
      );

      return result.rows[0];
    });

    return res.status(201).json({ success: true, data: pin });
  }
);

// ============================================================
// PATCH /:projectId/pins/:pinId/status - Cập nhật trạng thái pin
// ============================================================
router.patch(
  '/:projectId/pins/:pinId/status',
  authenticate,
  authorizeProject(['project_manager', 'member']),
  [body('status').isIn(['open', 'in_progress', 'resolved', 'closed', 'rejected'])],
  async (req: AuthRequest, res: Response) => {
    const { projectId, pinId } = req.params;
    const { status, resolution_note } = req.body;

    const resolvedFields = status === 'resolved'
      ? `, resolved_at = NOW(), resolved_by = '${req.user!.id}'`
      : '';

    const pin = await queryOne(
      `UPDATE pins_reports
       SET status = $1 ${resolvedFields}
       WHERE id = $2 AND project_id = $3
       RETURNING *`,
      [status, pinId, projectId]
    );

    if (!pin) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy pin' });
    }

    return res.json({ success: true, data: pin });
  }
);

export default router;
