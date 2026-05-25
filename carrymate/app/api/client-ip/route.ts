import { NextResponse } from 'next/server';

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() ?? 'unknown';
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;

  return 'unknown';
}

export async function GET(request: Request): Promise<Response> {
  try {
    const ipAddress = getClientIp(request);
    return NextResponse.json({ ipAddress });
  } catch (error) {
    console.error('Client IP error:', error);
    return NextResponse.json({ error: 'Failed to resolve client IP' }, { status: 500 });
  }
}
