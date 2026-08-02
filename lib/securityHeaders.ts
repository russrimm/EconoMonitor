export interface SecurityHeader {
  key: string;
  value: string;
}

export function buildSecurityHeaders(isProduction: boolean): SecurityHeader[] {
  const contentSecurityPolicy = [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'" + (isProduction ? '' : ' http: ws:'),
    "font-src 'self' data:",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline'" + (isProduction ? '' : " 'unsafe-eval'"),
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:",
    ...(isProduction ? ['upgrade-insecure-requests'] : []),
  ].join('; ');

  const headers: SecurityHeader[] = [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy },
    { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
  ];

  if (isProduction) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    });
  }

  return headers;
}
