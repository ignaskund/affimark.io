'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Sparkles, BarChart3, Package, TrendingUp, Loader2, ScanLine, ShoppingBag } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

interface SocialAccount {
  id: string;
  platform: string;
  channel_name: string;
  follower_count: number;
}

interface LocalMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [userId, setUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Redirect if not authenticated
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error || !data.session) {
        setAuthStatus('unauthenticated');
        router.push('/sign-in');
      } else {
        setAuthStatus('authenticated');
        setUserId(data.session.user.id);
      }
    }

    checkSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (session) {
        setAuthStatus('authenticated');
      } else {
        setAuthStatus('unauthenticated');
        router.push('/sign-in');
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const userMessage: LocalMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          connectedAccounts: [],
          history: messages,
        }),
      });

      if (!response.ok) {
        // Try to parse error details from response
        let errorMessage = 'Chat request failed';
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
            if (errorData.details) {
              errorMessage += `\n\nDetails: ${errorData.details}`;
            }
            if (errorData.hint) {
              errorMessage += `\n\n${errorData.hint}`;
            }
          }
        } catch {
          // If parsing fails, use status text
          errorMessage = `Chat request failed: ${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const replyText =
        data.reply ??
        data.content ??
        'Sorry, I could not process that request right now.';

      const assistantMessage: LocalMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: replyText,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Chat error:', error);

      // Create more descriptive error message
      let errorMessage = 'Something went wrong talking to your monetization agent.';

      if (error.message) {
        if (error.message.includes('backend service')) {
          errorMessage = '⚠️ Cannot connect to the backend service.\n\nPlease make sure the backend is running:\n\n```\ncd backend && npm run dev\n```';
        } else if (error.message.includes('Unauthorized')) {
          errorMessage = '🔒 Authentication error. Please sign in again.';
        } else if (error.message.includes('ANTHROPIC_API_KEY')) {
          errorMessage = '⚠️ AI service configuration error. Please check your API keys.';
        } else {
          errorMessage = `⚠️ ${error.message}\n\nPlease try again in a moment.`;
        }
      }

      const assistantMessage: LocalMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: errorMessage,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !input.trim()) return;
    await sendMessage(input);
  };

  if (authStatus === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="animate-spin text-purple-600" size={48} />
      </div>
    );
  }
  
  if (authStatus === 'unauthenticated') {
    return null;
  }

  const quickPrompts = [
    {
      icon: ScanLine,
      label: 'Review my scans',
      prompt: 'Review my recent content scans and suggest which products I should add to my inventory',
    },
    {
      icon: ShoppingBag,
      label: 'Optimize my shop',
      prompt: 'Analyze my shop performance and recommend which products to highlight or remove',
    },
    {
      icon: Package,
      label: 'Product suggestions',
      prompt: 'What products should I add for my next video about studio setup?',
    },
    {
      icon: TrendingUp,
      label: 'Affiliate programs',
      prompt: 'Which affiliate programs should I join based on my current inventory?',
    },
  ];

  const handleQuickPrompt = (prompt: string) => {
    if (isLoading) return;
    sendMessage(prompt);
  };

  return (
    <AppShell>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-black">
        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-800 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Sparkles size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">AI Monetization Strategist</h1>
              <p className="text-sm text-gray-400">
                Context-aware revenue optimization powered by your data
              </p>
            </div>
          </div>

        </div>

        {/* Messages Area */}
        <ScrollArea className="flex-1 overflow-y-auto">
          <div ref={scrollRef} className="px-6 py-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center max-w-2xl mx-auto pt-12">
                <div className="bg-purple-600/10 p-6 rounded-full mb-6">
                  <Sparkles size={48} className="text-purple-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-3">
                  Welcome to Your AI Monetization Strategist
                </h2>
                <p className="text-gray-400 mb-8 max-w-md">
                  I'm grounded in your inventory, scan results, shop performance, and content data.
                  I can add products, suggest affiliate programs, analyze performance, and help you maximize revenue.
                </p>

                {/* Quick Prompts */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 w-full mb-8">
                  {quickPrompts.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={index}
                        onClick={() => handleQuickPrompt(item.prompt)}
                        className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl p-4 transition-colors text-left group"
                      >
                        <Icon size={24} className="text-purple-500 mb-3" />
                        <p className="text-white font-medium mb-1">{item.label}</p>
                        <p className="text-xs text-gray-500 group-hover:text-gray-400">
                          {item.prompt}
                        </p>
                      </button>
                    );
                  })}
                </div>

              </div>
            ) : (
              <div className="max-w-4xl mx-auto">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    role={message.role}
                    content={message.content}
                  />
                ))}
                {isLoading && (
                  <ChatMessage role="assistant" content="" isLoading />
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="bg-gray-900 border-t border-gray-800 px-6 py-4">
          <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your inventory, shop performance, scans, or monetization strategy..."
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-600"
                disabled={isLoading}
              />
              <Button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6"
              >
                <Send size={20} />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2 text-center">
              AI can make mistakes. Verify important information.
            </p>
          </form>
        </div>
      </div>

    </AppShell>
  );
}

