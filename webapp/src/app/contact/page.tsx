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
                    <Link href="/contact" className="text-white font-medium">Contact</Link>
                    <a href="#" className="btn-primary px-6 py-2.5 rounded-full text-white font-semibold">
                        Download App
                    </a>
                </div>
            </div>
        </nav>
    );
}

export default function ContactPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        subject: '',
        message: '',
    });
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // In production, this would send to your backend
        console.log('Form submitted:', formData);
        setSubmitted(true);
    };

    const contactInfo = [
        { icon: '📧', label: 'Email', value: 'hello@carpoolconnect.com.au', href: 'mailto:hello@carpoolconnect.com.au' },
        { icon: '📍', label: 'Location', value: 'Canberra, Australia', href: null },
        { icon: '📱', label: 'Social', value: '@carpoolconnect', href: 'https://twitter.com' },
    ];

    const faqs = [
        { q: 'How do I sign up?', a: 'Download the app from the App Store or Google Play and create your account in seconds.' },
        { q: 'Is it safe?', a: 'Yes! All users are verified and we have safety features like trip sharing and emergency contacts.' },
        { q: 'How do payments work?', a: 'We use Stripe for secure payments. Drivers set their price and payments are handled automatically.' },
        { q: 'What if I need to cancel?', a: 'You can cancel anytime before the ride. Check our cancellation policy in the app for details.' },
    ];

    return (
        <main className="min-h-screen">
            <Navbar />

            {/* Hero */}
            <section className="relative pt-32 pb-20 overflow-hidden">
                <div className="orb w-[400px] h-[400px] bg-[var(--gradient-1)] -top-20 -left-20" />
                <div className="orb w-[300px] h-[300px] bg-[var(--gradient-4)] top-40 -right-20" />

                <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
                    <h1 className="text-5xl md:text-7xl font-bold mb-6">
                        Get in <span className="gradient-text">Touch</span>
                    </h1>
                    <p className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto">
                        Have questions? We&apos;d love to hear from you. Send us a message and we&apos;ll
                        respond as soon as possible.
                    </p>
                </div>
            </section>

            {/* Contact Form & Info */}
            <section className="py-24">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid md:grid-cols-2 gap-12">
                        {/* Form */}
                        <div className="glass rounded-3xl p-8 md:p-12">
                            {submitted ? (
                                <div className="text-center py-12">
                                    <div className="text-6xl mb-6">✅</div>
                                    <h3 className="text-2xl font-bold text-white mb-4">Message Sent!</h3>
                                    <p className="text-[var(--text-secondary)] mb-6">
                                        Thank you for reaching out. We&apos;ll get back to you within 24 hours.
                                    </p>
                                    <button
                                        onClick={() => { setSubmitted(false); setFormData({ name: '', email: '', subject: '', message: '' }); }}
                                        className="btn-primary px-8 py-3 rounded-full text-white font-semibold"
                                    >
                                        Send Another Message
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <h2 className="text-2xl font-bold text-white mb-6">Send us a message</h2>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                            Your Name
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                                            placeholder="John Smith"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            required
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors"
                                            placeholder="john@example.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                            Subject
                                        </label>
                                        <select
                                            required
                                            value={formData.subject}
                                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-[var(--primary)] transition-colors"
                                        >
                                            <option value="" className="bg-[var(--surface)]">Select a topic</option>
                                            <option value="general" className="bg-[var(--surface)]">General Inquiry</option>
                                            <option value="support" className="bg-[var(--surface)]">Technical Support</option>
                                            <option value="partnership" className="bg-[var(--surface)]">Partnership</option>
                                            <option value="feedback" className="bg-[var(--surface)]">Feedback</option>
                                            <option value="press" className="bg-[var(--surface)]">Press & Media</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                                            Message
                                        </label>
                                        <textarea
                                            required
                                            rows={5}
                                            value={formData.message}
                                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] transition-colors resize-none"
                                            placeholder="Tell us how we can help..."
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full btn-primary py-4 rounded-xl text-white font-semibold text-lg"
                                    >
                                        Send Message
                                    </button>
                                </form>
                            )}
                        </div>

                        {/* Contact Info */}
                        <div className="space-y-8">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-6">Contact Information</h2>
                                <div className="space-y-4">
                                    {contactInfo.map((info, i) => (
                                        <div key={i} className="glass rounded-xl p-6 flex items-center gap-4 card-hover">
                                            <span className="text-3xl">{info.icon}</span>
                                            <div>
                                                <p className="text-sm text-[var(--text-secondary)]">{info.label}</p>
                                                {info.href ? (
                                                    <a href={info.href} className="text-white hover:text-[var(--primary-light)] transition-colors">
                                                        {info.value}
                                                    </a>
                                                ) : (
                                                    <p className="text-white">{info.value}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* FAQ */}
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
                                <div className="space-y-4">
                                    {faqs.map((faq, i) => (
                                        <details key={i} className="glass rounded-xl group">
                                            <summary className="p-6 cursor-pointer text-white font-medium flex justify-between items-center">
                                                {faq.q}
                                                <span className="text-[var(--primary-light)] group-open:rotate-180 transition-transform">
                                                    ▼
                                                </span>
                                            </summary>
                                            <div className="px-6 pb-6 text-[var(--text-secondary)]">
                                                {faq.a}
                                            </div>
                                        </details>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/10">
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <p className="text-[var(--text-muted)]">© 2024 CarpoolConnect. All rights reserved.</p>
                </div>
            </footer>
        </main>
    );
}
