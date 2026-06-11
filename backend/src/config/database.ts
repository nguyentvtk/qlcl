// ============================================================
// Cấu hình kết nối PostgreSQL với Connection Pool
// Pool giúp tái sử dụng kết nối thay vì tạo mới mỗi request
// ============================================================
import { Pool, PoolConfig } from 'pg';

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'site360',
  user: process.env.DB_USER || 'site360_user',
  password: process.env.DB_PASSWORD,
  // Giới hạn số kết nối đồng thời (phù hợp với 20 concurrent users)
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  // Đóng kết nối nhàn rỗi sau 30 giây
  idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT || '30000'),
  // Timeout khi chờ kết nối từ pool
  connectionTimeoutMillis: parseInt(process.env.DB_POOL_CONNECTION_TIMEOUT || '2000'),
  // Bật SSL trong production
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

export const pool = new Pool(dbConfig);

// Kiểm tra kết nối khi khởi động
pool.on('connect', () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log('📦 PostgreSQL: Kết nối mới từ pool');
  }
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL Pool Error:', err.message);
});

// Helper function để thực thi query với type safety
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;

  // Log slow queries (> 1 giây) để debug
  if (duration > 1000) {
    console.warn(`⚠️ Slow query (${duration}ms):`, text.substring(0, 100));
  }

  return res.rows as T[];
}

// Helper cho single row query
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

// Transaction helper - đảm bảo atomicity cho các thao tác phức tạp
export async function withTransaction<T>(
  callback: (client: import('pg').PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
