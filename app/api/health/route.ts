import { NextResponse } from 'next/server';
import { getStripeStatus } from '@/lib/stripe';
import { getDatabaseStatus } from '@/lib/db';
import type { ApiResponse, HealthStatus } from '@/lib/types';

const startTime = Date.now();

export async function GET(): Promise<NextResponse<ApiResponse<HealthStatus>>> {
  const stripeStatus = getStripeStatus();
  const dbStatus = await getDatabaseStatus();
  
  // Determine overall health status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (!stripeStatus.configured || !dbStatus.configured) {
    overallStatus = 'degraded';
  }
  if (dbStatus.configured && !dbStatus.connected) {
    overallStatus = 'unhealthy';
  }
  
  const status: HealthStatus = {
    status: overallStatus,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    stripe: stripeStatus,
    database: dbStatus,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  return NextResponse.json({
    success: true,
    data: status,
    timestamp: new Date().toISOString(),
  });
}
