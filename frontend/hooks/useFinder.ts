'use client';

import { useState, useCallback, useEffect } from 'react';
import type {
  FinderSession,
  AlternativeProduct,
  ChatMessage,
  SavedProduct,
  ActiveContext,
  Priority,
} from '@/types/finder';

interface UseFinderOptions {
  userId: string;
}

interface UseFinderReturn {
  // State
  session: FinderSession | null;
  alternatives: AlternativeProduct[];
  currentIndex: number;
  currentProduct: AlternativeProduct | null;
  chatMessages: ChatMessage[];
  savedProducts: SavedProduct[];
  isLoading: boolean;
  isSearching: boolean;
  isChatLoading: boolean;
  error: string | null;

  // User context
  productPriorities: Priority[];
  brandPriorities: Priority[];
  activeContext: ActiveContext;
  availableSocials: string[];
  availableStorefronts: string[];

  // Actions
  search: (input: string, inputType: 'url' | 'category') => Promise<void>;
  saveProduct: (product: AlternativeProduct, listType: 'saved' | 'try_first' | 'content_calendar') => Promise<void>;
  skipProduct: (product: AlternativeProduct) => Promise<void>;
  goToIndex: (index: number) => void;
  sendChatMessage: (message: string) => Promise<void>;
  updateActiveContext: (context: ActiveContext) => Promise<void>;
  removeSavedProduct: (id: string) => Promise<void>;
  moveSavedProduct: (id: string, listType: 'saved' | 'try_first' | 'content_calendar') => Promise<void>;
  refreshSavedProducts: () => Promise<void>;
  reset: () => void;
  clearError: () => void;
}

export function useFinder({ userId }: UseFinderOptions): UseFinderReturn {
  // Session state
  const [session, setSession] = useState<FinderSession | null>(null);
  const [alternatives, setAlternatives] = useState<AlternativeProduct[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [savedProducts, setSavedProducts] = useState<SavedProduct[]>([]);

  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User context
  const [productPriorities, setProductPriorities] = useState<Priority[]>([]);
  const [brandPriorities, setBrandPriorities] = useState<Priority[]>([]);
  const [activeContext, setActiveContext] = useState<ActiveContext>({ socials: [], storefronts: [] });
  const [availableSocials, setAvailableSocials] = useState<string[]>([]);
  const [availableStorefronts, setAvailableStorefronts] = useState<string[]>([]);

  // Current product
  const currentProduct = alternatives[currentIndex] || null;

  // Load user priorities and context on mount
  useEffect(() => {
    async function loadUserContext() {
      try {
        // Load priorities
        const prioritiesRes = await fetch('/api/preferences/priorities', {
          credentials: 'include',
        });
        if (prioritiesRes.ok) {
          const data = await prioritiesRes.json();
          setProductPriorities(data.productPriorities || []);
          setBrandPriorities(data.brandPriorities || []);
          setActiveContext(data.activeContext || { socials: [], storefronts: [] });
        }

        // Load connected accounts for available socials/storefronts
        const accountsRes = await fetch('/api/social-accounts', {
          credentials: 'include',
        });
        if (accountsRes.ok) {
          const data = await accountsRes.json();
          const accounts = data.accounts || [];
          setAvailableSocials(
            accounts
              .filter((a: any) => ['youtube', 'instagram', 'twitter', 'tiktok'].includes(a.platform))
              .map((a: any) => a.platform)
          );
        }

        // Load storefronts
        const storefrontsRes = await fetch('/api/storefronts', {
          credentials: 'include',
        });
        if (storefrontsRes.ok) {
          const data = await storefrontsRes.json();
          const storefronts = data.storefronts || [];
          setAvailableStorefronts(storefronts.map((s: any) => s.platform || s.name));
        }

        // Load saved products
        await loadSavedProducts();
      } catch (err) {
        console.error('[useFinder] Error loading user context:', err);
      }
    }

    loadUserContext();
  }, [userId]);

  // Load saved products
  const loadSavedProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/finder/saved', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSavedProducts(data.products || []);
      }
    } catch (err) {
      console.error('[useFinder] Error loading saved products:', err);
    }
  }, []);

  // Search for products
  const search = useCallback(async (input: string, inputType: 'url' | 'category') => {
    setIsSearching(true);
    setError(null);

    try {
      const res = await fetch('/api/finder/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          input,
          inputType,
          context: activeContext,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Search failed');
      }

      const data = await res.json();

      setSession({
        id: data.sessionId,
        userId,
        inputType,
        inputValue: input,
        productPrioritiesSnapshot: productPriorities,
        brandPrioritiesSnapshot: brandPriorities,
        activeContextSnapshot: activeContext,
        originalProduct: null,
        alternatives: data.alternatives || [],
        alternativesCount: data.alternativesCount || 0,
        currentIndex: 0,
        viewedAlternatives: [],
        savedAlternatives: [],
        skippedAlternatives: [],
        selectedAlternativeId: null,
        chatMessages: [],
        status: data.status,
        errorMessage: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setAlternatives(data.alternatives || []);
      setCurrentIndex(0);
      setChatMessages([]);
    } catch (err: any) {
      setError(err.message || 'Search failed');
    } finally {
      setIsSearching(false);
    }
  }, [userId, activeContext, productPriorities, brandPriorities]);

  // Save a product
  const saveProduct = useCallback(async (
    product: AlternativeProduct,
    listType: 'saved' | 'try_first' | 'content_calendar'
  ) => {
    try {
      const res = await fetch('/api/finder/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          finderSessionId: session?.id,
          productUrl: product.url,
          productName: product.name,
          brand: product.brand,
          category: product.category,
          imageUrl: product.imageUrl,
          price: product.price,
          currency: product.currency,
          matchScore: product.matchScore,
          matchReasons: product.matchReasons,
          priorityAlignment: product.priorityAlignment,
          listType,
          affiliateNetwork: product.affiliateNetwork,
          commissionRate: product.commissionRate,
          cookieDurationDays: product.cookieDurationDays,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save product');
      }

      // Update session
      if (session) {
        await fetch(`/api/finder/session/${session.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            savedAlternativeId: product.id,
          }),
        });
      }

      // Move to next product
      setCurrentIndex((prev) => prev + 1);

      // Refresh saved products
      await loadSavedProducts();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
    }
  }, [session, loadSavedProducts]);

  // Skip a product
  const skipProduct = useCallback(async (product: AlternativeProduct) => {
    try {
      if (session) {
        await fetch(`/api/finder/session/${session.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            skippedAlternativeId: product.id,
          }),
        });
      }

      setCurrentIndex((prev) => prev + 1);
    } catch (err) {
      console.error('[useFinder] Skip error:', err);
    }
  }, [session]);

  // Go to specific index
  const goToIndex = useCallback((index: number) => {
    if (index >= 0 && index < alternatives.length) {
      setCurrentIndex(index);
    }
  }, [alternatives.length]);

  // Send chat message
  const sendChatMessage = useCallback(async (message: string) => {
    if (!session || !currentProduct) return;

    setIsChatLoading(true);

    // Add user message immediately
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
      context: { productId: currentProduct.id },
    };
    setChatMessages((prev) => [...prev, userMessage]);

    try {
      const res = await fetch(`/api/finder/session/${session.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message,
          productId: currentProduct.id,
          productContext: {
            name: currentProduct.name,
            brand: currentProduct.brand,
            price: currentProduct.price,
            currency: currentProduct.currency,
            matchScore: currentProduct.matchScore,
            matchReasons: currentProduct.matchReasons,
            priorityAlignment: currentProduct.priorityAlignment,
            affiliateNetwork: currentProduct.affiliateNetwork,
            category: currentProduct.category,
          },
          // NEW: Pass active context to agent
          activeContext,
        }),
      });

      if (!res.ok) {
        throw new Error('Chat failed');
      }

      const data = await res.json();
      setChatMessages(data.messages || []);
    } catch (err: any) {
      // Add error message
      setChatMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-error`,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  }, [session, currentProduct, activeContext]);

  // Update active context
  const updateActiveContext = useCallback(async (context: ActiveContext) => {
    setActiveContext(context);

    try {
      await fetch('/api/preferences/priorities', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ activeContext: context }),
      });
    } catch (err) {
      console.error('[useFinder] Update context error:', err);
    }
  }, []);

  // Remove saved product
  const removeSavedProduct = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/finder/saved/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to remove product');
      }

      setSavedProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      setError(err.message || 'Failed to remove product');
    }
  }, []);

  // Move saved product to different list
  const moveSavedProduct = useCallback(async (
    id: string,
    listType: 'saved' | 'try_first' | 'content_calendar'
  ) => {
    try {
      const res = await fetch(`/api/finder/saved/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ listType }),
      });

      if (!res.ok) {
        throw new Error('Failed to move product');
      }

      setSavedProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, listType } : p))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to move product');
    }
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setSession(null);
    setAlternatives([]);
    setCurrentIndex(0);
    setChatMessages([]);
    setError(null);
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    session,
    alternatives,
    currentIndex,
    currentProduct,
    chatMessages,
    savedProducts,
    isLoading,
    isSearching,
    isChatLoading,
    error,
    productPriorities,
    brandPriorities,
    activeContext,
    availableSocials,
    availableStorefronts,
    search,
    saveProduct,
    skipProduct,
    goToIndex,
    sendChatMessage,
    updateActiveContext,
    removeSavedProduct,
    moveSavedProduct,
    refreshSavedProducts: loadSavedProducts,
    reset,
    clearError,
  };
}
