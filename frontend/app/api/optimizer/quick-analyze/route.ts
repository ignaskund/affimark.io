import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { url, title } = await request.json() as { url: string; title?: string };

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Please enter a valid URL' }, { status: 400 });
    }

    // Reuse the batch-analyze endpoint internally with a single product
    const batchUrl = new URL('/api/optimizer/batch-analyze', request.url);
    const batchResponse = await fetch(batchUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: request.headers.get('cookie') || '',
      },
      body: JSON.stringify({
        products: [{
          id: `quick-${Date.now()}`,
          product_url: url,
          title: title || null,
          brand: null,
        }],
      }),
    });

    const batchData = await batchResponse.json();

    if (!batchResponse.ok) {
      return NextResponse.json(
        { error: batchData.error || 'Analysis failed' },
        { status: batchResponse.status }
      );
    }

    // Return single result without session wrapper
    return NextResponse.json({
      result: batchData.results?.[0] || null,
      summary: batchData.summary,
    });
  } catch (error) {
    console.error('[CommissionAgent] Quick analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze URL. Please try again.' },
      { status: 500 }
    );
  }
}
