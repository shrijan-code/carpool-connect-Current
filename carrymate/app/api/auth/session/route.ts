import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

const SESSION_EXPIRY_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

interface SessionBody {
  idToken: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as SessionBody;

    if (!body.idToken) {
      return NextResponse.json({ error: 'idToken is required' }, { status: 400 });
    }

    const sessionCookie = await getAdminAuth().createSessionCookie(body.idToken, {
      expiresIn: SESSION_EXPIRY_MS,
    });

    const response = NextResponse.json({ success: true });

    response.cookies.set('__session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_EXPIRY_MS / 1000,
    });

    return response;
  } catch (error) {
    console.error('Session create error:', error);
    return NextResponse.json({ error: 'Invalid or expired ID token' }, { status: 401 });
  }
}

export async function DELETE(): Promise<Response> {
  try {
    const response = NextResponse.json({ success: true });

    response.cookies.set('__session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('Session delete error:', error);
    return NextResponse.json({ error: 'Failed to clear session' }, { status: 500 });
  }
}
