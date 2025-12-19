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
                    <Link href="/mission" className="text-white font-medium">Our Mission</Link>
                    <Link href="/contact" className="text-[var(--text-secondary)] hover:text-white transition-colors">Contact</Link>
                    <a href="#" className="btn-primary px-6 py-2.5 rounded-full text-white font-semibold">
                        Download App
                    </a>
                </div>
            </div>
        </nav>
    );
}

export default function MissionPage() {
    const impacts = [
        { icon: '🌳', value: '10,000+', label: 'Annual CO₂ Goal (Tonnes)' },
        { icon: '🚗', value: '50K+', label: 'Cars Off Road (Goal)' },
        { icon: '💵', value: '$500K+', label: 'Projected Community Savings' },
        { icon: '🤝', value: '100K+', label: 'Future Connections' },
    ];

    const goals = [
        {
            year: '2025',
            title: 'Expand Nationwide',
            desc: 'Bring CarpoolConnect to every major city in Australia.',
        },
        {
            year: '2026',
            title: 'Carbon Neutral',
            desc: 'Offset 100% of our operational carbon footprint.',
        },
        {
            year: '2027',
            title: 'Global Expansion',
            desc: 'Launch in key international markets.',
        },
        {
            year: '2030',
            title: '1 Million Rides',
            desc: 'Help 1 million people share rides every month.',
        },
    ];

    return (
        <main className="min-h-screen">
            <Navbar />

            {/* Hero */}
            <section className="relative pt-32 pb-20 overflow-hidden">
                <div className="orb w-[500px] h-[500px] bg-[var(--gradient-2)] -top-20 left-1/4" />
                <div className="orb w-[400px] h-[400px] bg-[var(--gradient-3)] bottom-0 -right-20" />

                <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
                    <h1 className="text-5xl md:text-7xl font-bold mb-6">
                        Our <span className="gradient-text">Mission</span>
                    </h1>
                    <p className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto">
                        To create a world where every empty seat becomes an opportunity to connect,
                        save money, and protect our planet.
                    </p>
                </div>
            </section>

            {/* Why We Built This */}
            <section className="py-24">
                <div className="max-w-4xl mx-auto px-6">
                    <div className="glass rounded-3xl p-12 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--primary)] opacity-10 blur-3xl" />
                        <h2 className="text-3xl md:text-4xl font-bold mb-8">
                            Why We Are <span className="gradient-text">Creating CarpoolConnect</span>
                        </h2>
                        <div className="space-y-6 text-lg text-[var(--text-secondary)] leading-relaxed">
                            <p>
                                <strong className="text-white">The Problem:</strong> Every day, millions of cars travel with empty
                                seats while others struggle with expensive fuel costs, traffic congestion, and
                                limited public transport options.
                            </p>
                            <p>
                                <strong className="text-white">The Impact:</strong> This inefficiency contributes to climate change,
                                air pollution, and a lower quality of life in our cities. Cars are one of the
                                largest sources of personal carbon emissions.
                            </p>
                            <p>
                                <strong className="text-white">Our Solution:</strong> CarpoolConnect is designed to bridge this gap by connecting
                                drivers with empty seats to passengers heading the same way. It will be a win-win-win:
                                drivers earn money, passengers save money, and the planet gets a break.
                            </p>
                            <p>
                                <strong className="text-white">The Vision:</strong> We envision a future where sharing rides is the
                                norm, not the exception. Where communities are stronger because neighbors help
                                each other commute. Where we significantly reduce our collective carbon footprint.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Impact Stats */}
            <section className="py-24 relative">
                <div className="max-w-6xl mx-auto px-6">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
                        Projected <span className="gradient-text">Impact</span>
                    </h2>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {impacts.map((impact, i) => (
                            <div key={i} className="glass rounded-2xl p-8 text-center card-hover">
                                <div className="text-5xl mb-4">{impact.icon}</div>
                                <div className="text-3xl font-bold gradient-text mb-2">{impact.value}</div>
                                <p className="text-[var(--text-secondary)]">{impact.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Roadmap */}
            <section className="py-24">
                <div className="max-w-4xl mx-auto px-6">
                    <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
                        Our <span className="gradient-text">Roadmap</span>
                    </h2>
                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[var(--primary)] via-[var(--gradient-3)] to-[var(--gradient-4)]" />

                        {goals.map((goal, i) => (
                            <div key={i} className={`relative flex items-center mb-12 ${i % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'}`}>
                                {/* Dot */}
                                <div className="absolute left-8 md:left-1/2 w-4 h-4 -ml-2 rounded-full gradient-bg glow z-10" />

                                {/* Content */}
                                <div className={`ml-20 md:ml-0 md:w-1/2 ${i % 2 === 0 ? 'md:pr-16 md:text-right' : 'md:pl-16'}`}>
                                    <div className="glass rounded-2xl p-6 card-hover">
                                        <div className="text-2xl font-bold gradient-text mb-2">{goal.year}</div>
                                        <h3 className="text-xl font-semibold text-white mb-2">{goal.title}</h3>
                                        <p className="text-[var(--text-secondary)]">{goal.desc}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Commitment */}
            <section className="py-24">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <div className="glass rounded-3xl p-12">
                        <div className="text-6xl mb-8">🌍</div>
                        <h2 className="text-3xl md:text-4xl font-bold mb-6">
                            Our <span className="gradient-text">Commitment</span>
                        </h2>
                        <p className="text-xl text-[var(--text-secondary)] mb-8">
                            We pledge to measure, report, and continuously reduce our environmental impact.
                            Every feature we build, every decision we make, is guided by our mission to
                            create a more sustainable future.
                        </p>
                        <Link href="/contact" className="btn-primary px-10 py-4 rounded-full text-white font-semibold text-lg inline-block">
                            Join the Movement
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
