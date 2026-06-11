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

/** Login 360
 *  Thử login_360 trước (cần GAS đã cập nhật);
 *  Nếu GAS chưa có login_360, fallback sang login_tvgs (CPM5.0 gốc).
 */
export async function gasLogin<T>(email: string, password: string): Promise<GasResponse<T>> {
  // Thử login_360 (có token session, không cần hợp đồng)
  const r1 = await gasCall<T>({ action: 'login_360', email, password });
  if (r1.status === 'success') return r1;
  // Nếu GAS chưa có login_360 → fallback login_tvgs
  if (r1.message?.includes("sheet=''") || r1.message?.includes('không hợp lệ')) {
    const r2 = await gasCall<{ maSoDN?: string; tenDN?: string; email?: string; hoTen?: string; role?: string }>(
      { action: 'login_tvgs', identifier: email, password }
    );
    if (r2.status === 'success' && r2.data) {
      // Tạo session token phía frontend (không cần GAS xác thực lần sau)
      const token = btoa(`${email}:${Date.now()}`).replace(/[^a-zA-Z0-9]/g, '').slice(0, 32);
      const expiresAt = new Date(Date.now() + 8 * 3600 * 1000).toISOString();
      const adapted = {
        token,
        email: r2.data.email ?? email,
        tenDN: r2.data.tenDN ?? r2.data.hoTen ?? email,
        maSoDN: r2.data.maSoDN ?? '',
        vaiTro: 'Giám sát' as const,
        duAn360: [],
        expiresAt,
      };
      return { status: 'success', data: adapted as unknown as T, message: 'Đăng nhập thành công', timestamp: new Date().toISOString() };
    }
    return r2 as unknown as GasResponse<T>;
  }
  return r1;
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
