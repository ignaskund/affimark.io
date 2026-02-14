import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ProductFinder from '@/components/finder/ProductFinder';
import { Sparkles, Target, Zap, MessageSquare } from 'lucide-react';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Product Finder - AffiMark',
  description: 'Find the best products to promote based on your priorities',
};

export default async function ProductFinderPage() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect('/sign-in');
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Product Finder</h1>
              <p className="text-sm text-gray-400">
                Find products that match your priorities
              </p>
            </div>
          </div>

          {/* Feature badges */}
          <div className="hidden lg:flex items-center gap-3">
            <FeatureBadge icon={Target} label="Priority-Based" />
            <FeatureBadge icon={Zap} label="Swipe to Save" />
            <FeatureBadge icon={MessageSquare} label="AI Assistant" />
          </div>
        </div>
      </div>

      {/* Main finder */}
      <div className="flex-1 overflow-hidden">
        <ProductFinder userId={user.id} />
      </div>
    </div>
  );
}

function FeatureBadge({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-800/50 border border-gray-700">
      <Icon className="w-3.5 h-3.5 text-gray-400" />
      <span className="text-xs text-gray-400">{label}</span>
    </div>
  );
}
