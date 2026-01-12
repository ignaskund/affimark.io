'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  ArrowRight,
  ArrowLeft,
  Link2,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

// Link-in-bio platforms
const LINK_PLATFORMS = [
  'Linktree',
  'Beacons',
  'Stan Store',
  'Bio.fm',
  'Carrd',
  'Custom website',
  'Other',
];

// How many affiliate links do they manage?
const LINK_COUNT_OPTIONS = [
  { value: '1-10', label: '1-10 links', desc: 'Just getting started' },
  { value: '11-50', label: '11-50 links', desc: 'Growing portfolio' },
  { value: '51-200', label: '51-200 links', desc: 'Serious affiliate marketer' },
  { value: '200+', label: '200+ links', desc: 'Power user' },
];

// Affiliate networks they use
const AFFILIATE_NETWORKS = [
  'Amazon Associates',
  'ShareASale',
  'Impact.com',
  'CJ Affiliate',
  'Rakuten',
  'ClickBank',
  'Direct merchant programs',
  'Not sure / Other',
];

// Primary monetization method
const MONETIZATION_METHODS = [
  { value: 'affiliate', label: 'Affiliate links & promo codes', desc: 'Commission-based' },
  { value: 'sponsored', label: 'Sponsored posts', desc: 'Paid partnerships' },
  { value: 'products', label: 'My own products', desc: 'Digital or physical' },
  { value: 'mixed', label: 'Mix of everything', desc: 'Multiple revenue streams' },
];

interface QuestionnaireData {
  linkInBioUrl: string;
  platform: string;
  linkCount: string;
  affiliateNetworks: string[];
  monetizationMethod: string;
}

export default function QuestionnaireFlow() {
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [data, setData] = useState<QuestionnaireData>({
    linkInBioUrl: '',
    platform: '',
    linkCount: '',
    affiliateNetworks: [],
    monetizationMethod: '',
  });

  const totalSteps = 4;

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Save to database
      await fetch('/api/onboarding/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      // Mark onboarding complete
      await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      });

      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Onboarding error:', error);
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return data.linkInBioUrl.trim().length > 0;
      case 1:
        return data.platform.length > 0;
      case 2:
        return data.linkCount.length > 0;
      case 3:
        return data.monetizationMethod.length > 0;
      default:
        return false;
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Step {step + 1} of {totalSteps}
          </span>
          <span className="text-sm text-gray-500">
            {Math.round(((step + 1) / totalSteps) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-purple-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step 0: Link-in-bio URL */}
      {step === 0 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              What's your link-in-bio URL?
            </h2>
            <p className="text-gray-600">
              We'll scan it to find your affiliate links and start monitoring them.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your link page URL
              </label>
              <div className="relative">
                <ExternalLink className="absolute left-3 top-3 text-gray-400" size={20} />
                <input
                  type="url"
                  placeholder="https://linktr.ee/yourname"
                  value={data.linkInBioUrl}
                  onChange={(e) => setData({ ...data, linkInBioUrl: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  autoFocus
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Works with Linktree, Beacons, Stan, custom sites, or any link page
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Step 1: Platform */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Which platform do you use?
            </h2>
            <p className="text-gray-600">
              This helps us optimize our crawler for your setup.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {LINK_PLATFORMS.map((platform) => (
              <button
                key={platform}
                onClick={() => setData({ ...data, platform })}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  data.platform === platform
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{platform}</span>
                  {data.platform === platform && (
                    <CheckCircle2 className="text-purple-600" size={20} />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Link count */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              How many affiliate links do you manage?
            </h2>
            <p className="text-gray-600">
              Helps us set up the right monitoring schedule for you.
            </p>
          </div>

          <div className="space-y-3">
            {LINK_COUNT_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setData({ ...data, linkCount: option.value })}
                className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                  data.linkCount === option.value
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{option.label}</div>
                    <div className="text-sm text-gray-500">{option.desc}</div>
                  </div>
                  {data.linkCount === option.value && (
                    <CheckCircle2 className="text-purple-600" size={20} />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Monetization method */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              How do you primarily monetize?
            </h2>
            <p className="text-gray-600">
              We'll prioritize the right types of issues for your business model.
            </p>
          </div>

          <div className="space-y-3">
            {MONETIZATION_METHODS.map((method) => (
              <button
                key={method.value}
                onClick={() => setData({ ...data, monetizationMethod: method.value })}
                className={`w-full p-4 border-2 rounded-lg text-left transition-all ${
                  data.monetizationMethod === method.value
                    ? 'border-purple-600 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{method.label}</div>
                    <div className="text-sm text-gray-500">{method.desc}</div>
                  </div>
                  {data.monetizationMethod === method.value && (
                    <CheckCircle2 className="text-purple-600" size={20} />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex justify-between">
        <Button
          variant="outline"
          onClick={handleBack}
          disabled={step === 0}
          className="flex items-center gap-2"
        >
          <ArrowLeft size={16} />
          Back
        </Button>

        {step < totalSteps - 1 ? (
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className="flex items-center gap-2"
          >
            Next
            <ArrowRight size={16} />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canProceed() || isSubmitting}
            className="flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Starting scan...
              </>
            ) : (
              <>
                Complete setup
                <CheckCircle2 size={16} />
              </>
            )}
          </Button>
        )}
      </div>

      {/* Skip option */}
      <div className="mt-4 text-center">
        <button
          onClick={() => (window.location.href = '/dashboard')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
