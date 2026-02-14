import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8787';

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id') || 'anonymous';
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '10';

    const url = new URL(`${BACKEND_URL}/api/verifier/recent`);
    url.searchParams.set('limit', limit);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-user-id': userId,
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('Verifier recent proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to get recent sessions' },
      { status: 500 }
    );
  }
}
