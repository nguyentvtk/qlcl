// GAS HTTP client — gọi qua Vercel Edge Function proxy /api/gas
// Proxy xử lý CORS và forward tới Google Apps Script server-side

// Trong production: gọi /api/gas (relative URL)
// Trong dev local: gọi VITE_GAS_URL trực tiếp (nếu có proxy dev) hoặc dùng mock
const PROXY_URL = '/api/gas';

export type GasResponse<T = unknown> = {
  status: 'success' | 'error';
  data: T | null;
  message: string;
  timestamp: string;
};

function getToken(): string | undefined {
  return localStorage.getItem('gas_token') ?? undefined;
}

async function gasCall<T>(body: Record<string, unknown>): Promise<GasResponse<T>> {
  const token = getToken();
  if (token) body = { token, ...body };

  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  if (typeof json === 'object' && 'status' in json) return json as GasResponse<T>;
  return { status: 'success', data: json as T, message: '', timestamp: new Date().toISOString() };
}

/** Đọc list hoặc get theo sheet/action */
export function gasGet<T>(
  sheet: string,
  action: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<GasResponse<T>> {
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') clean[k] = v;
  }
  return gasCall<T>({ sheet, action, ...clean });
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

/** Login 360 — action 'login_360' của CPM5.0 */
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
