'use client';

import { useState, useCallback } from 'react';
import type {
  VerifierSession,
  DecisionSnapshot,
  RecommendationsResponse,
  RankMode,
  RankedAlternative,
  RecommendationBucket,
  Playbook,
  TelemetryEventName,
  UserContext,
  VerifierAnalysisResult,
} from '@/types/verifier';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';

interface UseVerifierState {
  sessionId: string | null;
  status: string;
  snapshot: DecisionSnapshot | null;
  recommendations: RecommendationsResponse | null;
  playbook: Playbook | null;
  isLoading: boolean;
  loadingPhase: string | null;
  error: string | null;
}

export function useVerifier(userId: string | null) {
  const [state, setState] = useState<UseVerifierState>({
    sessionId: null,
    status: 'idle',
    snapshot: null,
    recommendations: null,
    playbook: null,
    isLoading: false,
    loadingPhase: null,
    error: null,
  });

  const headers = useCallback(() => ({
    'Content-Type': 'application/json',
    'x-user-id': userId || '',
  }), [userId]);

  /**
   * Phase A+B: Analyze a product URL
   * Returns snapshot + recommendations in one response
   */
  const analyze = useCallback(async (url: string, userContext?: UserContext) => {
    if (!userId) return;

    setState(prev => ({
      ...prev,
      isLoading: true,
      loadingPhase: 'Extracting product data...',
      error: null,
      snapshot: null,
      recommendations: null,
      playbook: null,
    }));

    try {
      // Progress simulation for better UX
      const phaseTimer = setTimeout(() => {
        setState(prev => ({ ...prev, loadingPhase: 'Collecting reviews and reputation...' }));
      }, 2000);

      const scoreTimer = setTimeout(() => {
        setState(prev => ({ ...prev, loadingPhase: 'Computing scores and finding alternatives...' }));
      }, 4000);

      const response = await fetch(`${BACKEND_URL}/api/verifier/analyze`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ product_url: url, user_context: userContext }),
      });

      clearTimeout(phaseTimer);
      clearTimeout(scoreTimer);

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Analysis failed' }));
        throw new Error(err.error || 'Analysis failed');
      }

      const data = await response.json() as VerifierAnalysisResult;

      setState(prev => ({
        ...prev,
        sessionId: data.session_id,
        status: 'recommendations_ready',
        snapshot: data.snapshot,
        recommendations: {
          session_id: data.session_id,
          mode: data.recommendations.mode,
          routing: data.recommendations.routing,
          coverage: data.snapshot.coverage,
          winner: data.recommendations.winner,
          buckets: data.recommendations.buckets,
        },
        isLoading: false,
        loadingPhase: null,
      }));

      // Log telemetry
      logTelemetry(data.session_id, 'analyze_completed', {
        verdict: data.snapshot.verdict?.status,
        confidence: data.snapshot.confidence?.level,
        mode: data.recommendations.mode,
        winner_found: data.recommendations.winner !== null,
        bucket_count: data.recommendations.buckets.length,
      });
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        loadingPhase: null,
        error: error.message || 'Failed to analyze URL',
      }));
    }
  }, [userId, headers]);

  /**
   * Rerank alternatives with a new mode (triggered by pillar hover action)
   */
  const rerank = useCallback(async (mode: RankMode) => {
    if (!state.sessionId || !userId) return;

    setState(prev => ({
      ...prev,
      isLoading: true,
      loadingPhase: 'Reranking alternatives...',
      error: null,
    }));

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/verifier/session/${state.sessionId}/rerank`,
        {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ mode }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to rerank' }));
        throw new Error(err.error);
      }

      const data = await response.json();

      setState(prev => ({
        ...prev,
        recommendations: prev.recommendations ? {
          ...prev.recommendations,
          mode: data.mode,
          winner: data.winner,
          buckets: data.buckets,
        } : null,
        isLoading: false,
        loadingPhase: null,
      }));

      logTelemetry(state.sessionId, 'rerank_applied', {
        new_mode: mode,
        winner_changed: data.winner?.id !== state.recommendations?.winner?.id,
      });
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        loadingPhase: null,
        error: error.message || 'Failed to rerank alternatives',
      }));
    }
  }, [state.sessionId, state.recommendations, userId, headers]);

  /**
   * Phase D: Generate playbook
   */
  const generatePlaybook = useCallback(async (selectedAlternativeId?: string) => {
    if (!state.sessionId || !userId) return;

    setState(prev => ({
      ...prev,
      isLoading: true,
      loadingPhase: 'Generating your playbook...',
      error: null,
    }));

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/verifier/session/${state.sessionId}/playbook`,
        {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            selected_alternative_id: selectedAlternativeId || null,
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to generate playbook' }));
        throw new Error(err.error);
      }

      const data = await response.json();

      setState(prev => ({
        ...prev,
        status: 'playbook_ready',
        playbook: data.playbook as Playbook,
        isLoading: false,
        loadingPhase: null,
      }));

      logTelemetry(state.sessionId, 'playbook_viewed');
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        loadingPhase: null,
        error: error.message || 'Failed to generate playbook',
      }));
    }
  }, [state.sessionId, userId, headers]);

  /**
   * Phase E: Add to watchlist
   */
  const addToWatchlist = useCallback(async () => {
    if (!state.sessionId || !userId) return;

    try {
      const response = await fetch(
        `${BACKEND_URL}/api/verifier/session/${state.sessionId}/watchlist`,
        {
          method: 'POST',
          headers: headers(),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to add to watchlist' }));
        throw new Error(err.error);
      }

      logTelemetry(state.sessionId, 'watchlist_added');
      return await response.json();
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to add to watchlist',
      }));
      return null;
    }
  }, [state.sessionId, userId, headers]);

  /**
   * Save to library
   */
  const saveToLibrary = useCallback(async (notes?: string, tags?: string[]) => {
    if (!state.sessionId || !userId) return;

    try {
      const response = await fetch(`${BACKEND_URL}/api/verifier/library/save`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          session_id: state.sessionId,
          notes,
          tags,
        }),
      });

      if (!response.ok) throw new Error('Failed to save');
      return await response.json();
    } catch (error: any) {
      setState(prev => ({ ...prev, error: error.message }));
      return null;
    }
  }, [state.sessionId, userId, headers]);

  /**
   * Log telemetry event
   */
  const logTelemetry = useCallback(async (
    sessionId: string,
    event: TelemetryEventName,
    data?: Record<string, unknown>
  ) => {
    try {
      await fetch(`${BACKEND_URL}/api/verifier/session/${sessionId}/telemetry`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ event, data }),
      });
    } catch {
      // Telemetry is non-critical
    }
  }, [headers]);

  /**
   * Reset state for new analysis
   */
  const reset = useCallback(() => {
    setState({
      sessionId: null,
      status: 'idle',
      snapshot: null,
      recommendations: null,
      playbook: null,
      isLoading: false,
      loadingPhase: null,
      error: null,
    });
  }, []);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    ...state,
    analyze,
    rerank,
    generatePlaybook,
    addToWatchlist,
    saveToLibrary,
    logTelemetry: (event: TelemetryEventName, data?: Record<string, unknown>) => {
      if (state.sessionId) logTelemetry(state.sessionId, event, data);
    },
    reset,
    clearError,
  };
}
