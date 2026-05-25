import { NextResponse, type NextRequest } from 'next/server';

const protectedRoutes = ['/dashboard', '/trips/new', '/bookings', '/profile', '/emergency'];
const authRoutes = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get('__session')?.value;
  const adminToken = request.cookies.get('admin_token')?.value;

  if (pathname.startsWith('/admin')) {
    if (!adminToken && pathname !== '/admin/login') {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    return NextResponse.next();
  }

  const isProtected = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isProtected && !session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/trips/new',
    '/bookings/:path*',
    '/profile/:path*',
    '/emergency',
    '/login',
    '/register',
    '/admin/:path*',
  ],
};
