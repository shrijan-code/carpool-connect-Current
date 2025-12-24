/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    env: {
        NEXT_PUBLIC_APP_NAME: 'CarpoolConnect Admin',
    },
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        // Note: Next.js requires 'unsafe-inline' and 'unsafe-eval' for proper operation
                        // To fully remove these, you need to implement CSP nonces via middleware
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                            "img-src 'self' data: https: blob:",
                            "font-src 'self' https://fonts.gstatic.com",
                            "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com wss://*.firebaseio.com https://*.cloudfunctions.net",
                            "frame-src 'none'",
                            "object-src 'none'",
                            "base-uri 'self'",
                            "form-action 'self'",
                            "frame-ancestors 'none'",
                            "upgrade-insecure-requests",
                        ].join('; ')
                    },
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                    { key: 'X-XSS-Protection', value: '1; mode=block' },
                    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
                    // Strict CORS for admin - same-origin only
                    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
                    { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
                    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
                ],
            },
        ]
    },
}

module.exports = nextConfig
