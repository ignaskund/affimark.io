import Link from 'next/link';

export default function Pricing() {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      period: '/month',
      description: 'Get started with basic features',
      features: [
        '1 social account',
        '50 AI messages/month',
        'Basic analytics',
        'Product recommendations',
      ],
      cta: 'Get Started',
      ctaLink: '/sign-in',
      highlighted: false,
    },
    {
      name: 'Creator',
      price: '$29',
      period: '/month',
      description: 'Perfect for growing creators',
      features: [
        '3 social accounts',
        'Unlimited AI messages',
        'Advanced analytics',
        'Priority product matching',
        'Email support',
      ],
      cta: 'Start Free Trial',
      ctaLink: '/billing',
      highlighted: true,
    },
    {
      name: 'Pro',
      price: '$79',
      period: '/month',
      description: 'For professional content creators',
      features: [
        'Unlimited social accounts',
        'Unlimited AI messages',
        'Advanced analytics + insights',
        'Custom product integrations',
        'Priority support',
        'API access',
      ],
      cta: 'Start Free Trial',
      ctaLink: '/billing',
      highlighted: false,
    },
  ];

  return (
    <section id="pricing" className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600">
            Choose the plan that fits your needs
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 ${
                plan.highlighted
                  ? 'bg-purple-600 text-white ring-4 ring-purple-600 ring-opacity-50 transform scale-105'
                  : 'bg-white text-gray-900 border border-gray-200'
              }`}
            >
              <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="mb-4">
                <span className="text-5xl font-bold">{plan.price}</span>
                <span
                  className={plan.highlighted ? 'text-purple-100' : 'text-gray-500'}
                >
                  {plan.period}
                </span>
              </div>
              <p
                className={`mb-6 ${
                  plan.highlighted ? 'text-purple-100' : 'text-gray-600'
                }`}
              >
                {plan.description}
              </p>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start">
                    <svg
                      className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${
                        plan.highlighted ? 'text-purple-200' : 'text-purple-600'
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className={plan.highlighted ? 'text-purple-50' : ''}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaLink}
                className={`block w-full text-center py-3 px-6 rounded-lg font-semibold transition-colors ${
                  plan.highlighted
                    ? 'bg-white text-purple-600 hover:bg-purple-50'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600">
            All plans include a 14-day free trial. No credit card required.
          </p>
        </div>
      </div>
    </section>
  );
}

