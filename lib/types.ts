// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Health check types
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  environment: string;
  stripe: {
    configured: boolean;
    mode: string;
    hasWebhookSecret: boolean;
    hasProductId: boolean;
    hasPriceId: boolean;
  };
  database: {
    configured: boolean;
    connected: boolean;
    error?: string;
  };
  uptime: number;
}

// Subscription types for API
export interface SubscriptionRecord {
  id: number;
  stripe_subscription_id: string;
  stripe_customer_id: string;
  stripe_price_id: string | null;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  created_at: string;
  email?: string;
  name?: string;
}

export interface SubscriptionStats {
  active: number;
  trialing: number;
  canceled: number;
  total: number;
}

// Checkout types
export interface CreateCheckoutRequest {
  priceId?: string;
  quantity?: number;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

// Product types
export interface ProductInfo {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  prices: PriceInfo[];
}

export interface PriceInfo {
  id: string;
  currency: string;
  unitAmount: number | null;
  recurring: {
    interval: string;
    intervalCount: number;
  } | null;
  active: boolean;
}

// Webhook types
export interface WebhookEvent {
  type: string;
  id: string;
  created: number;
}

