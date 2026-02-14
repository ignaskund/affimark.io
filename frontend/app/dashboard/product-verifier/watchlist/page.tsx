import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import WatchlistPage from '@/components/verifier/WatchlistPage';
import { Eye, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Watchlist - Product Verifier - AffiMark',
  description: 'Monitor your products for changes in reviews, commissions, and policies',
};

export default async function WatchlistRoute() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect('/sign-in');
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Link */}
      <Link
        href="/dashboard/product-verifier"
        className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Product Verifier
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
          <Eye className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Watchlist</h1>
          <p className="text-sm text-muted-foreground">
            Monitor products for review changes, commission updates, and better alternatives
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="glass-card p-6">
        <WatchlistPage userId={user.id} />
      </div>
    </div>
  );
}
