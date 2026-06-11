// ============================================================
// Tasks API: CRUD công việc cho Kanban Board và Gantt Chart
// ============================================================
import { Router, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { authenticate, authorizeProject } from '../middleware/auth';
import { AuthRequest, Task, TaskStatus } from '../types';
import { query, queryOne, withTransaction } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ============================================================
// GET /:projectId/tasks - Lấy danh sách task (Kanban + Gantt)
// ============================================================
router.get(
  '/:projectId/tasks',
  authenticate,
  authorizeProject(['project_manager', 'member', 'viewer']),
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;
    const { view = 'kanban', status, assigned_to } = req.query as Record<string, string>;

    const conditions: string[] = ['t.project_id = $1'];
    const params: unknown[] = [projectId];
    let pidx = 2;

    if (status) {
      conditions.push(`t.status = $${pidx++}`);
      params.push(status);
    }

    if (assigned_to) {
      conditions.push(`t.assigned_to = $${pidx++}`);
      params.push(assigned_to);
    }

    const whereClause = conditions.join(' AND ');

    // Kanban view: nhóm theo status, sắp xếp theo kanban_order
    // Gantt view: sắp xếp theo start_date (cần đầy đủ date info)
    const orderBy = view === 'gantt'
      ? 'ORDER BY t.start_date ASC NULLS LAST, t.created_at ASC'
      : 'ORDER BY t.status, t.kanban_order ASC, t.created_at DESC';

    const tasks = await query<Task>(
      `SELECT t.*,
        u_assigned.full_name AS assignee_name,
        u_assigned.avatar_url AS assignee_avatar,
        u_creator.full_name AS creator_name,
        z.name AS zone_name,
        -- Đếm số pin liên quan
        COUNT(DISTINCT pr.id) AS pin_count
       FROM tasks t
       LEFT JOIN users u_assigned ON u_assigned.id = t.assigned_to
       LEFT JOIN users u_creator ON u_creator.id = t.created_by
       LEFT JOIN zones z ON z.id = t.zone_id
       LEFT JOIN pins_reports pr ON pr.task_id = t.id
       WHERE ${whereClause}
       GROUP BY t.id, u_assigned.full_name, u_assigned.avatar_url, u_creator.full_name, z.name
       ${orderBy}`,
      params
    );

    // Với Kanban view, nhóm tasks theo status columns
    if (view === 'kanban') {
      const columns: Record<TaskStatus, Task[]> = {
        todo: [], doing: [], review: [], done: [], blocked: [],
      };
      tasks.forEach((task) => {
        const col = task.status as TaskStatus;
        if (columns[col]) columns[col].push(task);
      });
      return res.json({ success: true, data: { columns, tasks } });
    }

    return res.json({ success: true, data: tasks });
  }
);

// ============================================================
// POST /:projectId/tasks - Tạo task mới
// ============================================================
router.post(
  '/:projectId/tasks',
  authenticate,
  authorizeProject(['project_manager', 'member']),
  [
    body('title').trim().isLength({ min: 1, max: 255 }).withMessage('Tiêu đề không được để trống'),
    body('description').optional().trim(),
    body('status').optional().isIn(['todo', 'doing', 'review', 'done', 'blocked']),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('start_date').optional().isDate(),
    body('end_date').optional().isDate(),
    body('progress').optional().isInt({ min: 0, max: 100 }),
    body('dependencies').optional().isArray(),
    body('zone_id').optional().isUUID(),
    body('assigned_to').optional().isUUID(),
    body('tags').optional().isArray(),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { projectId } = req.params;
    const {
      title, description, status = 'todo', priority = 'medium',
      start_date, end_date, progress = 0, dependencies = [],
      zone_id, assigned_to, tags = [], color = '#3B82F6'
    } = req.body;

    // Lấy kanban_order cao nhất trong cột status đó
    const maxOrder = await queryOne<{ max_order: number }>(
      `SELECT COALESCE(MAX(kanban_order), 0) + 1 AS max_order
       FROM tasks WHERE project_id = $1 AND status = $2`,
      [projectId, status]
    );

    const task = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO tasks
           (id, project_id, title, description, status, priority, start_date, end_date,
            progress, dependencies, zone_id, assigned_to, created_by, kanban_order, color, tags)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         RETURNING *`,
        [
          uuidv4(), projectId, title, description || null,
          status, priority, start_date || null, end_date || null,
          progress, JSON.stringify(dependencies),
          zone_id || null, assigned_to || null, req.user!.id,
          maxOrder?.max_order || 1, color, JSON.stringify(tags),
        ]
      );

      await client.query(
        `INSERT INTO activity_logs (project_id, user_id, action, entity_type, entity_id)
         VALUES ($1, $2, 'task.create', 'task', $3)`,
        [projectId, req.user!.id, result.rows[0].id]
      );

      return result.rows[0];
    });

    return res.status(201).json({ success: true, data: task });
  }
);

// ============================================================
// PATCH /:projectId/tasks/:taskId - Cập nhật task (Kanban kéo thả / chỉnh sửa)
// ============================================================
router.patch(
  '/:projectId/tasks/:taskId',
  authenticate,
  authorizeProject(['project_manager', 'member']),
  async (req: AuthRequest, res: Response) => {
    const { projectId, taskId } = req.params;

    // Chỉ cho phép cập nhật các field được phép
    const allowedFields: (keyof Task)[] = [
      'title', 'description', 'status', 'priority',
      'start_date', 'end_date', 'progress', 'dependencies',
      'zone_id', 'assigned_to', 'kanban_order', 'color', 'tags', 'photo_evidence',
    ];

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIdx++}`);
        // Serialize arrays/objects sang JSON
        const val = req.body[field];
        values.push(Array.isArray(val) || typeof val === 'object' ? JSON.stringify(val) : val);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'Không có field nào để cập nhật' });
    }

    // Khi status chuyển sang 'done', cập nhật completed_at
    if (req.body.status === 'done') {
      updates.push(`completed_at = NOW()`);
    } else if (req.body.status && req.body.status !== 'done') {
      updates.push(`completed_at = NULL`);
    }

    values.push(taskId, projectId);

    const task = await withTransaction(async (client) => {
      // Lấy trạng thái cũ để log
      const old = await client.query('SELECT status FROM tasks WHERE id = $1', [taskId]);
      const oldStatus = old.rows[0]?.status;

      const result = await client.query(
        `UPDATE tasks SET ${updates.join(', ')}
         WHERE id = $${paramIdx} AND project_id = $${paramIdx + 1}
         RETURNING *`,
        values
      );

      if (result.rows.length === 0) {
        throw new Error('NOT_FOUND');
      }

      // Log thay đổi status (hữu ích cho audit)
      if (req.body.status && req.body.status !== oldStatus) {
        await client.query(
          `INSERT INTO activity_logs (project_id, user_id, action, entity_type, entity_id, metadata)
           VALUES ($1, $2, 'task.status_change', 'task', $3, $4)`,
          [projectId, req.user!.id, taskId, JSON.stringify({ from: oldStatus, to: req.body.status })]
        );
      }

      return result.rows[0];
    });

    return res.json({ success: true, data: task });
  }
);

// ============================================================
// POST /:projectId/tasks/reorder - Cập nhật thứ tự Kanban khi kéo thả
// Gọi sau khi user drop task vào vị trí mới
// ============================================================
router.post(
  '/:projectId/tasks/reorder',
  authenticate,
  authorizeProject(['project_manager', 'member']),
  [
    body('updates').isArray().withMessage('updates phải là mảng'),
    body('updates.*.id').isUUID(),
    body('updates.*.status').isIn(['todo', 'doing', 'review', 'done', 'blocked']),
    body('updates.*.kanban_order').isInt({ min: 0 }),
  ],
  async (req: AuthRequest, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { projectId } = req.params;
    const { updates } = req.body as {
      updates: Array<{ id: string; status: TaskStatus; kanban_order: number }>;
    };

    // Cập nhật tất cả trong 1 transaction để đảm bảo nhất quán
    await withTransaction(async (client) => {
      for (const update of updates) {
        await client.query(
          `UPDATE tasks SET status = $1, kanban_order = $2
           WHERE id = $3 AND project_id = $4`,
          [update.status, update.kanban_order, update.id, projectId]
        );
      }
    });

    return res.json({ success: true, message: `Đã cập nhật thứ tự ${updates.length} task` });
  }
);

// ============================================================
// GET /:projectId/tasks/gantt - Dữ liệu tối ưu cho Gantt Chart
// ============================================================
router.get(
  '/:projectId/tasks/gantt',
  authenticate,
  authorizeProject(['project_manager', 'member', 'viewer']),
  async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;
    const { start, end } = req.query as Record<string, string>;

    let dateFilter = '';
    const params: unknown[] = [projectId];

    // Lọc theo khoảng thời gian hiển thị Gantt
    if (start && end) {
      dateFilter = `AND (t.start_date <= $3 AND (t.end_date >= $2 OR t.end_date IS NULL))`;
      params.push(start, end);
    }

    const tasks = await query(
      `SELECT
        t.id, t.title, t.status, t.priority, t.color,
        t.start_date, t.end_date, t.progress, t.dependencies,
        t.assigned_to, u.full_name AS assignee_name,
        z.name AS zone_name,
        -- Tính duration (ngày)
        CASE WHEN t.start_date IS NOT NULL AND t.end_date IS NOT NULL
          THEN (t.end_date - t.start_date) + 1
          ELSE NULL
        END AS duration_days
       FROM tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       LEFT JOIN zones z ON z.id = t.zone_id
       WHERE t.project_id = $1 ${dateFilter}
       ORDER BY t.start_date ASC NULLS LAST, t.created_at ASC`,
      params
    );

    return res.json({ success: true, data: tasks });
  }
);

// ============================================================
// DELETE /:projectId/tasks/:taskId - Xóa task
// ============================================================
router.delete(
  '/:projectId/tasks/:taskId',
  authenticate,
  authorizeProject(['project_manager']),
  async (req: AuthRequest, res: Response) => {
    const { projectId, taskId } = req.params;

    const result = await query(
      'DELETE FROM tasks WHERE id = $1 AND project_id = $2 RETURNING id',
      [taskId, projectId]
    );

    if (result.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy task' });
    }

    return res.json({ success: true, message: 'Đã xóa task thành công' });
  }
);

export default router;
