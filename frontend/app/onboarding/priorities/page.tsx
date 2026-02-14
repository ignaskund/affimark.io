'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Loader2,
  ArrowRight,
  ArrowLeft,
  Package,
  Building2,
  Sparkles,
  CheckCircle,
} from 'lucide-react';
import PriorityRanker from '@/components/onboarding/PriorityRanker';
import { PRODUCT_PRIORITIES, BRAND_PRIORITIES, Priority } from '@/types/finder';

type Step = 'product' | 'brand' | 'review';

export default function PrioritiesOnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const [step, setStep] = useState<Step>('product');
  const [productPriorities, setProductPriorities] = useState<Priority[]>([]);
  const [brandPriorities, setBrandPriorities] = useState<Priority[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if coming from magic onboarding
  const fromMagic = searchParams.get('from') === 'magic';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/sign-in?callbackUrl=/onboarding/priorities');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const canProceedFromProduct = productPriorities.length === 5;
  const canProceedFromBrand = brandPriorities.length === 5;
  const canComplete = canProceedFromProduct && canProceedFromBrand;

  const handleNext = () => {
    if (step === 'product' && canProceedFromProduct) {
      setStep('brand');
    } else if (step === 'brand' && canProceedFromBrand) {
      setStep('review');
    }
  };

  const handleBack = () => {
    if (step === 'brand') {
      setStep('product');
    } else if (step === 'review') {
      setStep('brand');
    }
  };

  const handleComplete = async () => {
    if (!canComplete) return;

    setIsLoading(true);
    setError(null);

    try {
      // Save priorities to backend
      const res = await fetch('/api/preferences/priorities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productPriorities,
          brandPriorities,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save priorities');
      }

      // Mark onboarding as complete if not already
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        credentials: 'include',
      });

      // Navigate to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    // Save empty priorities and continue
    try {
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (e) {}
    router.push('/dashboard');
  };

  // Get labels for selected priorities
  const getSelectedLabels = (priorities: Priority[], options: typeof PRODUCT_PRIORITIES) => {
    return priorities
      .sort((a, b) => a.rank - b.rank)
      .map((p) => {
        const option = options.find((o) => o.id === p.id);
        return option ? `${p.rank}. ${option.label}` : '';
      })
      .filter(Boolean);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-700/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 max-w-4xl w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-700 to-orange-600 mb-4 shadow-lg shadow-orange-500/30">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl lg:text-4xl font-bold text-foreground">
            {step === 'product' && 'What matters in products?'}
            {step === 'brand' && 'What matters in brands?'}
            {step === 'review' && 'Review your priorities'}
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            {step === 'product' && 'We\'ll use this to find products that match your standards.'}
            {step === 'brand' && 'We\'ll use this to find brands worth your partnership.'}
            {step === 'review' && 'These will personalize your product recommendations.'}
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex justify-center gap-3">
          <StepIndicator
            icon={<Package className="w-4 h-4" />}
            label="Products"
            isActive={step === 'product'}
            isComplete={canProceedFromProduct}
          />
          <div className="w-8 h-0.5 bg-gray-700 self-center" />
          <StepIndicator
            icon={<Building2 className="w-4 h-4" />}
            label="Brands"
            isActive={step === 'brand'}
            isComplete={canProceedFromBrand}
          />
          <div className="w-8 h-0.5 bg-gray-700 self-center" />
          <StepIndicator
            icon={<CheckCircle className="w-4 h-4" />}
            label="Review"
            isActive={step === 'review'}
            isComplete={false}
          />
        </div>

        {/* Content */}
        <div className="glass-card p-8 animate-slide-up">
          <AnimatePresence mode="wait">
            {step === 'product' && (
              <motion.div
                key="product"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <PriorityRanker
                  type="product"
                  options={PRODUCT_PRIORITIES}
                  selected={productPriorities}
                  onSelectionChange={setProductPriorities}
                  maxSelections={5}
                />
              </motion.div>
            )}

            {step === 'brand' && (
              <motion.div
                key="brand"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <PriorityRanker
                  type="brand"
                  options={BRAND_PRIORITIES}
                  selected={brandPriorities}
                  onSelectionChange={setBrandPriorities}
                  maxSelections={5}
                />
              </motion.div>
            )}

            {step === 'review' && (
              <motion.div
                key="review"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Product priorities summary */}
                  <div className="p-6 rounded-xl bg-orange-500/10 border border-orange-500/20">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                        <Package className="w-5 h-5 text-orange-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">Product Priorities</h3>
                    </div>
                    <ul className="space-y-2">
                      {getSelectedLabels(productPriorities, PRODUCT_PRIORITIES).map((label, i) => (
                        <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-orange-500/30 text-orange-400 text-xs flex items-center justify-center font-bold">
                            {i + 1}
                          </span>
                          {label.replace(/^\d+\.\s/, '')}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => setStep('product')}
                      className="mt-4 text-sm text-orange-400 hover:text-orange-300 transition-colors"
                    >
                      Edit
                    </button>
                  </div>

                  {/* Brand priorities summary */}
                  <div className="p-6 rounded-xl bg-blue-500/10 border border-blue-500/20">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-blue-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">Brand Priorities</h3>
                    </div>
                    <ul className="space-y-2">
                      {getSelectedLabels(brandPriorities, BRAND_PRIORITIES).map((label, i) => (
                        <li key={i} className="text-sm text-gray-300 flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-500/30 text-blue-400 text-xs flex items-center justify-center font-bold">
                            {i + 1}
                          </span>
                          {label.replace(/^\d+\.\s/, '')}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => setStep('brand')}
                      className="mt-4 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>

                <div className="text-center text-sm text-gray-400">
                  You can always change these later in Settings.
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div>
            {step !== 'product' ? (
              <button
                onClick={handleBack}
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <button
                onClick={handleSkip}
                className="text-gray-500 hover:text-gray-400 text-sm transition-colors"
              >
                Skip for now
              </button>
            )}
          </div>

          <div>
            {step === 'review' ? (
              <button
                onClick={handleComplete}
                disabled={!canComplete || isLoading}
                className="btn-primary px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Complete Setup
                    <CheckCircle className="w-5 h-5" />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={handleNext}
                disabled={
                  (step === 'product' && !canProceedFromProduct) ||
                  (step === 'brand' && !canProceedFromBrand)
                }
                className="btn-primary px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground animate-fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Personalizes your experience
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Change anytime
          </span>
          <span className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Better recommendations
          </span>
        </div>
      </div>
    </div>
  );
}

// Step indicator component
function StepIndicator({
  icon,
  label,
  isActive,
  isComplete,
}: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  isComplete: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`
          w-10 h-10 rounded-full flex items-center justify-center transition-colors
          ${isActive
            ? 'bg-orange-500 text-white'
            : isComplete
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
              : 'bg-gray-800 text-gray-500 border border-gray-700'
          }
        `}
      >
        {isComplete && !isActive ? <CheckCircle className="w-4 h-4" /> : icon}
      </div>
      <span className={`text-xs ${isActive ? 'text-white' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
}
