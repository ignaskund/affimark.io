import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Bookmark } from 'lucide-react';
import SavedProductsClient from './SavedProductsClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Saved Products - AffiMark',
  description: 'View and manage your saved products',
};

export default async function SavedProductsPage() {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    redirect('/sign-in');
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
          <Bookmark className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Saved Products</h1>
          <p className="text-sm text-gray-400">
            Manage your saved products and content calendar
          </p>
        </div>
      </div>

      <SavedProductsClient userId={user.id} />
    </div>
  );
}
