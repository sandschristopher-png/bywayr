import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

const ALLOWED_ORIGINS = [
  'https://bywayr.com',
  'https://www.bywayr.com',
  'http://localhost:3000',
];

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin || '') ? origin! : 'https://bywayr.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get('origin')),
  });
}

export async function POST(req: Request) {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  try {
    const { userId, email, returnUrl } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' }, 
        { status: 400, headers }
      );
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email || undefined,
      client_reference_id: userId,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID || 'price_1UFyicCwrzKdrTSEnv8AZT6J',
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 3,
        metadata: {
          user_id: userId,
        },
      },
      metadata: {
        user_id: userId,
      },
      success_url: `${returnUrl || process.env.NEXT_PUBLIC_APP_URL}/?session_id={CHECKOUT_SESSION_ID}&upgrade=success`,
      cancel_url: `${returnUrl || process.env.NEXT_PUBLIC_APP_URL}/?upgrade=cancelled`,
    });

    return NextResponse.json(
      { url: session.url },
      { headers }
    );
  } catch (err: any) {
    console.error('Stripe session creation error:', err);
    return NextResponse.json(
      { error: err.message },
      { status: 500, headers }
    );
  }
}