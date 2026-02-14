'use client';

import { useState } from 'react';
import { useVerifier } from '@/hooks/useVerifier';
import type { RankMode } from '@/types/verifier';
import VerifierInput from './VerifierInput';
import DecisionSnapshot from './DecisionSnapshot';
import WinnerRecommendationCard from './WinnerRecommendationCard';
import RecommendationsBuckets from './RecommendationsBuckets';
import PillarHoverAction from './PillarHoverAction';
import PlaybookView from './PlaybookView';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

interface ProductVerifierProps {
  userId: string;
}

type Phase = 'input' | 'results' | 'playbook';

export default function ProductVerifier({ userId }: ProductVerifierProps) {
  const verifier = useVerifier(userId);
  const [phase, setPhase] = useState<Phase>('input');
  const [selectedAlternativeId, setSelectedAlternativeId] = useState<string | null>(null);

  // Handle URL analysis
  const handleAnalyze = (url: string, context?: any) => {
    verifier.analyze(url, context);
  };

  // When results are ready, move to results phase
  if (verifier.snapshot && verifier.recommendations && phase === 'input' && !verifier.isLoading) {
    setPhase('results');
  }

  // Handle approve original product (go to playbook)
  const handleApproveOriginal = () => {
    setSelectedAlternativeId(null);
    verifier.generatePlaybook();
    setPhase('playbook');
  };

  // Handle winner selection (go to playbook)
  const handleSelectWinner = (id: string) => {
    setSelectedAlternativeId(id);
    verifier.generatePlaybook(id);
    setPhase('playbook');
  };

  // Handle alternative selection from buckets
  const handleSelectAlternative = (id: string) => {
    setSelectedAlternativeId(id);
    verifier.generatePlaybook(id);
    setPhase('playbook');
  };

  // Handle rerank (triggered by pillar hover action)
  const handleRerank = (mode: RankMode) => {
    verifier.rerank(mode);
  };

  // Handle back navigation
  const handleBack = () => {
    if (phase === 'playbook') {
      setPhase('results');
    } else if (phase === 'results') {
      verifier.reset();
      setPhase('input');
    }
  };

  // Handle new analysis
  const handleNewAnalysis = () => {
    verifier.reset();
    setPhase('input');
    setSelectedAlternativeId(null);
  };

  // Get scores for pillar hover actions
  const scores = verifier.snapshot?.scores || {
    product_viability: 0,
    offer_merchant: 0,
    economics: 0,
  };

  const currentMode = verifier.recommendations?.mode || 'balanced';

  return (
    <div className="space-y-6">
      {/* Back button (when not on input phase) */}
      {phase !== 'input' && (
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      )}

      {/* Phase A: Input */}
      {phase === 'input' && (
        <VerifierInput
          onAnalyze={handleAnalyze}
          isLoading={verifier.isLoading}
          loadingPhase={verifier.loadingPhase}
          error={verifier.error}
          onClearError={verifier.clearError}
        />
      )}

      {/* Phase B+C: Results (Snapshot + Recommendations) */}
      {phase === 'results' && verifier.snapshot && verifier.recommendations && (
        <div className="space-y-8">
          {/* Decision Snapshot with Pillar Hover Actions */}
          <div className="rounded-xl border border-gray-800 bg-gray-900/30 p-6">
            <DecisionSnapshot
              snapshot={verifier.snapshot}
              onApprove={handleApproveOriginal}
            />

            {/* Pillar Cards with Hover Rerank */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <PillarHoverAction
                pillar="product_viability"
                score={scores.product_viability}
                breakdown={verifier.snapshot.score_breakdowns?.product_viability}
                currentMode={currentMode}
                onRerank={handleRerank}
                isLoading={verifier.isLoading}
              />
              <PillarHoverAction
                pillar="offer_merchant"
                score={scores.offer_merchant}
                breakdown={verifier.snapshot.score_breakdowns?.offer_merchant}
                currentMode={currentMode}
                onRerank={handleRerank}
                isLoading={verifier.isLoading}
              />
              <PillarHoverAction
                pillar="economics"
                score={scores.economics}
                breakdown={verifier.snapshot.score_breakdowns?.economics}
                currentMode={currentMode}
                onRerank={handleRerank}
                isLoading={verifier.isLoading}
              />
            </div>
          </div>

          {/* Recommendations Section */}
          {verifier.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              <span className="ml-3 text-gray-400">{verifier.loadingPhase || 'Loading...'}</span>
            </div>
          ) : (
            <>
              {/* Winner Card */}
              {verifier.recommendations.winner && (
                <WinnerRecommendationCard
                  winner={verifier.recommendations.winner}
                  reason={getWinnerReason(verifier.recommendations.winner, currentMode)}
                  onSelect={handleSelectWinner}
                />
              )}

              {/* Bucket Recommendations */}
              {verifier.recommendations.buckets.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-white">Other Alternatives</h3>
                  <RecommendationsBuckets
                    buckets={verifier.recommendations.buckets}
                    onSelectItem={handleSelectAlternative}
                  />
                </div>
              )}

              {/* No alternatives message */}
              {!verifier.recommendations.winner && verifier.recommendations.buckets.length === 0 && (
                <div className="text-center py-8 rounded-lg border border-gray-800 bg-gray-900/30">
                  <p className="text-gray-400">No alternatives found for this category.</p>
                  <button
                    onClick={handleApproveOriginal}
                    className="mt-4 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
                  >
                    Continue with original product
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Phase D: Playbook */}
      {phase === 'playbook' && (
        <>
          {verifier.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
              <span className="ml-3 text-gray-400">{verifier.loadingPhase || 'Generating playbook...'}</span>
            </div>
          ) : verifier.playbook ? (
            <PlaybookView
              playbook={verifier.playbook}
              onAddToWatchlist={async () => {
                const result = await verifier.addToWatchlist();
                return !!result;
              }}
              onSaveToLibrary={async () => {
                const result = await verifier.saveToLibrary();
                return !!result;
              }}
              onNewAnalysis={handleNewAnalysis}
            />
          ) : null}
        </>
      )}

      {/* Error display for non-input phases */}
      {phase !== 'input' && verifier.error && (
        <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 text-sm text-red-400">
          {verifier.error}
        </div>
      )}
    </div>
  );
}

// Helper function to generate winner reason based on mode
function getWinnerReason(winner: any, mode: RankMode): string {
  const tags = winner.tags || [];
  const hasTag = (t: string) => tags.some((tag: string) => tag.toLowerCase().includes(t.toLowerCase()));

  switch (mode) {
    case 'demand_first':
      if (hasTag('strong demand')) {
        return 'Top pick based on demand signals. This product shows strong market interest and conversion potential.';
      }
      return 'Ranked highest for demand and market viability in this category.';

    case 'trust_first':
      if (hasTag('trusted')) {
        return 'Top pick for trust and reliability. This merchant has excellent reputation and customer satisfaction.';
      }
      return 'Ranked highest for merchant trust and offer quality in this category.';

    case 'economics_first':
      if (hasTag('high margin')) {
        return 'Top pick for economics. Best commission rates and cookie duration for maximum earnings.';
      }
      return 'Ranked highest for earning potential based on commission, AOV, and cookie duration.';

    default:
      return 'Best overall alternative based on balanced scoring across demand, trust, and economics.';
  }
}
