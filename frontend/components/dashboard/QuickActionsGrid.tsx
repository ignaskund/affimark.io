import Link from 'next/link';
import { Sparkles, Package, Store, TrendingUp, Search } from 'lucide-react';

interface QuickAction {
    icon: React.ReactNode;
    label: string;
    description: string;
    href: string;
    color: string;
    featured?: boolean;
}

const quickActions: QuickAction[] = [
    {
        icon: <Search className="w-5 h-5" />,
        label: 'Product Verifier',
        description: 'Verify products before promoting',
        href: '/dashboard/product-verifier',
        color: 'bg-gradient-to-br from-emerald-500/30 to-teal-500/30 text-emerald-400',
        featured: true,
    },
    {
        icon: <Sparkles className="w-5 h-5" />,
        label: 'Import Storefront',
        description: 'From Linktree or Beacons',
        href: '/onboarding/magic',
        color: 'bg-indigo-500/20 text-indigo-400',
    },
    {
        icon: <Package className="w-5 h-5" />,
        label: 'View Products',
        description: 'Browse all imported products',
        href: '/dashboard/products',
        color: 'bg-emerald-500/20 text-emerald-400',
    },
    {
        icon: <Store className="w-5 h-5" />,
        label: 'Storefronts',
        description: 'Manage connected platforms',
        href: '/dashboard/storefronts',
        color: 'bg-purple-500/20 text-purple-400',
    },
    {
        icon: <TrendingUp className="w-5 h-5" />,
        label: 'Earnings',
        description: 'Track your commissions',
        href: '/dashboard/earnings',
        color: 'bg-amber-500/20 text-amber-400',
    },
];

export default function QuickActionsGrid() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {quickActions.map((action) => (
                <Link
                    key={action.label}
                    href={action.href}
                    className={`glass-card p-4 hover:border-white/20 transition-all group ${action.featured ? 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-teal-500/5' : ''
                        }`}
                >
                    <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                        {action.icon}
                    </div>
                    <h4 className="font-medium text-foreground text-sm">{action.label}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                    {action.featured && (
                        <span className="inline-block mt-2 text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">
                            NEW
                        </span>
                    )}
                </Link>
            ))}
        </div>
    );
}
