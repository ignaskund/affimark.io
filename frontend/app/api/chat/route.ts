/**
 * Strategy Agent Chat API
 * Context-aware AI monetization strategist
 */

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@/lib/supabase-server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function POST(request: NextRequest) {
  try {
    console.log('[Chat API] Starting request processing...');

    const { message, history } = await request.json();

    if (!message) {
      console.error('[Chat API] No message provided');
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    console.log('[Chat API] Message received, checking authentication...');

    // Get user from session using proper server-side Supabase client
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error('[Chat API] Auth error:', authError);
      return NextResponse.json({ error: 'Authentication failed', details: authError.message }, { status: 401 });
    }

    if (!user) {
      console.error('[Chat API] User not authenticated');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Chat API] User authenticated: ${user.id}`);

    // Verify environment variables
    if (!process.env.OPENAI_API_KEY) {
      console.error('[Chat API] OPENAI_API_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error: Missing OpenAI API key' },
        { status: 500 }
      );
    }

    if (!process.env.BACKEND_API_KEY) {
      console.error('[Chat API] BACKEND_API_KEY not configured');
      return NextResponse.json(
        { error: 'Server configuration error: Missing backend API key' },
        { status: 500 }
      );
    }

    // Fetch agent context from backend
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';
    console.log(`[Chat API] Fetching context from backend: ${backendUrl}`);

    let contextResponse;
    try {
      contextResponse = await fetch(`${backendUrl}/api/mcp/get_agent_context`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.BACKEND_API_KEY}`,
        },
        body: JSON.stringify({ user_id: user.id }),
      });
    } catch (fetchError: any) {
      console.error('[Chat API] Failed to connect to backend:', fetchError.message);
      return NextResponse.json(
        {
          error: 'Cannot connect to backend service',
          details: `Backend URL: ${backendUrl}. Error: ${fetchError.message}`,
          hint: 'Make sure the backend is running on port 8787'
        },
        { status: 503 }
      );
    }

    if (!contextResponse.ok) {
      const errorText = await contextResponse.text();
      console.error(`[Chat API] Failed to fetch agent context: ${contextResponse.status} - ${errorText}`);
      return NextResponse.json(
        {
          error: 'Failed to fetch agent context from backend',
          details: `Status: ${contextResponse.status}`,
          backendError: errorText
        },
        { status: 502 }
      );
    }

    const { context } = await contextResponse.json();
    console.log('[Chat API] Context fetched successfully');

    // Build system prompt
    console.log('[Chat API] Fetching system prompt...');
    let systemPromptResponse;
    try {
      systemPromptResponse = await fetch(`${backendUrl}/api/mcp/get_system_prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.BACKEND_API_KEY}`,
        },
        body: JSON.stringify({ user_id: user.id }),
      });
    } catch (fetchError: any) {
      console.error('[Chat API] Failed to fetch system prompt:', fetchError.message);
      return NextResponse.json(
        {
          error: 'Cannot connect to backend for system prompt',
          details: fetchError.message
        },
        { status: 503 }
      );
    }

    if (!systemPromptResponse.ok) {
      const errorText = await systemPromptResponse.text();
      console.error(`[Chat API] Failed to fetch system prompt: ${systemPromptResponse.status} - ${errorText}`);
      return NextResponse.json(
        {
          error: 'Failed to fetch system prompt from backend',
          details: `Status: ${systemPromptResponse.status}`,
          backendError: errorText
        },
        { status: 502 }
      );
    }

    const { system_prompt } = await systemPromptResponse.json();
    console.log('[Chat API] System prompt fetched successfully');

    // Build message history
    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    // Add system message
    messages.push({
      role: 'system',
      content: system_prompt,
    });

    // Add previous messages from history
    for (const msg of history || []) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }

    // Add current user message
    messages.push({
      role: 'user',
      content: message,
    });

    // Define tools for the agent
    const tools: OpenAI.ChatCompletionTool[] = [
      {
        type: 'function',
        function: {
          name: 'addToInventory',
          description:
            "Add a product to the creator's inventory. Use this when the creator mentions wanting to track or recommend a specific product.",
          parameters: {
            type: 'object',
            properties: {
              product_name: {
                type: 'string',
                description: 'Name of the product',
              },
              product_url: {
                type: 'string',
                description: 'URL to the product page (optional)',
              },
              merchant: {
                type: 'string',
                description: 'Merchant name (e.g., "Amazon", "B&H Photo")',
              },
              affiliate_url: {
                type: 'string',
                description: 'Affiliate link URL (optional)',
              },
              discount_code: {
                type: 'string',
                description: 'Discount code (optional)',
              },
              notes: {
                type: 'string',
                description: 'Notes about why this product is recommended',
              },
            },
            required: ['product_name'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'searchAffiliatePrograms',
          description:
            'Search for affiliate programs for a specific product. Use this when the creator asks about affiliate opportunities.',
          parameters: {
            type: 'object',
            properties: {
              product_name: {
                type: 'string',
                description: 'Product name to search affiliate programs for',
              },
              category: {
                type: 'string',
                description: 'Product category (optional)',
              },
            },
            required: ['product_name'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getShopAnalytics',
          description:
            "Get detailed analytics about the creator's shop performance. Use this when asked about shop metrics, clicks, or conversions.",
          parameters: {
            type: 'object',
            properties: {
              days: {
                type: 'number',
                description: 'Number of days to analyze (default: 30)',
              },
            },
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'suggestProductsForContent',
          description:
            'Suggest products for upcoming content topics. Use this when the creator asks what products to feature in specific content.',
          parameters: {
            type: 'object',
            properties: {
              topic: {
                type: 'string',
                description: 'Content topic or title',
              },
              niche: {
                type: 'string',
                description: 'Creator niche (optional)',
              },
            },
            required: ['topic'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getInventorySummary',
          description:
            "Get a summary of the creator's current inventory. Use this when asked about their products or inventory status.",
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'analyzeLink',
          description:
            'Given a content/profile URL, extract profile description, any shop links, and monetizable product cues.',
          parameters: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'Content or profile URL (YouTube, TikTok, Pinterest, X, Meta, etc.)',
              },
            },
            required: ['url'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'analyzeSocialProfiles',
          description:
            "Analyze the creator's connected social media profiles to check for existing shop links in their bio/description and extract content themes. Use this when discussing shop setup or profile optimization.",
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'setupShop',
          description:
            "Help the creator set up their AffiMark shop with initial configuration. Use this when the user wants to create or configure their shop.",
          parameters: {
            type: 'object',
            properties: {
              shop_name: {
                type: 'string',
                description: 'Name for the shop (e.g., "Tech Gear by John")',
              },
              bio: {
                type: 'string',
                description: 'Optional shop bio/description',
              },
            },
            required: ['shop_name'],
          },
        },
      },
      {
        type: 'function',
        function: {
          name: 'getProductMarketData',
          description:
            'Get comprehensive market data for a product from multiple sources (Amazon, Google Shopping, trends). Use this when the user asks about a product\'s market performance, pricing, ratings, or demand. Returns detailed market intelligence including price ranges, ratings, reviews, market demand, and recommendations.',
          parameters: {
            type: 'object',
            properties: {
              product_name: {
                type: 'string',
                description: 'Name of the product to research',
              },
              asin: {
                type: 'string',
                description: 'Optional Amazon ASIN for more accurate data',
              },
            },
            required: ['product_name'],
          },
        },
      },
    ];

    // Call OpenAI API with tools
    console.log('[Chat API] Calling OpenAI API...');
    let response;
    try {
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 2048,
        messages,
        tools,
        tool_choice: 'auto',
      });
      console.log('[Chat API] OpenAI API response received');
    } catch (openaiError: any) {
      console.error('[Chat API] OpenAI API error:', openaiError);
      return NextResponse.json(
        {
          error: 'Failed to get response from AI',
          details: openaiError.message,
          hint: 'Check if OPENAI_API_KEY is valid'
        },
        { status: 500 }
      );
    }

    // Process tool calls
    let finalResponse = response;
    const assistantMessage = response.choices[0]?.message;
    const toolCalls = assistantMessage?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      // Add assistant message with tool calls
      messages.push(assistantMessage);

      // Execute each tool call
      for (const toolCall of toolCalls) {
        console.log(`[Chat API] Tool called: ${toolCall.function.name} with input:`, toolCall.function.arguments);

        let toolResult: any;
        try {
          const functionArgs = JSON.parse(toolCall.function.arguments);
          const toolEndpoint = toolCall.function.name.replace(/([A-Z])/g, '_$1').toLowerCase();
          const toolUrl = `${backendUrl}/api/mcp/tool/${toolEndpoint}`;
          console.log(`[Chat API] Calling tool endpoint: ${toolUrl}`);

          const toolResponse = await fetch(toolUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.BACKEND_API_KEY}`,
            },
            body: JSON.stringify({
              user_id: user.id,
              ...functionArgs,
            }),
          });

          if (!toolResponse.ok) {
            const errorText = await toolResponse.text();
            console.error(`[Chat API] Tool execution failed: ${toolResponse.status} - ${errorText}`);
            toolResult = {
              error: `Tool execution failed with status ${toolResponse.status}`,
              details: errorText
            };
          } else {
            toolResult = await toolResponse.json();
            console.log(`[Chat API] Tool ${toolCall.function.name} executed successfully`);
          }
        } catch (error: any) {
          console.error(`[Chat API] Tool error:`, error);
          toolResult = {
            error: 'Tool execution failed',
            details: error.message
          };
        }

        // Add tool result to messages
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      // Get final response with tool results
      finalResponse = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 2048,
        messages,
        tools,
        tool_choice: 'auto',
      });
    }

    // Extract text response
    const reply = finalResponse.choices[0]?.message?.content || 'I apologize, but I encountered an error processing your request.';

    return NextResponse.json({
      reply,
      context,
    });
  } catch (error: any) {
    console.error('[Chat API] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to process chat request',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
