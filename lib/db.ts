import { Pool, PoolClient } from 'pg';

// Database configuration - injected by Monk
function getDbConfig() {
  return {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'monk_demo',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || '',
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  };
}

// Lazy-initialized connection pool
let _pool: Pool | null = null;
let _dbInitPromise: Promise<void> | null = null;

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool(getDbConfig());
  }
  return _pool;
}

// Helper to check if database is configured
export function isDatabaseConfigured(): boolean {
  return !!(process.env.DATABASE_HOST && process.env.DATABASE_PASSWORD);
}

export function isDatabaseAutoInitEnabled(): boolean {
  // Default: enabled. Set DATABASE_AUTO_INIT=false to disable.
  return process.env.DATABASE_AUTO_INIT !== 'false';
}

// Ensure the database schema exists (idempotent).
// Note: this runs at most once per server instance (single-flight),
// but is still safe to run multiple times across instances because the DDL is IF NOT EXISTS.
export async function ensureDatabaseInitialized(): Promise<void> {
  console.log('ensureDatabaseInitialized', isDatabaseConfigured(), isDatabaseAutoInitEnabled());
  if (!isDatabaseConfigured() || !isDatabaseAutoInitEnabled()) return;

  if (!_dbInitPromise) {
    _dbInitPromise = (async () => {
      try {
        await initializeDatabase();
      } catch (error) {
        // Allow retry on subsequent calls if initialization failed.
        _dbInitPromise = null;
        throw error;
      }
    })();
  }

  return _dbInitPromise;
}

// Get database status for health checks
export async function getDatabaseStatus(): Promise<{
  configured: boolean;
  connected: boolean;
  error?: string;
}> {
  if (!isDatabaseConfigured()) {
    return { configured: false, connected: false };
  }

  try {
    // Best-effort: auto-initialize schema before reporting status.
    // If this fails, the health check should still reflect the underlying DB issue.
    await ensureDatabaseInitialized();
    const pool = getPool();
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return { configured: true, connected: true };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Transaction helper
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Initialize database schema
export async function initializeDatabase(): Promise<void> {
  const pool = getPool();
  
  await pool.query(`
    -- Customers table (synced from Stripe)
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255),
      name VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Subscriptions table (synced from Stripe)
    CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
      stripe_customer_id VARCHAR(255) NOT NULL REFERENCES customers(stripe_customer_id),
      stripe_price_id VARCHAR(255),
      status VARCHAR(50) NOT NULL,
      current_period_start TIMESTAMP WITH TIME ZONE,
      current_period_end TIMESTAMP WITH TIME ZONE,
      canceled_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Webhook events table (for idempotency and debugging)
    CREATE TABLE IF NOT EXISTS webhook_events (
      id SERIAL PRIMARY KEY,
      stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
      event_type VARCHAR(100) NOT NULL,
      payload JSONB NOT NULL,
      processed BOOLEAN DEFAULT FALSE,
      processed_at TIMESTAMP WITH TIME ZONE,
      error TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Checkout sessions table
    CREATE TABLE IF NOT EXISTS checkout_sessions (
      id SERIAL PRIMARY KEY,
      stripe_session_id VARCHAR(255) UNIQUE NOT NULL,
      stripe_customer_id VARCHAR(255),
      status VARCHAR(50),
      payment_status VARCHAR(50),
      amount_total INTEGER,
      currency VARCHAR(10),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(stripe_customer_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
    CREATE INDEX IF NOT EXISTS idx_webhook_events_type ON webhook_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
  `);
}

// Customer operations
export const customers = {
  async upsert(stripeCustomerId: string, email?: string, name?: string) {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO customers (stripe_customer_id, email, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (stripe_customer_id) 
       DO UPDATE SET email = COALESCE($2, customers.email), 
                     name = COALESCE($3, customers.name),
                     updated_at = NOW()
       RETURNING *`,
      [stripeCustomerId, email, name]
    );
    return result.rows[0];
  },

  async findByStripeId(stripeCustomerId: string) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM customers WHERE stripe_customer_id = $1',
      [stripeCustomerId]
    );
    return result.rows[0] || null;
  },

  async list(limit = 50, offset = 0) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM customers ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return result.rows;
  },
};

// Subscription operations
export const subscriptions = {
  async upsert(data: {
    stripeSubscriptionId: string;
    stripeCustomerId: string;
    stripePriceId?: string;
    status: string;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
    canceledAt?: Date;
  }) {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO subscriptions (
        stripe_subscription_id, stripe_customer_id, stripe_price_id, 
        status, current_period_start, current_period_end, canceled_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (stripe_subscription_id) 
       DO UPDATE SET status = $4,
                     stripe_price_id = COALESCE($3, subscriptions.stripe_price_id),
                     current_period_start = COALESCE($5, subscriptions.current_period_start),
                     current_period_end = COALESCE($6, subscriptions.current_period_end),
                     canceled_at = $7,
                     updated_at = NOW()
       RETURNING *`,
      [
        data.stripeSubscriptionId,
        data.stripeCustomerId,
        data.stripePriceId,
        data.status,
        data.currentPeriodStart,
        data.currentPeriodEnd,
        data.canceledAt,
      ]
    );
    return result.rows[0];
  },

  async findByCustomer(stripeCustomerId: string) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM subscriptions WHERE stripe_customer_id = $1 ORDER BY created_at DESC',
      [stripeCustomerId]
    );
    return result.rows;
  },

  async listActive(limit = 50, offset = 0) {
    const pool = getPool();
    const result = await pool.query(
      `SELECT s.*, c.email, c.name 
       FROM subscriptions s 
       JOIN customers c ON s.stripe_customer_id = c.stripe_customer_id
       WHERE s.status IN ('active', 'trialing')
       ORDER BY s.created_at DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  },

  async count() {
    const pool = getPool();
    const result = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'active') as active,
        COUNT(*) FILTER (WHERE status = 'trialing') as trialing,
        COUNT(*) FILTER (WHERE status = 'canceled') as canceled,
        COUNT(*) as total
       FROM subscriptions`
    );
    return result.rows[0];
  },
};

// Webhook event operations
export const webhookEvents = {
  async create(stripeEventId: string, eventType: string, payload: unknown) {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO webhook_events (stripe_event_id, event_type, payload)
       VALUES ($1, $2, $3)
       ON CONFLICT (stripe_event_id) DO NOTHING
       RETURNING *`,
      [stripeEventId, eventType, JSON.stringify(payload)]
    );
    return result.rows[0] || null;
  },

  async markProcessed(stripeEventId: string, error?: string) {
    const pool = getPool();
    await pool.query(
      `UPDATE webhook_events 
       SET processed = TRUE, processed_at = NOW(), error = $2
       WHERE stripe_event_id = $1`,
      [stripeEventId, error]
    );
  },

  async exists(stripeEventId: string) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT 1 FROM webhook_events WHERE stripe_event_id = $1 AND processed = TRUE',
      [stripeEventId]
    );
    return result.rows.length > 0;
  },

  async listRecent(limit = 50) {
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, stripe_event_id, event_type, processed, error, created_at FROM webhook_events ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows;
  },
};

// Checkout session operations
export const checkoutSessions = {
  async upsert(data: {
    stripeSessionId: string;
    stripeCustomerId?: string;
    status?: string;
    paymentStatus?: string;
    amountTotal?: number;
    currency?: string;
  }) {
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO checkout_sessions (
        stripe_session_id, stripe_customer_id, status, payment_status, amount_total, currency
      ) VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (stripe_session_id) 
       DO UPDATE SET stripe_customer_id = COALESCE($2, checkout_sessions.stripe_customer_id),
                     status = COALESCE($3, checkout_sessions.status),
                     payment_status = COALESCE($4, checkout_sessions.payment_status),
                     amount_total = COALESCE($5, checkout_sessions.amount_total),
                     currency = COALESCE($6, checkout_sessions.currency),
                     updated_at = NOW()
       RETURNING *`,
      [
        data.stripeSessionId,
        data.stripeCustomerId,
        data.status,
        data.paymentStatus,
        data.amountTotal,
        data.currency,
      ]
    );
    return result.rows[0];
  },
};

