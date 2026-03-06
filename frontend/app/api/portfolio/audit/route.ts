/**
 * Portfolio Risk Audit — Frontend API Route
 * Proxies to backend POST /api/portfolio/audit with the authenticated user's ID.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(_request: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8787';

    const res = await fetch(`${backendUrl}/api/portfolio/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[Portfolio Audit] Backend error (${res.status}):`, errorText);
      return NextResponse.json(
        { error: `Backend audit failed: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Portfolio Audit] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
