import { NextResponse } from 'next/server';
import { isDatabaseConfigured, initializeDatabase } from '@/lib/db';
import type { ApiResponse } from '@/lib/types';

// Initialize database schema
// This endpoint should be called once during deployment
export async function POST(): Promise<NextResponse<ApiResponse<{ initialized: boolean }>>> {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({
      success: false,
      error: 'Database is not configured. Set DATABASE_HOST and DATABASE_PASSWORD.',
      timestamp: new Date().toISOString(),
    }, { status: 503 });
  }

  try {
    await initializeDatabase();

    return NextResponse.json({
      success: true,
      data: { initialized: true },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error initializing database:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize database',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

