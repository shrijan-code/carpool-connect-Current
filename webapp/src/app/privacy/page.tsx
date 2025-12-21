'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

// Navbar Component
function Navbar() {
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    return (
        <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'glass-stronger py-4' : 'py-6'}`}>
            <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center glow">
                        <span className="text-white font-bold text-lg">C</span>
                    </div>
                    <span className="text-xl font-bold text-white group-hover:text-[var(--primary-light)] transition-colors">
                        CarpoolConnect
                    </span>
                </Link>

                <div className="hidden md:flex items-center gap-8">
                    <Link href="/about" className="text-[var(--text-secondary)] hover:text-white transition-colors">About</Link>
                    <Link href="/mission" className="text-[var(--text-secondary)] hover:text-white transition-colors">Our Mission</Link>
                    <Link href="/contact" className="text-[var(--text-secondary)] hover:text-white transition-colors">Contact</Link>
                    <a href="#" className="btn-primary px-6 py-2.5 rounded-full text-white font-semibold">
                        Download App
                    </a>
                </div>
            </div>
        </nav>
    );
}

export default function PrivacyPage() {
    const lastUpdated = 'December 21, 2024';

    return (
        <main className="min-h-screen">
            <Navbar />

            {/* Hero */}
            <section className="relative pt-32 pb-12 overflow-hidden">
                <div className="orb w-[400px] h-[400px] bg-[var(--gradient-1)] -top-20 -left-20" />
                <div className="orb w-[300px] h-[300px] bg-[var(--gradient-4)] top-40 -right-20" />

                <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
                    <h1 className="text-5xl md:text-7xl font-bold mb-6">
                        Privacy <span className="gradient-text">Policy</span>
                    </h1>
                    <p className="text-lg text-[var(--text-secondary)]">
                        Last updated: {lastUpdated}
                    </p>
                </div>
            </section>

            {/* Privacy Policy Content */}
            <section className="py-12">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="glass rounded-3xl p-8 md:p-12 space-y-8">

                        {/* Introduction */}
                        <div className="border-l-4 border-[var(--primary)] pl-6">
                            <p className="text-[var(--text-secondary)] leading-relaxed italic">
                                CarpoolConnect Pty Ltd (&quot;CarpoolConnect,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is a technology
                                company that operates a digital platform connecting drivers and passengers for
                                ride-sharing purposes. We are committed to transparency about how we collect,
                                use, and protect your information.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">1. Who We Are</h2>
                            <div className="text-[var(--text-secondary)] leading-relaxed space-y-3">
                                <p>
                                    CarpoolConnect is a <strong className="text-white">technology platform</strong> that
                                    facilitates connections between users. We are <strong className="text-white">not</strong> a
                                    transportation company, taxi service, or ride-hailing service. We provide the software
                                    infrastructure that enables users to find and arrange shared rides.
                                </p>
                                <p>
                                    <strong className="text-white">Registered Business:</strong> CarpoolConnect Pty Ltd<br />
                                    <strong className="text-white">Location:</strong> Canberra, Australian Capital Territory, Australia<br />
                                    <strong className="text-white">Contact:</strong> privacy@carpoolconnect.com.au
                                </p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>
                            <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                                <p className="font-medium text-white">We collect information transparently and only as necessary to provide our services:</p>

                                <div className="glass rounded-xl p-6 space-y-3">
                                    <p><strong className="text-[var(--primary-light)]">Account Information:</strong> Name, email address, phone number, and profile photo that you provide during registration.</p>
                                    <p><strong className="text-[var(--primary-light)]">Identity Verification (Drivers Only):</strong> Government-issued ID documents processed through Stripe Identity. We require identity verification for all drivers to promote safety.</p>
                                    <p><strong className="text-[var(--primary-light)]">Location Data:</strong> GPS location during active rides, pickup and drop-off coordinates. Location is only collected when you actively use mapping features or during a ride.</p>
                                    <p><strong className="text-[var(--primary-light)]">Payment Information:</strong> Payment card details are collected and processed <strong className="text-white">exclusively by Stripe</strong> (our third-party payment processor). We do not store, process, or have access to your full card numbers.</p>
                                    <p><strong className="text-[var(--primary-light)]">Device Information:</strong> Device type, operating system version, app version, and unique device identifiers for security and troubleshooting.</p>
                                    <p><strong className="text-[var(--primary-light)]">Usage Data:</strong> How you interact with our app, ride history, ratings, and reviews.</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Your Information</h2>
                            <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)] leading-relaxed">
                                <li>To display your profile to other users for ride matching purposes</li>
                                <li>To facilitate communication between drivers and passengers</li>
                                <li>To display pickup/drop-off locations on maps</li>
                                <li>To process payments through Stripe (we do not handle payments directly)</li>
                                <li>To verify driver identities through Stripe Identity</li>
                                <li>To send you important notifications about your rides and account</li>
                                <li>To respond to customer support inquiries</li>
                                <li>To improve our platform and develop new features</li>
                                <li>To comply with legal obligations and prevent fraud</li>
                            </ul>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">4. Third-Party Services & Data Processors</h2>
                            <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                                <p className="font-medium text-white">We use trusted third-party services to operate CarpoolConnect. Each has their own privacy policies:</p>

                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="glass rounded-xl p-4">
                                        <p className="font-bold text-white mb-2">🔥 Firebase (Google)</p>
                                        <p className="text-sm">Authentication, database storage, cloud functions, and push notifications.</p>
                                        <a href="https://firebase.google.com/support/privacy" className="text-[var(--primary-light)] text-sm hover:underline">Privacy Policy →</a>
                                    </div>
                                    <div className="glass rounded-xl p-4">
                                        <p className="font-bold text-white mb-2">💳 Stripe</p>
                                        <p className="text-sm">Payment processing, driver payouts, and identity verification. <strong>All payment data is handled by Stripe.</strong></p>
                                        <a href="https://stripe.com/privacy" className="text-[var(--primary-light)] text-sm hover:underline">Privacy Policy →</a>
                                    </div>
                                    <div className="glass rounded-xl p-4">
                                        <p className="font-bold text-white mb-2">🗺️ Google Maps</p>
                                        <p className="text-sm">Location services, maps display, route calculation, and address search.</p>
                                        <a href="https://policies.google.com/privacy" className="text-[var(--primary-light)] text-sm hover:underline">Privacy Policy →</a>
                                    </div>
                                    <div className="glass rounded-xl p-4">
                                        <p className="font-bold text-white mb-2">📧 Email Services</p>
                                        <p className="text-sm">Transactional emails for ride confirmations, booking updates, and account notifications.</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">5. Information Sharing</h2>
                            <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                                <p className="font-medium text-white">We share your information only in these specific circumstances:</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li><strong className="text-white">Between Users:</strong> Drivers see passenger names and pickup locations. Passengers see driver names, photos, vehicle details, and ratings.</li>
                                    <li><strong className="text-white">Payment Processing:</strong> Transaction details are shared with Stripe to process payments and payouts.</li>
                                    <li><strong className="text-white">Legal Requirements:</strong> We may disclose information if required by law, court order, or government request.</li>
                                    <li><strong className="text-white">Safety Concerns:</strong> We may share information to prevent fraud, protect safety, or respond to emergencies.</li>
                                </ul>
                                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mt-4">
                                    <p className="text-green-400 font-medium">✅ We never sell your personal data to third parties for marketing or advertising purposes.</p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">6. Data Security</h2>
                            <div className="text-[var(--text-secondary)] leading-relaxed space-y-3">
                                <p>We implement industry-standard security measures including:</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>Encryption in transit (TLS/SSL) for all data transmission</li>
                                    <li>Secure cloud infrastructure (Firebase/Google Cloud)</li>
                                    <li>Access controls and authentication requirements</li>
                                    <li>Regular security monitoring</li>
                                </ul>
                                <p className="text-yellow-400 mt-4">
                                    ⚠️ While we strive to protect your data, no method of transmission over the Internet or electronic
                                    storage is 100% secure. We cannot guarantee absolute security.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">7. Data Retention</h2>
                            <div className="text-[var(--text-secondary)] leading-relaxed space-y-3">
                                <ul className="list-disc list-inside space-y-2">
                                    <li><strong className="text-white">Active Accounts:</strong> We retain your data for as long as your account remains active.</li>
                                    <li><strong className="text-white">After Account Deletion:</strong> Personal data is deleted within 30 days of account deletion.</li>
                                    <li><strong className="text-white">Financial Records:</strong> Transaction records may be retained for up to 7 years as required for tax and legal compliance.</li>
                                    <li><strong className="text-white">Safety Reports:</strong> Safety-related reports may be retained longer for legal purposes.</li>
                                </ul>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">8. Your Rights</h2>
                            <div className="text-[var(--text-secondary)] leading-relaxed space-y-3">
                                <p className="font-medium text-white">You have the following rights regarding your personal data:</p>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="glass rounded-xl p-4">
                                        <p className="font-bold text-white">Access</p>
                                        <p className="text-sm">Request a copy of your personal data</p>
                                    </div>
                                    <div className="glass rounded-xl p-4">
                                        <p className="font-bold text-white">Correction</p>
                                        <p className="text-sm">Update or correct inaccurate data</p>
                                    </div>
                                    <div className="glass rounded-xl p-4">
                                        <p className="font-bold text-white">Deletion</p>
                                        <p className="text-sm">Delete your account and associated data via app settings</p>
                                    </div>
                                    <div className="glass rounded-xl p-4">
                                        <p className="font-bold text-white">Portability</p>
                                        <p className="text-sm">Request your data in a portable format</p>
                                    </div>
                                </div>
                                <p className="mt-4">To exercise these rights, use the in-app settings or contact <a href="mailto:privacy@carpoolconnect.com.au" className="text-[var(--primary-light)] hover:underline">privacy@carpoolconnect.com.au</a></p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">9. Children&apos;s Privacy</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                CarpoolConnect is intended for users aged 18 and older. We do not knowingly collect
                                personal information from anyone under 18 years of age. If we become aware that we
                                have collected data from a minor, we will delete it promptly.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">10. International Data Transfers</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                Your data may be processed and stored in Australia and other countries where our
                                service providers operate (including the United States for Firebase/Google and Stripe).
                                By using CarpoolConnect, you consent to such transfers.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">11. Changes to This Policy</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                We may update this Privacy Policy from time to time. We will notify you of significant
                                changes via email or in-app notification. The &quot;Last updated&quot; date at the top indicates
                                when the policy was last revised. Continued use of the app after changes constitutes
                                acceptance of the updated policy.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">12. Contact Us</h2>
                            <div className="glass rounded-xl p-6">
                                <p className="text-white font-bold mb-4">CarpoolConnect Pty Ltd</p>
                                <p className="text-[var(--text-secondary)]">
                                    <strong className="text-white">Privacy Inquiries:</strong> <a href="mailto:privacy@carpoolconnect.com.au" className="text-[var(--primary-light)] hover:underline">privacy@carpoolconnect.com.au</a>
                                </p>
                                <p className="text-[var(--text-secondary)]">
                                    <strong className="text-white">General Support:</strong> <a href="mailto:hello@carpoolconnect.com.au" className="text-[var(--primary-light)] hover:underline">hello@carpoolconnect.com.au</a>
                                </p>
                                <p className="text-[var(--text-secondary)]">
                                    <strong className="text-white">Location:</strong> Canberra, Australian Capital Territory, Australia
                                </p>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/10">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-[var(--text-muted)]">© 2024 CarpoolConnect Pty Ltd. All rights reserved.</p>
                        <div className="flex gap-6">
                            <Link href="/privacy" className="text-white font-medium">Privacy Policy</Link>
                            <Link href="/terms" className="text-[var(--text-secondary)] hover:text-white transition-colors">Terms of Service</Link>
                            <Link href="/contact" className="text-[var(--text-secondary)] hover:text-white transition-colors">Contact</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </main>
    );
}
