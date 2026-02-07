import Link from 'next/link';
import { Sparkles, Package, Store, TrendingUp } from 'lucide-react';

interface QuickAction {
    icon: React.ReactNode;
    label: string;
    description: string;
    href: string;
    color: string;
}

const quickActions: QuickAction[] = [
    {
        icon: <Sparkles className="w-5 h-5" />,
        label: 'Import Storefront',
        description: 'From Linktree or Beacons',
        href: '/onboarding/magic',
        color: 'bg-[var(--color-brand)]/20 text-[var(--color-brand-strong)]',
    },
    {
        icon: <Package className="w-5 h-5" />,
        label: 'View Products',
        description: 'Browse all imported products',
        href: '/dashboard/products',
        color: 'bg-[var(--color-success)]/20 text-[var(--color-success)]',
    },
    {
        icon: <Store className="w-5 h-5" />,
        label: 'Storefronts',
        description: 'Manage connected platforms',
        href: '/dashboard/storefronts',
        color: 'bg-[var(--color-brand)]/20 text-[var(--color-brand-strong)]',
    },
    {
        icon: <TrendingUp className="w-5 h-5" />,
        label: 'Earnings',
        description: 'Track your commissions',
        href: '/dashboard/earnings',
        color: 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]',
    },
];

export default function QuickActionsGrid() {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {quickActions.map((action) => (
                <Link
                    key={action.label}
                    href={action.href}
                    className="glass-card p-4 hover:border-white/20 transition-all group"
                >
                    <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                        {action.icon}
                    </div>
                    <h4 className="font-medium text-foreground text-sm">{action.label}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                </Link>
            ))}
        </div>
    );
}
