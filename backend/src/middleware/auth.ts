// ============================================================
// Auth Middleware: Xác thực JWT và phân quyền RBAC theo Project
// ============================================================
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, JWTPayload, ProjectRole } from '../types';
import { queryOne } from '../config/database';

// ============================================================
// 1. Xác thực JWT Access Token
// ============================================================
export async function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Lấy token từ header Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Không tìm thấy token xác thực' });
      return;
    }

    const token = authHeader.substring(7); // Bỏ "Bearer "
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error('JWT_ACCESS_SECRET chưa được cấu hình');

    // Verify và decode token
    const payload = jwt.verify(token, secret) as JWTPayload;

    // Kiểm tra user còn active trong DB (tránh token hợp lệ của user đã bị vô hiệu hóa)
    const user = await queryOne<{ id: string; is_active: boolean }>(
      'SELECT id, is_active FROM users WHERE id = $1',
      [payload.userId]
    );

    if (!user || !user.is_active) {
      res.status(401).json({ success: false, error: 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa' });
      return;
    }

    // Gắn thông tin user vào request để các handler tiếp theo sử dụng
    req.user = {
      id: payload.userId,
      email: payload.email,
      systemRole: payload.systemRole,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, error: 'Token đã hết hạn, vui lòng đăng nhập lại' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, error: 'Token không hợp lệ' });
      return;
    }
    next(error);
  }
}

// ============================================================
// 2. Kiểm tra quyền trong Project cụ thể (Project-based RBAC)
// Dùng: authorize(['project_manager', 'member']) để cho phép 2 role trên
// ============================================================
export function authorizeProject(allowedRoles: ProjectRole[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ success: false, error: 'Chưa xác thực' });
        return;
      }

      // Admin hệ thống có quyền truy cập mọi project
      if (req.user.systemRole === 'admin') {
        req.user.projectRole = 'project_manager';
        next();
        return;
      }

      // Lấy projectId từ URL params hoặc body
      const projectId = req.params.projectId || req.body.project_id || req.query.projectId;
      if (!projectId) {
        res.status(400).json({ success: false, error: 'Thiếu project_id' });
        return;
      }

      // Kiểm tra membership và role trong project
      const membership = await queryOne<{ role: ProjectRole }>(
        `SELECT role FROM project_members
         WHERE project_id = $1 AND user_id = $2`,
        [projectId, req.user.id]
      );

      if (!membership) {
        // Kiểm tra xem user có phải owner không
        const project = await queryOne<{ owner_id: string }>(
          'SELECT owner_id FROM projects WHERE id = $1',
          [projectId]
        );

        if (!project || project.owner_id !== req.user.id) {
          res.status(403).json({ success: false, error: 'Bạn không có quyền truy cập dự án này' });
          return;
        }
        req.user.projectRole = 'project_manager';
      } else {
        req.user.projectRole = membership.role;
      }

      // Kiểm tra role có đủ quyền không
      if (!allowedRoles.includes(req.user.projectRole)) {
        res.status(403).json({
          success: false,
          error: `Bạn cần quyền ${allowedRoles.join(' hoặc ')} để thực hiện thao tác này`
        });
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

// ============================================================
// 3. Kiểm tra quyền System Admin
// ============================================================
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.systemRole !== 'admin') {
    res.status(403).json({ success: false, error: 'Chỉ quản trị viên hệ thống mới có quyền thực hiện' });
    return;
  }
  next();
}

// ============================================================
// 4. Optional Auth - Không bắt buộc đăng nhập (cho public endpoints)
// ============================================================
export async function optionalAuthenticate(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const secret = process.env.JWT_ACCESS_SECRET!;
      const payload = jwt.verify(token, secret) as JWTPayload;
      req.user = {
        id: payload.userId,
        email: payload.email,
        systemRole: payload.systemRole,
      };
    } catch {
      // Ignore invalid token cho optional auth
    }
  }
  next();
}
