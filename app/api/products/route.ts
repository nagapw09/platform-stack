import { NextResponse } from 'next/server';
import { getStripe, isStripeConfigured, stripeConfig } from '@/lib/stripe';
import type { ApiResponse, ProductInfo, PriceInfo } from '@/lib/types';

export async function GET(): Promise<NextResponse<ApiResponse<ProductInfo[]>>> {
  if (!isStripeConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'Stripe is not configured',
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }

  try {
    const stripe = getStripe();
    
    // If we have a specific product ID from Monk, fetch just that product
    if (stripeConfig.productId) {
      const product = await stripe.products.retrieve(stripeConfig.productId);
      const prices = await stripe.prices.list({
        product: product.id,
        active: true,
      });

      const productInfo: ProductInfo = {
        id: product.id,
        name: product.name,
        description: product.description,
        active: product.active,
        prices: prices.data.map((price): PriceInfo => ({
          id: price.id,
          currency: price.currency,
          unitAmount: price.unit_amount,
          recurring: price.recurring ? {
            interval: price.recurring.interval,
            intervalCount: price.recurring.interval_count,
          } : null,
          active: price.active,
        })),
      };

      return NextResponse.json({
        success: true,
        data: [productInfo],
        timestamp: new Date().toISOString(),
      });
    }

    // Otherwise, fetch all active products
    const products = await stripe.products.list({
      active: true,
      limit: 10,
    });

    const productsWithPrices: ProductInfo[] = await Promise.all(
      products.data.map(async (product) => {
        const prices = await stripe.prices.list({
          product: product.id,
          active: true,
        });

        return {
          id: product.id,
          name: product.name,
          description: product.description,
          active: product.active,
          prices: prices.data.map((price): PriceInfo => ({
            id: price.id,
            currency: price.currency,
            unitAmount: price.unit_amount,
            recurring: price.recurring ? {
              interval: price.recurring.interval,
              intervalCount: price.recurring.interval_count,
            } : null,
            active: price.active,
          })),
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: productsWithPrices,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch products',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

