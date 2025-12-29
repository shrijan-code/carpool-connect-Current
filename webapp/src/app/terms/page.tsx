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
                        Terms & <span className="gradient-text">Conditions</span>
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

                        {/* Important Notice */}
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
                            <p className="text-yellow-400 font-bold text-lg mb-2">⚠️ IMPORTANT - PLEASE READ CAREFULLY</p>
                            <p className="text-[var(--text-secondary)]">
                                By using CarpoolConnect, you agree to these Terms and Conditions. These Terms contain
                                important provisions including limitations of liability and disclaimers. If you do not
                                agree to these Terms, you must not use our platform.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">1. About CarpoolConnect</h2>
                            <div className="text-[var(--text-secondary)] leading-relaxed space-y-3">
                                <div className="glass rounded-xl p-6">
                                    <p className="font-bold text-white text-lg mb-3">WE ARE A TECHNOLOGY PLATFORM, NOT A TRANSPORTATION COMPANY</p>
                                    <p className="mb-3">
                                        CarpoolConnect Pty Ltd (&quot;CarpoolConnect,&quot; &quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) operates a
                                        <strong className="text-white"> digital technology platform</strong> that enables users to post,
                                        discover, and arrange shared rides. We provide the software and infrastructure that connects
                                        drivers and passengers.
                                    </p>
                                    <p className="text-yellow-400 font-medium">
                                        We do NOT provide transportation services. We do NOT employ or contract any drivers.
                                        We do NOT own or operate any vehicles. All ride arrangements are made directly between
                                        independent users of our platform.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">2. Eligibility & Account Registration</h2>
                            <div className="text-[var(--text-secondary)] leading-relaxed space-y-3">
                                <p>To use CarpoolConnect, you must:</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>Be at least <strong className="text-white">18 years of age</strong></li>
                                    <li>Provide accurate, current, and complete registration information</li>
                                    <li>Maintain the security of your account credentials</li>
                                    <li>Accept full responsibility for all activities under your account</li>
                                    <li>Notify us immediately of any unauthorized access to your account</li>
                                </ul>
                                <p className="mt-4">
                                    We reserve the right to suspend or terminate accounts that violate these Terms or
                                    provide false information.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">3. Driver Requirements & Verification</h2>
                            <div className="text-[var(--text-secondary)] leading-relaxed space-y-3">
                                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                                    <p className="text-green-400 font-medium">✅ All drivers are required to complete identity verification through Stripe Identity before offering rides.</p>
                                </div>

                                <p className="font-medium text-white mt-4">Drivers using CarpoolConnect represent and warrant that they:</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>Hold a valid driver&apos;s license for the jurisdiction where they operate</li>
                                    <li>Have and maintain adequate vehicle insurance that covers ride-sharing or cost-sharing arrangements</li>
                                    <li>Operate a roadworthy vehicle that meets all safety and registration requirements</li>
                                    <li>Will comply with all applicable traffic laws and regulations</li>
                                    <li>Will not operate while impaired by alcohol, drugs, fatigue, or any other condition</li>
                                    <li>Are legally permitted to operate in their jurisdiction</li>
                                </ul>

                                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mt-4">
                                    <p className="text-yellow-400 font-medium">
                                        ⚠️ DISCLAIMER: While we require identity verification, CarpoolConnect does not verify
                                        driver&apos;s licenses, insurance coverage, vehicle registration, or driving history.
                                        Drivers are solely responsible for ensuring they meet all legal requirements.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">4. Passenger Acknowledgments</h2>
                            <div className="text-[var(--text-secondary)] leading-relaxed space-y-3">
                                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                                    <p className="text-red-400 font-medium">
                                        ⚠️ IMPORTANT: Passenger identity verification is OPTIONAL and NOT required.
                                        Passengers may use the platform without completing identity verification.
                                    </p>
                                </div>

                                <p className="font-medium text-white mt-4">By using CarpoolConnect as a passenger, you acknowledge and agree that:</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>You are entering into a direct arrangement with an independent driver, not with CarpoolConnect</li>
                                    <li>You assume responsibility for your own safety and exercise your own judgment before accepting rides</li>
                                    <li>You will be at the designated pickup location at the agreed time</li>
                                    <li>You will treat drivers and their vehicles with respect</li>
                                    <li>You will wear seatbelts during the journey as required by law</li>
                                    <li>You will not bring illegal items, weapons, or hazardous materials</li>
                                    <li>You will pay the agreed fare through the app</li>
                                </ul>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">5. Payments, Fees & Stripe</h2>
                            <div className="text-[var(--text-secondary)] leading-relaxed space-y-3">
                                <div className="glass rounded-xl p-6">
                                    <p className="font-bold text-white text-lg mb-3">PAYMENT PROCESSING IS HANDLED BY STRIPE</p>
                                    <p className="mb-3">
                                        All payment processing, including payment collection from passengers and payouts to drivers,
                                        is provided by <strong className="text-white">Stripe, Inc.</strong>, a third-party payment processor.
                                        CarpoolConnect does not directly process, store, or handle payment card information.
                                    </p>
                                    <p className="text-yellow-400">
                                        By using our payment features, you agree to Stripe&apos;s
                                        <a href="https://stripe.com/legal" className="underline ml-1">Terms of Service</a> and
                                        <a href="https://stripe.com/privacy" className="underline ml-1">Privacy Policy</a>.
                                    </p>
                                </div>

                                <p className="font-medium text-white mt-4">Payment Terms:</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>Passengers pay the fare set by the driver plus a platform service fee</li>
                                    <li>All fees are displayed before booking confirmation</li>
                                    <li>Drivers receive payouts to their Stripe-connected bank accounts after ride completion</li>
                                    <li>CarpoolConnect retains a percentage as a platform service fee</li>
                                    <li>Payment disputes should first be addressed between users; CarpoolConnect may assist but is not liable for payment issues</li>
                                </ul>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">6. Cancellation Policy</h2>
                            <div className="text-[var(--text-secondary)] leading-relaxed space-y-3">
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div className="glass rounded-xl p-4">
                                        <p className="font-bold text-white mb-2">Passengers</p>
                                        <ul className="list-disc list-inside text-sm space-y-1">
                                            <li>Early cancellation (24+ hours before): Full fare refund, $5 platform fee retained</li>
                                            <li>Late cancellation (within 24 hours): 50% refund, 50% goes to driver, platform fee retained</li>
                                            <li>No-show: No refund, driver receives full fare compensation</li>
                                        </ul>
                                    </div>
                                    <div className="glass rounded-xl p-4">
                                        <p className="font-bold text-white mb-2">Drivers</p>
                                        <ul className="list-disc list-inside text-sm space-y-1">
                                            <li>Driver cancellation: Passenger receives full refund including platform fee</li>
                                            <li>Repeated cancellations may result in account restrictions</li>
                                            <li>Should communicate promptly if cancellation is necessary</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">7. Safety & Conduct</h2>
                            <div className="text-[var(--text-secondary)] leading-relaxed space-y-3">
                                <p className="font-medium text-white">All users must:</p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>Behave respectfully and professionally toward all platform users</li>
                                    <li>Not harass, threaten, discriminate against, or abuse other users</li>
                                    <li>Not use the platform for illegal activities</li>
                                    <li>Report safety concerns or incidents through the app immediately</li>
                                    <li>Provide accurate information about themselves and their rides</li>
                                </ul>

                                <p className="mt-4">
                                    CarpoolConnect provides safety features including emergency contact sharing and safety
                                    reporting, but <strong className="text-white">does not guarantee user safety</strong>.
                                    Users are responsible for their own safety decisions.
                                </p>

                                <p className="mt-4">
                                    We reserve the right to suspend or permanently terminate accounts for violations of
                                    these conduct standards without prior notice.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">8. LIMITATION OF LIABILITY</h2>
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 space-y-4">
                                <p className="text-red-400 font-bold text-lg">PLEASE READ THIS SECTION CAREFULLY</p>

                                <p className="text-[var(--text-secondary)]">
                                    TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:
                                </p>

                                <ul className="list-disc list-inside space-y-3 text-[var(--text-secondary)]">
                                    <li>
                                        CarpoolConnect provides a <strong className="text-white">technology platform only</strong>.
                                        We are not a party to any agreement between drivers and passengers regarding rides.
                                    </li>
                                    <li>
                                        We are <strong className="text-white">NOT LIABLE</strong> for the actions, conduct,
                                        or behavior of any user, whether driver or passenger.
                                    </li>
                                    <li>
                                        We are <strong className="text-white">NOT LIABLE</strong> for any accidents, injuries,
                                        death, property damage, or other harm occurring during, before, or after rides arranged
                                        through our platform.
                                    </li>
                                    <li>
                                        We are <strong className="text-white">NOT LIABLE</strong> for delays, cancellations,
                                        route changes, or failure to complete rides.
                                    </li>
                                    <li>
                                        We are <strong className="text-white">NOT LIABLE</strong> for lost, stolen, or
                                        damaged belongings.
                                    </li>
                                    <li>
                                        We are <strong className="text-white">NOT LIABLE</strong> for the accuracy of user-provided
                                        information, including driver credentials or vehicle information.
                                    </li>
                                    <li>
                                        We are <strong className="text-white">NOT LIABLE</strong> for payment processing issues,
                                        which are handled by Stripe.
                                    </li>
                                </ul>

                                <p className="text-yellow-400 font-medium mt-4">
                                    OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING FROM YOUR USE OF CARPOOLCONNECT
                                    SHALL NOT EXCEED THE AMOUNT OF FEES YOU PAID TO US IN THE 12 MONTHS PRECEDING THE CLAIM,
                                    OR AUD $100, WHICHEVER IS LESS.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">9. DISCLAIMER OF WARRANTIES</h2>
                            <div className="text-[var(--text-secondary)] leading-relaxed space-y-3">
                                <p className="font-bold text-white">THE PLATFORM IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE.&quot;</p>
                                <p>
                                    We make no warranties or representations about the accuracy, reliability, or availability
                                    of the platform. We disclaim all warranties, express or implied, including implied
                                    warranties of merchantability, fitness for a particular purpose, and non-infringement.
                                </p>
                                <p>
                                    We do not warrant that: (a) the platform will meet your requirements; (b) the platform
                                    will be uninterrupted, timely, secure, or error-free; (c) any information obtained
                                    through the platform will be accurate or reliable.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">10. Indemnification</h2>
                            <div className="text-[var(--text-secondary)] leading-relaxed">
                                <p>
                                    You agree to indemnify, defend, and hold harmless CarpoolConnect, its officers, directors,
                                    employees, and agents from and against any claims, liabilities, damages, losses, costs,
                                    or expenses (including legal fees) arising from:
                                </p>
                                <ul className="list-disc list-inside space-y-2 mt-3">
                                    <li>Your use of the platform</li>
                                    <li>Your violation of these Terms</li>
                                    <li>Your violation of any law or rights of a third party</li>
                                    <li>Any ride you offer or accept through the platform</li>
                                    <li>Any content you submit to the platform</li>
                                </ul>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">11. Intellectual Property</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                All content, trademarks, logos, and intellectual property on CarpoolConnect are owned
                                by us or our licensors. You may not copy, modify, distribute, sell, or create derivative
                                works of our content without prior written permission.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">12. Account Termination</h2>
                            <div className="text-[var(--text-secondary)] leading-relaxed space-y-3">
                                <p>
                                    We may suspend or terminate your account at any time, with or without notice, for:
                                </p>
                                <ul className="list-disc list-inside space-y-2">
                                    <li>Violation of these Terms</li>
                                    <li>Suspected fraudulent or illegal activity</li>
                                    <li>Safety concerns</li>
                                    <li>At our sole discretion for any other reason</li>
                                </ul>
                                <p className="mt-3">
                                    You may delete your account at any time through the app settings. Upon termination,
                                    your right to use the platform immediately ceases, but these Terms continue to apply
                                    to any prior use.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">13. Dispute Resolution</h2>
                            <div className="text-[var(--text-secondary)] leading-relaxed space-y-3">
                                <p>
                                    <strong className="text-white">Between Users:</strong> Disputes between drivers and
                                    passengers should be resolved directly between the parties. CarpoolConnect may, at
                                    its discretion, assist in mediating disputes but is not obligated to do so.
                                </p>
                                <p>
                                    <strong className="text-white">Against CarpoolConnect:</strong> Before initiating
                                    legal proceedings, you agree to attempt to resolve disputes by contacting us at
                                    legal@carpoolconnect.com.au.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">14. Governing Law & Jurisdiction</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                These Terms are governed by the laws of the <strong className="text-white">Australian Capital Territory, Australia</strong>,
                                without regard to conflict of law principles. Any legal proceedings arising from these
                                Terms or your use of the platform shall be brought exclusively in the courts of the
                                Australian Capital Territory, and you consent to the jurisdiction of such courts.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">15. Changes to Terms</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                We reserve the right to modify these Terms at any time. We will notify you of material
                                changes via email or in-app notification. Continued use of the platform after changes
                                become effective constitutes acceptance of the revised Terms. If you do not agree to
                                the changes, you must stop using the platform.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">16. Severability</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                If any provision of these Terms is found to be invalid, illegal, or unenforceable,
                                the remaining provisions will continue in full force and effect.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">17. Entire Agreement</h2>
                            <p className="text-[var(--text-secondary)] leading-relaxed">
                                These Terms, together with our Privacy Policy, constitute the entire agreement between
                                you and CarpoolConnect regarding your use of the platform and supersede any prior
                                agreements.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-2xl font-bold text-white mb-4">18. Contact Us</h2>
                            <div className="glass rounded-xl p-6">
                                <p className="text-white font-bold mb-4">CarpoolConnect Pty Ltd</p>
                                <p className="text-[var(--text-secondary)]">
                                    <strong className="text-white">Legal Inquiries:</strong> <a href="mailto:legal@carpoolconnect.com.au" className="text-[var(--primary-light)] hover:underline">legal@carpoolconnect.com.au</a>
                                </p>
                                <p className="text-[var(--text-secondary)]">
                                    <strong className="text-white">General Support:</strong> <a href="mailto:hello@carpoolconnect.com.au" className="text-[var(--primary-light)] hover:underline">hello@carpoolconnect.com.au</a>
                                </p>
                                <p className="text-[var(--text-secondary)]">
                                    <strong className="text-white">Location:</strong> Canberra, Australian Capital Territory, Australia
                                </p>
                            </div>
                        </div>

                        {/* Final Acknowledgment */}
                        <div className="bg-[var(--primary)]/10 border border-[var(--primary)]/30 rounded-xl p-6">
                            <p className="text-[var(--primary-light)] font-bold text-lg mb-2">Acknowledgment</p>
                            <p className="text-[var(--text-secondary)]">
                                By using CarpoolConnect, you acknowledge that you have read, understood, and agree
                                to be bound by these Terms and Conditions, including the limitations of liability
                                and disclaimer of warranties set forth above.
                            </p>
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
                            <Link href="/privacy" className="text-[var(--text-secondary)] hover:text-white transition-colors">Privacy Policy</Link>
                            <Link href="/terms" className="text-white font-medium">Terms of Service</Link>
                            <Link href="/contact" className="text-[var(--text-secondary)] hover:text-white transition-colors">Contact</Link>
                        </div>
                    </div>
                </div>
            </footer>
        </main>
    );
}
