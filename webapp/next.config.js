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
                        ].join('; ')
                    },
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
                    { key: 'X-XSS-Protection', value: '1; mode=block' },
                ],
            },
        ]
    },
}

module.exports = nextConfig
