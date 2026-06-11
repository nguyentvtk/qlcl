// GAS HTTP client — dùng chung cho mọi sheet trong Google Spreadsheet
// POST dùng Content-Type: text/plain để tránh CORS preflight với GAS Web App

const GAS_URL = import.meta.env.VITE_GAS_URL ?? '';

export type GasResponse<T = unknown> = {
  status: 'success' | 'error';
  data: T | null;
  message: string;
  timestamp: string;
};

function getToken() {
  return localStorage.getItem('gas_token') ?? undefined;
}

export async function gasGet<T>(
  sheet: string,
  action: string,
  params: Record<string, string | number | boolean | undefined> = {}
): Promise<GasResponse<T>> {
  if (!GAS_URL) throw new Error('VITE_GAS_URL chưa cấu hình trong .env');
  const url = new URL(GAS_URL);
  url.searchParams.set('sheet', sheet);
  url.searchParams.set('action', action);
  const token = getToken();
  if (token) url.searchParams.set('token', token);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function gasPost<T>(
  sheet: string,
  action: string,
  payload: {
    id?: string;
    data?: Record<string, unknown>;
    params?: Record<string, unknown>;
  } = {}
): Promise<GasResponse<T>> {
  if (!GAS_URL) throw new Error('VITE_GAS_URL chưa cấu hình trong .env');
  const token = getToken();
  const body = JSON.stringify({ sheet, action, token, ...payload });
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
