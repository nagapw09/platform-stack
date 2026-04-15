import { NextRequest, NextResponse } from "next/server";
import { getStripe, isStripeConfigured, stripeConfig } from "@/lib/stripe";
import type {
  ApiResponse,
  CreateCheckoutRequest,
  CheckoutSessionResponse,
} from "@/lib/types";

export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<CheckoutSessionResponse>>> {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: "Stripe is not configured",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  try {
    const body: CreateCheckoutRequest = await request.json();

    // Use provided priceId or fall back to Monk-configured price
    const priceId = body.priceId || stripeConfig.priceId;

    if (!priceId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No price ID provided. Either pass priceId in request body or configure STRIPE_PRICE_ID.",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: body.quantity || 1,
        },
      ],
      success_url:
        body.successUrl || `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: body.cancelUrl || `${appUrl}/canceled`,
    });

    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url!,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create checkout session",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve session status
export async function GET(
  request: NextRequest
): Promise<NextResponse<ApiResponse>> {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: "Stripe is not configured",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  const sessionId = request.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json(
      {
        success: false,
        error: "session_id is required",
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "customer"],
    });

    return NextResponse.json({
      success: true,
      data: {
        status: session.status,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email,
        amountTotal: session.amount_total,
        currency: session.currency,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error retrieving checkout session:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to retrieve checkout session",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
