'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Bot, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ChatRole = 'user' | 'assistant' | 'system' | 'function' | 'tool' | 'data';

interface ChatMessageProps {
  role: ChatRole;
  content: string;
  isLoading?: boolean;
}

export function ChatMessage({ role, content, isLoading }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={`flex gap-4 mb-6 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <Avatar className="h-10 w-10 flex-shrink-0">
        {isUser ? (
          <>
            <AvatarFallback className="bg-purple-600">
              <User size={20} />
            </AvatarFallback>
          </>
        ) : (
          <>
            <AvatarFallback className="bg-gray-800">
              <Bot size={20} />
            </AvatarFallback>
          </>
        )}
      </Avatar>

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? 'bg-purple-600 text-white'
              : 'bg-gray-800 text-gray-100'
          }`}
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Thinking...</span>
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  code: ({ className, children }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-gray-900 px-1.5 py-0.5 rounded text-purple-400">
                        {children}
                      </code>
                    ) : (
                      <code className="block bg-gray-900 p-3 rounded-lg my-2 overflow-x-auto">
                        {children}
                      </code>
                    );
                  },
                  strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                  a: ({ href, children }) => (
                    <a href={href} className="text-purple-400 hover:underline" target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
        <span className="text-xs text-gray-500 mt-1 px-2">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

