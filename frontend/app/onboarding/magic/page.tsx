'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
    Loader2,
    ArrowRight,
    Sparkles,
    CheckCircle,
    AlertCircle,
    Link2,
    Store,
    TrendingUp,
    Zap,
    ExternalLink,
    ShoppingBag,
    Share2,
    ChevronDown,
    ChevronUp,
} from 'lucide-react';

const platformLogos: Record<string, { icon: string; name: string }> = {
    linktree: { icon: '🌲', name: 'Linktree' },
    beacons: { icon: '🗼', name: 'Beacons' },
    stan: { icon: '⭐', name: 'Stan Store' },
    bio: { icon: '📱', name: 'Link in Bio' },
    website: { icon: '🌐', name: 'Website' },
};

interface ProductLink {
    url: string;
    title: string;
    image?: string;
    price?: string;
    externalId?: string;  // ASIN, SKU, etc.
    brand?: string;
}

interface Storefront {
    name: string;
    icon: string;
    storefrontUrl: string;
    platform: string;     // 'ltk', 'amazon', 'shopmy', etc.
    products: ProductLink[];
}

interface SocialMedia {
    name: string;
    icon: string;
    url: string;
    platform: string;     // 'instagram', 'youtube', etc.
}


interface ScanResult {
    platform: string;
    totalLinks: number;
    storefronts: Storefront[];
    storefrontCount: number;
    totalProducts: number;
    displayProducts: string;
    socialMedia: SocialMedia[];
    otherLinks: { url: string; title: string }[];
    suggestions: string[];
    links: { id: string; url: string; title: string }[];
}

export default function MagicOnboardingPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scanResult, setScanResult] = useState<ScanResult | null>(null);
    const [step, setStep] = useState<'input' | 'scanning' | 'results'>('input');
    const [expandedStorefronts, setExpandedStorefronts] = useState<Set<string>>(new Set());
    const [scanProgress, setScanProgress] = useState('');

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (status === 'unauthenticated') {
        router.push('/sign-in?callbackUrl=/onboarding/magic');
        return null;
    }

    const toggleStorefront = (name: string) => {
        const newExpanded = new Set(expandedStorefronts);
        if (newExpanded.has(name)) {
            newExpanded.delete(name);
        } else {
            newExpanded.add(name);
        }
        setExpandedStorefronts(newExpanded);
    };

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        setIsLoading(true);
        setError(null);
        setStep('scanning');
        setScanProgress('Fetching your profile...');

        // Simulate progress updates
        const progressInterval = setInterval(() => {
            setScanProgress((prev) => {
                if (prev.includes('profile')) return 'Detecting storefronts...';
                if (prev.includes('storefronts')) return 'Scanning products...';
                if (prev.includes('products')) return 'Analyzing links...';
                return 'Almost done...';
            });
        }, 4000);

        try {
            // Call backend directly (bypassing Next.js proxy which times out on long requests)
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
            const res = await fetch(`${apiUrl}/api/migration/scrape?deep=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });

            clearInterval(progressInterval);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to scan profile');
            }

            // Normalize API response to match expected ScanResult interface
            const normalizedResult: ScanResult = {
                platform: data.platform || 'custom',
                totalLinks: data.totalLinks || data.links?.length || 0,
                storefronts: data.storefronts || [],
                storefrontCount: data.storefrontCount || data.storefronts?.length || 0,
                totalProducts: data.totalProducts || 0,
                displayProducts: data.displayProducts || String(data.totalProducts || 0),
                socialMedia: data.socialMedia || [],
                otherLinks: data.otherLinks || [],
                suggestions: data.suggestions || [],
                links: data.links || [],
            };

            // If we have affiliate links but no storefronts, convert links to a storefront
            if (normalizedResult.storefronts.length === 0 && normalizedResult.links.length > 0) {
                const affiliateLinks = normalizedResult.links.filter((l: any) => l.isAffiliate);
                if (affiliateLinks.length > 0) {
                    normalizedResult.storefronts = [{
                        name: 'Affiliate Links',
                        icon: '🔗',
                        storefrontUrl: '',
                        platform: 'mixed',
                        products: affiliateLinks.map((l: any) => ({
                            url: l.url,
                            title: l.title || 'Untitled',
                        })),
                    }];
                    normalizedResult.storefrontCount = 1;
                    normalizedResult.totalProducts = affiliateLinks.length;
                    normalizedResult.displayProducts = String(affiliateLinks.length);
                }
            }

            setScanResult(normalizedResult);
            setStep('results');
            // Auto-expand first storefront
            if (normalizedResult.storefronts?.length > 0) {
                setExpandedStorefronts(new Set([normalizedResult.storefronts[0].name]));
            }
        } catch (err: any) {
            clearInterval(progressInterval);
            setError(err.message);
            setStep('input');
        } finally {
            setIsLoading(false);
        }
    };

    const handleContinue = async () => {
        if (!scanResult) return;

        setIsLoading(true);
        setError(null);
        try {
            // Step 1: Save the imported data
            console.log('[Import] Saving storefronts and products...');
            const res = await fetch('/api/migration/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    storefronts: scanResult.storefronts,
                    socialMedia: scanResult.socialMedia,
                    platform: scanResult.platform
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || 'Failed to save storefronts');
            }

            const applyResult = await res.json();
            console.log('[Import] Saved:', applyResult);

            // Step 2: Mark onboarding as complete
            console.log('[Import] Marking onboarding complete...');
            const completeRes = await fetch('/api/onboarding/complete', {
                method: 'POST',
                credentials: 'include',
            });

            if (!completeRes.ok) {
                const data = await completeRes.json().catch(() => ({}));
                console.error('[Import] Failed to mark complete:', data);
                // Don't throw - still try to navigate, the data is saved
            } else {
                console.log('[Import] Onboarding marked complete');
            }

            // Step 3: Trigger product enrichment in background (don't await)
            fetch('/api/products/enrich', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ limit: 20 }),
            }).catch(err => console.log('[Enrichment] Background enrichment started'));

            // Step 4: Navigate to dashboard
            console.log('[Import] Redirecting to dashboard...');
            router.push('/dashboard');
        } catch (err: any) {
            console.error('[Import] Error:', err);
            setError(err.message || 'Failed to save. Please try again.');
            setIsLoading(false);
        }
    };


    const handleSkip = async () => {
        try {
            await fetch('/api/onboarding/complete', {
                method: 'POST',
                credentials: 'include',
            });
        } catch (e) { }
        router.push('/dashboard');
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-amber-700/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-orange-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="relative z-10 max-w-2xl w-full space-y-8">
                {/* Header */}
                <div className="text-center space-y-4 animate-fade-in">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-700 to-orange-600 mb-4 shadow-lg shadow-orange-500/30">
                        <Zap className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-bold text-foreground">
                        Let's build your HQ
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-lg mx-auto">
                        Paste your link-in-bio URL. We'll auto-detect your storefronts and products.
                    </p>
                </div>

                {/* Platform chips */}
                {step === 'input' && (
                    <div className="flex flex-wrap justify-center gap-2 animate-slide-up">
                        {Object.entries(platformLogos).map(([key, { icon, name }]) => (
                            <span key={key} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground">
                                <span>{icon}</span>
                                {name}
                            </span>
                        ))}
                    </div>
                )}

                {/* Input Section */}
                {step === 'input' && (
                    <form onSubmit={handleScan} className="space-y-4 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        <div className="relative group">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 rounded-2xl blur opacity-50 group-hover:opacity-75 group-focus-within:opacity-100 transition duration-500" />
                            <div className="relative flex items-center bg-card rounded-2xl p-2 border border-border">
                                <div className="flex-shrink-0 pl-4">
                                    <Link2 className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <input
                                    type="url"
                                    placeholder="https://linktr.ee/yourname"
                                    className="flex-1 bg-transparent border-none text-foreground placeholder-muted-foreground focus:ring-0 text-lg px-4 h-14 focus:outline-none"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    required
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading || !url}
                                    className="btn-primary h-12 px-8 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Scan <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="text-center pt-4">
                            <button type="button" onClick={handleSkip} className="text-muted-foreground hover:text-foreground text-sm transition-colors">
                                Skip for now →
                            </button>
                        </div>
                    </form>
                )}

                {/* Scanning Animation */}
                {step === 'scanning' && (
                    <div className="glass-card p-12 text-center animate-scale-in">
                        <div className="relative inline-flex mb-6">
                            <div className="w-20 h-20 rounded-2xl bg-orange-500/20 flex items-center justify-center animate-pulse">
                                <Sparkles className="w-10 h-10 text-orange-400" />
                            </div>
                            <div className="absolute inset-0 rounded-2xl border-2 border-orange-500/50 animate-ping" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-2">Deep scanning profile...</h2>
                        <p className="text-muted-foreground mb-4">{scanProgress}</p>
                        <p className="text-xs text-muted-foreground">This may take up to 30 seconds for comprehensive results</p>
                        <div className="mt-8 flex justify-center gap-2">
                            {[0, 1, 2].map((i) => (
                                <div key={i} className="w-2 h-2 rounded-full bg-orange-500 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Results Section */}
                {step === 'results' && scanResult && (
                    <div className="glass-card p-8 animate-scale-in space-y-6 max-h-[70vh] overflow-y-auto">
                        {/* Success header */}
                        <div className="text-center">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-foreground">Profile Scanned!</h2>
                            <p className="text-muted-foreground">Found {scanResult.totalLinks} links</p>
                        </div>

                        {/* Stats Summary */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 text-center">
                                <ShoppingBag className="w-5 h-5 mx-auto mb-2 text-orange-400" />
                                <div className="text-2xl font-bold text-foreground">{scanResult.storefrontCount}</div>
                                <div className="text-xs text-muted-foreground">Storefronts</div>
                            </div>
                            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                                <Store className="w-5 h-5 mx-auto mb-2 text-amber-400" />
                                <div className="text-2xl font-bold text-foreground">{scanResult.displayProducts || scanResult.totalProducts}</div>
                                <div className="text-xs text-muted-foreground">Products</div>
                            </div>
                            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                                <Share2 className="w-5 h-5 mx-auto mb-2 text-blue-400" />
                                <div className="text-2xl font-bold text-foreground">{scanResult.socialMedia?.length || 0}</div>
                                <div className="text-xs text-muted-foreground">Socials</div>
                            </div>
                        </div>

                        {/* Storefronts */}
                        {(scanResult.storefronts?.length || 0) > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    Storefronts ({scanResult.storefrontCount})
                                </h3>
                                <div className="space-y-2">
                                    {scanResult.storefronts.map((storefront) => (
                                        <div key={storefront.name} className="rounded-xl bg-orange-500/10 border border-orange-500/20 overflow-hidden">
                                            <button
                                                onClick={() => toggleStorefront(storefront.name)}
                                                className="w-full flex items-center justify-between p-4 hover:bg-orange-500/5 transition-colors"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-2xl">{storefront.icon}</span>
                                                    <div className="text-left">
                                                        <div className="font-semibold text-foreground">{storefront.name}</div>
                                                        <div className="text-sm text-orange-400">{storefront.products.length} products</div>
                                                    </div>
                                                </div>
                                                {expandedStorefronts.has(storefront.name) ? (
                                                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                                )}
                                            </button>

                                            {expandedStorefronts.has(storefront.name) && (
                                                <div className="border-t border-orange-500/20 p-3 space-y-1 bg-black/20">
                                                    {/* Storefront link */}
                                                    <a
                                                        href={storefront.storefrontUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-between p-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 group mb-2"
                                                    >
                                                        <span className="text-sm font-medium text-orange-400">
                                                            View full {storefront.name} storefront
                                                        </span>
                                                        <ExternalLink className="w-4 h-4 text-orange-400" />
                                                    </a>

                                                    {/* Products */}
                                                    {storefront.products.map((product, idx) => (
                                                        <a
                                                            key={idx}
                                                            href={product.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 group"
                                                        >
                                                            <span className="text-sm text-foreground truncate flex-1 pr-2">
                                                                {product.title}
                                                            </span>
                                                            {product.price && (
                                                                <span className="text-xs text-muted-foreground mr-2">{product.price}</span>
                                                            )}
                                                            <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                                        </a>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Social Media */}
                        {(scanResult.socialMedia?.length || 0) > 0 && (
                            <div>
                                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                                    Social Media
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {scanResult.socialMedia.map((social) => (
                                        <a
                                            key={social.name}
                                            href={social.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors"
                                        >
                                            <span>{social.icon}</span>
                                            <span className="text-sm font-medium">{social.name}</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions - Glassmorphic sticky footer */}
                        <div className="space-y-3 pt-4 sticky bottom-0 pb-2" style={{
                            background: 'linear-gradient(to top, rgba(26, 22, 19, 0.95) 60%, rgba(26, 22, 19, 0.7) 85%, transparent)',
                            backdropFilter: 'blur(12px)',
                            WebkitBackdropFilter: 'blur(12px)',
                            marginLeft: '-1.5rem',
                            marginRight: '-1.5rem',
                            paddingLeft: '1.5rem',
                            paddingRight: '1.5rem',
                        }}>
                            <button onClick={handleContinue} className="btn-primary w-full py-4 text-lg" disabled={isLoading}>
                                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Import & Continue <ArrowRight className="w-5 h-5" /></>}
                            </button>
                            <button
                                onClick={() => { setStep('input'); setScanResult(null); setUrl(''); }}
                                className="btn-ghost w-full"
                            >
                                Scan a different URL
                            </button>
                        </div>
                    </div>
                )}

                {/* Trust indicators */}
                <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" />Your data stays private</span>
                    <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" />Deep scan</span>
                    <span className="flex items-center gap-2"><CheckCircle className="w-4 h-4 text-emerald-500" />No credit card</span>
                </div>
            </div>
        </div>
    );
}
