import Stripe from 'stripe';
import { getPlanByPriceId } from '@/lib/stripe-config';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.noroute ? NextResponse.json({ error: 'No signature' }, { status: 400 }) : NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error(
      '[Stripe Webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET env vars',
    );
    return NextResponse.json(
      { error: 'Stripe is not configured on this environment' },
      { status: 500 },
    );
  }

  const stripe = new Stripe(secretKey, { apiVersion: '2024-11-20.acacia' });

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  console.log('[Stripe Webhook] Event type:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentSucceeded(invoice);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await handlePaymentFailed(invoice);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('[Stripe Webhook] Error handling event:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 },
    );
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.user_id;
  if (!userId) {
    console.error('No user_id in session metadata');
    return;
  }

  const subscriptionId = session.subscription as string;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    console.error('[Stripe Webhook] STRIPE_SECRET_KEY is not configured');
    return;
  }
  const stripe = new Stripe(secretKey, { apiVersion: '2024-11-20.acacia' });
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  const priceId = subscription.items.data[0]?.price.id;
  const planType = getPlanByPriceId(priceId);

  const supabase = createSupabaseAdminClient();

  await supabase
    .from('profiles')
    .update({
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: session.customer as string,
      subscription_status: subscription.status,
      plan_type: planType,
      subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq('id', userId);

  console.log('[Webhook] Checkout completed for user:', userId);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const supabase = createSupabaseAdminClient();
  const userId = subscription.metadata?.user_id;
  if (!userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('stripe_customer_id', subscription.customer)
      .single();

    if (!profile) {
      console.error('No user found for subscription');
      return;
    }
  }

  const priceId = subscription.items.data[0]?.price.id;
  const planType = getPlanByPriceId(priceId);

  await supabase
    .from('profiles')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      plan_type: planType,
      subscription_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    })
    .eq('stripe_customer_id', subscription.customer as string);

  console.log('[Webhook] Subscription updated:', subscription.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const supabase = createSupabaseAdminClient();
  await supabase
    .from('profiles')
    .update({
      subscription_status: 'canceled',
      plan_type: 'FREE',
      subscription_period_end: null,
    })
    .eq('stripe_subscription_id', subscription.id);

  console.log('[Webhook] Subscription canceled:', subscription.id);
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('[Webhook] Payment succeeded for invoice:', invoice.id);
  // Optional: send success email or notification here
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('[Webhook] Payment failed for invoice:', invoice.id);
  // Optional: send failure email or notification here
}

