/**
 * Revenue Optimization Agent (Step 3)
 * 
 * Provides personalized revenue maximization guidance for the selected brand/product.
 * This is the final step in the 3-step Commission Agent flow.
 */

import { Env } from '../../index';

// ============================================================
// Types
// ============================================================

export interface RevenueOptimizationInput {
    productUrl: string;
    productTitle: string;
    brandSlug: string;
    brandName: string;
    category: string;
    currentPlatform: string;
    currentCommissionRate: number;
    userId?: string;
    userAnalytics?: {
        monthlyClicks?: number;
        avgConversionRate?: number;
        audienceSize?: number;
        topPlatform?: string;
    };
}

export interface AffiliateProgram {
    programId: string;
    network: string;
    networkDisplay: string;
    commissionRateLow: number;
    commissionRateHigh: number;
    cookieDuration: number;
    requiresApplication: boolean;
    approvalDifficulty: 'easy' | 'medium' | 'hard';
    signupUrl: string;
    isRecommended: boolean;
    reason?: string;
}

export interface RevenueProjection {
    scenario: 'conservative' | 'realistic' | 'optimistic';
    monthlyClicks: number;
    conversionRate: number;
    avgOrderValue: number;
    monthlyRevenue: number;
    yearlyRevenue: number;
    vsCurrentGain: number;
}

export interface LaunchStep {
    step: number;
    title: string;
    description: string;
    actionUrl?: string;
    estimatedTime: string;
    isCompleted?: boolean;
}

export interface ContentTip {
    type: 'seasonal' | 'bundle' | 'audience' | 'timing' | 'format';
    title: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
}

export interface RevenueOptimizationResult {
    success: boolean;

    // Selected product/brand
    product: {
        url: string;
        title: string;
        brandSlug: string;
        brandName: string;
        category: string;
    };

    // Best affiliate program pathway
    recommendedProgram: AffiliateProgram | null;
    alternativePrograms: AffiliateProgram[];

    // Revenue projections (3 scenarios)
    projections: RevenueProjection[];

    // Step-by-step launch guide
    launchSteps: LaunchStep[];

    // Content strategy tips
    contentTips: ContentTip[];

    // Summary
    estimatedMonthlyGain: { low: number; high: number };
    estimatedYearlyGain: { low: number; high: number };

    error?: string;
}

// ============================================================
// Network Signup URLs
// ============================================================

const NETWORK_SIGNUP_URLS: Record<string, string> = {
    awin: 'https://www.awin.com/gb/publishers',
    shareasale: 'https://www.shareasale.com/newsignup.cfm',
    impact: 'https://impact.com/partnerships/',
    cj: 'https://www.cj.com/publisher',
    rakuten: 'https://rakutenadvertising.com/publisher/',
    partnerstack: 'https://partnerstack.com/',
    tradedoubler: 'https://www.tradedoubler.com/en/publishers/',
    ltk: 'https://company.shopltk.com/creator-app',
};

function getNetworkSignupUrl(network: string): string {
    return NETWORK_SIGNUP_URLS[network.toLowerCase()] || '';
}

function formatNetworkName(network: string): string {
    const names: Record<string, string> = {
        awin: 'Awin', shareasale: 'ShareASale', impact: 'Impact',
        cj: 'CJ Affiliate', rakuten: 'Rakuten', ltk: 'LTK', direct: 'Brand Direct',
    };
    return names[network.toLowerCase()] || network.charAt(0).toUpperCase() + network.slice(1);
}

// ============================================================
// Find Best Affiliate Programs
// ============================================================

async function findBestPrograms(
    brandSlug: string,
    category: string,
    currentRate: number,
    supabaseUrl: string,
    supabaseKey: string
): Promise<AffiliateProgram[]> {
    try {
        // Query for brand-specific programs first
        const brandResponse = await fetch(
            `${supabaseUrl}/rest/v1/affiliate_programs?or=(brand_slug.eq.${brandSlug},brand_slug.ilike.%${brandSlug}%)&is_active=eq.true&order=commission_rate_high.desc&limit=3`,
            {
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                },
            }
        );

        let programs: Array<{
            id: string;
            network: string;
            brand_name: string;
            commission_rate_low: number;
            commission_rate_high: number;
            cookie_duration: number;
            requires_application: boolean;
            approval_difficulty: string;
            signup_url: string;
        }> = [];

        if (brandResponse.ok) {
            programs = await brandResponse.json() as typeof programs;
        }

        // If no brand-specific programs, try category
        if (programs.length === 0) {
            const categoryResponse = await fetch(
                `${supabaseUrl}/rest/v1/affiliate_programs?category=eq.${category}&commission_rate_high=gt.${currentRate}&is_active=eq.true&order=commission_rate_high.desc&limit=3`,
                {
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                    },
                }
            );

            if (categoryResponse.ok) {
                programs = await categoryResponse.json() as typeof programs;
            }
        }

        return programs.map((p, index) => ({
            programId: p.id,
            network: p.network,
            networkDisplay: formatNetworkName(p.network),
            commissionRateLow: p.commission_rate_low,
            commissionRateHigh: p.commission_rate_high,
            cookieDuration: p.cookie_duration || 30,
            requiresApplication: p.requires_application ?? true,
            approvalDifficulty: (p.approval_difficulty || 'medium') as 'easy' | 'medium' | 'hard',
            signupUrl: p.signup_url || getNetworkSignupUrl(p.network),
            isRecommended: index === 0,
            reason: index === 0 ? 'Highest commission rate available' : undefined,
        }));
    } catch {
        return [];
    }
}

// ============================================================
// Calculate Revenue Projections
// ============================================================

function calculateProjections(
    currentRate: number,
    newRateLow: number,
    newRateHigh: number,
    category: string,
    userAnalytics?: RevenueOptimizationInput['userAnalytics']
): RevenueProjection[] {
    // Category-specific defaults
    const categoryDefaults: Record<string, { clicks: number; cvr: number; aov: number }> = {
        electronics: { clicks: 500, cvr: 1.5, aov: 150 },
        fashion: { clicks: 800, cvr: 3.0, aov: 80 },
        beauty: { clicks: 600, cvr: 2.5, aov: 60 },
        home: { clicks: 400, cvr: 2.0, aov: 120 },
        general: { clicks: 500, cvr: 2.0, aov: 75 },
    };

    const defaults = categoryDefaults[category] || categoryDefaults.general;

    // Use user analytics if available, otherwise use defaults
    const baseClicks = userAnalytics?.monthlyClicks || defaults.clicks;
    const baseCvr = userAnalytics?.avgConversionRate || defaults.cvr;
    const baseAov = defaults.aov;

    const scenarios: Array<{
        name: 'conservative' | 'realistic' | 'optimistic';
        clickMultiplier: number;
        cvrMultiplier: number;
        rateToUse: number;
    }> = [
            { name: 'conservative', clickMultiplier: 0.7, cvrMultiplier: 0.8, rateToUse: newRateLow },
            { name: 'realistic', clickMultiplier: 1.0, cvrMultiplier: 1.0, rateToUse: (newRateLow + newRateHigh) / 2 },
            { name: 'optimistic', clickMultiplier: 1.3, cvrMultiplier: 1.2, rateToUse: newRateHigh },
        ];

    return scenarios.map(scenario => {
        const clicks = Math.round(baseClicks * scenario.clickMultiplier);
        const cvr = baseCvr * scenario.cvrMultiplier;
        const monthlyRevenue = clicks * (cvr / 100) * baseAov * (scenario.rateToUse / 100);
        const currentMonthlyRevenue = clicks * (cvr / 100) * baseAov * (currentRate / 100);

        return {
            scenario: scenario.name,
            monthlyClicks: clicks,
            conversionRate: Math.round(cvr * 10) / 10,
            avgOrderValue: baseAov,
            monthlyRevenue: Math.round(monthlyRevenue * 100) / 100,
            yearlyRevenue: Math.round(monthlyRevenue * 12 * 100) / 100,
            vsCurrentGain: Math.round((monthlyRevenue - currentMonthlyRevenue) * 100) / 100,
        };
    });
}

// ============================================================
// Generate Launch Steps
// ============================================================

function generateLaunchSteps(
    program: AffiliateProgram | null,
    brandName: string,
    currentPlatform: string
): LaunchStep[] {
    if (!program) {
        return [
            {
                step: 1,
                title: 'Search for affiliate programs',
                description: `Look for ${brandName}'s affiliate program on major networks (Awin, Impact, ShareASale)`,
                estimatedTime: '15 minutes',
            },
        ];
    }

    const steps: LaunchStep[] = [];

    if (program.requiresApplication) {
        steps.push({
            step: 1,
            title: `Join ${program.networkDisplay}`,
            description: `Create a publisher account on ${program.networkDisplay} if you don't have one`,
            actionUrl: program.signupUrl,
            estimatedTime: '10 minutes',
        });

        steps.push({
            step: 2,
            title: `Apply to ${brandName}'s program`,
            description: `Search for "${brandName}" in the program directory and submit your application`,
            estimatedTime: '5 minutes',
        });

        const approvalTimes: Record<string, string> = { easy: '1-2 days', medium: '3-7 days', hard: '1-2 weeks' };
        steps.push({
            step: 3,
            title: 'Wait for approval',
            description: `Most applications are reviewed within ${approvalTimes[program.approvalDifficulty]}`,
            estimatedTime: approvalTimes[program.approvalDifficulty],
        });

        steps.push({
            step: 4,
            title: 'Generate your affiliate link',
            description: `Once approved, use the ${program.networkDisplay} dashboard to create your unique tracking link`,
            estimatedTime: '2 minutes',
        });

        steps.push({
            step: 5,
            title: 'Update your storefront',
            description: `Replace your ${currentPlatform} link with the new ${program.networkDisplay} link`,
            estimatedTime: '5 minutes',
        });
    } else {
        steps.push({
            step: 1,
            title: `Join ${program.networkDisplay}`,
            description: `Create a free publisher account`,
            actionUrl: program.signupUrl,
            estimatedTime: '10 minutes',
        });

        steps.push({
            step: 2,
            title: 'Join and generate link',
            description: `${brandName}'s program has instant approval - generate your link immediately`,
            estimatedTime: '5 minutes',
        });

        steps.push({
            step: 3,
            title: 'Update your storefront',
            description: `Replace your ${currentPlatform} link with the new tracking link`,
            estimatedTime: '5 minutes',
        });
    }

    steps.push({
        step: steps.length + 1,
        title: 'Track your results',
        description: 'Monitor your clicks and conversions in the AffiMark dashboard',
        estimatedTime: 'Ongoing',
    });

    return steps;
}

// ============================================================
// Generate Content Tips
// ============================================================

function generateContentTips(
    category: string,
    brandName: string
): ContentTip[] {
    const tips: ContentTip[] = [];

    // Seasonal tip
    const now = new Date();
    const month = now.getMonth();
    if (month >= 9 && month <= 11) {
        tips.push({
            type: 'seasonal',
            title: 'Q4 is peak season',
            description: `Black Friday and holiday shopping boost ${category} sales by 2-3x. Prioritize promoting ${brandName} now.`,
            priority: 'high',
        });
    } else if (month >= 0 && month <= 1) {
        tips.push({
            type: 'seasonal',
            title: 'New Year promotions',
            description: `Many brands run January sales. Check if ${brandName} has special offers to promote.`,
            priority: 'medium',
        });
    }

    // Category-specific tips
    if (category === 'electronics') {
        tips.push({
            type: 'bundle',
            title: 'Bundle with accessories',
            description: 'Promote related accessories (cases, cables, stands) to increase average order value.',
            priority: 'medium',
        });
    } else if (category === 'beauty') {
        tips.push({
            type: 'format',
            title: 'Tutorial content converts best',
            description: 'How-to tutorials and before/after content drive 40% higher conversion for beauty products.',
            priority: 'high',
        });
    } else if (category === 'fashion') {
        tips.push({
            type: 'audience',
            title: 'Style inspiration drives clicks',
            description: 'Outfit-of-the-day and styling tips generate more engagement than product-only posts.',
            priority: 'medium',
        });
    }

    // Universal tips
    tips.push({
        type: 'timing',
        title: 'Post at peak times',
        description: 'Schedule promotional content for 7-9am and 7-9pm when engagement is highest.',
        priority: 'low',
    });

    return tips.slice(0, 4); // Max 4 tips
}

// ============================================================
// Main Agent Function
// ============================================================

export async function runRevenueOptimizationAgent(
    input: RevenueOptimizationInput,
    env: Env
): Promise<RevenueOptimizationResult> {
    try {
        const supabaseUrl = env.SUPABASE_URL;
        const supabaseKey = env.SUPABASE_SERVICE_KEY;

        // Find best affiliate programs
        const programs = await findBestPrograms(
            input.brandSlug,
            input.category,
            input.currentCommissionRate,
            supabaseUrl,
            supabaseKey
        );

        const recommendedProgram = programs.find(p => p.isRecommended) || programs[0] || null;
        const alternativePrograms = programs.filter(p => !p.isRecommended);

        // Calculate revenue projections
        const newRateLow = recommendedProgram?.commissionRateLow || input.currentCommissionRate;
        const newRateHigh = recommendedProgram?.commissionRateHigh || input.currentCommissionRate;
        const projections = calculateProjections(
            input.currentCommissionRate,
            newRateLow,
            newRateHigh,
            input.category,
            input.userAnalytics
        );

        // Generate launch steps
        const launchSteps = generateLaunchSteps(
            recommendedProgram,
            input.brandName,
            input.currentPlatform
        );

        // Generate content tips
        const contentTips = generateContentTips(input.category, input.brandName);

        // Calculate gain summary
        const conservativeProjection = projections.find(p => p.scenario === 'conservative');
        const optimisticProjection = projections.find(p => p.scenario === 'optimistic');

        return {
            success: true,
            product: {
                url: input.productUrl,
                title: input.productTitle,
                brandSlug: input.brandSlug,
                brandName: input.brandName,
                category: input.category,
            },
            recommendedProgram,
            alternativePrograms,
            projections,
            launchSteps,
            contentTips,
            estimatedMonthlyGain: {
                low: conservativeProjection?.vsCurrentGain || 0,
                high: optimisticProjection?.vsCurrentGain || 0,
            },
            estimatedYearlyGain: {
                low: (conservativeProjection?.vsCurrentGain || 0) * 12,
                high: (optimisticProjection?.vsCurrentGain || 0) * 12,
            },
        };
    } catch (error) {
        return {
            success: false,
            product: {
                url: input.productUrl,
                title: input.productTitle,
                brandSlug: input.brandSlug,
                brandName: input.brandName,
                category: input.category,
            },
            recommendedProgram: null,
            alternativePrograms: [],
            projections: [],
            launchSteps: [],
            contentTips: [],
            estimatedMonthlyGain: { low: 0, high: 0 },
            estimatedYearlyGain: { low: 0, high: 0 },
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}
