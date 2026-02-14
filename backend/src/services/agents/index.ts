/**
 * Sub-Agents Index
 * 
 * Re-exports all sub-agents for easy importing.
 */

export {
    runProductInsightsAgent,
    type ProductInsightsInput,
    type ProductInsightsResult,
    type KPIValue,
} from './product-insights-agent';

export {
    runBrandResearchAgent,
    type BrandResearchInput,
    type BrandResearchResult,
    type ReputationSource,
    type PartnershipQuality,
    type AlternativeBrand,
} from './brand-research-agent';

export {
    runRevenueOptimizationAgent,
    type RevenueOptimizationInput,
    type RevenueOptimizationResult,
    type AffiliateProgram,
    type RevenueProjection,
    type LaunchStep,
    type ContentTip,
} from './revenue-optimization-agent';

export {
    orchestrateAgent,
    type AgentStep,
    type AgentSession,
    type OrchestratorRequest,
    type OrchestratorResponse,
} from './agent-orchestrator';
