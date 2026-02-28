/**
 * MCP Alternative Search Agent — Public API
 *
 * Entry point for the MCP-powered search.
 * Can be called from finder-routes.ts as a replacement for the old pipeline.
 */

export { runAlternativeSearchAgent } from './agent';
export {
  getCreatorProfile,
  identifyProduct,
  searchAlternatives,
  scoreCandidate,
  computeSemanticScores,
} from './tools';
export type {
  CreatorProfile,
  IdentifiedProduct,
  SearchCandidate,
  ScoredAlternative,
  AgentSearchResult,
  SearchIteration,
} from './types';
