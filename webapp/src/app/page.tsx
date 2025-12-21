'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

// Navbar Component
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
          <a
            href="https://apps.apple.com"
            target="_blank"
            className="btn-primary px-6 py-2.5 rounded-full text-white font-semibold"
          >
            Download App
          </a>
        </div>

        <button
          className="md:hidden text-white p-2"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden glass-stronger mt-4 mx-6 rounded-2xl p-6 space-y-4">
          <Link href="/about" className="block text-white py-2">About</Link>
          <Link href="/mission" className="block text-white py-2">Our Mission</Link>
          <Link href="/contact" className="block text-white py-2">Contact</Link>
          <a href="#" className="btn-primary px-6 py-3 rounded-full text-white font-semibold block text-center mt-4">
            Download App
          </a>
        </div>
      )}
    </nav>
  );
}

// Hero Section
function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden grid-bg">
      {/* Animated gradient orbs */}
      <div className="orb w-[600px] h-[600px] bg-[var(--gradient-1)] -top-20 -left-40" />
      <div className="orb w-[500px] h-[500px] bg-[var(--gradient-3)] -bottom-20 -right-40" style={{ animationDelay: '2s' }} />
      <div className="orb w-[300px] h-[300px] bg-[var(--gradient-2)] top-1/2 left-1/2" style={{ animationDelay: '4s' }} />

      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
        <div className="fade-in opacity-0" style={{ animationDelay: '0.2s' }}>
          <span className="inline-block px-4 py-2 rounded-full glass text-sm text-[var(--text-secondary)] mb-8">
            🚗 The Future of Sustainable Travel
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-6 fade-in opacity-0" style={{ animationDelay: '0.4s' }}>
          Share Rides,<br />
          <span className="gradient-text">Save the Planet</span>
        </h1>

        <p className="text-xl md:text-2xl text-[var(--text-secondary)] max-w-2xl mx-auto mb-12 fade-in opacity-0" style={{ animationDelay: '0.6s' }}>
          Connect with commuters, split costs, and reduce your carbon footprint.
          The smarter way to travel.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center fade-in opacity-0" style={{ animationDelay: '0.8s' }}>
          <a href="#" className="btn-primary px-8 py-4 rounded-full text-white font-semibold text-lg flex items-center justify-center gap-3">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            Download for iOS
          </a>
          <a href="#" className="glass px-8 py-4 rounded-full text-white font-semibold text-lg hover:bg-white/10 transition-all flex items-center justify-center gap-3">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
            </svg>
            Get for Android
          </a>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 scroll-indicator">
          <svg className="w-6 h-6 text-[var(--text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
    </section>
  );
}

// Stats Section
function Stats() {
  const stats = [
    { value: '50K+', label: 'Target Users' },
    { value: '100K+', label: 'Projected Rides' },
    { value: '500T', label: 'CO₂ Savings Goal' },
    { value: '$2M+', label: 'Fuel Savings Goal' },
  ];

  return (
    <section className="py-24 relative">
      <div className="max-w-6xl mx-auto px-6">
        <div className="glass rounded-3xl p-12 grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">{stat.value}</div>
              <div className="text-[var(--text-secondary)]">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Features Section
function Features() {
  const features = [
    {
      icon: '🔒',
      title: 'Verified Users',
      description: 'Every user goes through identity verification for your safety.',
    },
    {
      icon: '💰',
      title: 'Save Money',
      description: 'Split fuel costs and save up to 75% on your daily commute.',
    },
    {
      icon: '🌱',
      title: 'Eco-Friendly',
      description: 'Reduce your carbon footprint by sharing rides.',
    },
    {
      icon: '⚡',
      title: 'Instant Booking',
      description: 'Book rides instantly with real-time availability.',
    },
    {
      icon: '💳',
      title: 'Secure Payments',
      description: 'Powered by Stripe for safe, seamless transactions.',
    },
    {
      icon: '📍',
      title: 'Smart Matching',
      description: 'AI-powered route matching for the perfect ride.',
    },
  ];

  return (
    <section className="py-24 relative" id="features">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Why Choose <span className="gradient-text">CarpoolConnect</span>?
          </h2>
          <p className="text-xl text-[var(--text-secondary)] max-w-2xl mx-auto">
            We&apos;ve built the most advanced carpooling platform with your safety and convenience in mind.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <div
              key={i}
              className="glass rounded-2xl p-8 card-hover"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className="text-4xl mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2 text-white">{feature.title}</h3>
              <p className="text-[var(--text-secondary)]">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// How it Works
function HowItWorks() {
  const steps = [
    { step: '01', title: 'Create Account', desc: 'Sign up in seconds and verify your identity.' },
    { step: '02', title: 'Find or Post', desc: 'Search for rides or offer seats in your car.' },
    { step: '03', title: 'Book & Pay', desc: 'Secure booking with instant payment.' },
    { step: '04', title: 'Ride Together', desc: 'Meet up and enjoy the journey!' },
  ];

  return (
    <section className="py-24 relative">
      <div className="max-w-6xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            How It <span className="gradient-text">Works</span>
          </h2>
        </div>

        <div className="grid md:grid-cols-4 gap-8">
          {steps.map((step, i) => (
            <div key={i} className="relative text-center">
              <div className="text-6xl font-bold text-[var(--primary)] opacity-20 mb-4">{step.step}</div>
              <h3 className="text-xl font-semibold mb-2 text-white">{step.title}</h3>
              <p className="text-[var(--text-secondary)]">{step.desc}</p>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-[var(--primary)] to-transparent" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// CTA Section
function CTA() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 gradient-bg opacity-20" />
      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-4xl md:text-6xl font-bold mb-6">
          Ready to Start <span className="gradient-text">Sharing Rides</span>?
        </h2>
        <p className="text-xl text-[var(--text-secondary)] mb-10 max-w-2xl mx-auto">
          Join thousands of commuters who are saving money and helping the environment.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="#" className="btn-primary px-10 py-4 rounded-full text-white font-semibold text-lg">
            Download Now — It&apos;s Free
          </a>
          <Link href="/contact" className="glass px-10 py-4 rounded-full text-white font-semibold text-lg hover:bg-white/10 transition-all">
            Contact Us
          </Link>
        </div>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  return (
    <footer className="py-16 border-t border-white/10">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <Link href="/" className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl gradient-bg flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <span className="text-xl font-bold text-white">CarpoolConnect</span>
            </Link>
            <p className="text-[var(--text-secondary)] max-w-sm">
              Making sustainable transportation accessible to everyone. One shared ride at a time.
            </p>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Company</h4>
            <ul className="space-y-2 text-[var(--text-secondary)]">
              <li><Link href="/about" className="hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/mission" className="hover:text-white transition-colors">Our Mission</Link></li>
              <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-[var(--text-secondary)]">
              <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[var(--text-muted)]">© 2024 CarpoolConnect. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="text-[var(--text-secondary)] hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" /></svg>
            </a>
            <a href="#" className="text-[var(--text-secondary)] hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm4.441 16.892c-2.102.144-6.784.144-8.883 0C5.282 16.736 5.017 15.622 5 12c.017-3.629.285-4.736 2.558-4.892 2.099-.144 6.782-.144 8.883 0C18.718 7.264 18.982 8.378 19 12c-.018 3.629-.285 4.736-2.559 4.892zM10 9.658l4.917 2.338L10 14.342V9.658z" /></svg>
            </a>
            <a href="#" className="text-[var(--text-secondary)] hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Main Page
export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />
    </main>
  );
}
