'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

// Navbar Component (shared)
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
                    <Link href="/about" className="text-white font-medium">About</Link>
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

// Team member type
interface TeamMember {
    name: string;
    role: string;
    bio: string;
}

export default function AboutPage() {
    const team: TeamMember[] = [
        {
            name: 'Shrijan Bhandari',
            role: 'Founder & CEO',
            bio: 'Passionate about sustainable mobility and building technology that brings people together.',
        },
        {
            name: 'Development Team',
            role: 'Engineering',
            bio: 'A dedicated team of engineers building the future of shared transportation.',
        },
        {
            name: 'Community Team',
            role: 'Operations',
            bio: 'Ensuring every ride is safe, comfortable, and memorable.',
        },
    ];

    const values = [
        { icon: '🤝', title: 'Trust', desc: 'We build trust through transparency and verification.' },
        { icon: '🌍', title: 'Sustainability', desc: 'Every shared ride is a step towards a greener planet.' },
        { icon: '💜', title: 'Community', desc: 'We connect people and create lasting relationships.' },
        { icon: '🚀', title: 'Innovation', desc: 'We continuously improve to serve you better.' },
    ];

    return (
        <main className="min-h-screen">
            <Navbar />

            {/* Hero */}
            <section className="relative pt-32 pb-20 overflow-hidden">
                <div className="orb w-[400px] h-[400px] bg-[var(--gradient-1)] -top-20 -right-20" />
                <div className="orb w-[300px] h-[300px] bg-[var(--gradient-3)] top-40 -left-20" />

                <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
                    <h1 className="text-5xl md:text-7xl font-bold mb-6">
                        About <span className="gradient-text">Us</span>
                    </h1>
                    <p className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto">
                        We&apos;re on a mission to transform how people travel — making it more social,
                        affordable, and sustainable.
                    </p>
                </div>
            </section>

            {/* Story */}
            <section className="py-24">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid md:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-3xl md:text-4xl font-bold mb-6">
                                Our <span className="gradient-text">Story</span>
                            </h2>
                            <p className="text-[var(--text-secondary)] mb-6 text-lg leading-relaxed">
                                CarpoolConnect was born from a simple observation: millions of cars travel our roads
                                every day with empty seats, while others struggle to find affordable and convenient
                                transportation.
                            </p>
                            <p className="text-[var(--text-secondary)] mb-6 text-lg leading-relaxed">
                                We saw an opportunity to connect these people, reduce traffic congestion, lower costs
                                for everyone, and most importantly — reduce our collective carbon footprint.
                            </p>
                            <p className="text-[var(--text-secondary)] text-lg leading-relaxed">
                                Today, CarpoolConnect is one of Australia&apos;s leading carpooling platforms,
                                connecting thousands of drivers and passengers every day.
                            </p>
                        </div>
                        <div className="glass rounded-3xl p-12 glow">
                            <div className="text-6xl font-bold gradient-text mb-4">2024</div>
                            <p className="text-xl text-white mb-2">Founded in Australia</p>
                            <p className="text-[var(--text-secondary)]">
                                Built with love for the environment and the community.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Values */}
            <section className="py-24 relative">
                <div className="max-w-6xl mx-auto px-6">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
                        Our <span className="gradient-text">Values</span>
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {values.map((value, i) => (
                            <div key={i} className="glass rounded-2xl p-8 text-center card-hover">
                                <div className="text-5xl mb-4">{value.icon}</div>
                                <h3 className="text-xl font-semibold mb-2 text-white">{value.title}</h3>
                                <p className="text-[var(--text-secondary)]">{value.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Team */}
            <section className="py-24">
                <div className="max-w-6xl mx-auto px-6">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
                        Meet The <span className="gradient-text">Team</span>
                    </h2>
                    <div className="grid md:grid-cols-3 gap-8">
                        {team.map((member, i) => (
                            <div key={i} className="glass rounded-2xl p-8 text-center card-hover">
                                <div className="w-24 h-24 rounded-full gradient-bg mx-auto mb-6 flex items-center justify-center glow">
                                    <span className="text-3xl font-bold text-white">{member.name[0]}</span>
                                </div>
                                <h3 className="text-xl font-semibold text-white mb-1">{member.name}</h3>
                                <p className="text-[var(--primary-light)] mb-4">{member.role}</p>
                                <p className="text-[var(--text-secondary)]">{member.bio}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="py-24 relative overflow-hidden">
                <div className="absolute inset-0 gradient-bg opacity-20" />
                <div className="relative max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-4xl font-bold mb-6">
                        Join Our <span className="gradient-text">Journey</span>
                    </h2>
                    <p className="text-xl text-[var(--text-secondary)] mb-10">
                        Be part of the movement that&apos;s reshaping transportation.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <a href="#" className="btn-primary px-10 py-4 rounded-full text-white font-semibold text-lg">
                            Download the App
                        </a>
                        <Link href="/contact" className="glass px-10 py-4 rounded-full text-white font-semibold text-lg hover:bg-white/10 transition-all">
                            Get in Touch
                        </Link>
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
