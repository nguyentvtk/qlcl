// GAS HTTP client — CPM5.0 API
// doGet trả HTML → dùng POST cho TẤT CẢ requests (kể cả reads)
// text/plain để tránh CORS preflight với GAS Web App

const GAS_URL = import.meta.env.VITE_GAS_URL ?? '';

export type GasResponse<T = unknown> = {
  status: 'success' | 'error';
  data: T | null;
  message: string;
  timestamp: string;
};

function getToken(): string | undefined {
  return localStorage.getItem('gas_token') ?? undefined;
}

// ─── Internal POST helper ─────────────────────────────────────────────────────
async function gasCall<T>(body: Record<string, unknown>): Promise<GasResponse<T>> {
  if (!GAS_URL) throw new Error('VITE_GAS_URL chưa cấu hình trong .env');
  const token = getToken();
  if (token) body = { token, ...body };
  const res = await fetch(GAS_URL, {
    method: 'POST',
    // text/plain tránh CORS preflight với GAS — body vẫn là JSON string
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  // Chuẩn hoá response: {status, data, message, timestamp}
  if (typeof json === 'object' && 'status' in json) return json as GasResponse<T>;
  // Fallback nếu CPM5.0 trả format khác
  return { status: 'success', data: json as T, message: '', timestamp: new Date().toISOString() };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Đọc danh sách (list) hoặc một bản ghi (get) */
export function gasGet<T>(
  sheet: string,
  action: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<GasResponse<T>> {
  const cleanParams: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') cleanParams[k] = v;
  }
  return gasCall<T>({ sheet, action, ...cleanParams });
}

/** Ghi (create/update/delete) hoặc action đặc biệt */
export function gasPost<T>(
  sheet: string,
  action: string,
  payload: {
    id?: string;
    data?: Record<string, unknown>;
    params?: Record<string, unknown>;
  } = {}
): Promise<GasResponse<T>> {
  return gasCall<T>({ sheet, action, ...payload });
}

/** Login 360 — dùng action 'login_360' của CPM5.0 */
export function gasLogin<T>(email: string, password: string): Promise<GasResponse<T>> {
  return gasCall<T>({ action: 'login_360', email, password });
}

/** Logout 360 */
export function gasLogout(): Promise<GasResponse<null>> {
  const token = getToken();
  return gasCall<null>({ action: 'logout_360', token: token ?? '' });
}

/** Batch load nhiều sheets cùng lúc */
export function gasBatchList<T>(sheets: string[]): Promise<GasResponse<T>> {
  return gasCall<T>({ action: 'batch_list', sheets });
}
