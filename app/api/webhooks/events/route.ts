import { NextRequest, NextResponse } from 'next/server';
import { ensureDatabaseInitialized, isDatabaseConfigured, webhookEvents } from '@/lib/db';
import type { ApiResponse } from '@/lib/types';

interface WebhookEventRecord {
  id: number;
  stripe_event_id: string;
  event_type: string;
  processed: boolean;
  error: string | null;
  created_at: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<WebhookEventRecord[]>>> {
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
    const events = await webhookEvents.listRecent(limit);

    return NextResponse.json({
      success: true,
      data: events,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching webhook events:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch webhook events',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

