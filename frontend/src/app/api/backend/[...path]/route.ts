import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'smart_ticket_session';
const noStore = { 'Cache-Control': 'no-store' };

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const route = path.join('/');
  const allowed = /^(health|predict|analytics|auth\/(login|logout|me)|tickets(\/[a-f0-9-]{36})?)$/.test(route);
  if (!allowed) return NextResponse.json({ detail: 'Not found' }, { status: 404, headers: noStore });
  if (request.method !== 'GET') {
    const expectedOrigin = process.env.APP_ORIGIN || request.nextUrl.origin;
    if (request.headers.get('origin') !== expectedOrigin) {
      return NextResponse.json({ detail: 'Invalid request origin' }, { status: 403, headers: noStore });
    }
  }
  const backend = process.env.API_URL;
  if (!backend) return NextResponse.json({ detail: 'Backend not configured' }, { status: 503, headers: noStore });
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const body = ['GET', 'DELETE'].includes(request.method) ? undefined : await request.text();
    if (body && Buffer.byteLength(body) > 32768) {
      return NextResponse.json({ detail: 'Request too large' }, { status: 413, headers: noStore });
    }
    const upstream = await fetch(`${backend.replace(/\/$/, '')}/${route}${request.nextUrl.search}`, {
      method: request.method, headers, body, cache: 'no-store', redirect: 'manual',
      signal: AbortSignal.timeout(60000),
    });
    if (upstream.status === 401) store.delete(COOKIE);
    if (route === 'auth/logout' && upstream.ok) store.delete(COOKIE);
    if (upstream.status === 204) return new NextResponse(null, { status: 204, headers: noStore });
    const data = await upstream.json();
    if (route === 'auth/login' && upstream.ok) {
      store.set(COOKIE, data.access_token, {
        httpOnly: true, secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict', path: '/', maxAge: data.expires_in,
      });
      return NextResponse.json({ authenticated: true }, { headers: noStore });
    }
    // Unexpected backend failures must not expose internal error details.
    if (upstream.status >= 500) return NextResponse.json({ detail: 'Backend unavailable' }, { status: 502, headers: noStore });
    return NextResponse.json(data, { status: upstream.status, headers: noStore });
  } catch {
    return NextResponse.json({ detail: 'Cannot connect to the API. It may be starting; try again shortly.' }, { status: 502, headers: noStore });
  }
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
