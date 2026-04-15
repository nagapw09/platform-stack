import { ensureDatabaseInitialized } from '@/lib/db';

// Runs once per server instance at startup (Node runtime).
// In multi-instance deployments this may run multiple times, but DB init is idempotent.
export async function register(): Promise<void> {
  try {
    await ensureDatabaseInitialized();
  } catch (error) {
    // Don't crash the server on boot if DB isn't ready yet.
    console.error('Database auto-initialization failed:', error);
  }
}

