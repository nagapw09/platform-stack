import Stripe from 'stripe';

// Stripe configuration using environment variables
// These are injected by Monk's Stripe entity integration
export const stripeConfig = {
  secretKey: process.env.STRIPE_SECRET_KEY || '',
  publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  accountId: process.env.STRIPE_ACCOUNT_ID,
  mode: process.env.STRIPE_MODE || 'test',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  productId: process.env.STRIPE_PRODUCT_ID,
  priceId: process.env.STRIPE_PRICE_ID,
};

// Lazy-initialized Stripe client (avoids build-time errors)
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!stripeConfig.secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    _stripe = new Stripe(stripeConfig.secretKey, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    });
  }
  return _stripe;
}

// Legacy export for backward compatibility
export const stripe = {
  get checkout() { return getStripe().checkout; },
  get customers() { return getStripe().customers; },
  get products() { return getStripe().products; },
  get prices() { return getStripe().prices; },
  get subscriptions() { return getStripe().subscriptions; },
  get invoices() { return getStripe().invoices; },
  get webhooks() { return getStripe().webhooks; },
};

// Helper to check if Stripe is configured
export function isStripeConfigured(): boolean {
  return !!(
    process.env.STRIPE_SECRET_KEY && 
    process.env.STRIPE_PUBLISHABLE_KEY
  );
}

// Get configuration status for health checks
export function getStripeStatus() {
  return {
    configured: isStripeConfigured(),
    mode: stripeConfig.mode,
    hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
    hasProductId: !!process.env.STRIPE_PRODUCT_ID,
    hasPriceId: !!process.env.STRIPE_PRICE_ID,
  };
}
