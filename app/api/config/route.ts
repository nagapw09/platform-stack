import { NextResponse } from 'next/server';
import { stripeConfig, isStripeConfigured } from '@/lib/stripe';
import type { ApiResponse } from '@/lib/types';

interface ConfigResponse {
  publishableKey: string;
  mode: string;
  productId?: string;
  priceId?: string;
}

export async function GET(): Promise<NextResponse<ApiResponse<ConfigResponse>>> {
  if (!isStripeConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'Stripe is not configured. Please set STRIPE_PUBLISHABLE_KEY environment variable.',
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }

  return NextResponse.json({
    success: true,
    data: {
      publishableKey: stripeConfig.publishableKey,
      mode: stripeConfig.mode,
      productId: stripeConfig.productId,
      priceId: stripeConfig.priceId,
    },
    timestamp: new Date().toISOString(),
  });
}

