import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/utils/supabase/server';

const techStackHints = [
  { keyword: 'next.js', label: 'Next.js' },
  { keyword: 'react', label: 'React' },
  { keyword: 'graphql', label: 'GraphQL' },
  { keyword: 'node', label: 'Node.js' },
  { keyword: 'python', label: 'Python' },
  { keyword: 'aws', label: 'AWS' },
  { keyword: 'kubernetes', label: 'Kubernetes' },
  { keyword: 'rust', label: 'Rust' },
];

const industryHints = [
  { keyword: 'ai', label: 'AI / ML' },
  { keyword: 'machine learning', label: 'AI / ML' },
  { keyword: 'cyber', label: 'Cybersecurity' },
  { keyword: 'security', label: 'Cybersecurity' },
  { keyword: 'fintech', label: 'Fintech' },
  { keyword: 'devops', label: 'DevOps' },
  { keyword: 'marketing', label: 'Marketing Tech' },
  { keyword: 'ecommerce', label: 'E-commerce' },
  { keyword: 'gaming', label: 'Gaming' },
  { keyword: 'hardware', label: 'Hardware' },
];

const personaHints = [
  { keyword: 'developer', label: 'Developers' },
  { keyword: 'engineer', label: 'Engineers' },
  { keyword: 'founder', label: 'Founders' },
  { keyword: 'cto', label: 'CTOs / VPs of Engineering' },
  { keyword: 'marketing', label: 'Marketing Leaders' },
  { keyword: 'product', label: 'Product Managers' },
  { keyword: 'data', label: 'Data Scientists' },
  { keyword: 'ops', label: 'Operations Leaders' },
];

const compModelHints = [
  { keyword: 'subscription', label: 'Subscription / recurring' },
  { keyword: 'usage', label: 'Usage-based' },
  { keyword: 'performance', label: 'Performance-based' },
  { keyword: 'retainer', label: 'Retainer' },
  { keyword: 'rev share', label: 'Revenue share' },
  { keyword: 'commission', label: 'Commission-based' },
];

const serviceTypes = [
  { keyword: 'api', label: 'API / Developer Platform' },
  { keyword: 'platform', label: 'SaaS Platform' },
  { keyword: 'agency', label: 'Agency / Services' },
  { keyword: 'marketplace', label: 'Marketplace' },
  { keyword: 'hardware', label: 'Hardware / Device' },
];

export async function POST(request: NextRequest) {
  try {
    const { websiteUrl } = await request.json();

    if (!websiteUrl || typeof websiteUrl !== 'string') {
      return NextResponse.json(
        { error: 'websiteUrl is required' },
        { status: 400 }
      );
    }

    let normalizedUrl: URL;
    try {
      normalizedUrl = new URL(
        websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`
      );
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid URL provided' },
        { status: 400 }
      );
    }

    const hostname = normalizedUrl.hostname.replace('www.', '');
    const brandName =
      hostname
      .split('.')
      .filter(Boolean)[0]
      ?.replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Your Brand';

    let html = '';
    try {
      const res = await fetch(normalizedUrl.toString(), {
        headers: {
          'User-Agent': 'AffimarkSiteBot/1.0 (+https://affimark.com)',
        },
      });
      html = await res.text();
    } catch (error) {
      console.warn('[Analyze Website] Failed to fetch site, falling back to heuristics', error);
    }

    const cleanHtml = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');
    const textOnly = cleanHtml.replace(/<[^>]*>/g, ' ');
    const lowerText = textOnly.toLowerCase();

    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);

    const serviceType =
      serviceTypes.find((entry) => lowerText.includes(entry.keyword))?.label || 'Tech product';

    const derivedIndustries = Array.from(
      new Set(
        industryHints
          .filter((hint) => lowerText.includes(hint.keyword))
          .map((hint) => hint.label)
      )
    );

    const derivedPersonas = Array.from(
      new Set(
        personaHints
          .filter((hint) => lowerText.includes(hint.keyword))
          .map((hint) => hint.label)
      )
    );

    const derivedCompModels = Array.from(
      new Set(
        compModelHints
          .filter((hint) => lowerText.includes(hint.keyword))
          .map((hint) => hint.label)
      )
    );

    const derivedTechStack = Array.from(
      new Set(
        techStackHints
          .filter((hint) => lowerText.includes(hint.keyword))
          .map((hint) => hint.label)
      )
    ).slice(0, 5);

    const listMatches = cleanHtml.match(/<li[^>]*>(.*?)<\/li>/gis) || [];
    const keyFeatures = listMatches
      .map((li) => li.replace(/<[^>]*>/g, '').trim())
      .filter(Boolean)
      .slice(0, 4);

    const summarySentence =
      metaDescMatch?.[1] ||
      `${brandName} operates at ${hostname}, offering a ${serviceType.toLowerCase()} for modern tech teams.`;

    const productSentence =
      keyFeatures[0] ||
      (titleMatch?.[1]
        ? `${brandName} ${titleMatch[1].toLowerCase()}`
        : `${brandName} focuses on creator collaborations and analytics.`);

    const response = {
      company_name: brandName,
      company_description: summarySentence,
      product_description: productSentence,
      service_type: serviceType,
      industries: derivedIndustries,
      target_personas: derivedPersonas,
      comp_models: derivedCompModels,
      key_features: keyFeatures,
      tech_stack: derivedTechStack.length ? derivedTechStack : ['React', 'Next.js'],
      pricing_hint: /pricing|plans|free tier/i.test(lowerText)
        ? 'Pricing page detected'
        : 'No public pricing detected',
      confidence_score: Math.min(95, 60 + derivedIndustries.length * 5 + keyFeatures.length * 3),
    };

    // Best-effort persistence of insights for the authenticated user
    try {
      const session = await auth().catch(() => null);
      const userId = session?.user?.id;
      if (userId) {
        const supabase = createSupabaseAdminClient();
        await supabase
          .from('company_website_insights')
          .upsert(
            {
              user_id: userId,
              website_url: normalizedUrl.toString(),
              company_name: response.company_name,
              company_description: response.company_description,
              product_description: response.product_description,
              service_type: response.service_type,
              industries: response.industries,
              target_personas: response.target_personas,
              comp_models: response.comp_models,
              key_features: response.key_features,
              tech_stack: response.tech_stack,
              pricing_hint: response.pricing_hint,
              confidence_score: response.confidence_score,
              last_analyzed_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,website_url' },
          );
      }
    } catch (err) {
      console.error('[Analyze Website] Failed to persist website insights:', err);
      // Do not fail the request; insights are a best-effort enhancement
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Analyze Website] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze website. Please try again.' },
      { status: 500 }
    );
  }
}


