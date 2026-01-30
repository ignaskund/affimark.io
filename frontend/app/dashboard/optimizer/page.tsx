import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SmartOptimizer from '@/components/optimizer/SmartOptimizer';
import { Sparkles, TrendingUp, Zap, HelpCircle } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function OptimizerPage() {
  const session = await auth();
  const user = session?.user;

  if (!user) {
    redirect('/sign-in');
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <span className="inline-block px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-semibold rounded-full">
              COMMISSION AGENT
            </span>
          </div>
        </div>
        <h1 className="text-3xl font-bold text-foreground">Smart Link Optimizer</h1>
        <p className="mt-2 text-muted-foreground text-lg">
          Stop using 3% links when 12% links exist
        </p>
      </div>

      {/* How It Works - Compact */}
      <div className="glass-card p-5 animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <div className="flex items-start gap-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-foreground mb-2">How it works</h3>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">1</span>
                Add your product links
              </span>
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">2</span>
                Select products to scan
              </span>
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">3</span>
                Find better-paying programs
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="glass-card p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <SmartOptimizer />
      </div>

      {/* Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: '0.15s' }}>
        <div className="p-4 rounded-xl border border-border bg-card/50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h4 className="font-medium text-foreground text-sm">Higher Rates Exist</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Amazon pays 1-3% for electronics. Brand-direct programs often pay 5-15% for the same products.
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card/50">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h4 className="font-medium text-foreground text-sm">Quick Tip</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Import all your top-performing links and scan them together to find the biggest opportunities.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center animate-fade-in" style={{ animationDelay: '0.2s' }}>
        Commission rates are estimates and may vary by region, product category, or approval status.
        Always verify current rates with the affiliate network.
      </p>
    </div>
  );
}
