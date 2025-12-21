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

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                CarpoolConnect (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy.
                                This Privacy Policy explains how we collect, use, disclose, and safeguard your
                                information when you use our mobile application and related services.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>
                            <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                                <p><strong className="text-white">Personal Information:</strong> Name, email address, phone number, profile photo, and identity verification documents.</p>
                                <p><strong className="text-white">Location Data:</strong> Real-time location during rides, pickup and drop-off locations, and route information.</p>
                                <p><strong className="text-white">Payment Information:</strong> Payment card details (processed securely by Stripe), transaction history, and payout information for drivers.</p>
                                <p><strong className="text-white">Device Information:</strong> Device type, operating system, unique device identifiers, and mobile network information.</p>
                                <p><strong className="text-white">Usage Data:</strong> App interactions, ride history, ratings, reviews, and communication preferences.</p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">3. How We Use Your Information</h2>
                            <ul className="list-disc list-inside space-y-2 text-[var(--text-secondary)] leading-relaxed">
                                <li>To facilitate ride matching between drivers and passengers</li>
                                <li>To process payments and driver payouts</li>
                                <li>To verify user identities and ensure safety</li>
                                <li>To provide customer support and respond to inquiries</li>
                                <li>To send important notifications about your rides and account</li>
                                <li>To improve our services and develop new features</li>
                                <li>To comply with legal obligations</li>
                            </ul>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">4. Third-Party Services</h2>
                            <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                                <p>We use the following third-party services to operate CarpoolConnect:</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li><strong className="text-white">Firebase (Google):</strong> Authentication, database, and cloud functions</li>
                                    <li><strong className="text-white">Stripe:</strong> Payment processing and driver payouts</li>
                                    <li><strong className="text-white">Google Maps:</strong> Location services and route calculation</li>
                                    <li><strong className="text-white">Stripe Identity:</strong> Identity verification for drivers</li>
                                </ul>
                                <p>Each of these services has their own privacy policies governing the use of your data.</p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">5. Data Sharing</h2>
                            <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                                <p>We share your information in the following circumstances:</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>With other users as necessary to facilitate rides (e.g., drivers see passenger names and pickup locations)</li>
                                    <li>With payment processors to complete transactions</li>
                                    <li>With law enforcement when required by law</li>
                                    <li>To protect the safety of our users</li>
                                </ul>
                                <p className="font-medium text-white">We never sell your personal data to third parties for marketing purposes.</p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">6. Data Retention</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                We retain your personal data for as long as your account is active. If you delete
                                your account, we will delete your personal data within 30 days, except where we
                                are required to retain certain information for legal, tax, or regulatory purposes
                                (typically up to 7 years for financial records).
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">7. Data Security</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                We implement industry-standard security measures to protect your data, including
                                encryption in transit (TLS/SSL), secure data storage, access controls, and
                                regular security audits. However, no method of transmission over the Internet
                                is 100% secure.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">8. Your Rights</h2>
                            <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                                <p>You have the right to:</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>Access your personal data</li>
                                    <li>Correct inaccurate data</li>
                                    <li>Delete your account and associated data</li>
                                    <li>Export your data in a portable format</li>
                                    <li>Opt out of marketing communications</li>
                                </ul>
                                <p>To exercise these rights, use the in-app settings or contact us at <a href="mailto:privacy@carpoolconnect.com.au" className="text-[var(--primary-light)] hover:underline">privacy@carpoolconnect.com.au</a></p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">9. Children&apos;s Privacy</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                CarpoolConnect is not intended for users under 18 years of age. We do not
                                knowingly collect personal information from children. If you believe we have
                                collected data from a child, please contact us immediately.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">10. Changes to This Policy</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                We may update this Privacy Policy from time to time. We will notify you of
                                significant changes via email or in-app notification. Continued use of the
                                app after changes constitutes acceptance of the updated policy.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">11. Contact Us</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                If you have questions about this Privacy Policy or our data practices,
                                please contact us at:
                            </p>
                            <div className="mt-4 glass rounded-xl p-6">
                                <p className="text-white">CarpoolConnect</p>
                                <p className="text-[var(--text-secondary)]">Email: <a href="mailto:privacy@carpoolconnect.com.au" className="text-[var(--primary-light)] hover:underline">privacy@carpoolconnect.com.au</a></p>
                                <p className="text-[var(--text-secondary)]">Location: Canberra, Australia</p>
                            </div>
                        </div>

                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/10">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                        <p className="text-[var(--text-muted)]">© 2024 CarpoolConnect. All rights reserved.</p>
                        <div className="flex gap-6">
                            <Link href="/privacy" className="text-[var(--text-secondary)] hover:text-white transition-colors">Privacy Policy</Link>
                            <Link href="/terms" className="text-[var(--text-secondary)] hover:text-white transition-colors">Terms of Service</Link>
                            <Link href="/contact" className="text-[var(--text-secondary)] hover:text-white transition-colors">Contact</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </main>
    );
}
