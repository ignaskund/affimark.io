/**
 * Economics Sensitivity Calculator for Product Verifier
 *
 * Shows users how fragile their earnings projections are by
 * calculating earnings under different scenarios:
 * - Conversion rate variations
 * - AOV variations
 * - Refund rate variations
 *
 * Helps users understand risk and make informed decisions
 * instead of relying on single-point estimates.
 */

// --- Types ---

export interface SensitivityScenario {
  label: string;
  description: string;
  conversion_rate: number;
  aov: number;
  refund_rate: number;
  commission_rate: number;
  monthly_clicks: number;
  monthly_earnings: {
    gross: number;
    net: number; // After refunds
  };
}

export interface EconomicsSensitivity {
  base_scenario: SensitivityScenario;
  pessimistic_scenario: SensitivityScenario;
  optimistic_scenario: SensitivityScenario;
  earning_band: {
    min: number;
    max: number;
    currency: string;
  };
  fragility: 'stable' | 'moderate' | 'fragile';
  fragility_explanation: string;
  key_driver: string;
  sensitivity_factors: Array<{
    factor: string;
    impact: 'high' | 'medium' | 'low';
    explanation: string;
  }>;
  breakeven_analysis: {
    clicks_needed_for_100: number;
    realistic: boolean;
  };
}

export interface SensitivityInput {
  commission_rate: number; // As decimal, e.g., 0.08 for 8%
  commission_rate_range?: { low: number; high: number };
  base_conversion_rate: number; // As decimal
  base_aov: number;
  base_refund_rate: number; // As decimal
  estimated_monthly_clicks: number;
  currency: string;
  category_benchmarks?: {
    avg_conversion_rate: number;
    avg_aov: number;
    avg_refund_rate: number;
  };
}

// --- Variation Factors ---

const CONVERSION_VARIATIONS = {
  pessimistic: 0.5,  // 50% of base
  optimistic: 1.5,   // 150% of base
};

const AOV_VARIATIONS = {
  pessimistic: 0.8,  // 80% of base
  optimistic: 1.2,   // 120% of base
};

const REFUND_VARIATIONS = {
  pessimistic: 1.5,  // 150% of base
  optimistic: 0.5,   // 50% of base
};

// --- Main Calculation Function ---

export function calculateSensitivity(input: SensitivityInput): EconomicsSensitivity {
  const {
    commission_rate,
    base_conversion_rate,
    base_aov,
    base_refund_rate,
    estimated_monthly_clicks,
    currency,
  } = input;

  // Calculate scenarios
  const base = calculateScenario({
    label: 'Base Case',
    description: 'Expected performance based on available data',
    conversion_rate: base_conversion_rate,
    aov: base_aov,
    refund_rate: base_refund_rate,
    commission_rate,
    monthly_clicks: estimated_monthly_clicks,
  });

  const pessimistic = calculateScenario({
    label: 'Pessimistic',
    description: 'Lower conversion, higher refunds',
    conversion_rate: base_conversion_rate * CONVERSION_VARIATIONS.pessimistic,
    aov: base_aov * AOV_VARIATIONS.pessimistic,
    refund_rate: Math.min(0.3, base_refund_rate * REFUND_VARIATIONS.pessimistic),
    commission_rate: input.commission_rate_range?.low || commission_rate,
    monthly_clicks: estimated_monthly_clicks,
  });

  const optimistic = calculateScenario({
    label: 'Optimistic',
    description: 'Higher conversion, lower refunds',
    conversion_rate: Math.min(0.1, base_conversion_rate * CONVERSION_VARIATIONS.optimistic),
    aov: base_aov * AOV_VARIATIONS.optimistic,
    refund_rate: base_refund_rate * REFUND_VARIATIONS.optimistic,
    commission_rate: input.commission_rate_range?.high || commission_rate,
    monthly_clicks: estimated_monthly_clicks,
  });

  // Calculate earning band
  const earning_band = {
    min: pessimistic.monthly_earnings.net,
    max: optimistic.monthly_earnings.net,
    currency,
  };

  // Determine fragility
  const { fragility, explanation } = calculateFragility(base, pessimistic, optimistic);

  // Identify key driver
  const key_driver = identifyKeyDriver(input);

  // Calculate sensitivity factors
  const sensitivity_factors = calculateSensitivityFactors(input);

  // Breakeven analysis
  const breakeven_analysis = calculateBreakeven(commission_rate, base_conversion_rate, base_aov, base_refund_rate);

  return {
    base_scenario: base,
    pessimistic_scenario: pessimistic,
    optimistic_scenario: optimistic,
    earning_band,
    fragility,
    fragility_explanation: explanation,
    key_driver,
    sensitivity_factors,
    breakeven_analysis,
  };
}

// --- Scenario Calculator ---

function calculateScenario(params: {
  label: string;
  description: string;
  conversion_rate: number;
  aov: number;
  refund_rate: number;
  commission_rate: number;
  monthly_clicks: number;
}): SensitivityScenario {
  const { conversion_rate, aov, refund_rate, commission_rate, monthly_clicks } = params;

  const orders = monthly_clicks * conversion_rate;
  const gross_revenue = orders * aov;
  const gross_commission = gross_revenue * commission_rate;
  const refund_loss = gross_commission * refund_rate;
  const net_commission = gross_commission - refund_loss;

  return {
    ...params,
    monthly_earnings: {
      gross: Math.round(gross_commission * 100) / 100,
      net: Math.round(net_commission * 100) / 100,
    },
  };
}

// --- Fragility Calculation ---

function calculateFragility(
  base: SensitivityScenario,
  pessimistic: SensitivityScenario,
  optimistic: SensitivityScenario
): { fragility: 'stable' | 'moderate' | 'fragile'; explanation: string } {
  const baseNet = base.monthly_earnings.net;
  const range = optimistic.monthly_earnings.net - pessimistic.monthly_earnings.net;
  const coefficient = baseNet > 0 ? range / baseNet : 10;

  if (coefficient > 2) {
    return {
      fragility: 'fragile',
      explanation: 'Earnings vary significantly with small changes in conversion or refund rates. High uncertainty.',
    };
  } else if (coefficient > 1) {
    return {
      fragility: 'moderate',
      explanation: 'Moderate sensitivity to conversion and refund rate changes. Monitor performance closely.',
    };
  } else {
    return {
      fragility: 'stable',
      explanation: 'Relatively stable earnings projection. Less sensitive to market variations.',
    };
  }
}

// --- Key Driver Identification ---

function identifyKeyDriver(input: SensitivityInput): string {
  const { commission_rate, base_conversion_rate, base_aov, base_refund_rate } = input;

  // Calculate impact of each factor
  const impacts: Array<{ factor: string; impact: number }> = [];

  // Commission impact
  const commissionImpact = base_aov * base_conversion_rate;
  impacts.push({ factor: 'Commission Rate', impact: commissionImpact });

  // Conversion impact
  const conversionImpact = base_aov * commission_rate;
  impacts.push({ factor: 'Conversion Rate', impact: conversionImpact });

  // AOV impact
  const aovImpact = base_conversion_rate * commission_rate;
  impacts.push({ factor: 'Average Order Value', impact: aovImpact });

  // Refund impact (negative)
  const refundImpact = base_refund_rate * commissionImpact;
  impacts.push({ factor: 'Refund Rate', impact: refundImpact });

  // Sort by impact
  impacts.sort((a, b) => b.impact - a.impact);

  return impacts[0].factor;
}

// --- Sensitivity Factors ---

function calculateSensitivityFactors(input: SensitivityInput): Array<{
  factor: string;
  impact: 'high' | 'medium' | 'low';
  explanation: string;
}> {
  const factors: Array<{
    factor: string;
    impact: 'high' | 'medium' | 'low';
    explanation: string;
  }> = [];

  // Conversion rate sensitivity
  if (input.base_conversion_rate < 0.02) {
    factors.push({
      factor: 'Conversion Rate',
      impact: 'high',
      explanation: `Low base conversion (${(input.base_conversion_rate * 100).toFixed(1)}%) means small changes have large effects`,
    });
  } else if (input.base_conversion_rate < 0.05) {
    factors.push({
      factor: 'Conversion Rate',
      impact: 'medium',
      explanation: 'Moderate conversion rate - monitor for changes',
    });
  } else {
    factors.push({
      factor: 'Conversion Rate',
      impact: 'low',
      explanation: 'Strong conversion rate provides stability',
    });
  }

  // Refund rate sensitivity
  if (input.base_refund_rate > 0.1) {
    factors.push({
      factor: 'Refund Rate',
      impact: 'high',
      explanation: `High refund rate (${(input.base_refund_rate * 100).toFixed(0)}%) significantly impacts net earnings`,
    });
  } else if (input.base_refund_rate > 0.05) {
    factors.push({
      factor: 'Refund Rate',
      impact: 'medium',
      explanation: 'Moderate refund rate - factor into projections',
    });
  } else {
    factors.push({
      factor: 'Refund Rate',
      impact: 'low',
      explanation: 'Low refund rate is favorable',
    });
  }

  // Commission rate sensitivity
  if (input.commission_rate_range) {
    const range = input.commission_rate_range.high - input.commission_rate_range.low;
    if (range > 0.05) {
      factors.push({
        factor: 'Commission Rate',
        impact: 'high',
        explanation: `Wide commission range (${(input.commission_rate_range.low * 100).toFixed(0)}-${(input.commission_rate_range.high * 100).toFixed(0)}%) creates uncertainty`,
      });
    }
  }

  // AOV sensitivity
  if (input.base_aov > 200) {
    factors.push({
      factor: 'Average Order Value',
      impact: 'medium',
      explanation: 'High AOV means fewer sales needed, but each lost sale matters more',
    });
  }

  return factors;
}

// --- Breakeven Analysis ---

function calculateBreakeven(
  commission_rate: number,
  conversion_rate: number,
  aov: number,
  refund_rate: number
): { clicks_needed_for_100: number; realistic: boolean } {
  const net_commission_per_order = aov * commission_rate * (1 - refund_rate);
  const orders_needed = 100 / net_commission_per_order;
  const clicks_needed = orders_needed / conversion_rate;

  return {
    clicks_needed_for_100: Math.round(clicks_needed),
    realistic: clicks_needed < 10000, // Less than 10k clicks for €100 is realistic
  };
}

// --- Utility: Format for Display ---

export function formatSensitivityForUI(sensitivity: EconomicsSensitivity): {
  scenarios_table: Array<{
    scenario: string;
    conversion: string;
    aov: string;
    refunds: string;
    earnings: string;
  }>;
  earning_range: string;
  fragility_badge: { label: string; color: string };
} {
  const formatEarnings = (n: number, currency: string) =>
    `${currency}${n.toFixed(0)}`;

  const formatPercent = (n: number) => `${(n * 100).toFixed(1)}%`;

  const scenarios_table = [
    sensitivity.pessimistic_scenario,
    sensitivity.base_scenario,
    sensitivity.optimistic_scenario,
  ].map(s => ({
    scenario: s.label,
    conversion: formatPercent(s.conversion_rate),
    aov: `${sensitivity.earning_band.currency}${s.aov.toFixed(0)}`,
    refunds: formatPercent(s.refund_rate),
    earnings: formatEarnings(s.monthly_earnings.net, sensitivity.earning_band.currency),
  }));

  const earning_range = `${sensitivity.earning_band.currency}${sensitivity.earning_band.min.toFixed(0)} - ${sensitivity.earning_band.currency}${sensitivity.earning_band.max.toFixed(0)}`;

  const fragilityColors = {
    stable: 'emerald',
    moderate: 'amber',
    fragile: 'red',
  };

  return {
    scenarios_table,
    earning_range,
    fragility_badge: {
      label: sensitivity.fragility.charAt(0).toUpperCase() + sensitivity.fragility.slice(1),
      color: fragilityColors[sensitivity.fragility],
    },
  };
}
