import { NextRequest, NextResponse } from 'next/server';

/**
 * Frontend cloaked redirect route
 * GET /c/:code
 *
 * This uses the backend redirect handler for analytics and then
 * issues a 302 to the final destination. If the backend returns
 * an error, we show a simple 404 page.
 */
export async function GET(
  req: NextRequest,
  context: { params: { code: string } },
) {
  const code = context.params.code;

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8787';

  try {
    const res = await fetch(`${backendUrl}/c/${encodeURIComponent(code)}`, {
      redirect: 'manual',
    });

    // If backend itself issues a redirect, proxy it
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (location) {
        return NextResponse.redirect(location, 302);
      }
    }

    // If backend returned text "Link not found"
    if (res.status === 404) {
      return new NextResponse('Link not found', { status: 404 });
    }

    // Fallback: try to parse JSON shape from attribution API
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const json = await res.json().catch(() => null as any);
      const redirectUrl =
        (json && (json.redirect_url || json.destination_url)) || null;
      if (redirectUrl) {
        return NextResponse.redirect(redirectUrl, 302);
      }
    }

    // Unknown response – just surface 404
    return new NextResponse('Link not found', { status: 404 });
  } catch (error) {
    console.error('Frontend redirect error:', error);
    return new NextResponse('Unexpected error', { status: 500 });
  }
}


