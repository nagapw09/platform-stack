'use client';

import { useState } from 'react';
import type { HealthStatus } from '@/lib/types';

interface ApiDemoProps {
  health: HealthStatus | null;
}

export default function ApiDemo({ health }: ApiDemoProps) {
  const [activeTab, setActiveTab] = useState<'health' | 'products' | 'checkout' | 'subscriptions' | 'webhook'>('health');

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  
  const endpoints = {
    health: {
      method: 'GET',
      path: '/api/health',
      description: 'Check service health, Stripe config, and database connection status',
      example: `curl ${baseUrl}/api/health`,
    },
    products: {
      method: 'GET',
      path: '/api/products',
      description: 'List available products and prices from Stripe',
      example: `curl ${baseUrl}/api/products`,
    },
    checkout: {
      method: 'POST',
      path: '/api/checkout',
      description: 'Create a Stripe checkout session for subscription',
      example: `curl -X POST ${baseUrl}/api/checkout \\
  -H "Content-Type: application/json" \\
  -d '{"priceId": "price_xxx"}'`,
    },
    subscriptions: {
      method: 'GET',
      path: '/api/subscriptions',
      description: 'List active subscriptions and stats from PostgreSQL',
      example: `curl ${baseUrl}/api/subscriptions

# Also available:
# GET /api/webhooks/events - List recent webhook events
# POST /api/db/init - Initialize database schema`,
    },
    webhook: {
      method: 'POST',
      path: '/api/webhooks/stripe',
      description: 'Stripe webhook endpoint - stores events in PostgreSQL',
      example: `# Configured via Monk's stripe/webhook-endpoint entity
# Events handled:
#   - checkout.session.completed
#   - customer.subscription.created/updated/deleted
#   - customer.created/updated
#   - invoice.payment_succeeded/failed
# All events stored in webhook_events table`,
    },
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="border-b border-white/10">
        <div className="flex overflow-x-auto">
          {Object.entries(endpoints).map(([key, endpoint]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as typeof activeTab)}
              className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === key
                  ? 'text-white border-b-2 border-indigo-500 bg-white/5'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <span className={`mr-2 text-xs font-mono ${
                endpoint.method === 'GET' ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {endpoint.method}
              </span>
              {endpoint.path}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        <p className="text-gray-400 mb-4">{endpoints[activeTab].description}</p>
        
        <div className="code-block">
          <pre className="text-gray-300 whitespace-pre-wrap">
            <code>{endpoints[activeTab].example}</code>
          </pre>
        </div>

        {activeTab === 'health' && health && (
          <div className="mt-6 p-4 bg-black/20 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Live Response:</h4>
            <pre className="text-xs text-indigo-300 overflow-x-auto">
              {JSON.stringify({
                success: true,
                data: health,
                timestamp: new Date().toISOString(),
              }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
