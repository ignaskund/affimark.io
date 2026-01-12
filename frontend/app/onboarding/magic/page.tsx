'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
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
} from 'lucide-react';

const platformLogos: Record<string, { icon: string; name: string }> = {
    linktree: { icon: '🌲', name: 'Linktree' },
    beacons: { icon: '🗼', name: 'Beacons' },
    stan: { icon: '⭐', name: 'Stan Store' },
    bio: { icon: '📱', name: 'Link in Bio' },
    website: { icon: '🌐', name: 'Website' },
};

export default function MagicOnboardingPage() {
    const router = useRouter();
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [scanResult, setScanResult] = useState<any | null>(null);
    const [step, setStep] = useState<'input' | 'scanning' | 'results'>('input');

    const handleScan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        setIsLoading(true);
        setError(null);
        setStep('scanning');

        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                throw new Error('Please sign in first');
            }

            const res = await fetch('/api/migration/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ url }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to scan profile');
            }

            setScanResult(data);
            setStep('results');
        } catch (err: any) {
            setError(err.message);
            setStep('input');
        } finally {
            setIsLoading(false);
        }
    };

    const handleContinue = async () => {
        if (!scanResult) return;

        setIsLoading(true);
        try {
            const supabase = createBrowserClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) throw new Error('No session');

            const res = await fetch('/api/migration/apply', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    links: scanResult.links,
                    platform: scanResult.platform
                }),
            });

            if (!res.ok) {
                throw new Error('Failed to save imported links');
            }

            router.push('/dashboard');
        } catch (err: any) {
            console.error('Save error:', err);
            setError('Failed to save links. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Animated background */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="relative z-10 max-w-2xl w-full space-y-8">
                {/* Header */}
                <div className="text-center space-y-4 animate-fade-in">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 mb-4 shadow-lg shadow-indigo-500/30">
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
                            <span
                                key={key}
                                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm text-muted-foreground"
                            >
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
                            {/* Glowing border */}
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 rounded-2xl blur opacity-50 group-hover:opacity-75 group-focus-within:opacity-100 transition duration-500" />

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
                                    {isLoading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            Scan
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 animate-scale-in">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                <span>{error}</span>
                            </div>
                        )}

                        <div className="text-center pt-4">
                            <button
                                type="button"
                                onClick={() => router.push('/dashboard')}
                                className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                            >
                                Skip for now →
                            </button>
                        </div>
                    </form>
                )}

                {/* Scanning Animation */}
                {step === 'scanning' && (
                    <div className="glass-card p-12 text-center animate-scale-in">
                        <div className="relative inline-flex mb-6">
                            <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 flex items-center justify-center animate-pulse">
                                <Sparkles className="w-10 h-10 text-indigo-400" />
                            </div>
                            <div className="absolute inset-0 rounded-2xl border-2 border-indigo-500/50 animate-ping" />
                        </div>
                        <h2 className="text-2xl font-bold text-foreground mb-2">Scanning your profile...</h2>
                        <p className="text-muted-foreground">Detecting storefronts, products, and affiliate links</p>

                        <div className="mt-8 flex justify-center gap-2">
                            {[0, 1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce"
                                    style={{ animationDelay: `${i * 0.15}s` }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Results Section */}
                {step === 'results' && scanResult && (
                    <div className="glass-card p-8 animate-scale-in">
                        {/* Success header */}
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8 text-emerald-400" />
                            </div>
                            <h2 className="text-2xl font-bold text-foreground">Profile Detected!</h2>
                            <p className="text-muted-foreground">Here's what we found:</p>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="p-5 rounded-xl bg-muted border border-border text-center">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Link2 className="w-5 h-5 text-muted-foreground" />
                                </div>
                                <div className="text-3xl font-bold text-foreground">{scanResult.totalLinks}</div>
                                <div className="text-sm text-muted-foreground">Total Links</div>
                            </div>

                            <div className="p-5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-center">
                                <div className="flex items-center justify-center gap-2 mb-2">
                                    <Store className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div className="text-3xl font-bold text-indigo-300">{scanResult.affiliateLinks}</div>
                                <div className="text-sm text-indigo-400">Affiliate Links</div>
                            </div>
                        </div>

                        {/* Suggestions */}
                        {scanResult.suggestions && scanResult.suggestions.length > 0 && (
                            <div className="space-y-3 mb-8">
                                <p className="text-sm font-medium text-muted-foreground">Insights</p>
                                {scanResult.suggestions.map((suggestion: string, i: number) => (
                                    <div
                                        key={i}
                                        className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/10"
                                    >
                                        <TrendingUp className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                        <span className="text-sm text-foreground">{suggestion}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-3">
                            <button
                                onClick={handleContinue}
                                className="btn-primary w-full py-4 text-lg"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        Import & Continue
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>

                            <button
                                onClick={() => {
                                    setStep('input');
                                    setScanResult(null);
                                    setUrl('');
                                }}
                                className="btn-ghost w-full"
                            >
                                Scan a different URL
                            </button>
                        </div>
                    </div>
                )}

                {/* Trust indicators */}
                <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '0.2s' }}>
                    <span className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        Your data stays private
                    </span>
                    <span className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        2-minute setup
                    </span>
                    <span className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                        No credit card
                    </span>
                </div>
            </div>
        </div>
    );
}
