import { NextRequest, NextResponse } from 'next/server';
import { getStripe, stripeConfig } from '@/lib/stripe';
import { ensureDatabaseInitialized, isDatabaseConfigured, webhookEvents, customers, subscriptions, checkoutSessions } from '@/lib/db';
import type { ApiResponse } from '@/lib/types';
import Stripe from 'stripe';

// Webhook handler for Stripe events
// The webhook URL should be configured in Monk's stripe/webhook-endpoint entity
export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse>> {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({
      success: false,
      error: 'Missing stripe-signature header',
      timestamp: new Date().toISOString(),
    }, { status: 400 });
  }

  if (!stripeConfig.webhookSecret) {
    console.error('Webhook secret not configured');
    return NextResponse.json({
      success: false,
      error: 'Webhook secret not configured',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }

  let event: Stripe.Event;
  const stripe = getStripe();

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      stripeConfig.webhookSecret
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({
      success: false,
      error: 'Webhook signature verification failed',
      timestamp: new Date().toISOString(),
    }, { status: 400 });
  }

  // Log the event for debugging
  console.log(`Received Stripe webhook: ${event.type}`, {
    id: event.id,
    created: new Date(event.created * 1000).toISOString(),
  });

  const useDatabase = isDatabaseConfigured();
  let processingError: string | undefined;

  if (useDatabase) {
    try {
      await ensureDatabaseInitialized();
    } catch (error) {
      // If DB init fails, continue processing without persistence.
      console.error('Database initialization failed, continuing without DB:', error);
    }
  }

  // Check for duplicate event (idempotency)
  if (useDatabase) {
    try {
      const alreadyProcessed = await webhookEvents.exists(event.id);
      if (alreadyProcessed) {
        console.log(`Event ${event.id} already processed, skipping`);
        return NextResponse.json({
          success: true,
          data: { received: true, type: event.type, duplicate: true },
          timestamp: new Date().toISOString(),
        });
      }

      // Store the event
      await webhookEvents.create(event.id, event.type, event.data.object);
    } catch (error) {
      console.error('Error storing webhook event:', error);
      // Continue processing even if storage fails
    }
  }

  // Handle specific event types
  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log('Checkout completed:', {
          sessionId: session.id,
          customerId: session.customer,
          subscriptionId: session.subscription,
          paymentStatus: session.payment_status,
        });

        if (useDatabase) {
          // Create/update customer
          const customerId = typeof session.customer === 'string' 
            ? session.customer 
            : session.customer?.id;
          
          if (customerId) {
            await customers.upsert(
              customerId,
              session.customer_details?.email || undefined,
              session.customer_details?.name || undefined
            );
          }

          // Store checkout session
          await checkoutSessions.upsert({
            stripeSessionId: session.id,
            stripeCustomerId: customerId,
            status: session.status || undefined,
            paymentStatus: session.payment_status || undefined,
            amountTotal: session.amount_total || undefined,
            currency: session.currency || undefined,
          });

          // If there's a subscription, store it
          const subscriptionId = typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;
          
          if (subscriptionId && customerId) {
            // Fetch full subscription details from Stripe
            const subResponse = await stripe.subscriptions.retrieve(subscriptionId);
            // Handle both old and new Stripe API response formats
            const sub = subResponse as unknown as {
              id: string;
              status: string;
              items: { data: Array<{ price: { id: string } }> };
              current_period_start?: number;
              current_period_end?: number;
            };
            await subscriptions.upsert({
              stripeSubscriptionId: sub.id,
              stripeCustomerId: customerId,
              stripePriceId: sub.items.data[0]?.price.id,
              status: sub.status,
              currentPeriodStart: sub.current_period_start 
                ? new Date(sub.current_period_start * 1000) 
                : undefined,
              currentPeriodEnd: sub.current_period_end 
                ? new Date(sub.current_period_end * 1000) 
                : undefined,
            });
          }
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        // Use flexible typing to handle Stripe API version differences
        const subscription = event.data.object as unknown as {
          id: string;
          customer: string | { id: string };
          status: string;
          items: { data: Array<{ price: { id: string } }> };
          current_period_start?: number;
          current_period_end?: number;
          canceled_at?: number | null;
        };
        console.log('Subscription updated:', {
          subscriptionId: subscription.id,
          customerId: subscription.customer,
          status: subscription.status,
        });

        if (useDatabase) {
          const customerId = typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;

          // Ensure customer exists
          await customers.upsert(customerId);

          // Update subscription
          await subscriptions.upsert({
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: customerId,
            stripePriceId: subscription.items.data[0]?.price.id,
            status: subscription.status,
            currentPeriodStart: subscription.current_period_start 
              ? new Date(subscription.current_period_start * 1000) 
              : undefined,
            currentPeriodEnd: subscription.current_period_end 
              ? new Date(subscription.current_period_end * 1000) 
              : undefined,
            canceledAt: subscription.canceled_at 
              ? new Date(subscription.canceled_at * 1000) 
              : undefined,
          });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        console.log('Subscription deleted:', {
          subscriptionId: subscription.id,
          customerId: subscription.customer,
        });

        if (useDatabase) {
          const customerId = typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;

          await subscriptions.upsert({
            stripeSubscriptionId: subscription.id,
            stripeCustomerId: customerId,
            status: 'canceled',
            canceledAt: new Date(),
          });
        }
        break;
      }

      case 'customer.created':
      case 'customer.updated': {
        const customer = event.data.object as Stripe.Customer;
        console.log('Customer updated:', {
          customerId: customer.id,
          email: customer.email,
        });

        if (useDatabase) {
          await customers.upsert(
            customer.id,
            customer.email || undefined,
            customer.name || undefined
          );
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Invoice paid:', {
          invoiceId: invoice.id,
          customerId: invoice.customer,
          amountPaid: invoice.amount_paid,
        });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        console.log('Invoice payment failed:', {
          invoiceId: invoice.id,
          customerId: invoice.customer,
        });
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    console.error(`Error processing webhook ${event.type}:`, error);
    processingError = error instanceof Error ? error.message : 'Unknown error';
    // Still return 200 to acknowledge receipt - we don't want Stripe to retry
  }

  // Mark event as processed
  if (useDatabase) {
    try {
      await webhookEvents.markProcessed(event.id, processingError);
    } catch (error) {
      console.error('Error marking event as processed:', error);
    }
  }

  return NextResponse.json({
    success: true,
    data: { received: true, type: event.type, stored: useDatabase },
    timestamp: new Date().toISOString(),
  });
}
