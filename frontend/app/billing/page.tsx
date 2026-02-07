'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Loader2, CreditCard, ArrowRight, Sparkles } from 'lucide-react';
import { STRIPE_PLANS, type PlanType } from '@/lib/stripe-config';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

function BillingPageInner() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<PlanType>('FREE');
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);

  useEffect(() => {
    // Fetch user's current plan
    fetchUserPlan();

    // Show success message if coming from successful checkout
    if (searchParams.get('success') === 'true') {
      alert('Subscription successful! Welcome to Affimark Pro! 🎉');
    }
  }, [searchParams]);

  const fetchUserPlan = async () => {
    try {
      const response = await fetch('/api/user/subscription');
      if (response.ok) {
        const data = await response.json();
        setCurrentPlan(data.plan_type || 'FREE');
        setSubscriptionStatus(data.subscription_status);
      }
    } catch (error) {
      console.error('Failed to fetch subscription:', error);
    }
  };

  const handleSubscribe = async (priceId: string, planName: string) => {
    try {
      setLoading(planName);

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { sessionId } = await response.json();
      const stripe = await stripePromise;

      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      const { error } = await stripe.redirectToCheckout({ sessionId });

      if (error) {
        throw error;
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setLoading('portal');
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to open billing portal');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error: any) {
      console.error('Portal error:', error);
      alert(`Error: ${error.message}`);
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-purple-900/20 to-black border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-purple-600/10 px-4 py-2 rounded-full mb-6">
            <Sparkles size={16} className="text-purple-400" />
            <span className="text-sm text-purple-300">Choose Your Plan</span>
          </div>
          <h1 className="text-5xl font-bold mb-4">
            Supercharge Your Creator Monetization
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Connect unlimited accounts, get AI-powered insights, and discover perfect brand partnerships
          </p>
        </div>
      </div>

      {/* Current Plan Banner */}
      {currentPlan !== 'FREE' && (
        <div className="bg-purple-600/10 border-y border-purple-600/20 py-4">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="text-purple-400" />
              <div>
                <p className="text-sm text-gray-400">Current Plan</p>
                <p className="font-semibold text-white">{STRIPE_PLANS[currentPlan].name}</p>
              </div>
            </div>
            <Button
              onClick={handleManageSubscription}
              disabled={loading === 'portal'}
              className="bg-gray-800 hover:bg-gray-700 text-white"
            >
              {loading === 'portal' ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                'Manage Subscription'
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          {Object.entries(STRIPE_PLANS).map(([key, plan]) => {
            const planKey = key as PlanType;
            const isCurrentPlan = currentPlan === planKey;
            const isPopular = planKey === 'CREATOR';

            return (
              <Card
                key={key}
                className={`relative bg-gray-900 border-2 p-8 ${isPopular
                    ? 'border-purple-600 shadow-lg shadow-purple-600/20'
                    : 'border-gray-800'
                  }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    Most Popular
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold text-white">${plan.price}</span>
                    <span className="text-gray-400">/month</span>
                  </div>
                </div>

                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check size={20} className="text-purple-400 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-300 text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <Button
                    disabled
                    className="w-full bg-gray-800 text-gray-400 cursor-not-allowed"
                  >
                    Current Plan
                  </Button>
                ) : planKey === 'FREE' ? (
                  <Button
                    disabled
                    className="w-full bg-gray-800 text-gray-400 cursor-not-allowed"
                  >
                    Free Forever
                  </Button>
                ) : (
                  <Button
                    onClick={() => handleSubscribe(plan.priceId, plan.name)}
                    disabled={loading === plan.name}
                    className={`w-full ${isPopular
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-gray-800 hover:bg-gray-700 text-white'
                      }`}
                  >
                    {loading === plan.name ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        Upgrade to {plan.name}
                        <ArrowRight size={16} className="ml-2" />
                      </>
                    )}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>

        {/* FAQ */}
        <div className="mt-20 max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Can I cancel anytime?</h3>
              <p className="text-gray-400">
                Yes! You can cancel your subscription at any time. Your access will continue until the end of your billing period.
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-400">
                We accept all major credit cards (Visa, Mastercard, Amex) through Stripe.
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Can I upgrade or downgrade later?</h3>
              <p className="text-gray-400">
                Absolutely! You can change your plan at any time from the billing portal. Changes are prorated automatically.
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-2">Do you offer refunds?</h3>
              <p className="text-gray-400">
                We offer a 14-day money-back guarantee. If you're not satisfied, contact support for a full refund.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      }
    >
      <BillingPageInner />
    </Suspense>
  );
}

