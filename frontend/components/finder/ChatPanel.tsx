'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Loader2,
  User,
  Bot,
  Sparkles,
  ChevronRight,
  Link2,
  Search,
  Settings2,
} from 'lucide-react';
import ContextBar from './ContextBar';
import { getPlatformIcon, getPlatformColor } from '@/components/icons/PlatformIcons';
import type { ActiveContext } from '@/types/finder';
import type { ChatMessage, AlternativeProduct } from '@/types/finder';

interface ChatPanelProps {
  messages: ChatMessage[];
  currentProduct: AlternativeProduct | null;
  onSendMessage: (message: string) => void;
  onNewSearch: (input: string, inputType: 'url' | 'category') => void;
  isLoading: boolean;
  isSearching: boolean;
  searchQuery: string;
  availableSocials: string[];
  availableStorefronts: string[];
  activeContext: ActiveContext;
  onContextChange: (context: ActiveContext) => Promise<void>;
  onEditPriorities?: () => void;
}

const suggestedPrompts = [
  'Why is this my best match?',
  'Compare to the original',
  'What are the risks?',
  'Show commission details',
  'Will my audience like this?',
];

function detectInputType(value: string): 'url' | 'category' {
  try {
    new URL(value);
    return 'url';
  } catch {
    return value.startsWith('http') ? 'url' : 'category';
  }
}

export default function ChatPanel({
  messages,
  currentProduct,
  onSendMessage,
  onNewSearch,
  isLoading,
  isSearching,
  searchQuery,
  availableSocials,
  availableStorefronts,
  activeContext,
  onContextChange,
  onEditPriorities,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [showContextPicker, setShowContextPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || isSearching) return;

    const trimmed = input.trim();
    const type = detectInputType(trimmed);

    // If it looks like a URL or a new product search, trigger new search
    if (type === 'url') {
      onNewSearch(trimmed, 'url');
    } else {
      onSendMessage(trimmed);
    }
    setInput('');
  };

  const handleSuggestedPrompt = (prompt: string) => {
    onSendMessage(prompt);
  };

  const inputType = detectInputType(input);

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white">Product Assistant</h3>
            <p className="text-xs text-gray-500 truncate">
              {isSearching ? 'Searching...' : currentProduct ? currentProduct.name : 'Ask me anything'}
            </p>
          </div>
        </div>
        {/* Active context mini-badges */}
        {(activeContext.socials.length > 0 || activeContext.storefronts.length > 0) && (
          <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
            {activeContext.socials.map((social) => {
              const Icon = getPlatformIcon(social);
              const colors = getPlatformColor(social);
              return (
                <span
                  key={social}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}
                  title={social}
                >
                  <Icon className="w-3 h-3" />
                  <span className="text-[10px] font-medium capitalize">{social}</span>
                </span>
              );
            })}
            {activeContext.storefronts.map((storefront) => {
              const Icon = getPlatformIcon(storefront);
              const colors = getPlatformColor(storefront);
              return (
                <span
                  key={storefront}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}
                  title={storefront}
                >
                  <Icon className="w-3 h-3" />
                  <span className="text-[10px] font-medium capitalize">{storefront.replace('_', ' ')}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Search context message */}
        {searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3 flex-row-reverse"
          >
            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-blue-400" />
            </div>
            <div className="max-w-[80%] p-3 rounded-xl bg-blue-500/20 text-blue-100">
              <p className="text-sm">{searchQuery}</p>
            </div>
          </motion.div>
        )}

        {/* Searching indicator */}
        {isSearching && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-orange-400" />
            </div>
            <div className="p-3 rounded-xl bg-gray-800">
              <p className="text-sm text-gray-300 mb-2">Searching for the best products...</p>
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Chat messages */}
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user' ? 'bg-blue-500/20' : 'bg-orange-500/20'
              }`}
            >
              {message.role === 'user' ? (
                <User className="w-4 h-4 text-blue-400" />
              ) : (
                <Bot className="w-4 h-4 text-orange-400" />
              )}
            </div>
            <div
              className={`max-w-[80%] p-3 rounded-xl ${
                message.role === 'user'
                  ? 'bg-blue-500/20 text-blue-100'
                  : 'bg-gray-800 text-gray-200'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className="text-[10px] text-gray-500 mt-1">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </motion.div>
        ))}

        {/* Chat loading */}
        {isLoading && !isSearching && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-orange-400" />
            </div>
            <div className="p-3 rounded-xl bg-gray-800">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Suggested prompts when no messages and results are available */}
        {messages.length === 0 && !isSearching && searchQuery && (
          <div className="pt-4 space-y-2">
            <p className="text-xs text-gray-500 mb-3">Ask about the products:</p>
            {suggestedPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSuggestedPrompt(prompt)}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-800 text-gray-300 text-sm hover:bg-gray-800 hover:text-white transition-colors"
              >
                {prompt}
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            ))}
          </div>
        )}

        {/* Quick prompts scroll */}
        {messages.length > 0 && !isSearching && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {suggestedPrompts.slice(0, 3).map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSuggestedPrompt(prompt)}
                disabled={isLoading}
                className="flex-shrink-0 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700 text-gray-400 text-xs hover:bg-gray-700 hover:text-white disabled:opacity-50 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-800">
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isSearching ? 'Searching...' : 'Ask a question or paste a new URL...'}
              className="w-full px-4 py-2.5 pr-12 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 text-sm"
              disabled={isLoading || isSearching}
            />
            {/* Input type indicator */}
            {input && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {inputType === 'url' ? (
                  <Link2 className="w-4 h-4 text-blue-400" />
                ) : (
                  <Search className="w-4 h-4 text-gray-500" />
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowContextPicker((prev) => !prev)}
            className="p-2.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 hover:text-white hover:bg-gray-700 transition-colors"
            title="Context (optional)"
          >
            <Settings2 className="w-5 h-5" />
          </button>
          <button
            type="submit"
            disabled={!input.trim() || isLoading || isSearching}
            className="p-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:bg-gray-700 disabled:text-gray-500 text-white transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        <AnimatePresence>
          {showContextPicker && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="mt-3"
            >
              <ContextBar
                availableSocials={availableSocials}
                availableStorefronts={availableStorefronts}
                activeContext={activeContext}
                onContextChange={onContextChange}
                onEditPriorities={onEditPriorities}
              />
              <p className="mt-2 text-[11px] text-gray-500">
                Social and storefront context are optional. Leave empty to search broadly.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
