import Link from 'next/link';
import {
  Sparkles,
  Shield,
  TrendingUp,
  FileText,
  Link2,
  Zap,
  CheckCircle,
  ArrowRight,
  Coffee,
} from 'lucide-react';

import { auth } from '@/lib/auth';
import UserMenu from '@/components/user/UserMenu';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await auth();
  const user = session?.user;

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-700 to-orange-600 flex items-center justify-center">
                  <Coffee className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-xl text-foreground">Affimark</span>
              </Link>
              <div className="hidden md:flex items-center gap-6">
                <Link href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </Link>
                <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                  Pricing
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <Link href="/dashboard" className="btn-primary text-sm py-2 px-4">
                    Go to App
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <UserMenu />
                </>
              ) : (
                <>
                  <Link href="/sign-in" className="btn-ghost text-sm">
                    Sign In
                  </Link>
                  <Link href="/sign-up" className="btn-primary text-sm py-2 px-4">
                    Get Started
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background effects - Chocolate Truffle warm tones */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-700/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-600/20 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-700/10 border border-amber-700/30 mb-8">
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-orange-300">Revenue protection for affiliate creators</span>
            </div>

            <h1 className="text-5xl lg:text-7xl font-bold text-foreground mb-6 leading-tight">
              Stop Leaving
              <br />
              <span className="gradient-text">Money on the Table</span>
            </h1>

            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Unified earnings dashboard. Smart link optimization. Tax-ready exports.
              <br />
              Everything EU-based creators need to protect and grow affiliate revenue.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href={user ? '/dashboard' : '/sign-up'} className="btn-primary text-lg py-4 px-8">
                <Sparkles className="w-5 h-5" />
                Start Free
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link href="#features" className="btn-secondary text-lg py-4 px-8">
                See How It Works
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                2-minute setup
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                EU-based & GDPR compliant
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                No credit card required
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-card/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
              Not Another Dashboard. Revenue Protection.
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Affimark actively protects and optimizes your affiliate revenue
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="glass-card p-8 group hover:border-amber-700/40 transition-colors">
              <div className="w-14 h-14 rounded-xl bg-amber-700/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-7 h-7 text-amber-500" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Unified Dashboard</h3>
              <p className="text-muted-foreground">
                One view for all affiliate income. Amazon, Awin, LTK, and more — normalized to your home currency.
              </p>
            </div>

            {/* Feature 2 - Hero */}
            <div className="glass-card p-8 group border-orange-600/40 bg-gradient-to-br from-amber-800/10 to-orange-700/10">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-14 h-14 rounded-xl bg-orange-600/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sparkles className="w-7 h-7 text-orange-400" />
                </div>
                <span className="badge badge-warning text-xs">★ HERO</span>
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Smart Link Optimizer</h3>
              <p className="text-muted-foreground">
                Stop using 3% links when 12% exist. We find better-paying programs for the same products.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="glass-card p-8 group hover:border-emerald-500/40 transition-colors">
              <div className="w-14 h-14 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Shield className="w-7 h-7 text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Link Health Monitor</h3>
              <p className="text-muted-foreground">
                Catch broken links and stockouts before they cost you. Know exactly how much revenue we protected.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="glass-card p-8 group hover:border-amber-600/40 transition-colors">
              <div className="w-14 h-14 rounded-xl bg-amber-600/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Link2 className="w-7 h-7 text-amber-400" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">SmartWrapper Links</h3>
              <p className="text-muted-foreground">
                Platform-independent links with analytics, auto-fallback, and in-app browser detection.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="glass-card p-8 group hover:border-blue-500/40 transition-colors">
              <div className="w-14 h-14 rounded-xl bg-blue-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <FileText className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Tax-Ready Export</h3>
              <p className="text-muted-foreground">
                One-click exports for German freelancers, Dutch ZZPs, UK sole traders, and more EU tax personas.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="glass-card p-8 group hover:border-orange-500/40 transition-colors">
              <div className="w-14 h-14 rounded-xl bg-orange-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-7 h-7 text-orange-400" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Zero-Effort Onboarding</h3>
              <p className="text-muted-foreground">
                Paste your Linktree URL, we do the rest. Auto-detect storefronts and import in 2 minutes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-6">
            Ready to Protect Your Revenue?
          </h2>
          <p className="text-lg text-muted-foreground mb-10">
            Join creators who are earning more by working smarter, not harder.
          </p>
          <Link href={user ? '/dashboard' : '/sign-up'} className="btn-primary text-lg py-4 px-10">
            <Sparkles className="w-5 h-5" />
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-700 to-orange-600 flex items-center justify-center">
                <Coffee className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-foreground">Affimark</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2026 Affimark. Revenue protection for affiliate creators.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <Link href="#" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="#" className="hover:text-foreground transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
