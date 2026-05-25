'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Shield,
  Users,
  FileCheck,
  AlertCircle,
  Search,
  Package,
  CreditCard,
  MapPin,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { CITIES, type City } from '@/types';

export default function HomePage() {
  const router = useRouter();
  const [fromCity, setFromCity] = useState<City | ''>('');
  const [toCity, setToCity] = useState<City | ''>('');
  const [date, setDate] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (fromCity) params.set('from', fromCity);
    if (toCity) params.set('to', toCity);
    if (date) params.set('date', date);
    router.push(`/trips?${params.toString()}`);
  };

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-primary to-brand-secondary px-4 py-16 text-white sm:py-24">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-2 text-sm font-medium text-brand-light">Carry more. Share the journey.</p>
          <h1 className="mb-4 text-3xl font-bold sm:text-5xl">
            Send anything between Canberra, Sydney, and Melbourne with someone you trust
          </h1>
          <p className="mb-8 text-lg text-brand-light">
            CarryMate connects community members travelling between cities with people who need
            things delivered. Safe. Affordable. Trusted.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/trips">
              <Button size="lg" className="w-full bg-white text-brand-primary hover:bg-brand-light sm:w-auto">
                Find a carrier today
              </Button>
            </Link>
            <Link href="/trips/new">
              <Button size="lg" variant="outline" className="w-full border-white text-white hover:bg-white/10 sm:w-auto">
                Post your trip
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Search widget */}
      <section className="mx-auto max-w-3xl px-4 -mt-8">
        <Card className="shadow-lg">
          <form onSubmit={handleSearch} className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">From</label>
              <select
                value={fromCity}
                onChange={(e) => setFromCity(e.target.value as City | '')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Any city</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">To</label>
              <select
                value={toCity}
                onChange={(e) => setToCity(e.target.value as City | '')}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Any city</option>
                {CITIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
          </form>
        </Card>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="mb-10 text-center text-2xl font-bold text-gray-900">How it works</h2>
        <div className="grid gap-8 md:grid-cols-3">
          {[
            { icon: MapPin, title: 'Post your trip or find a carrier', desc: 'Browse available trips or list your upcoming journey between cities.' },
            { icon: CreditCard, title: 'Agree on the details and pay securely', desc: 'Complete a legal declaration and pay through escrow — your money is protected.' },
            { icon: Package, title: 'Track your item and confirm delivery', desc: 'Chat in-app, confirm pickup and delivery, then rate your experience.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-light">
                <Icon className="h-7 w-7 text-brand-primary" />
              </div>
              <h3 className="mb-2 font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trust signals */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-10 text-center text-2xl font-bold text-gray-900">Why trust CarryMate</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Shield, title: 'Escrow payments', desc: 'Your money is protected until delivery is confirmed.' },
              { icon: Users, title: 'Verified community', desc: 'Built for the Nepalese and South Asian diaspora in Australia.' },
              { icon: FileCheck, title: 'Legal declarations', desc: 'Every delivery requires a binding prohibited items declaration.' },
              { icon: AlertCircle, title: 'Emergency support', desc: 'Police stop documentation available instantly when you need it.' },
            ].map(({ icon: Icon, title, desc }) => (
              <Card key={title} padding className="text-center">
                <Icon className="mx-auto mb-3 h-8 w-8 text-brand-accent" />
                <h3 className="mb-1 font-semibold text-gray-900">{title}</h3>
                <p className="text-sm text-gray-600">{desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Community */}
      <section className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h2 className="mb-4 text-2xl font-bold text-gray-900">
          Built for the Nepalese community in Australia
        </h2>
        <p className="text-gray-600">
          Our community already carries food, gifts, and documents between cities through WhatsApp.
          CarryMate formalises this with escrow payments, item declarations, and a trust layer —
          so you can help each other safely and earn while you travel.
        </p>
      </section>
    </div>
  );
}
