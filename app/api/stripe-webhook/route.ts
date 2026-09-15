import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

let _stripe: Stripe | null = null;

const getStripe = (): Stripe => {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16' as any,
    });
  }
  return _stripe;
};

let _supabase: ReturnType<typeof createClient> | null = null;

const getSupabase = () => {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    );
  }
  return _supabase;
};

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    const supabase = getSupabase();

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id || session.metadata?.user_id;

        if (userId) {
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + 3 + 30); // 3-day trial + 30 days
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              is_plus_member: true,
              plus_expires_at: expiresAt.toISOString(),
              stripe_customer_id: session.customer as string,
            })
            .eq('id', userId);
          if (updateError) throw updateError;
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { error: cancelError } = await supabase
          .from('profiles')
          .update({
            is_plus_member: false,
          })
          .eq('stripe_customer_id', customerId);
        if (cancelError) throw cancelError;
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (dbErr: any) {
    console.error('Webhook database error:', dbErr);
    return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
  }
}