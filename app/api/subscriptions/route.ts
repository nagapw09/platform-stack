import { NextRequest, NextResponse } from 'next/server';
import { ensureDatabaseInitialized, isDatabaseConfigured, subscriptions, customers } from '@/lib/db';
import type { ApiResponse, SubscriptionRecord, SubscriptionStats } from '@/lib/types';

interface SubscriptionsResponse {
  subscriptions: SubscriptionRecord[];
  stats: SubscriptionStats;
  customers: number;
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<SubscriptionsResponse>>> {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'Database is not configured. Set DATABASE_HOST and DATABASE_PASSWORD.',
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }

  try {
    await ensureDatabaseInitialized();
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');
    const offset = parseInt(request.nextUrl.searchParams.get('offset') || '0');

    const [activeSubscriptions, stats, customerList] = await Promise.all([
      subscriptions.listActive(limit, offset),
      subscriptions.count(),
      customers.list(1, 0), // Just to get count
    ]);

    // Get total customer count
    const allCustomers = await customers.list(1000, 0);

    return NextResponse.json({
      success: true,
      data: {
        subscriptions: activeSubscriptions,
        stats: {
          active: parseInt(stats.active) || 0,
          trialing: parseInt(stats.trialing) || 0,
          canceled: parseInt(stats.canceled) || 0,
          total: parseInt(stats.total) || 0,
        },
        customers: allCustomers.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch subscriptions',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

