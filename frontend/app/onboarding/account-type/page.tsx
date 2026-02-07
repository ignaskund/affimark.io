'use client';

/**
 * Onboarding Step 1: Account Type Selection
 * User selects: Creator, Agency, or Brand
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';

export default function AccountTypePage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<'creator' | 'agency' | 'brand' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selectedType) return;

    setLoading(true);

    try {
      const supabase = createBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        // Not logged in yet, store selection and go to signup
        localStorage.setItem('pending_account_type', selectedType);
        router.push('/onboarding/signup');
        return;
      }

      // Update profile with account type
      const { error } = await supabase
        .from('profiles')
        .update({ account_type: selectedType })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating account type:', error);
        alert('Failed to save account type. Please try again.');
        setLoading(false);
        return;
      }

      // Continue to link setup
      router.push('/onboarding/link-setup');
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const accountTypes = [
    {
      id: 'creator' as const,
      icon: '👤',
      title: 'Creator',
      subtitle: 'Individual',
      description: 'I manage my own affiliate links',
      popular: true,
    },
    {
      id: 'agency' as const,
      icon: '🏢',
      title: 'Agency',
      subtitle: 'Manage multiple creators',
      description: 'I manage links for clients',
      popular: false,
    },
    {
      id: 'brand' as const,
      icon: '🏪',
      title: 'Brand',
      subtitle: 'Coming soon',
      description: 'I want to track my brand\'s affiliate program',
      popular: false,
      disabled: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center px-4 py-12">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Affimark Link Guard
          </h1>
          <p className="text-xl text-gray-600">
            Protect your affiliate revenue 24/7
          </p>
        </div>

        {/* Account Type Selection */}
        <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Choose your account type
          </h2>
          <p className="text-gray-600 mb-8">
            Select the option that best describes you
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {accountTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => !type.disabled && setSelectedType(type.id)}
                disabled={type.disabled || loading}
                className={`
                  relative p-6 rounded-xl border-2 text-left transition-all
                  ${selectedType === type.id
                    ? 'border-indigo-600 bg-indigo-50 shadow-lg'
                    : 'border-gray-200 hover:border-indigo-300 hover:shadow-md'
                  }
                  ${type.disabled
                    ? 'opacity-50 cursor-not-allowed'
                    : 'cursor-pointer'
                  }
                `}
              >
                {type.popular && (
                  <div className="absolute -top-3 right-4 bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Most Popular
                  </div>
                )}

                <div className="text-4xl mb-4">{type.icon}</div>

                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {type.title}
                </h3>

                <p className="text-sm text-indigo-600 font-semibold mb-2">
                  {type.subtitle}
                </p>

                <p className="text-gray-600 text-sm">
                  {type.description}
                </p>

                {selectedType === type.id && (
                  <div className="mt-4 flex items-center text-indigo-600">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-semibold">Selected</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Continue Button */}
        <div className="flex justify-center">
          <button
            onClick={handleContinue}
            disabled={!selectedType || loading}
            className="px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all text-lg"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              'Continue'
            )}
          </button>
        </div>

        {/* Value Props */}
        <div className="mt-12 grid md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="text-3xl mb-2">⚡</div>
            <p className="text-sm text-gray-600">Free health check</p>
          </div>
          <div>
            <div className="text-3xl mb-2">🔒</div>
            <p className="text-sm text-gray-600">No credit card required</p>
          </div>
          <div>
            <div className="text-3xl mb-2">📊</div>
            <p className="text-sm text-gray-600">Instant revenue insights</p>
          </div>
        </div>
      </div>
    </div>
  );
}
