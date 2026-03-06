import Link from 'next/link';
import { ArrowRight, CheckCircle, ShieldCheck, Coffee } from 'lucide-react';
import { auth } from '@/lib/auth';
import UserMenu from '@/components/user/UserMenu';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const session = await auth();
  const user = session?.user;

  const ctaHref = user ? '/dashboard/portfolio-audit' : '/sign-up';

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Coffee className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-white tracking-tight">AffiMark</span>
          </Link>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  href="/dashboard/portfolio-audit"
                  className="text-sm px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors flex items-center gap-1.5"
                >
                  Run Portfolio Audit
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <UserMenu />
              </>
            ) : (
              <>
                <Link
                  href="/sign-in"
                  className="text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="text-sm px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
                >
                  Get started free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <p className="text-xs font-mono tracking-[0.2em] text-emerald-500 uppercase mb-6">
          Affiliate Revenue Intelligence
        </p>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6">
          Optimize for Revenue<br />
          <span className="text-emerald-400">That Stays.</span>
        </h1>

        <p className="text-lg text-gray-400 max-w-xl mx-auto mb-10 leading-relaxed">
          Most affiliate tools help you scale traffic. AffiMark helps you protect margin —
          by auditing every product in your portfolio for fragile revenue signals.
        </p>

        <Link
          href={ctaHref}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base transition-all shadow-lg shadow-emerald-900/40"
        >
          Run Portfolio Risk Audit
          <ArrowRight className="w-5 h-5" />
        </Link>

        <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-gray-500">
          <span className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            Works from your Linktree
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            No manual data entry
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            EU-based &amp; GDPR compliant
          </span>
        </div>
      </section>

      {/* ── THE HIDDEN PROBLEM ───────────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="text-xs font-mono tracking-[0.2em] text-gray-500 uppercase mb-4">
            The Hidden Problem
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold mb-12 max-w-lg">
            You track what you earn. You don&apos;t track what you&apos;re at risk of losing.
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-4">
              <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                What affiliates measure
              </p>
              {[
                'Total clicks and impressions',
                'Monthly commission earned',
                'Top products by revenue',
                'Platform comparison charts',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-gray-300">
                  <div className="w-2 h-2 rounded-full bg-gray-600 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-6 space-y-4">
              <p className="text-sm font-semibold text-red-400 uppercase tracking-wider">
                What they ignore (until it hurts)
              </p>
              {[
                'Merchant reliability &amp; refund rates',
                'Cookie duration erosion over time',
                'Programs with approval requirements',
                'Category-level demand fragility',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-gray-300">
                  <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                  <span dangerouslySetInnerHTML={{ __html: item }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── RISK-ADJUSTED REVENUE ────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <p className="text-xs font-mono tracking-[0.2em] text-gray-500 uppercase mb-4">
          Risk-Adjusted Revenue
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold mb-4">
          Revenue you can predict is worth more than revenue you can&apos;t.
        </h2>
        <p className="text-gray-400 mb-10 max-w-lg">
          We score every product across four dimensions that determine whether your
          affiliate income will hold — or quietly erode.
        </p>

        {/* Formula */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 mb-10 font-mono text-sm text-gray-300">
          <p className="text-xs text-gray-500 mb-3 font-sans uppercase tracking-wider">
            Revenue Stability Score
          </p>
          <p className="text-base leading-loose">
            <span className="text-emerald-400">MerchantRisk</span>
            <span className="text-gray-500"> × 0.30 + </span>
            <span className="text-amber-400">ProgramFriction</span>
            <span className="text-gray-500"> × 0.25 +</span>
            <br />
            <span className="text-blue-400">DemandEvidence</span>
            <span className="text-gray-500"> × 0.25 + </span>
            <span className="text-purple-400">RefundRisk</span>
            <span className="text-gray-500"> × 0.20</span>
          </p>
        </div>

        {/* Metrics grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              color: 'emerald',
              label: 'Merchant Stability',
              desc: 'Trustpilot score, shipping reliability, return policy. Is this merchant likely to pay and deliver?',
              border: 'border-emerald-500/20 bg-emerald-500/[0.04]',
              dot: 'bg-emerald-400',
            },
            {
              color: 'amber',
              label: 'Program Friction',
              desc: 'Cookie duration, commission rate, approval difficulty. Is this program easy to stay in?',
              border: 'border-amber-500/20 bg-amber-500/[0.04]',
              dot: 'bg-amber-400',
            },
            {
              color: 'blue',
              label: 'Demand Evidence',
              desc: 'Review count, rating volume, price positioning. Is there real buying intent behind this product?',
              border: 'border-blue-500/20 bg-blue-500/[0.04]',
              dot: 'bg-blue-400',
            },
            {
              color: 'purple',
              label: 'Refund Risk',
              desc: 'Category return rates, satisfaction signals. Will chargebacks eat into your net commission?',
              border: 'border-purple-500/20 bg-purple-500/[0.04]',
              dot: 'bg-purple-400',
            },
          ].map(({ label, desc, border, dot }) => (
            <div key={label} className={`rounded-xl border p-5 ${border}`}>
              <div className={`w-2 h-2 rounded-full ${dot} mb-3`} />
              <p className="text-sm font-semibold text-white mb-2">{label}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── REMOVE FRAGILE REVENUE ───────────────────────────────────────── */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6 py-20">
          <p className="text-xs font-mono tracking-[0.2em] text-gray-500 uppercase mb-4">
            Remove Fragile Revenue
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold mb-10">
            Replace the products that look like income<br />
            but feel like risk.
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <p className="text-sm font-semibold text-red-400 uppercase tracking-wider mb-4">
                What you eliminate
              </p>
              {[
                'Products with volatile merchant ratings',
                'Links on programs with short cookie windows',
                'High-return categories with low margin',
                'Programs that cancel affiliates without notice',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-gray-300">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
            <div className="space-y-4">
              <p className="text-sm font-semibold text-emerald-400 uppercase tracking-wider mb-4">
                What you gain
              </p>
              {[
                'A predictable monthly commission baseline',
                'Confidence that traffic converts to payment',
                'Clear data for brand negotiation pitches',
                'Fewer surprises at the end of the month',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-gray-300">
                  <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── DIFFERENTIATION ─────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-4 px-6 py-5 rounded-2xl border border-white/10 bg-white/[0.03] max-w-xl mx-auto">
          <ShieldCheck className="w-8 h-8 text-emerald-400 flex-shrink-0" />
          <p className="text-base font-medium text-gray-200 text-left">
            Most affiliate tools help you scale traffic.{' '}
            <span className="text-white font-semibold">
              AffiMark helps you protect margin.
            </span>
          </p>
        </div>
      </section>

      {/* ── PSYCHOLOGICAL CLOSE ─────────────────────────────────────────── */}
      <section className="border-t border-white/5 bg-white/[0.02]">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <p className="text-xs font-mono tracking-[0.2em] text-gray-500 uppercase mb-6">
            Act on what you already have
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4 max-w-2xl mx-auto leading-tight">
            Your current portfolio is worth more<br />
            <span className="text-emerald-400">once you know which parts are fragile.</span>
          </h2>
          <p className="text-gray-400 mb-10 max-w-lg mx-auto">
            You don&apos;t need more links. You need to know which existing links are eroding
            your revenue — and what to replace them with.
          </p>

          <Link
            href={ctaHref}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-base transition-all shadow-lg shadow-emerald-900/40"
          >
            Audit Your Revenue Stability
            <ArrowRight className="w-5 h-5" />
          </Link>

          <p className="text-xs text-gray-600 mt-4">
            Free to start · No credit card required · EU-based &amp; GDPR compliant
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-emerald-600 flex items-center justify-center">
              <Coffee className="w-3 h-3 text-white" />
            </div>
            <span className="text-gray-500">AffiMark</span>
          </div>
          <p>© 2026 AffiMark. Revenue intelligence for affiliate creators.</p>
          <div className="flex items-center gap-4">
            <Link href="#" className="hover:text-gray-400 transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-gray-400 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
