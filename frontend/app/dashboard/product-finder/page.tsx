import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ProductFinder from '@/components/finder/ProductFinder';

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
    <div className="h-[calc(100vh-4rem)]">
      <ProductFinder userId={user.id} />
    </div>
  );
}
