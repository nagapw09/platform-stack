'use client';

import { useEffect, useState } from 'react';
import StatusBadge from './components/StatusBadge';
import PricingCard from './components/PricingCard';
import ApiDemo from './components/ApiDemo';
import MonkBadge from './components/MonkBadge';
import type { HealthStatus, ProductInfo, SubscriptionStats } from '@/lib/types';

interface SubscriptionsData {
  stats: SubscriptionStats;
  customers: number;
}

export default function Home() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [products, setProducts] = useState<ProductInfo[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch health status
        const healthRes = await fetch('/api/health');
        const healthData = await healthRes.json();
        if (healthData.success) {
          setHealth(healthData.data);
        }

        // Fetch products
        const productsRes = await fetch('/api/products');
        const productsData = await productsRes.json();
        if (productsData.success) {
          setProducts(productsData.data);
        }

        // Fetch subscriptions if database is configured
        const subsRes = await fetch('/api/subscriptions');
        const subsData = await subsRes.json();
        if (subsData.success) {
          setSubscriptions(subsData.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleCheckout = async (priceId: string) => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      
      if (data.success && data.data.url) {
        window.location.href = data.data.url;
      } else {
        alert(data.error || 'Failed to create checkout session');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Checkout failed');
    }
  };

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">M</span>
              </div>
              <span className="font-semibold text-lg text-white">Monk Demo</span>
            </div>
            {health && (
              <StatusBadge status={health.status} label={`API ${health.status}`} />
            )}
          </div>
          <MonkBadge />
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="animate-fade-in">
          <span className="inline-block px-4 py-1.5 bg-indigo-500/20 text-indigo-300 rounded-full text-sm font-medium mb-6 border border-indigo-500/30">
            Next.js + Stripe + PostgreSQL + Monk
          </span>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight animate-fade-in animate-fade-in-delay-1">
          Full-Stack Deployment
          <br />
          <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent glow-text">
            Made Simple
          </span>
        </h1>
        
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 animate-fade-in animate-fade-in-delay-2">
          This demo showcases how Monk deploys your Next.js backend to containers, 
          PostgreSQL database, and integrates Stripe—all in one go.
        </p>

        <div className="flex items-center justify-center gap-4 animate-fade-in animate-fade-in-delay-3">
          <a href="#api" className="btn-primary">
            Explore API
          </a>
          <a
            href="https://github.com/monk-io/monk-entities"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 border border-white/20 rounded-xl text-white font-medium hover:bg-white/5 transition-colors"
          >
            View on GitHub
          </a>
        </div>
      </section>

      {/* Status Grid */}
      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-fade-in animate-fade-in-delay-4">
          {[
            {
              label: 'Backend',
              value: 'Container',
              description: 'Next.js API routes in Docker',
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              ),
              status: 'healthy' as const,
            },
            {
              label: 'PostgreSQL',
              value: health?.database.connected ? 'Connected' : health?.database.configured ? 'Disconnected' : 'Not Configured',
              description: health?.database.connected ? 'Storing subscriptions' : 'Configure DATABASE_HOST',
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              ),
              status: health?.database.connected ? 'healthy' as const : health?.database.configured ? 'unhealthy' as const : 'degraded' as const,
            },
            {
              label: 'Stripe',
              value: health?.stripe.configured ? 'Connected' : 'Not Configured',
              description: health?.stripe.mode === 'live' ? 'Live mode' : 'Test mode',
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              ),
              status: health?.stripe.configured ? 'healthy' as const : 'degraded' as const,
            },
            {
              label: 'Subscriptions',
              value: subscriptions ? `${subscriptions.stats.active} active` : 'N/A',
              description: subscriptions ? `${subscriptions.customers} customers` : 'Database required',
              icon: (
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              ),
              status: subscriptions ? 'healthy' as const : 'degraded' as const,
            },
          ].map((item, i) => (
            <div key={i} className="glass-card p-6">
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-xl ${
                  item.status === 'healthy' ? 'bg-emerald-500/20 text-emerald-400' :
                  item.status === 'unhealthy' ? 'bg-red-500/20 text-red-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>
                  {item.icon}
                </div>
                <div>
                  <div className="text-gray-400 text-sm">{item.label}</div>
                  <div className="text-white font-semibold text-lg">{item.value}</div>
                  <div className="text-gray-500 text-sm mt-1">{item.description}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Subscription Stats (if database connected) */}
      {subscriptions && subscriptions.stats.total > 0 && (
        <section className="max-w-7xl mx-auto px-6 pb-16">
          <div className="glass-card p-8">
            <h3 className="text-xl font-semibold text-white mb-6">Subscription Analytics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { label: 'Active', value: subscriptions.stats.active, color: 'text-emerald-400' },
                { label: 'Trialing', value: subscriptions.stats.trialing, color: 'text-blue-400' },
                { label: 'Canceled', value: subscriptions.stats.canceled, color: 'text-red-400' },
                { label: 'Total', value: subscriptions.stats.total, color: 'text-white' },
              ].map((stat, i) => (
                <div key={i} className="text-center">
                  <div className={`text-4xl font-bold ${stat.color}`}>{stat.value}</div>
                  <div className="text-gray-400 text-sm mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Pricing Section */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            {products.length > 0 ? 'Available Plans' : 'Pricing Demo'}
          </h2>
          <p className="text-gray-400">
            {products.length > 0 
              ? 'Products and prices loaded from Stripe via Monk entity integration'
              : 'Configure STRIPE_PRODUCT_ID to load real products'
            }
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-96 rounded-2xl" />
            ))}
          </div>
        ) : error ? (
          <div className="glass-card p-8 text-center">
            <div className="text-red-400 mb-2">Failed to load products</div>
            <div className="text-gray-500 text-sm">{error}</div>
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {products.map((product, i) => (
              <PricingCard 
                key={product.id} 
                product={product} 
                featured={i === 1}
                onCheckout={handleCheckout}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: 'Starter', price: '$9', desc: 'Perfect for small projects' },
              { name: 'Pro', price: '$29', desc: 'Best for growing businesses', featured: true },
              { name: 'Enterprise', price: '$99', desc: 'For large-scale operations' },
            ].map((plan, i) => (
              <div key={i} className={`pricing-card glass-card p-8 ${plan.featured ? 'featured animated-border' : ''}`}>
                {plan.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-semibold px-4 py-1 rounded-full">
                      DEMO
                    </span>
                  </div>
                )}
                <h3 className="text-xl font-semibold text-white mb-2">{plan.name}</h3>
                <p className="text-gray-400 text-sm mb-6">{plan.desc}</p>
                <div className="text-4xl font-bold text-white mb-8">
                  {plan.price}<span className="text-gray-400 text-lg">/mo</span>
                </div>
                <button 
                  className="btn-primary w-full opacity-50 cursor-not-allowed"
                  disabled
                >
                  Configure Stripe
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* API Demo Section */}
      <section id="api" className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">REST API</h2>
          <p className="text-gray-400">
            Explore the backend API endpoints powered by Next.js API routes
          </p>
        </div>
        <ApiDemo health={health} />
      </section>

      {/* Monk Integration Section */}
      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="glass-card p-8 md:p-12">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl font-bold text-white mb-4">
                Monk Entity Integration
              </h2>
              <p className="text-gray-400 mb-6">
                This demo uses Monk to automatically provision and configure:
              </p>
              <ul className="space-y-3">
                {[
                  'postgres - PostgreSQL database container',
                  'stripe/credentials - API keys and account info',
                  'stripe/webhook-endpoint - Webhook URL and signing secret',
                  'stripe/product - Product managed by Monk',
                  'stripe/price - Pricing configuration',
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-300">
                    <span className="text-indigo-400 mt-1">→</span>
                    <span className="font-mono text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="code-block">
              <pre className="text-xs text-gray-300 overflow-x-auto">{`app:
  defines: runnable
  connections:
    database:
      runnable: nextjs-stripe-demo/postgres
    creds:
      runnable: nextjs-stripe-demo/stripe-creds
    webhook:
      runnable: nextjs-stripe-demo/stripe-webhook
  variables:
    DATABASE_HOST:
      value: <- connection-hostname("database")
    DATABASE_PASSWORD:
      value: <- secret("postgres-password")
    STRIPE_SECRET_KEY:
      value: <- secret($stripe_secret_ref)
    STRIPE_PRODUCT_ID:
      value: <- connection-target("product") 
             entity-state get-member("product_id")`}</pre>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-gray-500 text-sm">
            Demo application for Monk deployment showcase
          </div>
          <div className="flex items-center gap-6">
            <a href="/api/health" className="text-gray-400 hover:text-white text-sm transition-colors">
              Health Check
            </a>
            <a href="https://docs.monk.io" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm transition-colors">
              Monk Docs
            </a>
            <a href="https://stripe.com/docs" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white text-sm transition-colors">
              Stripe Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
