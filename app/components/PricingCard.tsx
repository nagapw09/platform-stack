'use client';

import { useState } from 'react';
import type { ProductInfo, PriceInfo } from '@/lib/types';

interface PricingCardProps {
  product: ProductInfo;
  featured?: boolean;
  onCheckout: (priceId: string) => Promise<void>;
}

function formatPrice(amount: number | null, currency: string): string {
  if (amount === null) return 'Custom';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function formatInterval(price: PriceInfo): string {
  if (!price.recurring) return 'one-time';
  const { interval, intervalCount } = price.recurring;
  if (intervalCount === 1) return `/${interval}`;
  return `/${intervalCount} ${interval}s`;
}

export default function PricingCard({ product, featured, onCheckout }: PricingCardProps) {
  const [loading, setLoading] = useState(false);
  const primaryPrice = product.prices[0];

  const handleCheckout = async () => {
    if (!primaryPrice) return;
    setLoading(true);
    try {
      await onCheckout(primaryPrice.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className={`pricing-card glass-card p-8 flex flex-col ${
        featured ? 'featured animated-border' : ''
      }`}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-semibold px-4 py-1 rounded-full">
            POPULAR
          </span>
        </div>
      )}
      
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-white mb-2">{product.name}</h3>
        {product.description && (
          <p className="text-gray-400 text-sm">{product.description}</p>
        )}
      </div>

      <div className="mb-8">
        {primaryPrice ? (
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-white">
              {formatPrice(primaryPrice.unitAmount, primaryPrice.currency)}
            </span>
            <span className="text-gray-400">
              {formatInterval(primaryPrice)}
            </span>
          </div>
        ) : (
          <span className="text-2xl font-bold text-gray-400">No price available</span>
        )}
      </div>

      <div className="flex-1 mb-8">
        <ul className="space-y-3">
          {['Full API access', 'Webhook integration', 'Email support', 'Analytics dashboard'].map((feature, i) => (
            <li key={i} className="flex items-center gap-3 text-gray-300">
              <svg className="w-5 h-5 text-indigo-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      <button 
        className="btn-primary w-full"
        onClick={handleCheckout}
        disabled={loading || !primaryPrice}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Processing...
          </span>
        ) : (
          'Subscribe Now'
        )}
      </button>
    </div>
  );
}

