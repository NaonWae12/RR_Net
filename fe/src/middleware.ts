import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function toCspOrigin(urlOrOrigin: string): string {
  try {
    // If it's already an origin (no path), URL() still works.
    return new URL(urlOrOrigin).origin;
  } catch {
    // Fallback: assume it's already a valid CSP source expression (e.g. "https://api.example.com")
    return urlOrOrigin;
  }
}

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-DNS-Prefetch-Control', 'on');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  // Content Security Policy
  const isDevelopment = process.env.NODE_ENV === 'development';
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
  const backendOrigin = toCspOrigin(backendUrl);
  const osrmUrl = process.env.NEXT_PUBLIC_OSRM_URL || 'https://router.project-osrm.org';
  const osrmOrigin = toCspOrigin(osrmUrl);
  
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    // Leaflet tiles are loaded as <img>. Allow https tiles and data URLs.
    // Some browsers/extensions may use blob URLs for image resources; allow blob: to avoid blank tiles.
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    // Allow backend + OSRM connection (dev: localhost, prod: configured origins)
    isDevelopment
      ? `connect-src 'self' ${backendOrigin} ${osrmOrigin} http://localhost:8080 http://localhost:9500 ws://localhost:*`
      : `connect-src 'self' ${backendOrigin} ${osrmOrigin}`,
    "frame-ancestors 'self'",
  ].join('; ');

  response.headers.set('Content-Security-Policy', csp);

  // Strict Transport Security (only in production with HTTPS)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

