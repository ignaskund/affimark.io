import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side proxy to fetch agent context without exposing backend secrets to the client

export async function POST(req: NextRequest) {
  try {
    const { user_id } = await req.json();
    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';
    const backendKey = process.env.BACKEND_API_KEY;
    if (!backendKey) {
      return NextResponse.json({ error: 'BACKEND_API_KEY not configured' }, { status: 500 });
    }

    // Optional session validation skipped for local/dev to avoid 401s

    const resp = await fetch(`${backendUrl}/api/mcp/get_agent_context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${backendKey}`,
      },
      body: JSON.stringify({ user_id }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      return NextResponse.json({ error: 'Failed to fetch context', details: text }, { status: 500 });
    }

    const json = await resp.json();
    return NextResponse.json(json);
  } catch (error: any) {
    console.error('[api/agent/context] error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}

