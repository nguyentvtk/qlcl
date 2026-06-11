// ============================================================
// SITE360 Backend - Entry Point
// ============================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { pool } from './config/database';

// Import routes
import authRoutes from './routes/auth';
import photosRoutes from './routes/photos';
import tasksRoutes from './routes/tasks';
import pinsRoutes from './routes/pins';
import mediaStorageRoutes from './services/mediaStorage';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// ============================================================
// PHẦN 5: BẢO MẬT - Cấu hình Security Headers
// ============================================================

// Helmet: tự động set các HTTP header bảo mật
// Bao gồm: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS, v.v.
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // Cho phép serve ảnh từ domain khác
  contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false, // Tắt CSP khi dev
}));

// CORS: chỉ cho phép domain được whitelist kết nối
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Cho phép requests không có origin (mobile app, Postman, server-to-server)
    if (!origin || corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} không được phép`));
    }
  },
  credentials: true, // Cho phép gửi cookies (refresh token)
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-Total-Count'],
}));

// Rate Limiting: chống brute force và DDoS
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 phút
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Quá nhiều request, vui lòng thử lại sau' },
});

// Rate limit chặt hơn cho auth endpoints (chống brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 10, // Tối đa 10 lần đăng nhập sai
  message: { success: false, error: 'Quá nhiều lần thử đăng nhập, vui lòng thử lại sau 15 phút' },
});

app.use(limiter);

// Parse JSON body (giới hạn 10MB để tránh payload bombing)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files (ảnh upload)
// Trong production nên dùng Nginx hoặc CDN thay vì Express serve trực tiếp
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  maxAge: '1d', // Cache ảnh trong 1 ngày
  etag: true,
}));

// ============================================================
// ROUTES
// ============================================================
app.use(`${API_PREFIX}/auth`, authLimiter, authRoutes);
app.use(`${API_PREFIX}/projects`, photosRoutes);
app.use(`${API_PREFIX}/projects`, tasksRoutes);
app.use(`${API_PREFIX}/projects`, pinsRoutes);
app.use(`${API_PREFIX}/projects`, mediaStorageRoutes);

// Health check endpoint
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date().toISOString(), db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ============================================================
// Global Error Handler
// ============================================================
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('❌ Unhandled Error:', err.message);

  // Không expose stack trace trong production
  const message = process.env.NODE_ENV === 'production'
    ? 'Đã xảy ra lỗi nội bộ'
    : err.message;

  // Lỗi Multer file upload
  if (err.message.includes('File too large')) {
    return res.status(413).json({ success: false, error: `File quá lớn (tối đa ${process.env.MAX_FILE_SIZE_MB || 100}MB)` });
  }

  res.status(500).json({ success: false, error: message });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint không tồn tại' });
});

// ============================================================
// Khởi động server
// ============================================================
app.listen(PORT, () => {
  console.log(`
🚀 Site360 Backend đang chạy!
   URL: http://localhost:${PORT}
   API: http://localhost:${PORT}${API_PREFIX}
   Môi trường: ${process.env.NODE_ENV || 'development'}
  `);
});

export default app;
