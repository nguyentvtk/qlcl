// ============================================================
// Auth Routes: Đăng ký, đăng nhập, refresh token, đăng xuất
// ============================================================
import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, queryOne } from '../config/database';
import { authenticate } from '../middleware/auth';
import { AuthRequest, JWTPayload, User } from '../types';

const router = Router();

// Số vòng bcrypt - 12 là cân bằng tốt giữa bảo mật và tốc độ
const BCRYPT_ROUNDS = 12;

// Helper tạo JWT Access Token (tồn tại ngắn - 15 phút)
function generateAccessToken(user: Pick<User, 'id' | 'email' | 'system_role'>): string {
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    systemRole: user.system_role,
  };
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
}

// Helper tạo JWT Refresh Token (tồn tại dài - 7 ngày)
function generateRefreshToken(): string {
  // Dùng crypto để tạo random token thay vì JWT (bảo mật hơn cho refresh)
  return crypto.randomBytes(64).toString('hex');
}

// ============================================================
// POST /auth/register - Đăng ký tài khoản mới
// ============================================================
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail().withMessage('Email không hợp lệ'),
    body('password')
      .isLength({ min: 8 })
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số'),
    body('full_name').trim().isLength({ min: 2, max: 255 }).withMessage('Họ tên từ 2-255 ký tự'),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: errors.array()[0].msg });
    }

    const { email, password, full_name } = req.body;

    // Kiểm tra email đã tồn tại
    const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email]);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email đã được sử dụng' });
    }

    // Hash mật khẩu
    const password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const [user] = await query<User>(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3)
       RETURNING id, email, full_name, system_role, created_at`,
      [email, password_hash, full_name]
    );

    return res.status(201).json({
      success: true,
      data: { id: user.id, email: user.email, full_name: user.full_name },
      message: 'Đăng ký thành công',
    });
  }
);

// ============================================================
// POST /auth/login - Đăng nhập
// ============================================================
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, error: 'Thông tin đăng nhập không hợp lệ' });
    }

    const { email, password } = req.body;

    // Tìm user
    const user = await queryOne<User>(
      'SELECT * FROM users WHERE email = $1 AND is_active = TRUE',
      [email]
    );

    // Dùng thời gian cố định để tránh timing attack
    const dummyHash = '$2b$12$invalidhashfortimingprotection00000000000000000000000000';
    const hashToCompare = user ? user.password_hash : dummyHash;
    const isValid = await bcrypt.compare(password, hashToCompare);

    if (!user || !isValid) {
      return res.status(401).json({ success: false, error: 'Email hoặc mật khẩu không đúng' });
    }

    // Tạo tokens
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    // Lưu refresh token (hash) vào DB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ngày
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5::inet)`,
      [user.id, refreshTokenHash, expiresAt, req.headers['user-agent'] || '', req.ip]
    );

    // Cập nhật last_login
    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    // Set refresh token trong HTTP-only cookie (bảo mật hơn localStorage)
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          system_role: user.system_role,
          avatar_url: user.avatar_url,
        },
      },
    });
  }
);

// ============================================================
// POST /auth/refresh - Cấp lại Access Token bằng Refresh Token
// ============================================================
router.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ success: false, error: 'Refresh token không tìm thấy' });
  }

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

  // Tìm và validate refresh token
  const storedToken = await queryOne<{
    user_id: string; expires_at: Date; is_revoked: boolean;
  }>(
    `SELECT rt.user_id, rt.expires_at, rt.is_revoked
     FROM refresh_tokens rt
     WHERE rt.token_hash = $1`,
    [tokenHash]
  );

  if (!storedToken || storedToken.is_revoked || new Date() > new Date(storedToken.expires_at)) {
    res.clearCookie('refreshToken');
    return res.status(401).json({ success: false, error: 'Refresh token không hợp lệ hoặc đã hết hạn' });
  }

  // Lấy thông tin user
  const user = await queryOne<User>(
    'SELECT id, email, system_role FROM users WHERE id = $1 AND is_active = TRUE',
    [storedToken.user_id]
  );

  if (!user) {
    return res.status(401).json({ success: false, error: 'Người dùng không tồn tại' });
  }

  // Tạo access token mới
  const newAccessToken = generateAccessToken(user);

  return res.json({ success: true, data: { accessToken: newAccessToken } });
});

// ============================================================
// POST /auth/logout - Đăng xuất (thu hồi refresh token)
// ============================================================
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;

  if (refreshToken) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    // Đánh dấu token là đã thu hồi
    await query(
      'UPDATE refresh_tokens SET is_revoked = TRUE WHERE token_hash = $1',
      [tokenHash]
    );
  }

  res.clearCookie('refreshToken');
  return res.json({ success: true, message: 'Đăng xuất thành công' });
});

// ============================================================
// GET /auth/me - Lấy thông tin user hiện tại
// ============================================================
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await queryOne(
    `SELECT id, email, full_name, system_role, avatar_url, last_login, created_at
     FROM users WHERE id = $1`,
    [req.user!.id]
  );

  return res.json({ success: true, data: user });
});

export default router;
