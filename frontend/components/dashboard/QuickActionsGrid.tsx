import Link from 'next/link';
import { ShieldCheck, Search, Settings } from 'lucide-react';

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
        icon: <ShieldCheck className="w-5 h-5" />,
        label: 'Portfolio Audit',
        description: 'Score every product for risk',
        href: '/dashboard/portfolio-audit',
        color: 'bg-gradient-to-br from-amber-500/30 to-orange-500/30 text-amber-400',
        featured: true,
    },
    {
        icon: <Search className="w-5 h-5" />,
        label: 'Find Alternatives',
        description: 'Better programs, same products',
        href: '/dashboard/product-finder',
        color: 'bg-indigo-500/20 text-indigo-400',
    },
    {
        icon: <Settings className="w-5 h-5" />,
        label: 'Edit Priorities',
        description: 'Update your product & brand priorities',
        href: '/settings',
        color: 'bg-purple-500/20 text-purple-400',
    },
];

export default function QuickActionsGrid() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {quickActions.map((action) => (
                <Link
                    key={action.label}
                    href={action.href}
                    className={`glass-card p-4 hover:border-white/20 transition-all group ${action.featured ? 'border-amber-500/30 bg-gradient-to-br from-amber-500/5 to-orange-500/5' : ''
                        }`}
                >
                    <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                        {action.icon}
                    </div>
                    <h4 className="font-medium text-foreground text-sm">{action.label}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                    {action.featured && (
                        <span className="inline-block mt-2 text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded-full">
                            ★ HERO
                        </span>
                    )}
                </Link>
            ))}
        </div>
    );
}
