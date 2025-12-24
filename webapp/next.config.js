/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async headers() {
        return [
            {
                source: '/(.*)',
                headers: [
                    {
                        key: 'Content-Security-Policy',
                        // Note: Next.js requires 'unsafe-inline' and 'unsafe-eval' for proper operation
                        // To fully remove these, you need to implement CSP nonces via middleware
                        // See: https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
                        value: [
                            "default-src 'self'",
                            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://www.googletagmanager.com",
                            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                            "img-src 'self' data: https: blob:",
                            "font-src 'self' https://fonts.gstatic.com",
                            "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://api.stripe.com wss://*.firebaseio.com https://*.cloudfunctions.net",
                            "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
                            "object-src 'none'",
                            "base-uri 'self'",
                            "form-action 'self'",
                            "upgrade-insecure-requests",
                        ].join('; ')
                    },
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                    { key: 'X-XSS-Protection', value: '1; mode=block' },
                    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
                    // Restrict CORS - only allow same-origin requests by default
                    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
                    { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
                    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
                ],
            },
            // API routes - allow controlled CORS for specific endpoints
            {
                source: '/api/:path*',
                headers: [
                    { key: 'Access-Control-Allow-Origin', value: 'https://carpoolconnect.au' },
                    { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
                    { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
                ],
            },
        ]
    },
}

module.exports = nextConfig
