# Next.js + Stripe + PostgreSQL Demo for Monk

A full-stack Next.js demo application showcasing how [Monk](https://monk.io) can deploy:
- **Backend** to a container (Next.js API routes)
- **PostgreSQL** database with automatic schema setup
- **Stripe integration** configured automatically via Monk entities
- **Frontend** to specialized hosting

## Features

### REST API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check with Stripe & database status |
| `/api/config` | GET | Public Stripe configuration (publishable key) |
| `/api/products` | GET | List products and prices from Stripe |
| `/api/checkout` | POST | Create a Stripe checkout session |
| `/api/checkout?session_id=xxx` | GET | Retrieve checkout session status |
| `/api/subscriptions` | GET | List subscriptions and stats from database |
| `/api/webhooks/stripe` | POST | Stripe webhook handler (stores in DB) |
| `/api/webhooks/events` | GET | List recent webhook events |
| `/api/db/init` | POST | Initialize database schema |

### Database Schema

PostgreSQL stores:
- **customers** - Synced from Stripe customer events
- **subscriptions** - Subscription status and periods
- **checkout_sessions** - Completed checkout sessions
- **webhook_events** - All webhook events for idempotency

### Frontend Pages

- **/** - Main landing page with pricing, stats, and API demo
- **/success** - Checkout success page
- **/canceled** - Checkout canceled page

## Monk Integration

This demo uses Monk to automatically provision:

- `postgres` - PostgreSQL 16 database container
- `stripe/credentials` - API keys and account configuration
- `stripe/webhook-endpoint` - Webhook URL with signing secret
- `stripe/product` - Product managed by Monk
- `stripe/price` - Pricing configuration

### Environment Variables

All configuration is injected automatically by Monk:

```bash
# Stripe
STRIPE_SECRET_KEY      # Stripe secret API key
STRIPE_PUBLISHABLE_KEY # Stripe publishable key
STRIPE_ACCOUNT_ID      # Stripe account ID
STRIPE_MODE            # "test" or "live"
STRIPE_WEBHOOK_SECRET  # Webhook signing secret
STRIPE_PRODUCT_ID      # Monk-managed product ID
STRIPE_PRICE_ID        # Monk-managed price ID

# Database
DATABASE_HOST          # PostgreSQL host
DATABASE_PORT          # PostgreSQL port (default: 5432)
DATABASE_NAME          # Database name
DATABASE_USER          # Database user
DATABASE_PASSWORD      # Database password

# App
NEXT_PUBLIC_APP_URL    # Application URL
```

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start PostgreSQL locally:
   ```bash
   docker run -d --name postgres \
     -e POSTGRES_DB=monk_demo \
     -e POSTGRES_USER=monk \
     -e POSTGRES_PASSWORD=secret \
     -p 5432:5432 \
     postgres:16-alpine
   ```

3. Create a `.env.local` file:
   ```bash
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   DATABASE_HOST=localhost
   DATABASE_NAME=monk_demo
   DATABASE_USER=monk
   DATABASE_PASSWORD=secret
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. Initialize the database:
   ```bash
   curl -X POST http://localhost:3000/api/db/init
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000)

## Docker Build

```bash
# Build the image
docker build -t nextjs-stripe-demo .

# Run locally with database
docker network create monk-demo

docker run -d --name postgres --network monk-demo \
  -e POSTGRES_DB=monk_demo \
  -e POSTGRES_USER=monk \
  -e POSTGRES_PASSWORD=secret \
  postgres:16-alpine

docker run -p 3000:3000 --network monk-demo \
  -e STRIPE_SECRET_KEY=sk_test_... \
  -e STRIPE_PUBLISHABLE_KEY=pk_test_... \
  -e DATABASE_HOST=postgres \
  -e DATABASE_NAME=monk_demo \
  -e DATABASE_USER=monk \
  -e DATABASE_PASSWORD=secret \
  nextjs-stripe-demo
```

## Deploy with Monk

```bash
# Load the manifest
monk load monk.yaml

# Set your secrets
monk secrets set stripe-api-key -- "sk_test_..."
monk secrets set postgres-password -- "your-secure-password"

# Deploy everything
monk run nextjs-stripe-demo/app

# Initialize database schema
curl -X POST https://your-app-url/api/db/init
```

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── checkout/route.ts        # Checkout session API
│   │   ├── config/route.ts          # Public config API
│   │   ├── db/init/route.ts         # Database initialization
│   │   ├── health/route.ts          # Health check API
│   │   ├── products/route.ts        # Products listing API
│   │   ├── subscriptions/route.ts   # Subscriptions API
│   │   └── webhooks/
│   │       ├── events/route.ts      # Webhook events list
│   │       └── stripe/route.ts      # Webhook handler
│   ├── components/
│   │   ├── ApiDemo.tsx              # API documentation
│   │   ├── MonkBadge.tsx            # Monk branding
│   │   ├── PricingCard.tsx          # Pricing display
│   │   └── StatusBadge.tsx          # Status indicators
│   ├── canceled/page.tsx            # Checkout canceled
│   ├── success/page.tsx             # Checkout success
│   ├── globals.css                  # Global styles
│   ├── layout.tsx                   # Root layout
│   └── page.tsx                     # Main page
├── lib/
│   ├── db.ts                        # PostgreSQL client & queries
│   ├── stripe.ts                    # Stripe configuration
│   └── types.ts                     # TypeScript types
├── Dockerfile                       # Container build
├── monk.yaml                        # Monk deployment config
└── package.json
```

## License

MIT
