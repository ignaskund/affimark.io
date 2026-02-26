/**
 * Unified AI Client — OpenAI GPT-4o-mini
 *
 * No singleton — each call creates a fresh client with the provided key.
 * If no key is passed, reads from OPENAI_API_KEY in process.env as a fallback.
 */

import OpenAI from 'openai';

function resolveKey(explicit?: string): string {
  const key = explicit || (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : undefined);
  if (!key) throw new Error('No OPENAI_API_KEY provided and none found in process.env');
  return key;
}

export interface AiCompletionOptions {
  prompt: string;
  system?: string;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  apiKey?: string;
}

export async function aiComplete(options: AiCompletionOptions): Promise<string> {
  const client = new OpenAI({ apiKey: resolveKey(options.apiKey) });

  const messages: OpenAI.ChatCompletionMessageParam[] = [];

  if (options.system) {
    messages.push({ role: 'system', content: options.system });
  }

  if (options.messages && options.messages.length > 0) {
    for (const m of options.messages) {
      messages.push({ role: m.role, content: m.content });
    }
  } else {
    messages.push({ role: 'user', content: options.prompt });
  }

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: options.maxTokens || 300,
    temperature: options.temperature ?? 0.3,
    messages,
  });

  return response.choices[0]?.message?.content || '';
}

export async function aiChat(options: {
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  maxTokens?: number;
  temperature?: number;
  apiKey?: string;
}): Promise<string> {
  const client = new OpenAI({ apiKey: resolveKey(options.apiKey) });

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: options.system },
    ...options.messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  ];

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: options.maxTokens || 600,
    temperature: options.temperature ?? 0.5,
    messages,
  });

  return response.choices[0]?.message?.content || '';
}

export function extractJson(text: string): any | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}
