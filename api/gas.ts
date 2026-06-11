// Vercel Edge Function — proxy GAS API
// Giải quyết CORS: frontend gọi /api/gas, Edge Function forward tới GAS server-side

export const config = { runtime: 'edge' };

const GAS_URL = process.env.VITE_GAS_URL ?? '';

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', message: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!GAS_URL) {
    return new Response(JSON.stringify({ status: 'error', message: 'GAS URL chưa cấu hình' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.text();

    const gasRes = await fetch(GAS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body,
      redirect: 'follow',
    });

    const text = await gasRes.text();

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        return new Response(
          JSON.stringify({
            status: 'error',
            message: 'GAS Web App yêu cầu cấu hình "Anyone, even anonymous".',
            data: null,
            timestamp: new Date().toISOString(),
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
          }
        );
      }
      throw new Error('GAS trả response không hợp lệ');
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return new Response(
      JSON.stringify({ status: 'error', message: msg, data: null, timestamp: new Date().toISOString() }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}
