/**
 * Agent Orchestrator
 * 
 * Coordinates the 3-step Commission Agent flow:
 * 1. Product Insights Agent
 * 2. Brand Research Agent  
 * 3. Revenue Optimization Agent
 */

import { Env } from '../../index';
import { runProductInsightsAgent, ProductInsightsInput, ProductInsightsResult } from './product-insights-agent';
import { runBrandResearchAgent, BrandResearchInput, BrandResearchResult } from './brand-research-agent';
import { runRevenueOptimizationAgent, RevenueOptimizationInput, RevenueOptimizationResult } from './revenue-optimization-agent';

// ============================================================
// Types
// ============================================================

export type AgentStep = 'insights' | 'brand_research' | 'optimization' | 'completed';

export interface AgentSession {
    sessionId: string;
    userId: string;
    currentStep: AgentStep;
    productUrl: string;
    createdAt: string;

    // Step results (populated as user progresses)
    insightsResult?: ProductInsightsResult;
    brandResearchResult?: BrandResearchResult;
    optimizationResult?: RevenueOptimizationResult;

    // User selections
    selectedBrandSlug?: string;
    userMatchPreference?: 'exact' | 'similar';
}

export interface OrchestratorRequest {
    action: 'start' | 'proceed' | 'select_brand' | 'select_alternative' | 'go_back' | 'complete';
    sessionId?: string;
    userId: string;

    // For 'start' action
    productUrl?: string;
    productTitle?: string;
    productBrand?: string;

    // For 'select_brand' and 'select_alternative' actions
    brandSlug?: string;
    brandName?: string;

    // User preferences
    matchPreference?: 'exact' | 'similar';
}

export interface OrchestratorResponse {
    success: boolean;
    sessionId: string;
    currentStep: AgentStep;

    // Current step result
    insightsResult?: ProductInsightsResult;
    brandResearchResult?: BrandResearchResult;
    optimizationResult?: RevenueOptimizationResult;

    // Navigation
    canGoBack: boolean;
    canProceed: boolean;

    error?: string;
}

// ============================================================
// Session Management
// ============================================================

// In-memory session store (would use KV or Supabase in production)
const sessions = new Map<string, AgentSession>();

function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

async function saveSession(session: AgentSession, env: Env): Promise<void> {
    sessions.set(session.sessionId, session);

    // Also persist to Supabase for durability
    try {
        await fetch(
            `${env.SUPABASE_URL}/rest/v1/commission_agent_sessions`,
            {
                method: 'POST',
                headers: {
                    'apikey': env.SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates',
                },
                body: JSON.stringify({
                    id: session.sessionId,
                    user_id: session.userId,
                    current_step: session.currentStep,
                    product_url: session.productUrl,
                    detected_brand_slug: session.insightsResult?.product.brand.slug,
                    selected_brand_slug: session.selectedBrandSlug,
                    step_data: {
                        insights: session.insightsResult,
                        brand_research: session.brandResearchResult,
                        optimization: session.optimizationResult,
                    },
                }),
            }
        );
    } catch (error) {
        console.error('Failed to persist session:', error);
    }
}

async function loadSession(sessionId: string, env: Env): Promise<AgentSession | null> {
    // Check in-memory first
    const cached = sessions.get(sessionId);
    if (cached) return cached;

    // Try loading from Supabase
    try {
        const response = await fetch(
            `${env.SUPABASE_URL}/rest/v1/commission_agent_sessions?id=eq.${sessionId}&select=*`,
            {
                headers: {
                    'apikey': env.SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
                },
            }
        );

        if (!response.ok) return null;

        const data = await response.json() as Array<{
            id: string;
            user_id: string;
            current_step: AgentStep;
            product_url: string;
            selected_brand_slug: string | null;
            step_data: {
                insights?: ProductInsightsResult;
                brand_research?: BrandResearchResult;
                optimization?: RevenueOptimizationResult;
            };
            created_at: string;
        }>;

        if (data.length === 0) return null;

        const row = data[0];
        const session: AgentSession = {
            sessionId: row.id,
            userId: row.user_id,
            currentStep: row.current_step,
            productUrl: row.product_url,
            createdAt: row.created_at,
            insightsResult: row.step_data?.insights,
            brandResearchResult: row.step_data?.brand_research,
            optimizationResult: row.step_data?.optimization,
            selectedBrandSlug: row.selected_brand_slug || undefined,
        };

        sessions.set(sessionId, session);
        return session;
    } catch {
        return null;
    }
}

// ============================================================
// Orchestrator Actions
// ============================================================

async function handleStart(
    request: OrchestratorRequest,
    env: Env
): Promise<OrchestratorResponse> {
    if (!request.productUrl) {
        return {
            success: false,
            sessionId: '',
            currentStep: 'insights',
            canGoBack: false,
            canProceed: false,
            error: 'Product URL is required',
        };
    }

    const sessionId = generateSessionId();

    // Run Product Insights Agent
    const insightsResult = await runProductInsightsAgent({
        productUrl: request.productUrl,
        title: request.productTitle,
        brand: request.productBrand,
        userId: request.userId,
    }, env);

    const session: AgentSession = {
        sessionId,
        userId: request.userId,
        currentStep: 'insights',
        productUrl: request.productUrl,
        createdAt: new Date().toISOString(),
        insightsResult,
        userMatchPreference: request.matchPreference,
    };

    await saveSession(session, env);

    return {
        success: insightsResult.success,
        sessionId,
        currentStep: 'insights',
        insightsResult,
        canGoBack: false,
        canProceed: insightsResult.success && insightsResult.worthPromotingScore >= 30,
        error: insightsResult.error,
    };
}

async function handleProceed(
    session: AgentSession,
    env: Env
): Promise<OrchestratorResponse> {
    if (session.currentStep === 'insights') {
        // Move to brand research
        if (!session.insightsResult) {
            return {
                success: false,
                sessionId: session.sessionId,
                currentStep: session.currentStep,
                canGoBack: false,
                canProceed: false,
                error: 'No insights result available',
            };
        }

        const brandResearchResult = await runBrandResearchAgent({
            brandSlug: session.insightsResult.product.brand.slug,
            brandName: session.insightsResult.product.brand.name,
            category: session.insightsResult.product.category.name,
            productUrl: session.productUrl,
            userId: session.userId,
            matchType: session.userMatchPreference,
        }, env);

        session.currentStep = 'brand_research';
        session.brandResearchResult = brandResearchResult;
        await saveSession(session, env);

        return {
            success: brandResearchResult.success,
            sessionId: session.sessionId,
            currentStep: 'brand_research',
            insightsResult: session.insightsResult,
            brandResearchResult,
            canGoBack: true,
            canProceed: brandResearchResult.success,
            error: brandResearchResult.error,
        };
    }

    if (session.currentStep === 'brand_research') {
        // Move to optimization
        if (!session.insightsResult || !session.brandResearchResult) {
            return {
                success: false,
                sessionId: session.sessionId,
                currentStep: session.currentStep,
                canGoBack: true,
                canProceed: false,
                error: 'Missing required data',
            };
        }

        const selectedBrand = session.selectedBrandSlug || session.insightsResult.product.brand.slug;
        const selectedBrandName = session.brandResearchResult.brand.name;

        const optimizationResult = await runRevenueOptimizationAgent({
            productUrl: session.productUrl,
            productTitle: session.insightsResult.product.title,
            brandSlug: selectedBrand,
            brandName: selectedBrandName,
            category: session.insightsResult.product.category.name,
            currentPlatform: session.insightsResult.current.platformName,
            currentCommissionRate: session.insightsResult.current.commissionRate,
            userId: session.userId,
        }, env);

        session.currentStep = 'optimization';
        session.optimizationResult = optimizationResult;
        await saveSession(session, env);

        return {
            success: optimizationResult.success,
            sessionId: session.sessionId,
            currentStep: 'optimization',
            insightsResult: session.insightsResult,
            brandResearchResult: session.brandResearchResult,
            optimizationResult,
            canGoBack: true,
            canProceed: false, // This is the final step
            error: optimizationResult.error,
        };
    }

    return {
        success: false,
        sessionId: session.sessionId,
        currentStep: session.currentStep,
        canGoBack: true,
        canProceed: false,
        error: 'Cannot proceed from current step',
    };
}

async function handleSelectBrand(
    session: AgentSession,
    brandSlug: string,
    brandName: string,
    env: Env
): Promise<OrchestratorResponse> {
    session.selectedBrandSlug = brandSlug;

    // Re-run brand research for the selected brand if different
    if (brandSlug !== session.insightsResult?.product.brand.slug) {
        const brandResearchResult = await runBrandResearchAgent({
            brandSlug,
            brandName,
            category: session.insightsResult?.product.category.name || 'general',
            productUrl: session.productUrl,
            userId: session.userId,
            includeAlternatives: false, // User already selected
        }, env);

        session.brandResearchResult = brandResearchResult;
    }

    await saveSession(session, env);

    // Automatically proceed to optimization
    return handleProceed(session, env);
}

async function handleGoBack(
    session: AgentSession,
    env: Env
): Promise<OrchestratorResponse> {
    if (session.currentStep === 'brand_research') {
        session.currentStep = 'insights';
    } else if (session.currentStep === 'optimization') {
        session.currentStep = 'brand_research';
    }

    await saveSession(session, env);

    return {
        success: true,
        sessionId: session.sessionId,
        currentStep: session.currentStep,
        insightsResult: session.insightsResult,
        brandResearchResult: session.currentStep === 'brand_research' ? session.brandResearchResult : undefined,
        canGoBack: session.currentStep !== 'insights',
        canProceed: true,
    };
}

// ============================================================
// Main Orchestrator Function
// ============================================================

export async function orchestrateAgent(
    request: OrchestratorRequest,
    env: Env
): Promise<OrchestratorResponse> {
    try {
        // Handle start action (no session required)
        if (request.action === 'start') {
            return handleStart(request, env);
        }

        // All other actions require a session
        if (!request.sessionId) {
            return {
                success: false,
                sessionId: '',
                currentStep: 'insights',
                canGoBack: false,
                canProceed: false,
                error: 'Session ID is required',
            };
        }

        const session = await loadSession(request.sessionId, env);
        if (!session) {
            return {
                success: false,
                sessionId: request.sessionId,
                currentStep: 'insights',
                canGoBack: false,
                canProceed: false,
                error: 'Session not found',
            };
        }

        switch (request.action) {
            case 'proceed':
                return handleProceed(session, env);

            case 'select_brand':
            case 'select_alternative':
                if (!request.brandSlug || !request.brandName) {
                    return {
                        success: false,
                        sessionId: session.sessionId,
                        currentStep: session.currentStep,
                        canGoBack: true,
                        canProceed: false,
                        error: 'Brand slug and name are required',
                    };
                }
                return handleSelectBrand(session, request.brandSlug, request.brandName, env);

            case 'go_back':
                return handleGoBack(session, env);

            case 'complete':
                session.currentStep = 'completed';
                await saveSession(session, env);
                return {
                    success: true,
                    sessionId: session.sessionId,
                    currentStep: 'completed',
                    insightsResult: session.insightsResult,
                    brandResearchResult: session.brandResearchResult,
                    optimizationResult: session.optimizationResult,
                    canGoBack: false,
                    canProceed: false,
                };

            default:
                return {
                    success: false,
                    sessionId: session.sessionId,
                    currentStep: session.currentStep,
                    canGoBack: false,
                    canProceed: false,
                    error: `Unknown action: ${request.action}`,
                };
        }
    } catch (error) {
        return {
            success: false,
            sessionId: request.sessionId || '',
            currentStep: 'insights',
            canGoBack: false,
            canProceed: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

// ============================================================
// Export sub-agent types for API routes
// ============================================================

export type {
    ProductInsightsInput,
    ProductInsightsResult,
    BrandResearchInput,
    BrandResearchResult,
    RevenueOptimizationInput,
    RevenueOptimizationResult,
};
