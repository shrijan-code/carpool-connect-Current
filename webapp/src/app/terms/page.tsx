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

export default function TermsPage() {
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
                        Terms of <span className="gradient-text">Service</span>
                    </h1>
                    <p className="text-lg text-[var(--text-secondary)]">
                        Last updated: {lastUpdated}
                    </p>
                </div>
            </section>

            {/* Terms Content */}
            <section className="py-12">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="glass rounded-3xl p-8 md:p-12 space-y-8">

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">1. Acceptance of Terms</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                By accessing or using CarpoolConnect (&quot;the App&quot;), you agree to be bound by these
                                Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you may not use
                                the App. We reserve the right to update these Terms at any time, and continued use
                                of the App constitutes acceptance of any changes.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">2. Description of Service</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                CarpoolConnect is a platform that connects drivers offering rides with passengers
                                seeking transportation. We facilitate the connection and payment processing but
                                do not provide transportation services ourselves. We are not a taxi, rideshare,
                                or transportation company.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">3. User Accounts</h2>
                            <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                                <p>To use CarpoolConnect, you must:</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>Be at least 18 years of age</li>
                                    <li>Provide accurate and complete registration information</li>
                                    <li>Maintain the security of your account credentials</li>
                                    <li>Notify us immediately of any unauthorized account access</li>
                                </ul>
                                <p>You are responsible for all activities that occur under your account.</p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">4. Driver Requirements</h2>
                            <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                                <p>Drivers using CarpoolConnect must:</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>Hold a valid driver&apos;s license for the jurisdiction where they operate</li>
                                    <li>Have adequate vehicle insurance that covers ride-sharing activities</li>
                                    <li>Complete identity verification through our platform</li>
                                    <li>Maintain a roadworthy vehicle in safe operating condition</li>
                                    <li>Comply with all applicable traffic laws and regulations</li>
                                    <li>Not operate while impaired by alcohol, drugs, or fatigue</li>
                                </ul>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">5. Passenger Responsibilities</h2>
                            <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                                <p>Passengers using CarpoolConnect agree to:</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>Be at the designated pickup location at the agreed time</li>
                                    <li>Treat drivers and their vehicles with respect</li>
                                    <li>Wear seatbelts during the journey</li>
                                    <li>Not bring illegal items or hazardous materials</li>
                                    <li>Pay the agreed fare through the app</li>
                                </ul>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">6. Payments and Fees</h2>
                            <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                                <p>Payment terms:</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>Passengers pay the fare set by drivers plus a platform service fee</li>
                                    <li>Payments are processed securely through Stripe</li>
                                    <li>Drivers receive payouts to their connected bank accounts</li>
                                    <li>CarpoolConnect retains a percentage as a service fee</li>
                                    <li>All fees are displayed before booking confirmation</li>
                                </ul>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">7. Cancellation Policy</h2>
                            <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                                <p><strong className="text-white">Passengers:</strong> Free cancellation up to 24 hours before the scheduled ride. Cancellations within 24 hours may incur a fee.</p>
                                <p><strong className="text-white">Drivers:</strong> Should avoid cancelling after accepting a booking. Repeated cancellations may result in account restrictions.</p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">8. Safety and Conduct</h2>
                            <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                                <p>All users must:</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>Behave respectfully and professionally</li>
                                    <li>Not harass, threaten, or discriminate against other users</li>
                                    <li>Report safety concerns or incidents through the app</li>
                                    <li>Not use the platform for illegal activities</li>
                                </ul>
                                <p>We reserve the right to suspend or terminate accounts for violations.</p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">9. Limitation of Liability</h2>
                            <div className="space-y-4 text-[var(--text-secondary)] leading-relaxed">
                                <p>CarpoolConnect is a platform connecting users and is not responsible for:</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>The conduct of drivers or passengers</li>
                                    <li>Accidents, injuries, or property damage during rides</li>
                                    <li>Delays, cancellations, or route changes</li>
                                    <li>Lost or damaged personal belongings</li>
                                </ul>
                                <p>To the maximum extent permitted by law, our liability is limited to the fees paid for the specific transaction in dispute.</p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">10. Intellectual Property</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                All content, trademarks, and intellectual property on CarpoolConnect are owned
                                by us or our licensors. You may not copy, modify, or distribute our content
                                without prior written permission.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">11. Account Termination</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                We may suspend or terminate your account at any time for violations of these
                                Terms or for any other reason at our discretion. You may delete your account
                                at any time through the app settings. Upon termination, your right to use the
                                App immediately ceases.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">12. Governing Law</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                These Terms are governed by the laws of Australia. Any disputes arising from
                                these Terms or your use of the App shall be resolved in the courts of the
                                Australian Capital Territory.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">13. Contact Us</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                If you have questions about these Terms, please contact us:
                            </p>
                            <div className="mt-4 glass rounded-xl p-6">
                                <p className="text-white">CarpoolConnect</p>
                                <p className="text-[var(--text-secondary)]">Email: <a href="mailto:legal@carpoolconnect.com.au" className="text-[var(--primary-light)] hover:underline">legal@carpoolconnect.com.au</a></p>
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
